import zlib from "zlib";

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

      const filename = buffer.toString("utf-8", offset + 30, offset + 30 + filenameLength);
      const dataOffset = offset + 30 + filenameLength + extraFieldLength;

      if (dataOffset + compressedSize <= buffer.length) {
        const compressedData = buffer.subarray(dataOffset, dataOffset + compressedSize);
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
