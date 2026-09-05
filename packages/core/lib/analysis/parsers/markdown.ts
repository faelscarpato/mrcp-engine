import path from "path";
import { classifyCategory } from "./utils.js";
import type {
  ParsedDocument,
  DocumentSection,
  DocumentLink,
  TabularSummary,
  DocumentQualityIssue,
  TabularColumn,
} from "../document-types.js";

function parseMarkdownTable(
  lines: string[],
  name: string,
): TabularSummary | null {
  try {
    const headerLine = lines[0];
    const headers = headerLine
      .split("|")
      .slice(1, -1)
      .map((h) => h.trim())
      .filter(Boolean);

    if (headers.length === 0) return null;

    const dataLines = lines.slice(2); // skip header and delimiter row
    const previewRows: any[][] = [];

    for (const dLine of dataLines.slice(0, 5)) {
      const cells = dLine
        .split("|")
        .slice(1, -1)
        .map((c) => c.trim());
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
        nullPercentage:
          dataLines.length > 0
            ? Math.round(
                ((dataLines.length - nonNull) / dataLines.length) * 100,
              )
            : 0,
        uniqueCount: nonNull,
        sampleValues: previewRows.map((r) => r[colIdx]).filter(Boolean),
      };
    });

    return {
      tableName: name,
      delimiter: "|",
      totalRows: dataLines.length,
      totalColumns: headers.length,
      columns,
      previewRows,
    };
  } catch {
    return null;
  }
}

export function parseMarkdown(
  content: string,
  filePath: string,
  allFilePaths: string[] = [],
): ParsedDocument {
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
  const tasks = { total: 0, completed: 0, pending: 0 };

  // Parse YAML Frontmatter
  let inFrontmatter = false;
  const frontmatterLines: string[] = [];
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
    const placeholderMatch = trimmed.match(
      /\b(TODO|FIXME|TBD|LOREM IPSUM|PLACEHOLDER|XXX)\b/i,
    );
    if (placeholderMatch && !trimmed.startsWith("- [ ]")) {
      qualityIssues.push({
        severity: "INFO",
        type: "PLACEHOLDER_TEXT",
        line: i + 1,
        description: `Texto de rascunho ou pendência detectado: '${placeholderMatch[1]}'`,
        snippet: trimmed.slice(0, 100),
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
      const isExternal =
        url.startsWith("http://") || url.startsWith("https://");
      const isAnchor = url.startsWith("#");
      let isBrokenRelative = false;

      if (!isExternal && !isAnchor && allFilePaths.length > 0) {
        const cleanUrl = url.split("?")[0].split("#")[0];
        const normalizedTarget = cleanUrl.replace(/^\.\//, "");
        const dir = path.dirname(filePath);
        const resolvedPath = path.posix.normalize(
          dir === "." ? normalizedTarget : `${dir}/${normalizedTarget}`,
        );
        const exists = allFilePaths.some(
          (p) =>
            p === resolvedPath ||
            p === normalizedTarget ||
            p.endsWith("/" + normalizedTarget) ||
            p.endsWith(normalizedTarget),
        );
        if (!exists) {
          isBrokenRelative = true;
          qualityIssues.push({
            severity: "WARNING",
            type: "BROKEN_LINK",
            line: i + 1,
            description: `Link relativo potencialmente quebrado: '${url}'`,
            snippet: line.trim(),
          });
        }
      }

      links.push({ label, url, isExternal, isAnchor, isBrokenRelative });
    }

    // Key concepts / definitions
    const boldRegex = /\*\*([A-Za-z0-9_\s:-]{3,50})\*\*/g;
    let bMatch;
    while ((bMatch = boldRegex.exec(line)) !== null) {
      const term = bMatch[1].replace(/[:-]+$/, "").trim();
      if (
        term.length >= 3 &&
        term.length <= 40 &&
        !/^(TODO|FIXME|NOTE|WARNING|IMPORTANT|TIP)$/i.test(term)
      ) {
        keyTermsSet.add(term);
      }
    }

    // Headings
    const headingMatch = line.match(/^(#{1,6})\s+(.+)$/);
    if (headingMatch) {
      const level = headingMatch[1].length;
      const hTitle = headingMatch[2].trim().replace(/\*\*/g, "");

      if (
        level === 1 &&
        (!title || title === path.basename(filePath, path.extname(filePath)))
      ) {
        title = hTitle;
      }

      if (currentSection && currentSection.wordCount === 0) {
        qualityIssues.push({
          severity: "WARNING",
          type: "EMPTY_SECTION",
          line: currentSection.line,
          description: `Seção vazia sem conteúdo textual: '${currentSection.title}'`,
        });
      }

      currentSection = {
        level,
        title: hTitle,
        line: i + 1,
        characterCount: 0,
        wordCount: 0,
        hasContent: false,
      };
      sections.push(currentSection);
      continue;
    }

    // Markdown Table Detection
    if (trimmed.startsWith("|") && trimmed.endsWith("|")) {
      tableBuffer.push(trimmed);
    } else {
      if (tableBuffer.length >= 2) {
        const parsedTbl = parseMarkdownTable(
          tableBuffer,
          `Tabela Linha ${i - tableBuffer.length + 1}`,
        );
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
    description:
      description ||
      (sections[0]?.title ? `Documentação cobrindo ${sections[0].title}` : ""),
    sections,
    tables,
    links,
    keyTerms: Array.from(keyTermsSet).slice(0, 25),
    tasks: tasks.total > 0 ? tasks : undefined,
    codeSnippetsCount,
    qualityScore,
    qualityIssues,
    rawTextSnippet: content.slice(0, 500).replace(/[\r\n]+/g, " "),
  };
}
