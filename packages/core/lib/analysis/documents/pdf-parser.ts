import zlib from "zlib";
import path from "path";
import { ParsedDocument, DocumentSection, classifyCategory } from "./types.js";

/** Mapa CID (ou byte) -> Unicode, extraído dos CMaps /ToUnicode do PDF. */
type CMap = Map<number, string>;

/** CMaps separados por largura de chave (1 byte vs 2 bytes/CID). */
interface CMapSet {
  by1: CMap;
  by2: CMap;
}

/** Resultado da varredura de streams: streams de conteúdo + CMaps. */
interface ExtractedStreams {
  chunks: string[];
  cmaps: CMapSet;
  cmapConflicts: number;
  hasToUnicode: boolean;
  /** Streams de não-conteúdo descartados (imagem, fonte, ICC, metadata...). */
  skippedStreams: number;
  /** Streams de conteúdo que não puderam ser decodificados (lixo/binário). */
  undecodableStreams: number;
}

/**
 * Descomprime um stream. Devolve `null` quando os três formatos falham, para o
 * chamador descartar o stream em vez de tratar bytes crus como texto: devolver
 * os bytes crus fazia uma imagem de 1 MB virar "conteúdo".
 */
function inflate(raw: Buffer): Buffer | null {
  try {
    return zlib.inflateSync(raw);
  } catch {
    try {
      return zlib.inflateRawSync(raw);
    } catch {
      try {
        return zlib.inflateSync(raw, {
          finishFlush: zlib.constants.Z_SYNC_FLUSH,
        });
      } catch {
        return null;
      }
    }
  }
}

/** Dicionários que descrevem streams que NUNCA contêm texto de página. */
const NON_CONTENT_DICT =
  /\/Subtype\s*\/Image|\/FontFile2?3?|\/ICCBased|\/Type\s*\/Metadata|\/Type\s*\/XRef|\/Type\s*\/EmbeddedFile|\/Type\s*\/Sig|\/Filter\s*\/(?:DCTDecode|JPXDecode|CCITTFaxDecode|JBIG2Decode)/;

/** Filtros de imagem/codec que não produzem operadores de texto. */
const NON_TEXT_FILTER =
  /\/Filter\s*(?:\[[^\]]*)?\s*\/(?:DCTDecode|JPXDecode|CCITTFaxDecode|JBIG2Decode)/;

/**
 * Fração de bytes "imprimíveis" (>= 0x20) ou de controle de whitespace.
 * Bytes >= 0x80 contam como texto porque conteúdo em Latin-1 acentuado é
 * comum; o que separa texto de binário é a densidade de bytes de controle
 * (NUL e 0x01-0x08), que imagem e fonte embutida sempre trazem em massa.
 */
function textByteRatio(buf: Buffer): number {
  const sample = buf.subarray(0, Math.min(buf.length, 8192));
  if (sample.length === 0) return 1;
  let ok = 0;
  for (const b of sample) {
    if (b >= 0x20 || b === 9 || b === 10 || b === 12 || b === 13) ok++;
  }
  return ok / sample.length;
}

/**
 * Remove imagens inline (`BI ... ID <binário> EI`) do stream de conteúdo.
 * Sem isso, o hex do payload da imagem casa com o regex de "<hex> Tj" e vira
 * texto falso. O fim é procurado pela única forma válida segundo a
 * especificação: um byte de whitespace, `EI`, e outro whitespace.
 */
function stripInlineImages(text: string): string {
  let out = text;
  let guard = 0;
  for (;;) {
    if (guard++ > 64) return out;
    const bi = out.search(/\bBI\b/);
    if (bi < 0) return out;
    const idIdx = out.indexOf("ID", bi);
    if (idIdx < 0) return out;
    const dataStart = idIdx + 2;
    const endRe = /\sEI[\s\0]/g;
    endRe.lastIndex = dataStart;
    const em = endRe.exec(out);
    if (!em) return out.slice(0, bi);
    out = out.slice(0, bi) + " " + out.slice(em.index + em[0].length);
  }
}

/** Um offset aponta para logo após um `endstream`? */
function looksLikeEndstream(raw: string, at: number): boolean {
  let i = at;
  while (
    i < raw.length &&
    (raw[i] === "\r" || raw[i] === "\n" || raw[i] === " " || raw[i] === "\t")
  )
    i++;
  return raw.startsWith("endstream", i);
}

interface StreamRegion {
  dict: string;
  /** Início do payload (logo após a palavra `stream` e o EOL). */
  dataStart: number;
  /** Offsets candidatos para o fim do payload, em ordem de confiança. */
  ends: number[];
}

/**
 * Localiza os streams por varredura, não por regex de palavra-chave.
 *
 * `/stream[\s\S]*?endstream/` casava "stream" dentro de "endstream", e um
 * "endstream" falso no meio de dados comprimidos truncaba o stream real
 * (perda silenciosa de conteúdo). Aqui a ocorrência precisa ser um início de
 * stream de verdade (não precedida de "end") e o fim vem primeiro do /Length
 * declarado — que é exato — caindo para varredura de "endstream" só quando o
 * comprimento é indireto ou inconsistente.
 */
function findStreamRegions(raw: string): StreamRegion[] {
  const regions: StreamRegion[] = [];
  let from = 0;

  for (;;) {
    const hit = raw.indexOf("stream", from);
    if (hit < 0) break;
    from = hit + 6;

    // "endstream" contém "stream": só vale o que não for sufixo de "end".
    if (raw.startsWith("endstream", hit - 3)) continue;
    // Precisa ser palavra isolada seguida de fim de linha.
    const after = raw[hit + 6];
    if (after !== "\n" && after !== "\r") continue;
    const before = raw[hit - 1];
    if (before !== undefined && !/[\s>]/.test(before)) continue;

    let dataStart = hit + 6;
    if (raw[dataStart] === "\r") dataStart++;
    if (raw[dataStart] === "\n") dataStart++;

    const objStart = raw.lastIndexOf("obj", hit);
    const dictAt = raw.lastIndexOf("<<", hit);
    const dictStart = dictAt > objStart ? dictAt : Math.max(0, hit - 4000);
    const dict = raw.slice(dictStart, hit);

    const ends: number[] = [];
    // /Length direto é exato. Referência indireta ("12 0 R") NÃO é.
    const directLen = /\/Length\s+(\d+)(?!\s+\d+\s+R)\b/.exec(dict);
    if (directLen) {
      const candidate = dataStart + parseInt(directLen[1], 10);
      if (candidate <= raw.length && looksLikeEndstream(raw, candidate)) {
        ends.push(candidate);
      }
    }
    // Fallback: candidatos por "endstream". Vários porque um deles pode ser
    // lixo dentro de dados comprimidos; o chamador testa um a um.
    let scan = dataStart;
    for (let n = 0; n < 8; n++) {
      const idx = raw.indexOf("endstream", scan);
      if (idx < 0) break;
      if (!ends.includes(idx)) ends.push(idx);
      scan = idx + 9;
    }
    if (ends.length === 0) ends.push(raw.length);

    regions.push({ dict, dataStart, ends });
  }

  return regions;
}

/**
 * Extrai os streams de CONTEÚDO, coletando os CMaps /ToUnicode.
 * Streams de imagem, fonte, ICC e metadata nunca entram em `chunks`, e o que
 * não decodificar é descartado e contado, nunca tratado como texto.
 */
function extractStreams(buffer: Buffer): ExtractedStreams {
  const rawStr = buffer.toString("latin1");
  const chunks: string[] = [];
  const cmaps: CMapSet = { by1: new Map(), by2: new Map() };
  let cmapConflicts = 0;
  let hasToUnicode = false;
  let skippedStreams = 0;
  let undecodableStreams = 0;

  for (const region of findStreamRegions(rawStr)) {
    if (
      NON_CONTENT_DICT.test(region.dict) ||
      NON_TEXT_FILTER.test(region.dict)
    ) {
      skippedStreams++;
      continue;
    }

    // Sem /Filter o payload É o conteúdo (stream não comprimido é comum):
    // descomprimir bytes de texto falharia e o conteúdo seria perdido.
    const filtered = /\/Filter/.test(region.dict);

    let data: Buffer | null = null;
    for (const end of region.ends) {
      const candidate = Buffer.from(
        rawStr.slice(region.dataStart, end),
        "latin1",
      );
      if (!filtered) {
        data = candidate;
        break;
      }
      const inflated = inflate(candidate);
      if (inflated) {
        data = inflated;
        break;
      }
    }

    if (!data || data.length === 0) {
      undecodableStreams++;
      continue;
    }

    // Rede de segurança: mesmo passando pelo dicionário, um payload que não é
    // texto não entra em `chunks` sob nenhuma hipótese.
    if (textByteRatio(data) < 0.9) {
      skippedStreams++;
      continue;
    }

    const text = data.toString("latin1");
    if (
      text.includes("begincmap") ||
      text.includes("beginbfchar") ||
      text.includes("beginbfrange")
    ) {
      hasToUnicode = true;
      cmapConflicts += parseToUnicodeCMap(text, cmaps);
      continue;
    }
    chunks.push(stripInlineImages(text));
  }

  return {
    chunks,
    cmaps,
    cmapConflicts,
    hasToUnicode,
    skippedStreams,
    undecodableStreams,
  };
}

/** Converte bytes UTF-16BE (2 bytes por code unit) em string. */
function hexToUtf16(hex: string): string {
  const clean = hex.replace(/[^0-9A-Fa-f]/g, "");
  if (clean.length === 0) return "";
  const padded =
    clean.length % 4 === 0
      ? clean
      : clean.padEnd(clean.length + (4 - (clean.length % 4)), "0");
  let out = "";
  for (let i = 0; i < padded.length; i += 4) {
    out += String.fromCharCode(parseInt(padded.slice(i, i + 4), 16));
  }
  return out;
}

/** Lê um único par de bytes (1 byte) como latin1. */
function hexToLatin1(hex: string): string {
  const clean = hex.replace(/[^0-9A-Fa-f]/g, "");
  let out = "";
  for (let i = 0; i + 1 < clean.length; i += 2) {
    out += String.fromCharCode(parseInt(clean.slice(i, i + 2), 16));
  }
  return out;
}

/**
 * Parseia um CMap /ToUnicode (bfchar e bfrange) e mescla no conjunto.
 * A largura da chave (2 hex = 1 byte, 4 hex = 2 bytes/CID) é detectada do
 * próprio CMap — misturar as duas produz texto corrompido.
 * Retorna quantos códigos entraram em conflito com um mapeamento já existente.
 */
function parseToUnicodeCMap(text: string, set: CMapSet): number {
  let conflicts = 0;

  const merge = (target: CMap, src: number, dst: string) => {
    if (!dst) return;
    const prev = target.get(src);
    if (prev !== undefined && prev !== dst) conflicts++;
    target.set(src, dst);
  };

  // <src> <dst>  — um par por linha dentro de beginbfchar/endbfchar
  const bfcharBlock = /beginbfchar([\s\S]*?)endbfchar/g;
  let block: RegExpExecArray | null;
  while ((block = bfcharBlock.exec(text)) !== null) {
    const pairRe = /<([0-9A-Fa-f]+)>\s*<([0-9A-Fa-f\s]*)>/g;
    let pair: RegExpExecArray | null;
    while ((pair = pairRe.exec(block[1])) !== null) {
      const srcHex = pair[1].replace(/[^0-9A-Fa-f]/g, "");
      if (!srcHex) continue;
      const dst = hexToUtf16(pair[2]);
      merge(srcHex.length <= 2 ? set.by1 : set.by2, parseInt(srcHex, 16), dst);
    }
  }

  // <start> <end> <dstStart>   ou   <start> <end> [<d1> <d2> ...]
  const bfrangeBlock = /beginbfrange([\s\S]*?)endbfrange/g;
  while ((block = bfrangeBlock.exec(text)) !== null) {
    const body = block[1];
    const rangeRe =
      /<([0-9A-Fa-f]+)>\s*<([0-9A-Fa-f]+)>\s*(?:<([0-9A-Fa-f\s]*)>|\[([\s\S]*?)\])/g;
    let range: RegExpExecArray | null;
    while ((range = rangeRe.exec(body)) !== null) {
      const startHex = range[1].replace(/[^0-9A-Fa-f]/g, "");
      const start = parseInt(startHex, 16);
      const end = parseInt(range[2], 16);
      if (
        !startHex ||
        !Number.isFinite(start) ||
        !Number.isFinite(end) ||
        end < start
      ) {
        continue;
      }
      // Protege contra tabelas degeneradas que estourariam memória.
      if (end - start > 65535) continue;
      const target = startHex.length <= 2 ? set.by1 : set.by2;

      if (range[3] !== undefined) {
        const baseHex = range[3].replace(/[^0-9A-Fa-f]/g, "");
        const base =
          baseHex.length >= 4
            ? parseInt(baseHex.slice(-4), 16)
            : parseInt(baseHex, 16);
        if (!Number.isFinite(base)) continue;
        for (let cid = start; cid <= end; cid++) {
          merge(target, cid, String.fromCharCode(base + (cid - start)));
        }
      } else if (range[4] !== undefined) {
        const items = range[4].match(/<([0-9A-Fa-f\s]*)>/g) || [];
        for (let i = 0; i < items.length; i++) {
          merge(
            target,
            start + i,
            hexToUtf16(items[i].replace(/[^0-9A-Fa-f]/g, "")),
          );
        }
      }
    }
  }

  return conflicts;
}

/** Decodifica uma string hexadecimal usando o CMap na largura dada. */
function decodeHexString(hex: string, cmap: CMap, width: 1 | 2): string {
  const clean = hex.replace(/[^0-9A-Fa-f]/g, "");
  if (!clean) return "";

  const step = width * 2;
  const padded =
    clean.length % step === 0
      ? clean
      : clean.padEnd(clean.length + (step - (clean.length % step)), "0");
  let out = "";
  let unknown = 0;
  for (let i = 0; i < padded.length; i += step) {
    const code = parseInt(padded.slice(i, i + step), 16);
    const mapped = cmap.get(code);
    if (mapped !== undefined) out += mapped;
    else unknown++;
  }
  // Se nada foi mapeado, não é texto recuperável (imagem/bitmap, ou fonte sem
  // ToUnicode). Devolver vazio é honesto; devolver o código cru seria lixo.
  if (unknown > 0 && out.length === 0) return "";
  return out;
}

function unescapeLiteral(raw: string): string {
  return raw
    .replace(/\\([()\\])/g, "$1")
    .replace(/\\n/g, "\n")
    .replace(/\\r/g, "\r")
    .replace(/\\t/g, "\t");
}

/** Conta páginas via árvore /Pages (/Count) e cai para /Type /Page. */
function countPages(rawStr: string): number {
  const counts = rawStr.match(/\/Type\s*\/Pages\b[^>]*?\/Count\s+(\d+)/g);
  if (counts) {
    let best = 0;
    for (const c of counts) {
      const n = parseInt(c.match(/\/Count\s+(\d+)/)?.[1] ?? "0", 10);
      if (n > best) best = n;
    }
    if (best > 0) return best;
  }
  const pageMatches = rawStr.match(/\/Type\s*\/Page\b/g);
  return pageMatches ? pageMatches.length : 1;
}

/**
 * Extrai texto de todos os streams.
 *
 * Operadores de posicionamento (Td, TD, T-star e Tm) são honrados como
 * separadores de palavra; glifos consecutivos sem reposicionamento são
 * concatenados. Sem isso, PDFs que emitem um glifo por vez viram
 * "C o n s o l i d".
 */
function extractText(
  chunks: string[],
  hexDecoder: (hex: string) => string,
): { text: string; lineCount: number } {
  let out = "";
  let pendingBreak = false;
  let lineCount = 0;

  // Estado de posicionamento, usado só como fallback para inserção de espaços.
  // A maioria dos PDFs traz o glifo de espaço no próprio /ToUnicode, e aí o
  // CMap já entrega " " — não devemos duplicar nem inventar separadores.
  let curX = NaN;
  let curY = NaN;
  let pendingGap = 0;
  const deltas: number[] = [];

  const median = () => {
    if (deltas.length < 3) return 0;
    const s = [...deltas].sort((a, b) => a - b);
    return s[Math.floor(s.length / 2)];
  };

  const observe = (dx: number) => {
    if (Number.isFinite(dx) && dx > 0.05) {
      deltas.push(dx);
      if (deltas.length > 12) deltas.shift();
    }
  };

  const push = (s: string) => {
    if (!s) return;
    if (pendingBreak && out && !out.endsWith(" ") && !s.startsWith(" "))
      out += " ";
    pendingBreak = false;
    out += s;
    pendingGap = 0;
  };

  for (const streamText of chunks) {
    // Numa passada só, casando: array TJ (com um nível de aninhamento),
    // sequências de hex antes de um Tj, string literal e posicionamento.
    const re =
      /(\[(?:[^[\]]|\[[^[\]]*\])*\]\s*TJ)|((?:<[0-9A-Fa-f\s]+>[ \t]*)+Tj)|(\((?:[^()\\]|\\.)*\)\s*Tj)|(-?[\d.]+)[ \t]+(-?[\d.]+)[ \t]+T[dD]\b|(-?[\d.]+)[ \t]+(-?[\d.]+)[ \t]+(-?[\d.]+)[ \t]+(-?[\d.]+)[ \t]+(-?[\d.]+)[ \t]+(-?[\d.]+)[ \t]+Tm\b|\bT\*\b/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(streamText)) !== null) {
      // m[0] é o match completo; os grupos de captura começam em m[1].
      const [, arrayTok, hexRunTok, litTok, tdX, tdY, , , , , tmX, , tmY] = m;

      // Deslocamento relativo (Td/TD): eixo X é avanço do glifo; eixo Y
      // diferente de zero significa nova linha, não espaço na mesma linha.
      if (tdX !== undefined) {
        const dx = Math.abs(parseFloat(tdX));
        const dy = Math.abs(parseFloat(tdY ?? "0"));
        if (dy > 0.5) {
          pendingBreak = true;
          curX = NaN;
          curY = NaN;
        } else if (dx > 0) {
          observe(dx);
          pendingGap += dx;
        }
        continue;
      }

      // Matriz de texto absoluta (Tm): comparamos com a posição anterior para
      // deduzir avanço horizontal; mudança de Y é outra linha.
      if (tmX !== undefined && tmY !== undefined) {
        const x = parseFloat(tmX);
        const y = parseFloat(tmY);
        if (Number.isFinite(curX) && Number.isFinite(curY)) {
          if (Math.abs(y - curY) > 0.5) pendingBreak = true;
          else {
            const dx = Math.abs(x - curX);
            observe(dx);
            pendingGap += dx;
          }
        }
        curX = x;
        curY = y;
        continue;
      }

      // T* avança para a próxima linha.
      if (m[0] === "T*") {
        pendingBreak = true;
        curX = NaN;
        curY = NaN;
        continue;
      }

      // Fallback: se o texto ainda não tem nenhum espaço e o avanço for um
      // outlier claro, inserimos o separador que o CMap não forneceu.
      const base = median();
      if (base > 0 && !out.includes(" ") && pendingGap > base * 1.6) {
        pendingBreak = true;
      }

      if (arrayTok) {
        const inner = arrayTok.slice(
          arrayTok.indexOf("[") + 1,
          arrayTok.lastIndexOf("]"),
        );
        // Números de ajuste dentro do array TJ codificam o espaço entre
        // palavras: um kerning grande significa um espaço real.
        const parts = inner.split(
          /(<[0-9A-Fa-f\s]*>|\((?:[^()\\]|\\.)*\)|-?\d+(?:\.\d+)?)/g,
        );
        let piece = "";
        for (const part of parts) {
          if (/^<[0-9A-Fa-f\s]*>$/.test(part)) {
            piece += hexDecoder(part.replace(/[<>]/g, ""));
          } else if (/^\((?:[^()\\]|\\.)*\)$/.test(part)) {
            piece += unescapeLiteral(part.slice(1, -1));
          } else if (/^-?\d+(\.\d+)?$/.test(part)) {
            if (Math.abs(parseFloat(part)) >= 100) piece += " ";
          }
        }
        push(piece);
        lineCount++;
        continue;
      }

      if (hexRunTok) {
        // Sequências do tipo "<63> <6F> <6E> Tj" descrevem glifos consecutivos
        // sem reposicionamento: concatenam, sem espaço.
        const hexes = hexRunTok.match(/<[0-9A-Fa-f\s]*>/g) || [];
        const piece = hexes
          .map((h) => hexDecoder(h.replace(/[<>]/g, "")))
          .join("");
        push(piece);
        lineCount++;
        continue;
      }

      if (litTok) {
        // litTok = "(texto) Tj" -> queremos "texto".
        const body = litTok.replace(/\s*Tj$/, "");
        push(unescapeLiteral(body.slice(1, -1)));
        lineCount++;
        continue;
      }
    }
  }

  return { text: out.replace(/[ \t]+/g, " ").trim(), lineCount };
}

/**
 * Nota de legibilidade: proporção de caracteres "de texto" (letras, números,
 * pontuação comum) sobre o total. Usada para escolher a variante de decodificação
 * e para não emitir glyph IDs crus como se fossem conteúdo.
 */
function readabilityScore(text: string): number {
  if (!text) return 0;
  let good = 0;
  for (const ch of text) {
    if (/[\p{L}\p{N}\s.,;:!?%()[\]'"–—-]/u.test(ch)) good++;
  }
  return good / text.length;
}

type Variant = {
  text: string;
  lineCount: number;
  score: number;
  label: string;
};

export function parsePdfText(buffer: Buffer, filePath: string): ParsedDocument {
  const rawStr = buffer.toString("latin1");
  const pageCount = countPages(rawStr);
  let title = path.basename(filePath, ".pdf");
  const titleMatch = rawStr.match(/\/Title\s*\(([^)]+)\)/i);
  if (titleMatch) title = titleMatch[1];

  const {
    chunks,
    cmaps,
    cmapConflicts,
    hasToUnicode,
    skippedStreams,
    undecodableStreams,
  } = extractStreams(buffer);

  // Candidatos: cada largura de CMap presente e, como rede de segurança, latin1
  // (algumas fontes simples codificam ASCII direto em hex, sem /ToUnicode).
  const variants: Variant[] = [];
  const add = (label: string, decoder: (hex: string) => string) => {
    const { text, lineCount } = extractText(chunks, decoder);
    variants.push({ text, lineCount, score: readabilityScore(text), label });
  };
  if (cmaps.by1.size > 0)
    add("cmap-1byte", (h) => decodeHexString(h, cmaps.by1, 1));
  if (cmaps.by2.size > 0)
    add("cmap-2byte", (h) => decodeHexString(h, cmaps.by2, 2));
  add("latin1", hexToLatin1);

  // Vence a variante mais legível; empate é resolvido pelo desempate estável.
  variants.sort((a, b) => b.score - a.score);
  const best = variants[0];

  // Vencer como "latin1" significa que NENHUM /ToUnicode produziu texto: ou o
  // PDF não tem ToUnicode, ou tem e ele não cobriu os glifos usados. Nos dois
  // casos a extração é bytes crus interpretados como caractere, então ela é
  // sinalizada SEMPRE — inclusive quando a legibilidade parece boa. Antes a
  // condição exigia `hasToUnicode && score < 0.6`, ou seja, o pior caso
  // (sem ToUnicode algum) passava com score alto e nenhum aviso.
  const usedLatin1 = best.label === "latin1";

  const fullText = best.text;
  const wordCount = fullText.split(/\s+/).filter(Boolean).length;

  const qualityIssues: ParsedDocument["qualityIssues"] = [];
  if (wordCount === 0) {
    qualityIssues.push({
      severity: "WARNING",
      type: "PLACEHOLDER_TEXT",
      description: hasToUnicode
        ? "PDF sem camada de texto recuperável apesar de conter CMaps /ToUnicode (possível imagem escaneada; requer OCR futuro)."
        : "PDF sem camada de texto recuperável: nenhuma string Tj/TJ e nenhuma fonte com /ToUnicode (possível imagem escaneada ou fonte não mapeada; requer OCR futuro).",
    });
  } else {
    if (usedLatin1) {
      qualityIssues.push({
        severity: "WARNING",
        type: "LOW_READABILITY",
        description: hasToUnicode
          ? "Nenhum /ToUnicode do PDF decodificou os glifos usados; o texto foi lido como latin1 a partir de bytes crus e pode conter caracteres incorretos."
          : "PDF sem /ToUnicode: o texto foi lido como latin1 a partir de bytes crus e pode conter caracteres incorretos.",
      });
    }
    if (cmapConflicts > 0) {
      qualityIssues.push({
        severity: "INFO",
        type: "LOW_READABILITY",
        description: `${cmapConflicts} código(s) com mapeamentos /ToUnicode conflitantes entre fontes; texto pode conter caracteres trocados.`,
      });
    }
  }

  // Sinaliza o que foi descartado: streams de não-conteúdo (imagem, fonte
  // embutida, ICC, metadata) e streams de conteúdo indecodificáveis. INFO de
  // propósito — não é defeito do documento, é o parser recusando inventar texto.
  if (skippedStreams > 0 || undecodableStreams > 0) {
    qualityIssues.push({
      severity: "INFO",
      type: "LOW_READABILITY",
      description: `${skippedStreams} stream(s) de não-conteúdo ignorado(s) (imagem, fonte, ICC ou metadata) e ${undecodableStreams} stream(s) de conteúdo indecodificável(is) foram descartados em vez de tratados como texto.`,
    });
  }

  const hasWarning = qualityIssues.some((q) => q.severity === "WARNING");

  return {
    path: filePath,
    filename: path.basename(filePath),
    format: "PDF",
    category: classifyCategory(filePath, fullText, "PDF"),
    sizeBytes: buffer.length,
    wordCount,
    lineCount: best.lineCount,
    estimatedReadingMinutes: Math.max(1, Math.ceil(wordCount / 200)),
    title: `${title} (${pageCount} páginas)`,
    sections:
      wordCount > 0
        ? [
            {
              level: 1,
              title,
              characterCount: fullText.length,
              wordCount,
              hasContent: true,
            },
          ]
        : [],
    tables: [],
    links: [],
    keyTerms: fullText.split(/\s+/).filter(Boolean).slice(0, 10),
    qualityScore:
      wordCount === 0 ? 40 : hasWarning ? 65 : cmapConflicts > 0 ? 78 : 88,
    qualityIssues,
    rawTextSnippet: fullText.slice(0, 500),
  };
}
