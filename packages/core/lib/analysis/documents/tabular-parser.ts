import path from "path";
import {
  ParsedDocument,
  TabularSummary,
  TabularColumn,
  DocumentQualityIssue,
} from "./types.js";

export function parseTabular(
  content: string,
  filePath: string,
): ParsedDocument {
  const lines = content.split(/\r?\n/).filter((l) => l.trim().length > 0);
  const qualityIssues: DocumentQualityIssue[] = [];

  if (lines.length === 0) {
    return {
      path: filePath,
      filename: path.basename(filePath),
      format: filePath.endsWith(".tsv") ? "TSV" : "CSV",
      category: "TABULAR_DATASET",
      sizeBytes: 0,
      wordCount: 0,
      lineCount: 0,
      estimatedReadingMinutes: 1,
      title: path.basename(filePath),
      sections: [],
      tables: [],
      links: [],
      keyTerms: [],
      qualityScore: 20,
      qualityIssues: [
        {
          severity: "CRITICAL",
          type: "EMPTY_SECTION",
          description: "Arquivo tabular vazio.",
        },
      ],
      rawTextSnippet: "",
    };
  }

  const sample = lines.slice(0, 10).join("\n");
  const commaCount = (sample.match(/,/g) || []).length;
  const semiCount = (sample.match(/;/g) || []).length;
  const tabCount = (sample.match(/\t/g) || []).length;
  const pipeCount = (sample.match(/\|/g) || []).length;

  let delimiter = ",";
  if (filePath.endsWith(".tsv") || tabCount > commaCount) delimiter = "\t";
  else if (semiCount > commaCount) delimiter = ";";
  else if (pipeCount > commaCount) delimiter = "|";

  function tokenizeLine(line: string, delim: string): string[] {
    const result: string[] = [];
    let current = "";
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      if (char === '"') {
        if (inQuotes && line[i + 1] === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (char === delim && !inQuotes) {
        result.push(current.trim());
        current = "";
      } else {
        current += char;
      }
    }
    result.push(current.trim());
    return result;
  }

  const rawHeaders = tokenizeLine(lines[0], delimiter);
  const headers = rawHeaders.map(
    (h, i) => h.replace(/^["']|["']$/g, "").trim() || `col_${i + 1}`,
  );

  const rows: string[][] = [];
  for (let i = 1; i < lines.length; i++) {
    const row = tokenizeLine(lines[i], delimiter);
    if (row.length !== headers.length) {
      if (qualityIssues.length < 5) {
        qualityIssues.push({
          severity: "WARNING",
          type: "MALFORMED_TABLE",
          line: i + 1,
          description: `Inconsistência de colunas na linha ${i + 1}: esperado ${headers.length}, recebido ${row.length}`,
        });
      }
    }
    rows.push(row);
  }

  const columns: TabularColumn[] = headers.map((headerName, colIdx) => {
    let nullCount = 0;
    const values: any[] = [];
    let intCount = 0;
    let floatCount = 0;
    let boolCount = 0;
    let dateCount = 0;
    let emailCount = 0;
    let urlCount = 0;

    for (const r of rows) {
      const v = r[colIdx]?.trim();
      if (
        !v ||
        v === "" ||
        v === "null" ||
        v === "NULL" ||
        v === "N/A" ||
        v === "undefined"
      ) {
        nullCount++;
        continue;
      }
      values.push(v);

      if (/^-?\d+$/.test(v)) intCount++;
      else if (/^-?\d*[.,]\d+$/.test(v)) floatCount++;
      else if (/^(true|false|yes|no|sim|não|1|0)$/i.test(v)) boolCount++;
      else if (/^\d{4}-\d{2}-\d{2}/.test(v)) dateCount++;
      else if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) emailCount++;
      else if (/^https?:\/\//i.test(v)) urlCount++;
    }

    const totalValid = values.length;
    let inferredType: TabularColumn["inferredType"] = "TEXT";
    if (totalValid > 0) {
      if (intCount / totalValid > 0.8) inferredType = "INTEGER";
      else if ((intCount + floatCount) / totalValid > 0.8)
        inferredType = "DECIMAL";
      else if (boolCount / totalValid > 0.8) inferredType = "BOOLEAN";
      else if (dateCount / totalValid > 0.8) inferredType = "DATE_ISO";
      else if (emailCount / totalValid > 0.8) inferredType = "EMAIL";
      else if (urlCount / totalValid > 0.8) inferredType = "URL";
      else if (new Set(values).size < totalValid * 0.3)
        inferredType = "CATEGORICAL";
    }

    const uniqueSet = new Set(values);
    return {
      name: headerName,
      inferredType,
      nullCount,
      nullPercentage:
        rows.length > 0 ? Math.round((nullCount / rows.length) * 100) : 0,
      uniqueCount: uniqueSet.size,
      sampleValues: Array.from(uniqueSet).slice(0, 5),
    };
  });

  const interfaceName = path
    .basename(filePath, path.extname(filePath))
    .replace(/[^a-zA-Z0-9]/g, "");
  const tsProperties = columns.map((c) => {
    const propName = /^[a-zA-Z_$][a-zA-Z0-9_$]*$/.test(c.name)
      ? c.name
      : `"${c.name}"`;
    let tsType = "string";
    if (c.inferredType === "INTEGER" || c.inferredType === "DECIMAL")
      tsType = "number";
    else if (c.inferredType === "BOOLEAN") tsType = "boolean";
    else if (c.inferredType === "CATEGORICAL")
      tsType =
        c.sampleValues.map((s) => JSON.stringify(s)).join(" | ") || "string";
    const optional = c.nullCount > 0 ? "?" : "";
    return `  ${propName}${optional}: ${tsType};`;
  });
  const generatedTypeScriptSchema = `export interface ${interfaceName || "TabularRecord"} {\n${tsProperties.join("\n")}\n}`;

  const tableSummary: TabularSummary = {
    tableName: path.basename(filePath),
    delimiter,
    totalRows: rows.length,
    totalColumns: headers.length,
    columns,
    generatedTypeScriptSchema,
    previewRows: rows.slice(0, 5),
  };

  const wordCount = content.split(/\s+/).filter(Boolean).length;
  let score = 100;
  if (qualityIssues.length > 0) score -= qualityIssues.length * 5;
  if (rows.length === 0) score -= 30;

  return {
    path: filePath,
    filename: path.basename(filePath),
    format: delimiter === "\t" ? "TSV" : "CSV",
    category: "TABULAR_DATASET",
    sizeBytes: Buffer.byteLength(content, "utf-8"),
    wordCount,
    lineCount: lines.length,
    estimatedReadingMinutes: Math.max(1, Math.ceil(rows.length / 500)),
    title: `Dataset Tabular: ${path.basename(filePath)}`,
    description: `Dataset tabular contendo ${rows.length} registros e ${headers.length} colunas (${headers.slice(0, 5).join(", ")}...)`,
    sections: [
      {
        level: 1,
        title: "Estrutura e Schema da Tabela",
        characterCount: content.length,
        wordCount,
        hasContent: true,
      },
    ],
    tables: [tableSummary],
    links: [],
    keyTerms: headers.slice(0, 20),
    qualityScore: Math.max(20, Math.min(100, score)),
    qualityIssues,
    rawTextSnippet: lines.slice(0, 5).join("\n"),
  };
}
