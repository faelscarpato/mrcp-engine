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

export interface AnalyzeDocumentRepoOptions {
  repoUrl: string;
  filterExtensions?: string[];
  maxFiles?: number;
  githubToken?: string;
}
