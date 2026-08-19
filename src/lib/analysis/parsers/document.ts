import * as mammoth from "mammoth";
import * as xlsx from "xlsx";
import pdf from "pdf-parse";
import { unified } from "unified";
import remarkParse from "remark-parse";
import nlp from "compromise";

export interface DocumentSemanticTree {
  document: string;
  type: string;
  metrics: {
    wordCount: number;
    paragraphCount: number;
    pageCount?: number;
    rows?: number;
    columns?: number;
  };
  themes: string[];
  structure: {
    headers: Array<{ level: number; text: string }>;
    listsCount: number;
    tables?: any[]; // for spreadsheets
  };
  rawText?: string;
}

/**
 * Extract themes using nlp compromise
 */
function extractThemes(text: string): string[] {
  if (!text) return [];
  // Extract top nouns and topics
  const doc = nlp(text);
  const nouns = doc.nouns().out('frequency');
  const topics = doc.topics().out('frequency');
  
  // Combine and sort
  const combined = [...(topics || []), ...(nouns || [])];
  
  // Filter out tiny words and duplicates
  const seen = new Set<string>();
  const results: string[] = [];
  
  for (const item of combined) {
    const word = item.normal;
    if (word && word.length > 3 && !seen.has(word)) {
      seen.add(word);
      results.push(word);
    }
    if (results.length >= 10) break; // Top 10 themes
  }
  
  return results;
}

/**
 * Generic metrics computation
 */
function computeTextMetrics(text: string) {
  const words = text.split(/\s+/).filter(w => w.trim().length > 0).length;
  const paragraphs = text.split(/\n\s*\n/).filter(p => p.trim().length > 0).length;
  return { wordCount: words, paragraphCount: paragraphs };
}

export async function parseDocument(
  path: string, 
  content?: string, 
  buffer?: Buffer
): Promise<DocumentSemanticTree | null> {
  const ext = path.split('.').pop()?.toLowerCase();
  
  try {
    if (ext === 'md' && content) {
      return await parseMarkdown(path, content);
    } else if (ext === 'txt' || ext === 'csv') {
      if (ext === 'csv') {
         const buf = buffer || (content ? Buffer.from(content) : undefined);
         if (buf) return parseSpreadsheet(path, buf);
      }
      if (content) return parseText(path, content);
    } else if (ext === 'pdf' && buffer) {
      return await parsePdf(path, buffer);
    } else if ((ext === 'doc' || ext === 'docx') && buffer) {
      return await parseWord(path, buffer);
    } else if ((ext === 'xls' || ext === 'xlsx') && buffer) {
      return parseSpreadsheet(path, buffer);
    }
  } catch (error) {
    console.error(`Failed to parse document ${path}:`, error);
  }
  return null;
}

async function parseMarkdown(path: string, content: string): Promise<DocumentSemanticTree> {
  const tree = unified().use(remarkParse).parse(content);
  
  const headers: Array<{ level: number; text: string }> = [];
  let listsCount = 0;
  
  // Basic AST traversal
  const traverse = (node: any) => {
    if (node.type === 'heading') {
      const text = node.children.map((c: any) => c.value).join('');
      headers.push({ level: node.depth, text });
    } else if (node.type === 'list') {
      listsCount++;
    }
    if (node.children) {
      node.children.forEach(traverse);
    }
  };
  
  traverse(tree);
  
  const metrics = computeTextMetrics(content);
  const themes = extractThemes(content);
  
  return {
    document: path,
    type: 'markdown',
    metrics,
    themes,
    structure: { headers, listsCount },
    rawText: content.substring(0, 5000) // snippet
  };
}

function parseText(path: string, content: string): DocumentSemanticTree {
  const metrics = computeTextMetrics(content);
  const themes = extractThemes(content);
  
  return {
    document: path,
    type: 'text',
    metrics,
    themes,
    structure: { headers: [], listsCount: 0 },
    rawText: content.substring(0, 5000)
  };
}

async function parsePdf(path: string, buffer: Buffer): Promise<DocumentSemanticTree> {
  const data = await pdf(buffer);
  const text = data.text;
  
  const metrics = computeTextMetrics(text);
  metrics.pageCount = data.numpages;
  const themes = extractThemes(text);
  
  // Heuristic header extraction (e.g. short lines in all caps)
  const headers: Array<{ level: number; text: string }> = [];
  const lines = text.split('\n');
  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.length > 0 && trimmed.length < 60 && trimmed === trimmed.toUpperCase()) {
      // rough guess it's a header
      headers.push({ level: 1, text: trimmed });
    }
  }

  return {
    document: path,
    type: 'pdf',
    metrics,
    themes,
    structure: { headers, listsCount: 0 },
    rawText: text.substring(0, 5000)
  };
}

async function parseWord(path: string, buffer: Buffer): Promise<DocumentSemanticTree> {
  const result = await mammoth.extractRawText({ buffer });
  const text = result.value;
  
  // Mammoth can also extract HTML to get semantic headers
  const htmlResult = await mammoth.convertToHtml({ buffer });
  const html = htmlResult.value;
  
  const headers: Array<{ level: number; text: string }> = [];
  // Simple regex to extract h1, h2, etc from html
  const regex = /<h([1-6])>(.*?)<\/h\1>/g;
  let match;
  while ((match = regex.exec(html)) !== null) {
    headers.push({ level: parseInt(match[1], 10), text: match[2].replace(/<[^>]*>?/gm, '') });
  }
  
  const listsCount = (html.match(/<ul>|<ol>/g) || []).length;
  const metrics = computeTextMetrics(text);
  const themes = extractThemes(text);

  return {
    document: path,
    type: 'word',
    metrics,
    themes,
    structure: { headers, listsCount },
    rawText: text.substring(0, 5000)
  };
}

function parseSpreadsheet(path: string, buffer: Buffer): DocumentSemanticTree {
  const workbook = xlsx.read(buffer, { type: 'buffer' });
  const tables: any[] = [];
  let totalRows = 0;
  let totalCols = 0;
  let textCorpus = "";

  for (const sheetName of workbook.SheetNames) {
    const sheet = workbook.Sheets[sheetName];
    // Convert to array of arrays to preserve structure
    const json: any[][] = xlsx.utils.sheet_to_json(sheet, { header: 1 });
    
    if (json.length > 0) {
      const headers = json[0];
      const rows = json.length;
      const cols = headers.length;
      totalRows += rows;
      totalCols = Math.max(totalCols, cols);
      
      // We will keep all rows but structured by sheet
      tables.push({
        sheetName,
        headers,
        rows: json.slice(1), // All data rows
        rowCount: rows - 1
      });
      
      textCorpus += json.map(r => r.join(' ')).join('\n') + "\n";
    }
  }

  const themes = extractThemes(textCorpus);

  return {
    document: path,
    type: 'spreadsheet',
    metrics: {
      wordCount: computeTextMetrics(textCorpus).wordCount,
      paragraphCount: tables.length,
      rows: totalRows,
      columns: totalCols
    },
    themes,
    structure: { headers: [], listsCount: 0, tables },
  };
}
