import zlib from "zlib";
import path from "path";
import { findRepoFiles, fetchRepoFile, fetchRepoBuffer, FetchedFile } from "./repo-fetcher.js";
import { parseTargetUrl } from "./pipeline.js";

export type DocumentCategory =
  | "TECHNICAL_DOCUMENTATION"
  | "API_SPECIFICATION"
  | "TABULAR_DATASET"
  | "PROJECT_MANAGEMENT_NOTES"
  | "LEGAL_OR_POLICY"
  | "RESEARCH_OR_ACADEMIC"
  | "SYSTEM_LOGS"
  | "CONFIGURATION_DATA"
  | "GENERAL_DOCUMENT";

export type DocumentFormat =
  | "MARKDOWN"
  | "CSV"
  | "TSV"
  | "PLAIN_TEXT"
  | "DOCX"
  | "XLSX"
  | "XLS"
  | "PDF"
  | "JSON"
  | "YAML"
  | "XML"
  | "LOG"
  | "RTF";

export interface DocumentSection {
  level: number;
  title: string;
  line?: number;
  characterCount: number;
  wordCount: number;
  hasContent: boolean;
  subsections?: DocumentSection[];
}

export interface TabularColumn {
  name: string;
  inferredType: "INTEGER" | "DECIMAL" | "BOOLEAN" | "DATE_ISO" | "EMAIL" | "URL" | "CATEGORICAL" | "TEXT";
  nullCount: number;
  nullPercentage: number;
  uniqueCount: number;
  sampleValues: any[];
  min?: number | string;
  max?: number | string;
}

export interface TabularSummary {
  tableName: string;
  delimiter: string;
  totalRows: number;
  totalColumns: number;
  columns: TabularColumn[];
  generatedTypeScriptSchema?: string;
  generatedJsonSchema?: any;
  previewRows: any[][];
}

export interface DocumentLink {
  label: string;
  url: string;
  isExternal: boolean;
  isAnchor: boolean;
  isBrokenRelative?: boolean;
}

export interface DocumentQualityIssue {
  severity: "CRITICAL" | "WARNING" | "INFO";
  type: "BROKEN_LINK" | "PLACEHOLDER_TEXT" | "EMPTY_SECTION" | "MALFORMED_TABLE" | "CORRUPTED_FILE" | "LOW_READABILITY";
  line?: number;
  description: string;
  snippet?: string;
}

export interface ParsedDocument {
  path: string;
  filename: string;
  format: DocumentFormat;
  category: DocumentCategory;
  sizeBytes: number;
  wordCount: number;
  lineCount: number;
  estimatedReadingMinutes: number;
  title: string;
  description?: string;
  sections: DocumentSection[];
  tables: TabularSummary[];
  links: DocumentLink[];
  keyTerms: string[];
  tasks?: { total: number; completed: number; pending: number };
  codeSnippetsCount?: number;
  logSummary?: { totalEntries: number; errorCount: number; warningCount: number; topErrors: string[] };
  qualityScore: number; // 0-100
  qualityIssues: DocumentQualityIssue[];
  rawTextSnippet: string;
}

export interface DocumentKnowledgeGraph {
  nodes: Array<{
    id: string;
    label: string;
    kind: "document" | "section" | "table" | "topic" | "entity";
    group: string;
    format?: DocumentFormat;
    category?: DocumentCategory;
    metrics?: Record<string, any>;
  }>;
  edges: Array<{
    from: string;
    to: string;
    type: "CONTAINS" | "REFERENCES_DOC" | "DEFINES_ENTITY" | "MENTIONS_TOPIC" | "SUBSECTION_OF";
    label?: string;
  }>;
}

export interface DocumentRepositoryAnalysis {
  analyzedUrl: string;
  timestamp: string;
  engineVersion: string;
  isDocumentRepository: boolean;
  totalDocumentsAnalyzed: number;
  totalWords: number;
  totalTables: number;
  formatsDistribution: Record<DocumentFormat, number>;
  categoriesDistribution: Record<DocumentCategory, number>;
  documentQualityIndex: {
    overallScore: number; // 0-100
    letterGrade: "A+" | "A" | "B" | "C" | "D" | "F";
    totalIssues: number;
    criticalIssues: number;
    warnings: number;
    summary: string;
  };
  knowledgeGraph: DocumentKnowledgeGraph;
  masterKnowledgeIndex: Array<{
    filePath: string;
    title: string;
    format: DocumentFormat;
    category: DocumentCategory;
    wordCount: number;
    readingMinutes: number;
    qualityScore: number;
    mainTopics: string[];
    schemaOrTables?: string[];
  }>;
  documents: ParsedDocument[];
  llmQueryDirectives: {
    systemDirective: string;
    recommendedLookupPaths: Record<string, string[]>;
    glossary: Record<string, string>;
  };
}

// ─── Pure JS Zip Extractor (for DOCX & XLSX) ───────────────────────────────────

function extractZipEntries(buffer: Buffer): Map<string, Buffer> {
  const files = new Map<string, Buffer>();
  try {
    let offset = 0;
    while (offset < buffer.length - 4) {
      const signature = buffer.readUInt32LE(offset);
      // Local File Header Signature: 0x04034b50 (PK\x03\x04)
      if (signature !== 0x04034b50) {
        offset++;
        continue;
      }

      const compressionMethod = buffer.readUInt16LE(offset + 8);
      const compressedSize = buffer.readUInt32LE(offset + 18);
      const uncompressedSize = buffer.readUInt32LE(offset + 22);
      const filenameLength = buffer.readUInt16LE(offset + 26);
      const extraFieldLength = buffer.readUInt16LE(offset + 28);

      const filename = buffer.toString("utf-8", offset + 30, offset + 30 + filenameLength);
      const dataOffset = offset + 30 + filenameLength + extraFieldLength;

      if (dataOffset + compressedSize <= buffer.length) {
        const compressedData = buffer.subarray(dataOffset, dataOffset + compressedSize);
        try {
          if (compressionMethod === 0) {
            files.set(filename, compressedData);
          } else if (compressionMethod === 8) {
            const decompressed = zlib.inflateRawSync(compressedData);
            files.set(filename, decompressed);
          }
        } catch {
          // Decompression error for this entry
        }
      }

      offset = dataOffset + compressedSize;
    }
  } catch {
    // Zip parse error
  }
  return files;
}

// ─── Document Category Classifier ──────────────────────────────────────────────

function classifyCategory(filePath: string, content: string, format: DocumentFormat): DocumentCategory {
  const p = filePath.toLowerCase();
  const c = content.toLowerCase();

  if (format === "CSV" || format === "TSV" || format === "XLSX" || format === "XLS") {
    return "TABULAR_DATASET";
  }
  if (format === "LOG" || p.includes("log") || c.includes("[error]") || c.includes("[info]")) {
    return "SYSTEM_LOGS";
  }
  if (p.includes("api") || p.includes("swagger") || p.includes("openapi") || c.includes("endpoints") || c.includes("curl http")) {
    return "API_SPECIFICATION";
  }
  if (p.includes("license") || p.includes("terms") || p.includes("privacy") || p.includes("compliance") || p.includes("gdpr") || c.includes("copyright")) {
    return "LEGAL_OR_POLICY";
  }
  if (p.includes("paper") || p.includes("thesis") || p.includes("research") || p.includes("study") || c.includes("abstract\n") || c.includes("methodology")) {
    return "RESEARCH_OR_ACADEMIC";
  }
  if (p.includes("todo") || p.includes("meeting") || p.includes("roadmap") || p.includes("sprint") || p.includes("minutes") || p.includes("changelog")) {
    return "PROJECT_MANAGEMENT_NOTES";
  }
  if (format === "JSON" || format === "YAML" || format === "XML" || p.includes("config") || p.includes(".env")) {
    return "CONFIGURATION_DATA";
  }
  if (p.includes("guide") || p.includes("doc") || p.includes("readme") || p.includes("manual") || p.includes("arch") || p.includes("spec")) {
    return "TECHNICAL_DOCUMENTATION";
  }
  return "GENERAL_DOCUMENT";
}

// ─── Format Parsers ────────────────────────────────────────────────────────────

// 1. Markdown Parser
export function parseMarkdown(content: string, filePath: string, allFilePaths: string[] = []): ParsedDocument {
  const lines = content.split(/\r?\n/);
  const sections: DocumentSection[] = [];
  const links: DocumentLink[] = [];
  const tables: TabularSummary[] = [];
  const qualityIssues: DocumentQualityIssue[] = [];
  const keyTermsSet = new Set<string>();

  let title = path.basename(filePath, path.extname(filePath));
  let description = "";
  let currentSection: DocumentSection | null = null;
  let codeSnippetsCount = 0;
  let tasks = { total: 0, completed: 0, pending: 0 };

  // Parse YAML Frontmatter
  let inFrontmatter = false;
  let frontmatterLines: string[] = [];
  let contentStartIndex = 0;

  if (lines[0]?.trim() === "---") {
    inFrontmatter = true;
    for (let i = 1; i < lines.length; i++) {
      if (lines[i].trim() === "---") {
        inFrontmatter = false;
        contentStartIndex = i + 1;
        break;
      }
      frontmatterLines.push(lines[i]);
    }
  }

  for (const fLine of frontmatterLines) {
    const mTitle = fLine.match(/^title:\s*["']?([^"'\r\n]+)["']?/i);
    if (mTitle) title = mTitle[1].trim();
    const mDesc = fLine.match(/^description:\s*["']?([^"'\r\n]+)["']?/i);
    if (mDesc) description = mDesc[1].trim();
  }

  // Parse Headings, Sections, Links, Tables, Quality issues
  let inCodeBlock = false;
  let tableBuffer: string[] = [];

  for (let i = contentStartIndex; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();

    // Code blocks
    if (trimmed.startsWith("```")) {
      inCodeBlock = !inCodeBlock;
      if (inCodeBlock) codeSnippetsCount++;
      continue;
    }
    if (inCodeBlock) continue;

    // Check for quality placeholder issues
    const placeholderMatch = trimmed.match(/\b(TODO|FIXME|TBD|LOREM IPSUM|PLACEHOLDER|XXX)\b/i);
    if (placeholderMatch && !trimmed.startsWith("- [ ]")) {
      qualityIssues.push({
        severity: "INFO",
        type: "PLACEHOLDER_TEXT",
        line: i + 1,
        description: `Texto de rascunho ou pendência detectado: '${placeholderMatch[1]}'`,
        snippet: trimmed.slice(0, 100)
      });
    }

    // Tasks / Checklists
    if (trimmed.match(/^[-*]\s*\[([ xX])\]/)) {
      tasks.total++;
      if (trimmed.includes("[x]") || trimmed.includes("[X]")) {
        tasks.completed++;
      } else {
        tasks.pending++;
      }
    }

    // Markdown Links
    const linkRegex = /\[([^\]]+)\]\(([^)]+)\)/g;
    let match;
    while ((match = linkRegex.exec(line)) !== null) {
      const label = match[1];
      const url = match[2];
      const isExternal = url.startsWith("http://") || url.startsWith("https://");
      const isAnchor = url.startsWith("#");
      let isBrokenRelative = false;

      if (!isExternal && !isAnchor && allFilePaths.length > 0) {
        const cleanUrl = url.split("?")[0].split("#")[0];
        const normalizedTarget = cleanUrl.replace(/^\.\//, "");
        const dir = path.dirname(filePath);
        const resolvedPath = path.posix.normalize(dir === "." ? normalizedTarget : `${dir}/${normalizedTarget}`);
        const exists = allFilePaths.some(
          p => p === resolvedPath || p === normalizedTarget || p.endsWith("/" + normalizedTarget) || p.endsWith(normalizedTarget)
        );
        if (!exists) {
          isBrokenRelative = true;
          qualityIssues.push({
            severity: "WARNING",
            type: "BROKEN_LINK",
            line: i + 1,
            description: `Link relativo potencialmente quebrado: '${url}'`,
            snippet: line.trim()
          });
        }
      }

      links.push({ label, url, isExternal, isAnchor, isBrokenRelative });
    }

    // Key concepts / definitions: **Concept** or **Concept:** or **Concept**:
    const boldRegex = /\*\*([A-Za-z0-9_\-\s:]{3,50})\*\*/g;
    let bMatch;
    while ((bMatch = boldRegex.exec(line)) !== null) {
      const term = bMatch[1].replace(/[:\-]+$/, "").trim();
      if (term.length >= 3 && term.length <= 40 && !/^(TODO|FIXME|NOTE|WARNING|IMPORTANT|TIP)$/i.test(term)) {
        keyTermsSet.add(term);
      }
    }

    // Headings
    const headingMatch = line.match(/^(#{1,6})\s+(.+)$/);
    if (headingMatch) {
      const level = headingMatch[1].length;
      const hTitle = headingMatch[2].trim().replace(/\*\*/g, "");

      if (level === 1 && (!title || title === path.basename(filePath, path.extname(filePath)))) {
        title = hTitle;
      }

      if (currentSection && currentSection.wordCount === 0) {
        qualityIssues.push({
          severity: "WARNING",
          type: "EMPTY_SECTION",
          line: currentSection.line,
          description: `Seção vazia sem conteúdo textual: '${currentSection.title}'`
        });
      }

      currentSection = {
        level,
        title: hTitle,
        line: i + 1,
        characterCount: 0,
        wordCount: 0,
        hasContent: false
      };
      sections.push(currentSection);
      continue;
    }

    // Markdown Table Detection
    if (trimmed.startsWith("|") && trimmed.endsWith("|")) {
      tableBuffer.push(trimmed);
    } else {
      if (tableBuffer.length >= 2) {
        const parsedTbl = parseMarkdownTable(tableBuffer, `Tabela Linha ${i - tableBuffer.length + 1}`);
        if (parsedTbl) tables.push(parsedTbl);
      }
      tableBuffer = [];
    }

    // Section character and word count tracking
    if (currentSection && trimmed.length > 0) {
      const words = trimmed.split(/\s+/).filter(Boolean).length;
      currentSection.wordCount += words;
      currentSection.characterCount += trimmed.length;
      currentSection.hasContent = true;
    }
  }

  if (tableBuffer.length >= 2) {
    const parsedTbl = parseMarkdownTable(tableBuffer, `Tabela Final`);
    if (parsedTbl) tables.push(parsedTbl);
  }

  const wordsAll = content.split(/\s+/).filter(Boolean).length;
  const wordCount = wordsAll;
  const lineCount = lines.length;
  const estimatedReadingMinutes = Math.max(1, Math.ceil(wordCount / 200));

  // Compute Quality Score
  let score = 100;
  for (const q of qualityIssues) {
    if (q.severity === "CRITICAL") score -= 25;
    else if (q.severity === "WARNING") score -= 10;
    else if (q.severity === "INFO") score -= 2;
  }
  const qualityScore = Math.max(10, Math.min(100, score));

  return {
    path: filePath,
    filename: path.basename(filePath),
    format: "MARKDOWN",
    category: classifyCategory(filePath, content, "MARKDOWN"),
    sizeBytes: Buffer.byteLength(content, "utf-8"),
    wordCount,
    lineCount,
    estimatedReadingMinutes,
    title,
    description: description || (sections[0]?.title ? `Documentação cobrindo ${sections[0].title}` : ""),
    sections,
    tables,
    links,
    keyTerms: Array.from(keyTermsSet).slice(0, 25),
    tasks: tasks.total > 0 ? tasks : undefined,
    codeSnippetsCount,
    qualityScore,
    qualityIssues,
    rawTextSnippet: content.slice(0, 500).replace(/[\r\n]+/g, " ")
  };
}

function parseMarkdownTable(lines: string[], name: string): TabularSummary | null {
  try {
    const headerLine = lines[0];
    const headers = headerLine
      .split("|")
      .slice(1, -1)
      .map(h => h.trim())
      .filter(Boolean);

    if (headers.length === 0) return null;

    const dataLines = lines.slice(2); // skip header and delimiter row
    const previewRows: any[][] = [];

    for (const dLine of dataLines.slice(0, 5)) {
      const cells = dLine
        .split("|")
        .slice(1, -1)
        .map(c => c.trim());
      previewRows.push(cells);
    }

    const columns: TabularColumn[] = headers.map((h, colIdx) => {
      let numericCount = 0;
      let nonNull = 0;
      for (const dLine of dataLines) {
        const val = dLine.split("|").slice(1, -1)[colIdx]?.trim();
        if (val && val !== "-") {
          nonNull++;
          if (!isNaN(Number(val.replace(",", ".")))) numericCount++;
        }
      }
      const isNum = nonNull > 0 && numericCount / nonNull > 0.8;
      return {
        name: h,
        inferredType: isNum ? "DECIMAL" : "TEXT",
        nullCount: dataLines.length - nonNull,
        nullPercentage: dataLines.length > 0 ? Math.round(((dataLines.length - nonNull) / dataLines.length) * 100) : 0,
        uniqueCount: nonNull,
        sampleValues: previewRows.map(r => r[colIdx]).filter(Boolean)
      };
    });

    return {
      tableName: name,
      delimiter: "|",
      totalRows: dataLines.length,
      totalColumns: headers.length,
      columns,
      previewRows
    };
  } catch {
    return null;
  }
}

// 2. Tabular Parser (CSV / TSV / PSV)
export function parseTabular(content: string, filePath: string): ParsedDocument {
  const lines = content.split(/\r?\n/).filter(l => l.trim().length > 0);
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
      qualityIssues: [{ severity: "CRITICAL", type: "EMPTY_SECTION", description: "Arquivo tabular vazio." }],
      rawTextSnippet: ""
    };
  }

  // Detect delimiter
  const sample = lines.slice(0, 10).join("\n");
  const commaCount = (sample.match(/,/g) || []).length;
  const semiCount = (sample.match(/;/g) || []).length;
  const tabCount = (sample.match(/\t/g) || []).length;
  const pipeCount = (sample.match(/\|/g) || []).length;

  let delimiter = ",";
  if (filePath.endsWith(".tsv") || tabCount > commaCount) delimiter = "\t";
  else if (semiCount > commaCount) delimiter = ";";
  else if (pipeCount > commaCount) delimiter = "|";

  // Simple RFC 4180 CSV tokenizer
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
  const headers = rawHeaders.map((h, i) => h.replace(/^["']|["']$/g, "").trim() || `col_${i + 1}`);

  const rows: string[][] = [];
  for (let i = 1; i < lines.length; i++) {
    const row = tokenizeLine(lines[i], delimiter);
    if (row.length !== headers.length) {
      if (qualityIssues.length < 5) {
        qualityIssues.push({
          severity: "WARNING",
          type: "MALFORMED_TABLE",
          line: i + 1,
          description: `Inconsistência de colunas na linha ${i + 1}: esperado ${headers.length}, recebido ${row.length}`
        });
      }
    }
    rows.push(row);
  }

  // Type inference and summary per column
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
      if (!v || v === "" || v === "null" || v === "NULL" || v === "N/A" || v === "undefined") {
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
      else if ((intCount + floatCount) / totalValid > 0.8) inferredType = "DECIMAL";
      else if (boolCount / totalValid > 0.8) inferredType = "BOOLEAN";
      else if (dateCount / totalValid > 0.8) inferredType = "DATE_ISO";
      else if (emailCount / totalValid > 0.8) inferredType = "EMAIL";
      else if (urlCount / totalValid > 0.8) inferredType = "URL";
      else if (new Set(values).size < totalValid * 0.3) inferredType = "CATEGORICAL";
    }

    const uniqueSet = new Set(values);
    return {
      name: headerName,
      inferredType,
      nullCount,
      nullPercentage: rows.length > 0 ? Math.round((nullCount / rows.length) * 100) : 0,
      uniqueCount: uniqueSet.size,
      sampleValues: Array.from(uniqueSet).slice(0, 5)
    };
  });

  // Generate TypeScript Interface
  const interfaceName = path.basename(filePath, path.extname(filePath)).replace(/[^a-zA-Z0-9]/g, "");
  const tsProperties = columns.map(c => {
    const propName = /^[a-zA-Z_$][a-zA-Z0-9_$]*$/.test(c.name) ? c.name : `"${c.name}"`;
    let tsType = "string";
    if (c.inferredType === "INTEGER" || c.inferredType === "DECIMAL") tsType = "number";
    else if (c.inferredType === "BOOLEAN") tsType = "boolean";
    else if (c.inferredType === "CATEGORICAL") tsType = c.sampleValues.map(s => JSON.stringify(s)).join(" | ") || "string";
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
    previewRows: rows.slice(0, 5)
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
        hasContent: true
      }
    ],
    tables: [tableSummary],
    links: [],
    keyTerms: headers.slice(0, 20),
    qualityScore: Math.max(20, Math.min(100, score)),
    qualityIssues,
    rawTextSnippet: lines.slice(0, 5).join("\n")
  };
}

// 3. Plain Text / Notes / Logs Parser
export function parsePlainText(content: string, filePath: string): ParsedDocument {
  const lines = content.split(/\r?\n/);
  const sections: DocumentSection[] = [];
  const qualityIssues: DocumentQualityIssue[] = [];
  const keyTermsSet = new Set<string>();

  const isLog = filePath.endsWith(".log") || content.includes("[INFO]") || content.includes("[ERROR]") || content.includes("[WARN]");

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
      totalEntries: lines.filter(l => l.trim().length > 0).length,
      errorCount,
      warningCount,
      topErrors
    };
  }

  // Detect Sections in plain text (Lines followed by underlines or ALL CAPS lines)
  let currentSection: DocumentSection = {
    level: 1,
    title: path.basename(filePath),
    line: 1,
    characterCount: 0,
    wordCount: 0,
    hasContent: false
  };
  sections.push(currentSection);

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();

    // Check for Underlined Headings (e.g. === or ---)
    const nextLine = lines[i + 1]?.trim() || "";
    if (trimmed.length > 3 && (nextLine.startsWith("===") || nextLine.startsWith("---"))) {
      currentSection = {
        level: nextLine.startsWith("===") ? 1 : 2,
        title: trimmed,
        line: i + 1,
        characterCount: 0,
        wordCount: 0,
        hasContent: true
      };
      sections.push(currentSection);
      i++; // skip underline
      continue;
    }

    // Capitalized short titles (e.g. "SECTION 1: INTRODUCTION")
    if (trimmed.length > 4 && trimmed.length < 60 && trimmed === trimmed.toUpperCase() && /^[A-Z0-9\s:_-]+$/.test(trimmed)) {
      currentSection = {
        level: 2,
        title: trimmed,
        line: i + 1,
        characterCount: 0,
        wordCount: 0,
        hasContent: true
      };
      sections.push(currentSection);
      continue;
    }

    // Key concepts / Key-values
    const kvMatch = trimmed.match(/^([A-Za-z0-9_]{3,30})\s*[:=]\s*(.+)$/);
    if (kvMatch) {
      keyTermsSet.add(kvMatch[1]);
    }

    // Placeholder alerts
    const ph = trimmed.match(/\b(TODO|FIXME|TBD|LOREM IPSUM)\b/i);
    if (ph) {
      qualityIssues.push({
        severity: "INFO",
        type: "PLACEHOLDER_TEXT",
        line: i + 1,
        description: `Pendência textual encontrada: '${ph[1]}'`
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
    rawTextSnippet: content.slice(0, 500).replace(/[\r\n]+/g, " ")
  };
}

// 4. Structured Data Parser (JSON / YAML / XML)
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

// 5. DOCX Document Parser (Pure JS)
export function parseDocx(buffer: Buffer, filePath: string): ParsedDocument {
  const entries = extractZipEntries(buffer);
  const docXml = entries.get("word/document.xml")?.toString("utf-8") || "";
  const coreXml = entries.get("docProps/core.xml")?.toString("utf-8") || "";

  let title = path.basename(filePath, ".docx");
  const titleMatch = coreXml.match(/<dc:title>([^<]+)<\/dc:title>/i);
  if (titleMatch) title = titleMatch[1];

  const sections: DocumentSection[] = [];
  const tables: TabularSummary[] = [];
  const textRuns: string[] = [];

  // Extract paragraphs <w:p>
  const paragraphRegex = /<w:p(?:\s[^>]*)?>([\s\S]*?)<\/w:p>/gi;
  let pMatch;
  let currentSection: DocumentSection | null = null;

  while ((pMatch = paragraphRegex.exec(docXml)) !== null) {
    const pContent = pMatch[1];
    const tMatches = pContent.match(/<w:t(?:\s[^>]*)?>([^<]*)<\/w:t>/gi) || [];
    const pText = tMatches.map(t => t.replace(/<[^>]+>/g, "")).join("").trim();

    if (!pText) continue;
    textRuns.push(pText);

    // Detect heading styles <w:pStyle w:val="Heading1"/> or bold short lines
    const isHeading = /<w:pStyle\s+[^>]*w:val="Heading(\d)"/i.test(pContent) || (/<w:b\/>/.test(pContent) && pText.length < 80);
    if (isHeading) {
      currentSection = {
        level: 2,
        title: pText,
        characterCount: 0,
        wordCount: 0,
        hasContent: true
      };
      sections.push(currentSection);
    } else if (currentSection) {
      currentSection.wordCount += pText.split(/\s+/).length;
      currentSection.characterCount += pText.length;
    }
  }

  // Extract Tables <w:tbl>
  const tableRegex = /<w:tbl(?:\s[^>]*)?>([\s\S]*?)<\/w:tbl>/gi;
  let tblMatch;
  let tblIdx = 1;
  while ((tblMatch = tableRegex.exec(docXml)) !== null) {
    const tblContent = tblMatch[1];
    const rowMatches = tblContent.match(/<w:tr(?:\s[^>]*)?>([\s\S]*?)<\/w:tr>/gi) || [];
    const tblRows: string[][] = [];

    for (const rXml of rowMatches) {
      const cellMatches = rXml.match(/<w:tc(?:\s[^>]*)?>([\s\S]*?)<\/w:tc>/gi) || [];
      const rowData = cellMatches.map(cXml => {
        const ts = cXml.match(/<w:t(?:\s[^>]*)?>([^<]*)<\/w:t>/gi) || [];
        return ts.map(t => t.replace(/<[^>]+>/g, "")).join("").trim();
      });
      if (rowData.length > 0) tblRows.push(rowData);
    }

    if (tblRows.length >= 2) {
      const headers = tblRows[0].map((h, i) => h || `Col ${i + 1}`);
      tables.push({
        tableName: `Tabela ${tblIdx++}`,
        delimiter: "DOCX_TABLE",
        totalRows: tblRows.length - 1,
        totalColumns: headers.length,
        columns: headers.map(h => ({
          name: h,
          inferredType: "TEXT",
          nullCount: 0,
          nullPercentage: 0,
          uniqueCount: tblRows.length - 1,
          sampleValues: tblRows.slice(1, 4).map(r => r[headers.indexOf(h)])
        })),
        previewRows: tblRows.slice(1, 6)
      });
    }
  }

  const fullText = textRuns.join("\n");
  const wordCount = fullText.split(/\s+/).filter(Boolean).length;
  const lineCount = textRuns.length;

  return {
    path: filePath,
    filename: path.basename(filePath),
    format: "DOCX",
    category: classifyCategory(filePath, fullText, "DOCX"),
    sizeBytes: buffer.length,
    wordCount,
    lineCount,
    estimatedReadingMinutes: Math.max(1, Math.ceil(wordCount / 200)),
    title,
    sections,
    tables,
    links: [],
    keyTerms: sections.map(s => s.title).slice(0, 15),
    qualityScore: 90,
    qualityIssues: [],
    rawTextSnippet: fullText.slice(0, 500).replace(/[\r\n]+/g, " ")
  };
}

// 6. XLSX Excel Spreadsheet Parser (Pure JS)
export function parseXlsx(buffer: Buffer, filePath: string): ParsedDocument {
  const entries = extractZipEntries(buffer);
  const sharedStringsXml = entries.get("xl/sharedStrings.xml")?.toString("utf-8") || "";
  const workbookXml = entries.get("xl/workbook.xml")?.toString("utf-8") || "";

  // 1. Shared Strings Table
  const sharedStrings: string[] = [];
  const siRegex = /<si(?:\s[^>]*)?>([\s\S]*?)<\/si>/gi;
  let siMatch;
  while ((siMatch = siRegex.exec(sharedStringsXml)) !== null) {
    const tMatches = siMatch[1].match(/<t(?:\s[^>]*)?>([^<]*)<\/t>/gi) || [];
    sharedStrings.push(tMatches.map(t => t.replace(/<[^>]+>/g, "")).join(""));
  }

  // 2. Sheet Names
  const sheetNames: string[] = [];
  const sheetRegex = /<sheet\s+[^>]*name="([^"]+)"/gi;
  let sMatch;
  while ((sMatch = sheetRegex.exec(workbookXml)) !== null) {
    sheetNames.push(sMatch[1]);
  }

  const tables: TabularSummary[] = [];
  let totalRowsCount = 0;

  // 3. Parse Worksheet XMLs
  for (let i = 1; i <= Math.max(1, sheetNames.length); i++) {
    const sheetXml = entries.get(`xl/worksheets/sheet${i}.xml`)?.toString("utf-8");
    if (!sheetXml) continue;

    const sheetName = sheetNames[i - 1] || `Sheet${i}`;
    const rowMatches = sheetXml.match(/<row\s+[^>]*>([\s\S]*?)<\/row>/gi) || [];
    const parsedRows: string[][] = [];

    for (const rXml of rowMatches) {
      const cellMatches = rXml.match(/<c\s+[^>]*>([\s\S]*?)<\/c>/gi) || [];
      const rowCells: string[] = [];
      for (const cXml of cellMatches) {
        const isShared = cXml.includes('t="s"');
        const vMatch = cXml.match(/<v>([^<]*)<\/v>/i);
        if (vMatch) {
          const val = vMatch[1];
          if (isShared) {
            const strIdx = parseInt(val, 10);
            rowCells.push(sharedStrings[strIdx] || "");
          } else {
            rowCells.push(val);
          }
        } else {
          rowCells.push("");
        }
      }
      if (rowCells.some(Boolean)) {
        parsedRows.push(rowCells);
      }
    }

    if (parsedRows.length > 0) {
      totalRowsCount += parsedRows.length;
      const headers = parsedRows[0].map((h, colI) => h.trim() || `Col_${colI + 1}`);
      const dataRows = parsedRows.slice(1);

      tables.push({
        tableName: sheetName,
        delimiter: "EXCEL_SHEET",
        totalRows: dataRows.length,
        totalColumns: headers.length,
        columns: headers.map((h, cIdx) => ({
          name: h,
          inferredType: "TEXT",
          nullCount: dataRows.filter(r => !r[cIdx]).length,
          nullPercentage: dataRows.length > 0 ? Math.round((dataRows.filter(r => !r[cIdx]).length / dataRows.length) * 100) : 0,
          uniqueCount: new Set(dataRows.map(r => r[cIdx])).size,
          sampleValues: dataRows.slice(0, 5).map(r => r[cIdx])
        })),
        previewRows: dataRows.slice(0, 5)
      });
    }
  }

  return {
    path: filePath,
    filename: path.basename(filePath),
    format: "XLSX",
    category: "TABULAR_DATASET",
    sizeBytes: buffer.length,
    wordCount: totalRowsCount * 4,
    lineCount: totalRowsCount,
    estimatedReadingMinutes: Math.max(1, Math.ceil(totalRowsCount / 200)),
    title: `Planilha Excel: ${path.basename(filePath)}`,
    sections: sheetNames.map(s => ({
      level: 1,
      title: `Aba: ${s}`,
      characterCount: 0,
      wordCount: 10,
      hasContent: true
    })),
    tables,
    links: [],
    keyTerms: sheetNames,
    qualityScore: 92,
    qualityIssues: [],
    rawTextSnippet: `Planilha com ${tables.length} abas: ${sheetNames.join(", ")}`
  };
}

// 7. Pure-Text PDF Parser (Zero-Dependency Text Layer Stream Decoder)
export function parsePdfText(buffer: Buffer, filePath: string): ParsedDocument {
  const sections: DocumentSection[] = [];
  const textLines: string[] = [];
  let pageCount = 0;

  // Count page objects
  const rawStr = buffer.toString("binary");
  const pageMatches = rawStr.match(/\/Type\s*\/Page\b/g);
  pageCount = pageMatches ? pageMatches.length : 1;

  // Extract metadata Title
  let title = path.basename(filePath, ".pdf");
  const titleMatch = rawStr.match(/\/Title\s*\(([^)]+)\)/i);
  if (titleMatch) title = titleMatch[1];

  // Find all streams: stream ... endstream
  const streamRegex = /stream\r?\n([\s\S]*?)\r?\nendstream/g;
  let sMatch;
  while ((sMatch = streamRegex.exec(rawStr)) !== null) {
    const rawStreamData = Buffer.from(sMatch[1], "binary");
    let decompressed: Buffer | null = null;

    try {
      decompressed = zlib.inflateSync(rawStreamData);
    } catch {
      try {
        decompressed = zlib.inflateRawSync(rawStreamData);
      } catch {
        decompressed = rawStreamData;
      }
    }

    if (decompressed) {
      const streamText = decompressed.toString("latin1");
      // Extract PDF Text Strings: (Text) Tj or [(T) 20 (ext)] TJ
      const tjRegex = /\((.*?)\)\s*Tj/g;
      let tj;
      while ((tj = tjRegex.exec(streamText)) !== null) {
        const unescaped = tj[1]
          .replace(/\\([()\\])/g, "$1")
          .replace(/\\n/g, "\n")
          .replace(/\\r/g, "\r")
          .replace(/\\t/g, "\t");
        if (unescaped.trim()) textLines.push(unescaped.trim());
      }

      // TJ Array strings
      const tjArrayRegex = /\[(.*?)\]\s*TJ/g;
      let tja;
      while ((tja = tjArrayRegex.exec(streamText)) !== null) {
        const inner = tja[1];
        const innerStrings = inner.match(/\((.*?)\)/g) || [];
        const combined = innerStrings
          .map(s => s.slice(1, -1).replace(/\\([()\\])/g, "$1"))
          .join("");
        if (combined.trim()) textLines.push(combined.trim());
      }
    }
  }

  const fullText = textLines.join(" ");
  const wordCount = fullText.split(/\s+/).filter(Boolean).length;

  if (wordCount > 0) {
    sections.push({
      level: 1,
      title: title,
      characterCount: fullText.length,
      wordCount,
      hasContent: true
    });
  }

  return {
    path: filePath,
    filename: path.basename(filePath),
    format: "PDF",
    category: classifyCategory(filePath, fullText, "PDF"),
    sizeBytes: buffer.length,
    wordCount,
    lineCount: textLines.length,
    estimatedReadingMinutes: Math.max(1, Math.ceil(wordCount / 200)),
    title: `${title} (${pageCount} páginas)`,
    sections,
    tables: [],
    links: [],
    keyTerms: textLines.slice(0, 10),
    qualityScore: wordCount > 0 ? 88 : 40,
    qualityIssues: wordCount === 0 ? [{ severity: "WARNING", type: "PLACEHOLDER_TEXT", description: "PDF sem camada de texto vetorial (possível imagem escaneada requerendo OCR futuro)." }] : [],
    rawTextSnippet: fullText.slice(0, 500)
  };
}

// ─── Main Document Intelligence Analysis Orchestrator ─────────────────────────

export interface AnalyzeDocumentRepoOptions {
  repoUrl: string;
  filterExtensions?: string[];
  maxFiles?: number;
  githubToken?: string;
}

const DOCUMENT_EXTENSIONS = new Set([
  "md", "markdown", "mdx",
  "csv", "tsv", "tab", "psv",
  "txt", "text", "note", "rst", "org", "adoc", "asciidoc",
  "docx",
  "xlsx", "xls",
  "pdf",
  "json", "jsonl", "yaml", "yml", "xml", "toml",
  "log", "rtf", "doc"
]);

export async function analyzeDocumentRepository(
  opts: AnalyzeDocumentRepoOptions
): Promise<DocumentRepositoryAnalysis> {
  const { repoUrl, githubToken } = opts;
  const maxFiles = opts.maxFiles || 500;

  // 1. Discover all candidate files
  const allFiles = await findRepoFiles(
    repoUrl,
    (filePath) => {
      const ext = filePath.split(".").pop()?.toLowerCase() || "";
      if (opts.filterExtensions && opts.filterExtensions.length > 0) {
        return opts.filterExtensions.includes(ext);
      }
      return DOCUMENT_EXTENSIONS.has(ext);
    },
    githubToken
  );

  const cappedFiles = allFiles.slice(0, maxFiles);
  const parsedDocs: ParsedDocument[] = [];

  const formatsDistribution: Record<DocumentFormat, number> = {
    MARKDOWN: 0,
    CSV: 0,
    TSV: 0,
    PLAIN_TEXT: 0,
    DOCX: 0,
    XLSX: 0,
    XLS: 0,
    PDF: 0,
    JSON: 0,
    YAML: 0,
    XML: 0,
    LOG: 0,
    RTF: 0
  };

  const categoriesDistribution: Record<DocumentCategory, number> = {
    TECHNICAL_DOCUMENTATION: 0,
    API_SPECIFICATION: 0,
    TABULAR_DATASET: 0,
    PROJECT_MANAGEMENT_NOTES: 0,
    LEGAL_OR_POLICY: 0,
    RESEARCH_OR_ACADEMIC: 0,
    SYSTEM_LOGS: 0,
    CONFIGURATION_DATA: 0,
    GENERAL_DOCUMENT: 0
  };

  // 2. Fetch and parse each document file
  for (const filePath of cappedFiles) {
    const ext = filePath.split(".").pop()?.toLowerCase() || "";
    try {
      if (ext === "md" || ext === "markdown" || ext === "mdx") {
        const file = await fetchRepoFile(repoUrl, filePath, githubToken);
        if (file) {
          const doc = parseMarkdown(file.content, filePath, cappedFiles);
          parsedDocs.push(doc);
          formatsDistribution.MARKDOWN++;
          categoriesDistribution[doc.category]++;
        }
      } else if (ext === "csv" || ext === "tsv" || ext === "tab" || ext === "psv") {
        const file = await fetchRepoFile(repoUrl, filePath, githubToken);
        if (file) {
          const doc = parseTabular(file.content, filePath);
          parsedDocs.push(doc);
          formatsDistribution[doc.format]++;
          categoriesDistribution[doc.category]++;
        }
      } else if (ext === "docx") {
        const buffer = await fetchRepoBuffer(repoUrl, filePath, githubToken);
        if (buffer) {
          const doc = parseDocx(buffer, filePath);
          parsedDocs.push(doc);
          formatsDistribution.DOCX++;
          categoriesDistribution[doc.category]++;
        }
      } else if (ext === "xlsx" || ext === "xls") {
        const buffer = await fetchRepoBuffer(repoUrl, filePath, githubToken);
        if (buffer) {
          const doc = parseXlsx(buffer, filePath);
          parsedDocs.push(doc);
          formatsDistribution.XLSX++;
          categoriesDistribution[doc.category]++;
        }
      } else if (ext === "pdf") {
        const buffer = await fetchRepoBuffer(repoUrl, filePath, githubToken);
        if (buffer) {
          const doc = parsePdfText(buffer, filePath);
          parsedDocs.push(doc);
          formatsDistribution.PDF++;
          categoriesDistribution[doc.category]++;
        }
      } else if (ext === "json" || ext === "jsonl" || ext === "yaml" || ext === "yml" || ext === "xml") {
        const file = await fetchRepoFile(repoUrl, filePath, githubToken);
        if (file) {
          const doc = parseStructuredData(file.content, filePath);
          parsedDocs.push(doc);
          formatsDistribution[doc.format]++;
          categoriesDistribution[doc.category]++;
        }
      } else {
        // Plain text, logs, rst, etc.
        const file = await fetchRepoFile(repoUrl, filePath, githubToken);
        if (file) {
          const doc = parsePlainText(file.content, filePath);
          parsedDocs.push(doc);
          formatsDistribution[doc.format]++;
          categoriesDistribution[doc.category]++;
        }
      }
    } catch (err: any) {
      console.warn(`[Document Analyzer] Erro ao analisar ${filePath}:`, err.message);
    }
  }

  // 3. Build Knowledge Graph (Nodes and Edges)
  const graphNodes: DocumentKnowledgeGraph["nodes"] = [];
  const graphEdges: DocumentKnowledgeGraph["edges"] = [];

  const categoryNodesAdded = new Set<string>();
  const entityNodesAdded = new Set<string>();

  for (const doc of parsedDocs) {
    const docNodeId = `doc:${doc.path}`;
    graphNodes.push({
      id: docNodeId,
      label: doc.title || doc.filename,
      kind: "document",
      group: doc.category,
      format: doc.format,
      category: doc.category,
      metrics: {
        wordCount: doc.wordCount,
        qualityScore: doc.qualityScore,
        readingMinutes: doc.estimatedReadingMinutes
      }
    });

    // Link Doc to Category Topic Node
    const topicNodeId = `topic:${doc.category}`;
    if (!categoryNodesAdded.has(topicNodeId)) {
      categoryNodesAdded.add(topicNodeId);
      graphNodes.push({
        id: topicNodeId,
        label: doc.category.replace(/_/g, " "),
        kind: "topic",
        group: "topics"
      });
    }
    graphEdges.push({
      from: docNodeId,
      to: topicNodeId,
      type: "MENTIONS_TOPIC"
    });

    // Section Nodes
    for (const sec of doc.sections) {
      const secNodeId = `sec:${doc.path}#${sec.title}`;
      graphNodes.push({
        id: secNodeId,
        label: sec.title,
        kind: "section",
        group: doc.category
      });
      graphEdges.push({
        from: docNodeId,
        to: secNodeId,
        type: "CONTAINS"
      });
    }

    // Table Nodes
    for (const tbl of doc.tables) {
      const tblNodeId = `table:${doc.path}#${tbl.tableName}`;
      graphNodes.push({
        id: tblNodeId,
        label: `${tbl.tableName} (${tbl.totalRows} linhas)`,
        kind: "table",
        group: "tabular"
      });
      graphEdges.push({
        from: docNodeId,
        to: tblNodeId,
        type: "CONTAINS"
      });
    }

    // Cross-doc Reference Edges
    for (const link of doc.links) {
      if (!link.isExternal && !link.isAnchor) {
        const targetDoc = parsedDocs.find(d => d.path.endsWith(link.url) || link.url.endsWith(d.filename));
        if (targetDoc) {
          graphEdges.push({
            from: docNodeId,
            to: `doc:${targetDoc.path}`,
            type: "REFERENCES_DOC",
            label: link.label
          });
        }
      }
    }

    // Key Entity Nodes
    for (const term of doc.keyTerms.slice(0, 5)) {
      const entityId = `entity:${term.toLowerCase()}`;
      if (!entityNodesAdded.has(entityId)) {
        entityNodesAdded.add(entityId);
        graphNodes.push({
          id: entityId,
          label: term,
          kind: "entity",
          group: "entities"
        });
      }
      graphEdges.push({
        from: docNodeId,
        to: entityId,
        type: "DEFINES_ENTITY"
      });
    }
  }

  // 4. Calculate Aggregate Metrics & Document Quality Index
  const totalWords = parsedDocs.reduce((acc, d) => acc + d.wordCount, 0);
  const totalTables = parsedDocs.reduce((acc, d) => acc + d.tables.length, 0);
  const allIssues = parsedDocs.flatMap(d => d.qualityIssues);
  const criticalIssues = allIssues.filter(i => i.severity === "CRITICAL").length;
  const warningIssues = allIssues.filter(i => i.severity === "WARNING").length;

  const avgQuality = parsedDocs.length > 0
    ? Math.round(parsedDocs.reduce((acc, d) => acc + d.qualityScore, 0) / parsedDocs.length)
    : 100;

  let letterGrade: "A+" | "A" | "B" | "C" | "D" | "F" = "A";
  if (avgQuality >= 95) letterGrade = "A+";
  else if (avgQuality >= 85) letterGrade = "A";
  else if (avgQuality >= 75) letterGrade = "B";
  else if (avgQuality >= 65) letterGrade = "C";
  else if (avgQuality >= 50) letterGrade = "D";
  else letterGrade = "F";

  // 5. Master Knowledge Index for AI Agents
  const masterKnowledgeIndex = parsedDocs.map(d => ({
    filePath: d.path,
    title: d.title,
    format: d.format,
    category: d.category,
    wordCount: d.wordCount,
    readingMinutes: d.estimatedReadingMinutes,
    qualityScore: d.qualityScore,
    mainTopics: d.sections.map(s => s.title).slice(0, 5),
    schemaOrTables: d.tables.map(t => `${t.tableName} (${t.totalRows}x${t.totalColumns})`)
  }));

  // 6. Generate LLM Query Directives
  const recommendedLookupPaths: Record<string, string[]> = {};
  for (const doc of parsedDocs) {
    if (!recommendedLookupPaths[doc.category]) recommendedLookupPaths[doc.category] = [];
    recommendedLookupPaths[doc.category].push(doc.path);
  }

  const glossary: Record<string, string> = {};
  for (const doc of parsedDocs) {
    for (const term of doc.keyTerms) {
      if (!glossary[term]) {
        glossary[term] = `Definido em ${doc.path}`;
      }
    }
  }

  const systemDirective = [
    `[MRCP DOCUMENT INTELLIGENCE DIRECTIVE]`,
    `Este repositório contém ${parsedDocs.length} documentos e bases de conhecimento (~${totalWords.toLocaleString()} palavras, ${totalTables} tabelas).`,
    `Para responder perguntas do usuário sem alucinar, utilize os caminhos de documentos mapeados no masterKnowledgeIndex.`
  ].join(" ");

  return {
    analyzedUrl: repoUrl,
    timestamp: new Date().toISOString(),
    engineVersion: "2.4.1",
    isDocumentRepository: parsedDocs.length > 0,
    totalDocumentsAnalyzed: parsedDocs.length,
    totalWords,
    totalTables,
    formatsDistribution,
    categoriesDistribution,
    documentQualityIndex: {
      overallScore: avgQuality,
      letterGrade,
      totalIssues: allIssues.length,
      criticalIssues,
      warnings: warningIssues,
      summary: `Document Quality Index ${avgQuality}/100 (Nota ${letterGrade}) com ${criticalIssues} alertas críticos e ${warningIssues} avisos.`
    },
    knowledgeGraph: {
      nodes: graphNodes,
      edges: graphEdges
    },
    masterKnowledgeIndex,
    documents: parsedDocs,
    llmQueryDirectives: {
      systemDirective,
      recommendedLookupPaths,
      glossary
    }
  };
}
