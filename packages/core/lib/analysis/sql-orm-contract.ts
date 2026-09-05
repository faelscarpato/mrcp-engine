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

import { parsePrismaSchema, parseSqlDdl } from "./sql-parsers.js";
export {
  parsePrismaSchema,
  parseSqlDdl,
  mapSqlTypeToTs,
  mapPrismaTypeToTs,
} from "./sql-parsers.js";

export async function generateSqlOrmContract(
  options: SqlOrmContractOptions,
): Promise<SqlOrmContractResult> {
  const { repoUrl, schemaFilePath } = options;
  const warnings: string[] = [];

  let detectedType: "PRISMA" | "DRIZZLE" | "TYPEORM" | "SQL_DDL" | "NONE" =
    "NONE";
  let targetFile: string | undefined = schemaFilePath;
  let fileContent = "";

  if (repoUrl || schemaFilePath) {
    const url = repoUrl || "local";

    // 1. Se o caminho específico do schema foi fornecido
    if (schemaFilePath) {
      const fetched = await fetchRepoFile(url, schemaFilePath);
      if (fetched) {
        if (fetched.isCorrupted) {
          warnings.push(
            `Arquivo de schema '${schemaFilePath}' está corrompido ou ilegível.`,
          );
        }
        fileContent = fetched.content;
        targetFile = schemaFilePath;
      } else {
        warnings.push(
          `Arquivo de schema especificado '${schemaFilePath}' não foi encontrado.`,
        );
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
    else if (targetFile.includes("schema") || targetFile.includes("models"))
      detectedType = "DRIZZLE";
  }

  // 4. Se nenhum schema foi detectado ou o conteúdo é vazio
  if (detectedType === "NONE" || !fileContent.trim()) {
    return {
      schemaDetected: "NONE",
      schemaFilePath: targetFile,
      isApplicable: false,
      message:
        "Não se aplica a esse repositório: Nenhum arquivo de schema Prisma, Drizzle, TypeORM ou SQL DDL foi detectado.",
      tablesCount: 0,
      tables: [],
      generatedTypescriptInterface: "",
      warnings,
    };
  }

  // 5. Execução do parsing real de tabelas
  let tables: OrmTableContract[] = [];
  try {
    if (detectedType === "PRISMA") {
      tables = parsePrismaSchema(fileContent, targetFile);
    } else if (detectedType === "SQL_DDL") {
      tables = parseSqlDdl(fileContent, targetFile);
    } else {
      // Fallback para Drizzle/TypeORM via regex DDL/interfaces
      tables = parsePrismaSchema(fileContent, targetFile);
      if (tables.length === 0) {
        tables = parseSqlDdl(fileContent, targetFile);
      }
    }
  } catch (err: any) {
    warnings.push(
      `Falha ao realizar parse do arquivo de schema '${targetFile}': ${err.message}`,
    );
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
      warnings,
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
    warnings,
  };
}
