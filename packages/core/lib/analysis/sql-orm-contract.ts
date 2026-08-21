import { fetchRepoFile, findRepoFiles } from "./repo-fetcher.js";

export interface SqlOrmContractOptions {
  repoUrl?: string;
  schemaFilePath?: string;
}

export interface OrmColumnContract {
  name: string;
  type: string;
  isNullable: boolean;
  isPrimaryKey: boolean;
  defaultValue?: string;
}

export interface OrmForeignKeyContract {
  column: string;
  referencedTable: string;
  referencedColumn: string;
}

export interface OrmTableContract {
  tableName: string;
  sourceFile?: string;
  columns: OrmColumnContract[];
  foreignKeys: OrmForeignKeyContract[];
}

export interface SqlOrmContractResult {
  schemaDetected: "PRISMA" | "DRIZZLE" | "TYPEORM" | "SQL_DDL" | "NONE";
  schemaFilePath?: string;
  isApplicable: boolean;
  message?: string;
  tablesCount: number;
  tables: OrmTableContract[];
  generatedTypescriptInterface: string;
  warnings: string[];
}

function mapSqlTypeToTs(sqlType: string): string {
  const upper = sqlType.toUpperCase().trim();
  if (upper.includes("INT") || upper.includes("SERIAL") || upper.includes("NUMERIC") || upper.includes("DECIMAL") || upper.includes("FLOAT") || upper.includes("DOUBLE")) {
    return "number";
  }
  if (upper.includes("BOOL")) {
    return "boolean";
  }
  if (upper.includes("TIME") || upper.includes("DATE")) {
    return "Date";
  }
  if (upper.includes("JSON")) {
    return "Record<string, any>";
  }
  if (upper.includes("BYTEA") || upper.includes("BLOB")) {
    return "Buffer";
  }
  return "string";
}

function mapPrismaTypeToTs(prismaType: string): string {
  const isArray = prismaType.endsWith("[]");
  const base = prismaType.replace("[]", "").replace("?", "");
  let tsType = "string";

  switch (base) {
    case "Int":
    case "Float":
      tsType = "number";
      break;
    case "BigInt":
      tsType = "bigint";
      break;
    case "Boolean":
      tsType = "boolean";
      break;
    case "DateTime":
      tsType = "Date";
      break;
    case "Json":
      tsType = "Record<string, any>";
      break;
    case "Bytes":
      tsType = "Buffer";
      break;
    case "String":
      tsType = "string";
      break;
    default:
      tsType = base; // Custom enum or relation model
  }

  return isArray ? `${tsType}[]` : tsType;
}

function parsePrismaSchema(content: string, filePath: string): OrmTableContract[] {
  const tables: OrmTableContract[] = [];
  const modelRegex = /model\s+(\w+)\s*\{([^}]+)\}/g;
  let match: RegExpExecArray | null;

  while ((match = modelRegex.exec(content)) !== null) {
    const modelName = match[1];
    const body = match[2];
    const columns: OrmColumnContract[] = [];
    const foreignKeys: OrmForeignKeyContract[] = [];

    const lines = body.split("\n");
    for (const rawLine of lines) {
      const line = rawLine.trim();
      if (!line || line.startsWith("//") || line.startsWith("@@")) continue;

      const tokens = line.split(/\s+/);
      if (tokens.length >= 2) {
        const colName = tokens[0];
        const colType = tokens[1];
        const isNullable = colType.endsWith("?");
        const isPrimaryKey = line.includes("@id");
        const defaultMatch = line.match(/@default\(([^)]+)\)/);

        // Checagem de relação (@relation)
        const relMatch = line.match(/@relation\([^)]*fields:\s*\[([^\]]+)\],[^)]*references:\s*\[([^\]]+)\]/);
        if (relMatch) {
          foreignKeys.push({
            column: relMatch[1].trim(),
            referencedTable: colType.replace("?", "").replace("[]", ""),
            referencedColumn: relMatch[2].trim()
          });
        }

        // Se o tipo for outro modelo em relação, não adicionamos como coluna primitiva pura a não ser que tenha tipo escalar
        const isScalar = ["String", "Int", "Float", "BigInt", "Boolean", "DateTime", "Json", "Bytes"].some(
          (t) => colType.startsWith(t)
        );

        columns.push({
          name: colName,
          type: mapPrismaTypeToTs(colType),
          isNullable,
          isPrimaryKey,
          defaultValue: defaultMatch ? defaultMatch[1] : undefined
        });
      }
    }

    tables.push({
      tableName: modelName,
      sourceFile: filePath,
      columns,
      foreignKeys
    });
  }

  return tables;
}

function parseSqlDdl(content: string, filePath: string): OrmTableContract[] {
  const tables: OrmTableContract[] = [];
  const tableRegex = /CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?["`]?([a-zA-Z0-9_]+)["`]?\s*\(([\s\S]*?)\);/gi;
  let match: RegExpExecArray | null;

  while ((match = tableRegex.exec(content)) !== null) {
    const tableName = match[1];
    const body = match[2];
    const columns: OrmColumnContract[] = [];
    const foreignKeys: OrmForeignKeyContract[] = [];

    const lines = body.split(/,\s*\n/);
    for (const rawLine of lines) {
      const line = rawLine.trim();
      if (!line || line.startsWith("--") || line.startsWith("/*")) continue;

      // Restrições de tabela
      if (line.toUpperCase().startsWith("PRIMARY KEY")) {
        const pkMatch = line.match(/PRIMARY\s+KEY\s*\(([^)]+)\)/i);
        if (pkMatch) {
          const pkCols = pkMatch[1].split(",").map((c) => c.trim().replace(/["`]/g, ""));
          for (const col of columns) {
            if (pkCols.includes(col.name)) col.isPrimaryKey = true;
          }
        }
        continue;
      }

      if (line.toUpperCase().startsWith("FOREIGN KEY") || line.toUpperCase().includes("REFERENCES")) {
        const fkMatch = line.match(/FOREIGN\s+KEY\s*\(([^)]+)\)\s*REFERENCES\s+["`]?([a-zA-Z0-9_]+)["`]?\s*\(([^)]+)\)/i);
        if (fkMatch) {
          foreignKeys.push({
            column: fkMatch[1].trim().replace(/["`]/g, ""),
            referencedTable: fkMatch[2].trim(),
            referencedColumn: fkMatch[3].trim().replace(/["`]/g, "")
          });
        }
        continue;
      }

      // Colunas normais
      const colMatch = line.match(/^["`]?([a-zA-Z0-9_]+)["`]?\s+([a-zA-Z0-9_]+(?:\([^)]+\))?)([\s\S]*)$/);
      if (colMatch) {
        const colName = colMatch[1];
        const sqlType = colMatch[2];
        const rest = colMatch[3].toUpperCase();

        const isPrimaryKey = rest.includes("PRIMARY KEY");
        const isNullable = !rest.includes("NOT NULL") && !isPrimaryKey;

        columns.push({
          name: colName,
          type: mapSqlTypeToTs(sqlType),
          isNullable,
          isPrimaryKey
        });
      }
    }

    tables.push({
      tableName,
      sourceFile: filePath,
      columns,
      foreignKeys
    });
  }

  return tables;
}

export async function generateSqlOrmContract(options: SqlOrmContractOptions): Promise<SqlOrmContractResult> {
  const { repoUrl, schemaFilePath } = options;
  const warnings: string[] = [];

  let detectedType: "PRISMA" | "DRIZZLE" | "TYPEORM" | "SQL_DDL" | "NONE" = "NONE";
  let targetFile: string | undefined = schemaFilePath;
  let fileContent = "";

  if (repoUrl || schemaFilePath) {
    const url = repoUrl || "local";

    // 1. Se o caminho específico do schema foi fornecido
    if (schemaFilePath) {
      const fetched = await fetchRepoFile(url, schemaFilePath);
      if (fetched) {
        if (fetched.isCorrupted) {
          warnings.push(`Arquivo de schema '${schemaFilePath}' está corrompido ou ilegível.`);
        }
        fileContent = fetched.content;
        targetFile = schemaFilePath;
      } else {
        warnings.push(`Arquivo de schema especificado '${schemaFilePath}' não foi encontrado.`);
      }
    }

    // 2. Busca automática por arquivos de schema no repositório caso não tenha sido especificado
    if (!fileContent && repoUrl) {
      const candidates = await findRepoFiles(repoUrl, (p) => {
        const lower = p.toLowerCase();
        return (
          lower.endsWith(".prisma") ||
          lower.endsWith(".sql") ||
          lower.includes("schema.ts") ||
          lower.includes("models.ts") ||
          lower.endsWith(".entity.ts")
        );
      });

      if (candidates.length > 0) {
        // Prioriza prisma, depois sql, depois drizzle/ts
        const prismaFile = candidates.find((c) => c.endsWith(".prisma"));
        const sqlFile = candidates.find((c) => c.endsWith(".sql"));
        const tsSchemaFile = candidates[0];

        const chosen = prismaFile || sqlFile || tsSchemaFile;
        const fetched = await fetchRepoFile(repoUrl, chosen);
        if (fetched) {
          if (fetched.isCorrupted) {
            warnings.push(`Arquivo de schema '${chosen}' está corrompido.`);
          }
          fileContent = fetched.content;
          targetFile = chosen;
        }
      }
    }
  }

  // 3. Detecção do tipo de schema
  if (targetFile) {
    if (targetFile.endsWith(".prisma")) detectedType = "PRISMA";
    else if (targetFile.endsWith(".sql")) detectedType = "SQL_DDL";
    else if (targetFile.includes(".entity.ts")) detectedType = "TYPEORM";
    else if (targetFile.includes("schema") || targetFile.includes("models")) detectedType = "DRIZZLE";
  }

  // 4. Se nenhum schema foi detectado ou o conteúdo é vazio
  if (detectedType === "NONE" || !fileContent.trim()) {
    return {
      schemaDetected: "NONE",
      schemaFilePath: targetFile,
      isApplicable: false,
      message: "Não se aplica a esse repositório: Nenhum arquivo de schema Prisma, Drizzle, TypeORM ou SQL DDL foi detectado.",
      tablesCount: 0,
      tables: [],
      generatedTypescriptInterface: "",
      warnings
    };
  }

  // 5. Execução do parsing real de tabelas
  let tables: OrmTableContract[] = [];
  try {
    const safeContent = fileContent || "";
    const safeTarget = targetFile || "unknown";
    if (detectedType === "PRISMA") {
      tables = parsePrismaSchema(safeContent, safeTarget);
    } else if (detectedType === "SQL_DDL") {
      tables = parseSqlDdl(safeContent, safeTarget);
    } else {
      // Fallback para Drizzle/TypeORM via regex DDL/interfaces
      tables = parsePrismaSchema(safeContent, safeTarget);
      if (tables.length === 0) {
        tables = parseSqlDdl(safeContent, safeTarget);
      }
    }
  } catch (err: any) {
    warnings.push(`Falha ao realizar parse do arquivo de schema '${targetFile}': ${err.message}`);
  }

  if (tables.length === 0) {
    return {
      schemaDetected: detectedType,
      schemaFilePath: targetFile,
      isApplicable: false,
      message: `Não se aplica: O arquivo '${targetFile}' foi identificado como ${detectedType}, mas nenhuma tabela ou modelo pôde ser extraído.`,
      tablesCount: 0,
      tables: [],
      generatedTypescriptInterface: "",
      warnings
    };
  }

  // 6. Geração de interfaces TypeScript reais
  const interfaces = tables
    .map((t) => {
      const fields = t.columns
        .map((c) => `  ${c.name}${c.isNullable ? "?" : ""}: ${c.type};`)
        .join("\n");
      return `export interface ${t.tableName} {\n${fields}\n}`;
    })
    .join("\n\n");

  return {
    schemaDetected: detectedType,
    schemaFilePath: targetFile,
    isApplicable: true,
    tablesCount: tables.length,
    tables,
    generatedTypescriptInterface: interfaces,
    warnings
  };
}
