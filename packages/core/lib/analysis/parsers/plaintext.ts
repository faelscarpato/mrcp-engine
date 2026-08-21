import path from "path";
import { classifyCategory } from "./utils.js";
import type { 
  ParsedDocument, DocumentSection, DocumentQualityIssue 
} from "../document-types.js";

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
