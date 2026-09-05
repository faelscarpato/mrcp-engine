import zlib from "zlib";
import type { DocumentFormat, DocumentCategory } from "../document-types.js";

export function extractZipEntries(buffer: Buffer): Map<string, Buffer> {
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
      const filenameLength = buffer.readUInt16LE(offset + 26);
      const extraFieldLength = buffer.readUInt16LE(offset + 28);

      const filename = buffer.toString(
        "utf-8",
        offset + 30,
        offset + 30 + filenameLength,
      );
      const dataOffset = offset + 30 + filenameLength + extraFieldLength;

      if (dataOffset + compressedSize <= buffer.length) {
        const compressedData = buffer.subarray(
          dataOffset,
          dataOffset + compressedSize,
        );
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

export function classifyCategory(
  filePath: string,
  content: string,
  format: DocumentFormat,
): DocumentCategory {
  const p = filePath.toLowerCase();
  const c = content.toLowerCase();

  if (
    format === "CSV" ||
    format === "TSV" ||
    format === "XLSX" ||
    format === "XLS"
  ) {
    return "TABULAR_DATASET";
  }
  if (
    format === "LOG" ||
    p.includes("log") ||
    c.includes("[error]") ||
    c.includes("[info]")
  ) {
    return "SYSTEM_LOGS";
  }
  if (
    p.includes("api") ||
    p.includes("swagger") ||
    p.includes("openapi") ||
    c.includes("endpoints") ||
    c.includes("curl http")
  ) {
    return "API_SPECIFICATION";
  }
  if (
    p.includes("license") ||
    p.includes("terms") ||
    p.includes("privacy") ||
    p.includes("compliance") ||
    p.includes("gdpr") ||
    c.includes("copyright")
  ) {
    return "LEGAL_OR_POLICY";
  }
  if (
    p.includes("paper") ||
    p.includes("thesis") ||
    p.includes("research") ||
    p.includes("study") ||
    c.includes("abstract\n") ||
    c.includes("methodology")
  ) {
    return "RESEARCH_OR_ACADEMIC";
  }
  if (
    p.includes("todo") ||
    p.includes("meeting") ||
    p.includes("roadmap") ||
    p.includes("sprint") ||
    p.includes("minutes") ||
    p.includes("changelog")
  ) {
    return "PROJECT_MANAGEMENT_NOTES";
  }
  if (
    format === "JSON" ||
    format === "YAML" ||
    format === "XML" ||
    p.includes("config") ||
    p.includes(".env")
  ) {
    return "CONFIGURATION_DATA";
  }
  if (
    p.includes("guide") ||
    p.includes("doc") ||
    p.includes("readme") ||
    p.includes("manual") ||
    p.includes("arch") ||
    p.includes("spec")
  ) {
    return "TECHNICAL_DOCUMENTATION";
  }
  return "GENERAL_DOCUMENT";
}
