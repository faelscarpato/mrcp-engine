import {
  findRepoFiles,
  fetchRepoFile,
  fetchRepoBuffer,
} from "./repo-fetcher.js";
import {
  DocumentCategory,
  DocumentFormat,
  DocumentSection,
  TabularColumn,
  TabularSummary,
  DocumentLink,
  DocumentQualityIssue,
  ParsedDocument,
  DocumentKnowledgeGraph,
  DocumentRepositoryAnalysis,
  classifyCategory,
} from "./documents/types.js";
import {
  parseMarkdown,
  parseMarkdownTable,
} from "./documents/markdown-parser.js";
import { parseTabular } from "./documents/tabular-parser.js";
import {
  parsePlainText,
  parseStructuredData,
  parseDocx,
  parseXlsx,
  parsePdfText,
} from "./documents/binary-parser.js";

// Re-export all types and format parsers
export * from "./documents/types.js";
export * from "./documents/markdown-parser.js";
export * from "./documents/tabular-parser.js";
export * from "./documents/binary-parser.js";

export interface AnalyzeDocumentRepoOptions {
  repoUrl: string;
  filterExtensions?: string[];
  maxFiles?: number;
  githubToken?: string;
}

const DOCUMENT_EXTENSIONS = new Set([
  "md",
  "markdown",
  "mdx",
  "csv",
  "tsv",
  "tab",
  "psv",
  "txt",
  "text",
  "note",
  "rst",
  "org",
  "adoc",
  "asciidoc",
  "docx",
  "xlsx",
  "xls",
  "pdf",
  "json",
  "jsonl",
  "yaml",
  "yml",
  "xml",
  "toml",
  "log",
  "rtf",
  "doc",
]);

export async function analyzeDocumentRepository(
  opts: AnalyzeDocumentRepoOptions,
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
    githubToken,
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
    RTF: 0,
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
    GENERAL_DOCUMENT: 0,
  };

  // 2. Fetch and parse document files in concurrent batches
  const BATCH_SIZE = 15;
  for (let i = 0; i < cappedFiles.length; i += BATCH_SIZE) {
    const batch = cappedFiles.slice(i, i + BATCH_SIZE);
    await Promise.all(
      batch.map(async (filePath) => {
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
          } else if (
            ext === "csv" ||
            ext === "tsv" ||
            ext === "tab" ||
            ext === "psv"
          ) {
            const file = await fetchRepoFile(repoUrl, filePath, githubToken);
            if (file) {
              const doc = parseTabular(file.content, filePath);
              parsedDocs.push(doc);
              formatsDistribution[doc.format]++;
              categoriesDistribution[doc.category]++;
            }
          } else if (ext === "docx") {
            const buffer = await fetchRepoBuffer(
              repoUrl,
              filePath,
              githubToken,
            );
            if (buffer) {
              const doc = parseDocx(buffer, filePath);
              parsedDocs.push(doc);
              formatsDistribution.DOCX++;
              categoriesDistribution[doc.category]++;
            }
          } else if (ext === "xlsx" || ext === "xls") {
            const buffer = await fetchRepoBuffer(
              repoUrl,
              filePath,
              githubToken,
            );
            if (buffer) {
              const doc = parseXlsx(buffer, filePath);
              parsedDocs.push(doc);
              formatsDistribution.XLSX++;
              categoriesDistribution[doc.category]++;
            }
          } else if (ext === "pdf") {
            const buffer = await fetchRepoBuffer(
              repoUrl,
              filePath,
              githubToken,
            );
            if (buffer) {
              const doc = parsePdfText(buffer, filePath);
              parsedDocs.push(doc);
              formatsDistribution.PDF++;
              categoriesDistribution[doc.category]++;
            }
          } else if (
            ext === "json" ||
            ext === "jsonl" ||
            ext === "yaml" ||
            ext === "yml" ||
            ext === "xml"
          ) {
            const file = await fetchRepoFile(repoUrl, filePath, githubToken);
            if (file) {
              const doc = parseStructuredData(file.content, filePath);
              parsedDocs.push(doc);
              formatsDistribution[doc.format]++;
              categoriesDistribution[doc.category]++;
            }
          } else {
            const file = await fetchRepoFile(repoUrl, filePath, githubToken);
            if (file) {
              const doc = parsePlainText(file.content, filePath);
              parsedDocs.push(doc);
              formatsDistribution[doc.format]++;
              categoriesDistribution[doc.category]++;
            }
          }
        } catch (err: any) {
          console.warn(
            `[Document Analyzer] Erro ao analisar ${filePath}:`,
            err.message,
          );
        }
      }),
    );
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
        readingMinutes: doc.estimatedReadingMinutes,
      },
    });

    const topicNodeId = `topic:${doc.category}`;
    if (!categoryNodesAdded.has(topicNodeId)) {
      categoryNodesAdded.add(topicNodeId);
      graphNodes.push({
        id: topicNodeId,
        label: doc.category.replace(/_/g, " "),
        kind: "topic",
        group: "topics",
      });
    }
    graphEdges.push({
      from: docNodeId,
      to: topicNodeId,
      type: "MENTIONS_TOPIC",
    });

    for (const sec of doc.sections) {
      const secNodeId = `sec:${doc.path}#${sec.title}`;
      graphNodes.push({
        id: secNodeId,
        label: sec.title,
        kind: "section",
        group: doc.category,
      });
      graphEdges.push({
        from: docNodeId,
        to: secNodeId,
        type: "CONTAINS",
      });
    }

    for (const tbl of doc.tables) {
      const tblNodeId = `table:${doc.path}#${tbl.tableName}`;
      graphNodes.push({
        id: tblNodeId,
        label: `${tbl.tableName} (${tbl.totalRows} linhas)`,
        kind: "table",
        group: "tabular",
      });
      graphEdges.push({
        from: docNodeId,
        to: tblNodeId,
        type: "CONTAINS",
      });
    }

    for (const link of doc.links) {
      if (!link.isExternal && !link.isAnchor) {
        const targetDoc = parsedDocs.find(
          (d) => d.path.endsWith(link.url) || link.url.endsWith(d.filename),
        );
        if (targetDoc) {
          graphEdges.push({
            from: docNodeId,
            to: `doc:${targetDoc.path}`,
            type: "REFERENCES_DOC",
            label: link.label,
          });
        }
      }
    }

    for (const term of doc.keyTerms.slice(0, 5)) {
      const entityId = `entity:${term.toLowerCase()}`;
      if (!entityNodesAdded.has(entityId)) {
        entityNodesAdded.add(entityId);
        graphNodes.push({
          id: entityId,
          label: term,
          kind: "entity",
          group: "entities",
        });
      }
      graphEdges.push({
        from: docNodeId,
        to: entityId,
        type: "DEFINES_ENTITY",
      });
    }
  }

  // 4. Calculate Aggregate Metrics
  const totalWords = parsedDocs.reduce((acc, d) => acc + d.wordCount, 0);
  const totalTables = parsedDocs.reduce((acc, d) => acc + d.tables.length, 0);
  const allIssues = parsedDocs.flatMap((d) => d.qualityIssues);
  const criticalIssues = allIssues.filter(
    (i) => i.severity === "CRITICAL",
  ).length;
  const warningIssues = allIssues.filter(
    (i) => i.severity === "WARNING",
  ).length;

  const avgQuality =
    parsedDocs.length > 0
      ? Math.round(
          parsedDocs.reduce((acc, d) => acc + d.qualityScore, 0) /
            parsedDocs.length,
        )
      : 100;

  let letterGrade: "A+" | "A" | "B" | "C" | "D" | "F" = "A";
  if (avgQuality >= 95) letterGrade = "A+";
  else if (avgQuality >= 85) letterGrade = "A";
  else if (avgQuality >= 75) letterGrade = "B";
  else if (avgQuality >= 65) letterGrade = "C";
  else if (avgQuality >= 50) letterGrade = "D";
  else letterGrade = "F";

  const masterKnowledgeIndex = parsedDocs.map((d) => ({
    filePath: d.path,
    title: d.title,
    format: d.format,
    category: d.category,
    wordCount: d.wordCount,
    readingMinutes: d.estimatedReadingMinutes,
    qualityScore: d.qualityScore,
    mainTopics: d.sections.map((s) => s.title).slice(0, 5),
    schemaOrTables: d.tables.map(
      (t) => `${t.tableName} (${t.totalRows}x${t.totalColumns})`,
    ),
  }));

  const recommendedLookupPaths: Record<string, string[]> = {};
  for (const doc of parsedDocs) {
    if (!recommendedLookupPaths[doc.category])
      recommendedLookupPaths[doc.category] = [];
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
    `Para responder perguntas do usuário sem alucinar, utilize os caminhos de documentos mapeados no masterKnowledgeIndex.`,
  ].join(" ");

  return {
    analyzedUrl: repoUrl,
    timestamp: new Date().toISOString(),
    engineVersion: "2.6.0",
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
      summary: `Document Quality Index ${avgQuality}/100 (Nota ${letterGrade}) com ${criticalIssues} alertas críticos e ${warningIssues} avisos.`,
    },
    knowledgeGraph: {
      nodes: graphNodes,
      edges: graphEdges,
    },
    masterKnowledgeIndex,
    documents: parsedDocs,
    llmQueryDirectives: {
      systemDirective,
      recommendedLookupPaths,
      glossary,
    },
  };
}
