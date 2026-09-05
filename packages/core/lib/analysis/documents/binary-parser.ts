import zlib from "zlib";
import path from "path";
import {
  ParsedDocument,
  DocumentSection,
  DocumentFormat,
  TabularSummary,
  TabularColumn,
  DocumentQualityIssue,
  classifyCategory,
} from "./types.js";
import { extractZipEntries } from "./zip-extractor.js";

// 1. Plain Text / Notes / Logs Parser
export function parsePlainText(
  content: string,
  filePath: string,
): ParsedDocument {
  const lines = content.split(/\r?\n/);
  const sections: DocumentSection[] = [];
  const qualityIssues: DocumentQualityIssue[] = [];
  const keyTermsSet = new Set<string>();

  const isLog =
    filePath.endsWith(".log") ||
    content.includes("[INFO]") ||
    content.includes("[ERROR]") ||
    content.includes("[WARN]");

  let logSummary: ParsedDocument["logSummary"] = undefined;
  if (isLog) {
    let errorCount = 0;
    let warningCount = 0;
    const topErrors: string[] = [];
    for (const l of lines) {
      if (/ERROR|FATAL|EXCEPTION/i.test(l)) {
        errorCount++;
        if (topErrors.length < 5) topErrors.push(l.trim().slice(0, 150));
      } else if (/WARN/i.test(l)) {
        warningCount++;
      }
    }
    logSummary = {
      totalEntries: lines.filter((l) => l.trim().length > 0).length,
      errorCount,
      warningCount,
      topErrors,
    };
  }

  let currentSection: DocumentSection = {
    level: 1,
    title: path.basename(filePath),
    line: 1,
    characterCount: 0,
    wordCount: 0,
    hasContent: false,
  };
  sections.push(currentSection);

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();

    const nextLine = lines[i + 1]?.trim() || "";
    if (
      trimmed.length > 3 &&
      (nextLine.startsWith("===") || nextLine.startsWith("---"))
    ) {
      currentSection = {
        level: nextLine.startsWith("===") ? 1 : 2,
        title: trimmed,
        line: i + 1,
        characterCount: 0,
        wordCount: 0,
        hasContent: true,
      };
      sections.push(currentSection);
      i++;
      continue;
    }

    if (
      trimmed.length > 4 &&
      trimmed.length < 60 &&
      trimmed === trimmed.toUpperCase() &&
      /^[A-Z0-9\s:_-]+$/.test(trimmed)
    ) {
      currentSection = {
        level: 2,
        title: trimmed,
        line: i + 1,
        characterCount: 0,
        wordCount: 0,
        hasContent: true,
      };
      sections.push(currentSection);
      continue;
    }

    const kvMatch = trimmed.match(/^([A-Za-z0-9_]{3,30})\s*[:=]\s*(.+)$/);
    if (kvMatch) {
      keyTermsSet.add(kvMatch[1]);
    }

    const ph = trimmed.match(/\b(TODO|FIXME|TBD|LOREM IPSUM)\b/i);
    if (ph) {
      qualityIssues.push({
        severity: "INFO",
        type: "PLACEHOLDER_TEXT",
        line: i + 1,
        description: `Pendência textual encontrada: '${ph[1]}'`,
      });
    }

    if (trimmed.length > 0) {
      const words = trimmed.split(/\s+/).filter(Boolean).length;
      currentSection.wordCount += words;
      currentSection.characterCount += trimmed.length;
      currentSection.hasContent = true;
    }
  }

  const wordCount = content.split(/\s+/).filter(Boolean).length;
  const estimatedReadingMinutes = Math.max(1, Math.ceil(wordCount / 200));

  let score = 100;
  if (logSummary && logSummary.errorCount > 10) score -= 15;
  if (qualityIssues.length > 0) score -= qualityIssues.length * 2;

  return {
    path: filePath,
    filename: path.basename(filePath),
    format: isLog ? "LOG" : "PLAIN_TEXT",
    category: classifyCategory(filePath, content, isLog ? "LOG" : "PLAIN_TEXT"),
    sizeBytes: Buffer.byteLength(content, "utf-8"),
    wordCount,
    lineCount: lines.length,
    estimatedReadingMinutes,
    title: sections[0]?.title || path.basename(filePath),
    sections,
    tables: [],
    links: [],
    keyTerms: Array.from(keyTermsSet).slice(0, 20),
    logSummary,
    qualityScore: Math.max(20, Math.min(100, score)),
    qualityIssues,
    rawTextSnippet: content.slice(0, 500).replace(/[\r\n]+/g, " "),
  };
}

// 2. Structured Data Parser (JSON / YAML / XML)
export function parseStructuredData(
  content: string,
  filePath: string,
): ParsedDocument {
  const isJson = filePath.endsWith(".json") || filePath.endsWith(".jsonl");
  const isYaml = filePath.endsWith(".yaml") || filePath.endsWith(".yml");
  const isXml = filePath.endsWith(".xml");
  const format: DocumentFormat = isJson ? "JSON" : isYaml ? "YAML" : "XML";

  const sections: DocumentSection[] = [];
  const tables: TabularSummary[] = [];
  const keyTerms: string[] = [];
  const title = path.basename(filePath);

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
          hasContent: true,
        });

        if (
          Array.isArray(parsed) &&
          parsed.length > 0 &&
          typeof parsed[0] === "object"
        ) {
          const itemKeys = Object.keys(parsed[0]);
          const cols: TabularColumn[] = itemKeys.map((k) => ({
            name: k,
            inferredType: typeof parsed[0][k] === "number" ? "DECIMAL" : "TEXT",
            nullCount: 0,
            nullPercentage: 0,
            uniqueCount: parsed.length,
            sampleValues: parsed.slice(0, 5).map((it) => it[k]),
          }));
          tables.push({
            tableName: path.basename(filePath),
            delimiter: "JSON_ARRAY",
            totalRows: parsed.length,
            totalColumns: itemKeys.length,
            columns: cols,
            previewRows: parsed.slice(0, 5).map((it) => Object.values(it)),
          });
        }
      }
    } catch {
      // JSON malformado ou parcial (ex.: arquivos .jsonl); mantém demais metadados
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
    rawTextSnippet: content.slice(0, 500).replace(/[\r\n]+/g, " "),
  };
}

export { parseDocx } from "./docx-parser.js";
export { parseXlsx } from "./xlsx-parser.js";
export { parsePdfText } from "./pdf-parser.js";
