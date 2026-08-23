import path from "path";
import {
  ParsedDocument,
  TabularSummary
} from "./types.js";
import { extractZipEntries } from "./zip-extractor.js";

export function parseXlsx(buffer: Buffer, filePath: string): ParsedDocument {
  const entries = extractZipEntries(buffer);
  const sharedStringsXml = entries.get("xl/sharedStrings.xml")?.toString("utf-8") || "";
  const workbookXml = entries.get("xl/workbook.xml")?.toString("utf-8") || "";

  const sharedStrings: string[] = [];
  const siRegex = /<si(?:\s[^>]*)?>([\s\S]*?)<\/si>/gi;
  let siMatch: RegExpExecArray | null;
  while ((siMatch = siRegex.exec(sharedStringsXml)) !== null) {
    const tMatches = siMatch[1].match(/<t(?:\s[^>]*)?>([^<]*)<\/t>/gi) || [];
    sharedStrings.push(tMatches.map(t => t.replace(/<[^>]+>/g, "")).join(""));
  }

  const sheetNames: string[] = [];
  const sheetRegex = /<sheet\s+[^>]*name="([^"]+)"/gi;
  let sMatch: RegExpExecArray | null;
  while ((sMatch = sheetRegex.exec(workbookXml)) !== null) {
    sheetNames.push(sMatch[1]);
  }

  const tables: TabularSummary[] = [];
  let totalRowsCount = 0;

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
