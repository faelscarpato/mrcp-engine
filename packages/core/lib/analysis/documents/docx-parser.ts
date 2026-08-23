import path from "path";
import {
  ParsedDocument,
  DocumentSection,
  TabularSummary,
  classifyCategory
} from "./types.js";
import { extractZipEntries } from "./zip-extractor.js";

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

  const paragraphRegex = /<w:p(?:\s[^>]*)?>([\s\S]*?)<\/w:p>/gi;
  let pMatch: RegExpExecArray | null;
  let currentSection: DocumentSection | null = null;

  while ((pMatch = paragraphRegex.exec(docXml)) !== null) {
    const pContent = pMatch[1];
    const tMatches = pContent.match(/<w:t(?:\s[^>]*)?>([^<]*)<\/w:t>/gi) || [];
    const pText = tMatches.map(t => t.replace(/<[^>]+>/g, "")).join("").trim();

    if (!pText) continue;
    textRuns.push(pText);

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

  const tableRegex = /<w:tbl(?:\s[^>]*)?>([\s\S]*?)<\/w:tbl>/gi;
  let tblMatch: RegExpExecArray | null;
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
