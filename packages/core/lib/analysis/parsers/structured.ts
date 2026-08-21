import path from "path";
import { classifyCategory } from "./utils.js";
import type { 
  ParsedDocument, DocumentSection, TabularSummary, TabularColumn, DocumentFormat 
} from "../document-types.js";

export function parseStructuredData(content: string, filePath: string): ParsedDocument {
  const isJson = filePath.endsWith(".json") || filePath.endsWith(".jsonl");
  const isYaml = filePath.endsWith(".yaml") || filePath.endsWith(".yml");
  const isXml = filePath.endsWith(".xml");
  const format: DocumentFormat = isJson ? "JSON" : isYaml ? "YAML" : "XML";

  const sections: DocumentSection[] = [];
  const tables: TabularSummary[] = [];
  const keyTerms: string[] = [];
  let title = path.basename(filePath);

  if (isJson) {
    try {
      const parsed = JSON.parse(content);
      if (typeof parsed === "object" && parsed !== null) {
        const keys = Object.keys(parsed);
        keyTerms.push(...keys.slice(0, 30));
        sections.push({
          level: 1,
          title: `Chaves Raiz (${keys.length})`,
          characterCount: content.length,
          wordCount: keys.length,
          hasContent: true
        });

        // If top-level array of objects, convert to tabular summary
        if (Array.isArray(parsed) && parsed.length > 0 && typeof parsed[0] === "object") {
          const itemKeys = Object.keys(parsed[0]);
          const cols: TabularColumn[] = itemKeys.map(k => ({
            name: k,
            inferredType: typeof parsed[0][k] === "number" ? "DECIMAL" : "TEXT",
            nullCount: 0,
            nullPercentage: 0,
            uniqueCount: parsed.length,
            sampleValues: parsed.slice(0, 5).map(it => it[k])
          }));
          tables.push({
            tableName: path.basename(filePath),
            delimiter: "JSON_ARRAY",
            totalRows: parsed.length,
            totalColumns: itemKeys.length,
            columns: cols,
            previewRows: parsed.slice(0, 5).map(it => Object.values(it))
          });
        }
      }
    } catch {
      // JSONL or partial JSON
    }
  }

  const wordCount = content.split(/\s+/).filter(Boolean).length;
  return {
    path: filePath,
    filename: path.basename(filePath),
    format,
    category: classifyCategory(filePath, content, format),
    sizeBytes: Buffer.byteLength(content, "utf-8"),
    wordCount,
    lineCount: content.split(/\r?\n/).length,
    estimatedReadingMinutes: Math.max(1, Math.ceil(wordCount / 300)),
    title,
    sections,
    tables,
    links: [],
    keyTerms,
    qualityScore: 95,
    qualityIssues: [],
    rawTextSnippet: content.slice(0, 500).replace(/[\r\n]+/g, " ")
  };
}
