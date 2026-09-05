import zlib from "zlib";
import path from "path";
import { classifyCategory } from "./utils.js";
import type { ParsedDocument, DocumentSection } from "../document-types.js";

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
          .map((s) => s.slice(1, -1).replace(/\\([()\\])/g, "$1"))
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
      hasContent: true,
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
    qualityIssues:
      wordCount === 0
        ? [
            {
              severity: "WARNING",
              type: "PLACEHOLDER_TEXT",
              description:
                "PDF sem camada de texto vetorial (possível imagem escaneada requerendo OCR futuro).",
            },
          ]
        : [],
    rawTextSnippet: fullText.slice(0, 500),
  };
}
