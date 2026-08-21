import { describe, it, expect } from "vitest";
import {
  parseMarkdown,
  parseTabular,
  parsePlainText,
  parseStructuredData,
  parseDocx,
  parseXlsx,
  parsePdfText,
  analyzeDocumentRepository
} from "./document-analyzer.js";

describe("Document Intelligence Analyzer Suite", () => {
  it("should accurately parse Markdown with sections, tables, tasks and links", () => {
    const mdContent = `---
title: "Technical Architecture Spec"
description: "Core specification document"
---

# Technical Architecture Spec

## Section 1: Overview
This is a comprehensive overview of the architecture.
**Microservice:** refers to autonomous distributed services.

## Section 2: Data Models
| ID | Name | Role | Salary |
| -- | ---- | ---- | ------ |
| 1  | Alice | Lead | 120000 |
| 2  | Bob   | Dev  | 95000  |

## Section 3: Tasks Checklist
- [x] Initial design review
- [ ] Database migration

See [Configuration](./config.json) and [External Docs](https://example.com/docs).
`;

    const result = parseMarkdown(mdContent, "docs/architecture.md", ["docs/architecture.md", "config.json"]);
    expect(result.title).toBe("Technical Architecture Spec");
    expect(result.format).toBe("MARKDOWN");
    expect(result.sections.length).toBeGreaterThanOrEqual(3);
    expect(result.tables.length).toBe(1);
    expect(result.tables[0].totalRows).toBe(2);
    expect(result.tables[0].columns.length).toBe(4);
    expect(result.tasks?.total).toBe(2);
    expect(result.tasks?.completed).toBe(1);
    expect(result.tasks?.pending).toBe(1);
    expect(result.links.length).toBe(2);
    expect(result.links[0].isBrokenRelative).toBe(false);
    expect(result.keyTerms).toContain("Microservice");
  });

  it("should parse CSV and infer schema, column types, statistics and TypeScript interface", () => {
    const csvContent = `user_id,email,is_active,created_date,score
101,alice@domain.com,true,2026-01-15,98.5
102,bob@domain.com,false,2026-02-10,87.0
103,carol@domain.com,true,2026-03-01,92.3
`;

    const result = parseTabular(csvContent, "data/users.csv");
    expect(result.format).toBe("CSV");
    expect(result.category).toBe("TABULAR_DATASET");
    expect(result.tables.length).toBe(1);
    const table = result.tables[0];
    expect(table.totalRows).toBe(3);
    expect(table.totalColumns).toBe(5);

    const emailCol = table.columns.find(c => c.name === "email");
    expect(emailCol?.inferredType).toBe("EMAIL");

    const activeCol = table.columns.find(c => c.name === "is_active");
    expect(activeCol?.inferredType).toBe("BOOLEAN");

    const scoreCol = table.columns.find(c => c.name === "score");
    expect(scoreCol?.inferredType).toBe("DECIMAL");

    expect(table.generatedTypeScriptSchema).toContain("export interface users");
    expect(table.generatedTypeScriptSchema).toContain("email: string;");
    expect(table.generatedTypeScriptSchema).toContain("is_active: boolean;");
    expect(table.generatedTypeScriptSchema).toContain("score: number;");
  });

  it("should parse Plain Text and System Logs with error diagnostics", () => {
    const logContent = `2026-08-19 10:00:00 [INFO] Server initialization started.
2026-08-19 10:00:05 [INFO] Database connected successfully.
2026-08-19 10:05:12 [WARN] High memory usage detected: 85%.
2026-08-19 10:06:01 [ERROR] Connection timeout to Redis replica 2.
2026-08-19 10:06:02 [ERROR] Failed to fetch user cache: Socket closed.
`;

    const result = parsePlainText(logContent, "logs/server.log");
    expect(result.format).toBe("LOG");
    expect(result.category).toBe("SYSTEM_LOGS");
    expect(result.logSummary).toBeDefined();
    expect(result.logSummary?.errorCount).toBe(2);
    expect(result.logSummary?.warningCount).toBe(1);
    expect(result.logSummary?.totalEntries).toBe(5);
  });

  it("should parse Structured Data JSON schema and arrays", () => {
    const jsonContent = JSON.stringify([
      { id: 1, name: "Product A", price: 29.99 },
      { id: 2, name: "Product B", price: 49.99 }
    ]);

    const result = parseStructuredData(jsonContent, "data/products.json");
    expect(result.format).toBe("JSON");
    expect(result.tables.length).toBe(1);
    expect(result.tables[0].totalRows).toBe(2);
    expect(result.tables[0].columns.length).toBe(3);
  });

  it("should build complete repository intelligence and knowledge graph", async () => {
    const repoAnalysis = await analyzeDocumentRepository({ repoUrl: "." });
    expect(repoAnalysis.isDocumentRepository).toBe(true);
    expect(repoAnalysis.totalDocumentsAnalyzed).toBeGreaterThan(0);
    expect(repoAnalysis.knowledgeGraph.nodes.length).toBeGreaterThan(0);
    expect(repoAnalysis.knowledgeGraph.edges.length).toBeGreaterThan(0);
    expect(repoAnalysis.masterKnowledgeIndex.length).toBeGreaterThan(0);
    expect(repoAnalysis.documentQualityIndex.overallScore).toBeGreaterThanOrEqual(50);
  }, 20000);
});
