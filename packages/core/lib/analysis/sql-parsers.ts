import {
  OrmTableContract,
  OrmColumnContract,
  OrmForeignKeyContract,
} from "./sql-orm-contract.js";

export function mapSqlTypeToTs(sqlType: string): string {
  const upper = sqlType.toUpperCase().trim();
  if (
    upper.includes("INT") ||
    upper.includes("SERIAL") ||
    upper.includes("NUMERIC") ||
    upper.includes("DECIMAL") ||
    upper.includes("FLOAT") ||
    upper.includes("DOUBLE")
  ) {
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

export function mapPrismaTypeToTs(prismaType: string): string {
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
      tsType = base;
  }

  return isArray ? `${tsType}[]` : tsType;
}

export function parsePrismaSchema(
  content: string,
  filePath: string,
): OrmTableContract[] {
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

        const relMatch = line.match(
          /@relation\([^)]*fields:\s*\[([^\]]+)\],[^)]*references:\s*\[([^\]]+)\]/,
        );
        if (relMatch) {
          foreignKeys.push({
            column: relMatch[1].trim(),
            referencedTable: colType.replace("?", "").replace("[]", ""),
            referencedColumn: relMatch[2].trim(),
          });
        }

        columns.push({
          name: colName,
          type: mapPrismaTypeToTs(colType),
          isNullable,
          isPrimaryKey,
          defaultValue: defaultMatch ? defaultMatch[1] : undefined,
        });
      }
    }

    tables.push({
      tableName: modelName,
      sourceFile: filePath,
      columns,
      foreignKeys,
    });
  }

  return tables;
}

export function parseSqlDdl(
  content: string,
  filePath: string,
): OrmTableContract[] {
  const tables: OrmTableContract[] = [];
  const tableRegex =
    /CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?["`]?([a-zA-Z0-9_]+)["`]?\s*\(([\s\S]*?)\);/gi;
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

      if (line.toUpperCase().startsWith("PRIMARY KEY")) {
        const pkMatch = line.match(/PRIMARY\s+KEY\s*\(([^)]+)\)/i);
        if (pkMatch) {
          const pkCols = pkMatch[1]
            .split(",")
            .map((c) => c.trim().replace(/["`]/g, ""));
          for (const col of columns) {
            if (pkCols.includes(col.name)) col.isPrimaryKey = true;
          }
        }
        continue;
      }

      if (
        line.toUpperCase().startsWith("FOREIGN KEY") ||
        line.toUpperCase().includes("REFERENCES")
      ) {
        const fkMatch = line.match(
          /FOREIGN\s+KEY\s*\(([^)]+)\)\s*REFERENCES\s+["`]?([a-zA-Z0-9_]+)["`]?\s*\(([^)]+)\)/i,
        );
        if (fkMatch) {
          foreignKeys.push({
            column: fkMatch[1].trim().replace(/["`]/g, ""),
            referencedTable: fkMatch[2].trim(),
            referencedColumn: fkMatch[3].trim().replace(/["`]/g, ""),
          });
        }
        continue;
      }

      const colMatch = line.match(
        /^["`]?([a-zA-Z0-9_]+)["`]?\s+([a-zA-Z0-9_]+(?:\([^)]+\))?)([\s\S]*)$/,
      );
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
          isPrimaryKey,
        });
      }
    }

    tables.push({
      tableName,
      sourceFile: filePath,
      columns,
      foreignKeys,
    });
  }

  return tables;
}
