import { describe, it, expect } from "vitest";
import zlib from "zlib";
import { parsePdfText } from "./pdf-parser.js";

/**
 * Monta um PDF mínimo em memória.
 *
 * Cobre o formato que quebrava em produção: texto em strings hexadecimais
 * (`<0048> Tj`) de fonte com CMap /ToUnicode, que o parser antigo ignorava
 * por só reconhecer strings literais `(...) Tj`.
 */
function buildPdf(opts: {
  toUnicode?: string;
  content: string;
  pageCount?: number;
  /**
   * Nível do deflate. `0` (armazenamento sem compressão) faz o payload
   * comprimido conter os bytes da entrada literalmente — é o que permite
   * plantar um "endstream" falso DENTRO dos dados comprimidos.
   */
  deflateLevel?: number;
  /** Objetos extras (streams de não-conteúdo) anexados após as páginas. */
  extraObjects?: string[];
}): Buffer {
  const objects: string[] = [];

  const contentStream = zlib.deflateSync(
    Buffer.from(opts.content, "latin1"),
    opts.deflateLevel === undefined ? {} : { level: opts.deflateLevel },
  );
  objects.push(
    `<< /Length ${contentStream.length} /Filter /FlateDecode >>\nstream\n${contentStream.toString(
      "latin1",
    )}\nendstream`,
  );
  const contentObjNum = 1;

  let fontObj = "";
  if (opts.toUnicode) {
    const cmap = zlib.deflateSync(Buffer.from(opts.toUnicode, "latin1"));
    objects.push(
      `<< /Length ${cmap.length} /Filter /FlateDecode >>\nstream\n${cmap.toString(
        "latin1",
      )}\nendstream`,
    );
    const cmapObjNum = objects.length; // 2
    fontObj = `/Font << /F1 3 0 R >>`;
    objects.push(
      `<< /Type /Font /Subtype /Type1 /BaseFont /Custom /ToUnicode ${cmapObjNum} 0 R >>`,
    );
    // objetos: 1=content, 2=cmap, 3=font
  } else {
    fontObj = "/Font << >>";
  }

  const pages = opts.pageCount ?? 1;
  objects.push(
    `<< /Type /Pages /Kids [${Array.from(
      { length: pages },
      (_, i) => `${4 + i} 0 R`,
    ).join(" ")}] /Count ${pages} >>`,
  );
  for (let i = 0; i < pages; i++) {
    objects.push(
      `<< /Type /Page /Parent 3 0 R /MediaBox [0 0 612 792] /Resources ${fontObj} /Contents ${contentObjNum} 0 R >>`,
    );
  }

  // Objetos adicionais ao final, para não deslocar a numeração de /Pages.
  if (opts.extraObjects) objects.push(...opts.extraObjects);

  let out = "%PDF-1.4\n";
  objects.forEach((body, i) => {
    out += `${i + 1} 0 obj\n${body}\nendobj\n`;
  });
  out +=
    "trailer\n<< /Root 1 0 R /Size " + (objects.length + 1) + " >>\n%%EOF\n";
  return Buffer.from(out, "latin1");
}

/** CMap simples: códigos de 1 byte -> Unicode. */
const CMAP_1BYTE = `/CIDInit /ProcSet findresource begin
12 dict begin
begincmap
1 beginbfrange
<20> <7e> <0020>
endbfrange
endcmap
end`;

/**
 * CMap no formato bfchar usado por fontes subset de PDF reais, com o glifo de
 * espaço explicitamente mapeado (<01> -> <0020>).
 */
const CMAP_SUBSET = `/CIDInit /ProcSet findresource begin
12 dict begin
begincmap
2 beginbfchar
<01> <0020>
<03> <0043>
<04> <006F>
<05> <0073>
endbfchar
1 beginbfrange
<06> <0B> <0061>
endbfrange
endcmap
end`;

describe("PDF Parser — hex strings e CMap /ToUnicode", () => {
  it("1. extrai texto de strings hexadecimais com CMap de 1 byte", () => {
    // "Pipeline pronto" em hex de 1 byte, emitido glifo a glifo (padrão InDesign/Word)
    const hex = Buffer.from("Pipeline pronto", "latin1")
      .toString("hex")
      .toUpperCase();
    const glyphs = hex
      .match(/.{2}/g)!
      .map((h) => `<${h}>`)
      .join(" ");
    const pdf = buildPdf({
      toUnicode: CMAP_1BYTE,
      content: `BT /F1 12 Tf ${glyphs} Tj ET`,
    });

    const doc = parsePdfText(pdf, "doc.pdf");

    expect(doc.wordCount).toBe(2);
    expect(doc.rawTextSnippet).toContain("Pipeline");
    expect(doc.rawTextSnippet).toContain("pronto");
    expect(doc.qualityScore).toBeGreaterThan(60);
  });

  it("2. nao separa cada glifo em uma palavra quando nao ha reposicionamento", () => {
    const hex = Buffer.from("consolidado", "latin1")
      .toString("hex")
      .toUpperCase();
    const glyphs = hex
      .match(/.{2}/g)!
      .map((h) => `<${h}>`)
      .join(" ");
    const pdf = buildPdf({
      toUnicode: CMAP_1BYTE,
      content: `BT /F1 12 Tf ${glyphs} Tj ET`,
    });

    const doc = parsePdfText(pdf, "doc.pdf");

    // 1 palavra, nao 11 (uma por glifo)
    expect(doc.wordCount).toBe(1);
    expect(doc.rawTextSnippet).toBe("consolidado");
  });

  it("3. respeita operador de posicionamento (Td) como separador de palavras", () => {
    const a = Buffer.from("primeira", "latin1").toString("hex").toUpperCase();
    const b = Buffer.from("segunda", "latin1").toString("hex").toUpperCase();
    const g = (h: string) =>
      h
        .match(/.{2}/g)!
        .map((x) => `<${x}>`)
        .join(" ");
    const pdf = buildPdf({
      toUnicode: CMAP_1BYTE,
      content: `BT /F1 12 Tf ${g(a)} Tj 0 -14 Td ${g(b)} Tj ET`,
    });

    const doc = parsePdfText(pdf, "doc.pdf");

    expect(doc.wordCount).toBe(2);
    expect(doc.rawTextSnippet).toBe("primeira segunda");
  });

  it("4. preserva o suporte a strings literais (Tj)", () => {
    const pdf = buildPdf({ content: "BT /F1 12 Tf (texto literal) Tj ET" });

    const doc = parsePdfText(pdf, "doc.pdf");

    expect(doc.wordCount).toBe(2);
    expect(doc.rawTextSnippet).toBe("texto literal");
  });

  it("5. extrai arrays hexadecimais TJ e trata kerning negativo como espaco", () => {
    // Em TJ o número é subtraído da posição: valor negativo grande abre gap,
    // logo equivale a um espaço. -20 é imperceptível e não separa.
    const pdf = buildPdf({
      toUnicode: CMAP_1BYTE,
      content: `BT /F1 12 Tf [<50> -20 [<69> -400] <70>] TJ ET`,
    });

    const doc = parsePdfText(pdf, "doc.pdf");

    expect(doc.rawTextSnippet).toBe("Pi p");
  });

  it("6. conta paginas via /Count da arvore /Pages", () => {
    const pdf = buildPdf({ content: "BT (x) Tj ET", pageCount: 7 });

    const doc = parsePdfText(pdf, "multi.pdf");

    expect(doc.title).toContain("7 páginas");
  });

  it("7. sinaliza PDF sem texto recuperavel em vez de devolver texto falso", () => {
    const pdf = buildPdf({ content: "q 1 0 0 1 0 0 cm /Im0 Do Q" });

    const doc = parsePdfText(pdf, "scan.pdf");

    expect(doc.wordCount).toBe(0);
    expect(doc.qualityScore).toBe(40);
    expect(doc.qualityIssues[0]?.type).toBe("PLACEHOLDER_TEXT");
    expect(doc.rawTextSnippet).toBe("");
  });

  it("8. nao reune glifos de linhas diferentes em uma unica palavra", () => {
    const h = (s: string) =>
      Buffer.from(s, "latin1")
        .toString("hex")
        .toUpperCase()
        .match(/.{2}/g)!
        .map((x) => `<${x}>`)
        .join(" ");
    const pdf = buildPdf({
      toUnicode: CMAP_1BYTE,
      content: `BT /F1 12 Tf ${h("linha um")} Tj 0 -14 Td ${h("linha dois")} Tj ET`,
    });

    const doc = parsePdfText(pdf, "doc.pdf");

    expect(doc.wordCount).toBe(4);
    expect(doc.rawTextSnippet).toBe("linha um linha dois");
  });

  it("9. monta palavras a partir de glifos individuais com Td por glifo", () => {
    // Padrão real de PDF gerado por InDesign/Word: um <..> Tj por glifo, cada
    // um precedido do avanço via Td, e o espaço vindo do próprio CMap.
    // Um Td por glifo NÃO pode virar espaço, senão sai "C o n s o l i d".
    const codes = [
      [0x03, 9.2],
      [0x04, 8.1],
      [0x05, 9.0],
      [0x01, 8.6],
      [0x06, 4.6],
      [0x07, 5.0],
      [0x08, 8.1],
      [0x01, 7.4],
      [0x06, 4.6],
      [0x0b, 5.0],
    ] as const;
    const ops = codes
      .map(([code, adv], i) =>
        i === 0
          ? `<${code.toString(16).padStart(2, "0")}> Tj`
          : `${adv} 0 Td <${code.toString(16).padStart(2, "0")}> Tj`,
      )
      .join("\n");
    const pdf = buildPdf({
      toUnicode: CMAP_SUBSET,
      content: `BT\n/F7 14 Tf\n1 0 0 -1 51 214 Tm\n${ops}\nET`,
    });

    const doc = parsePdfText(pdf, "subset.pdf");

    // 10 glifos -> 3 palavras, unidas, com os espaços vindos do CMap.
    expect(doc.rawTextSnippet).toBe("Cos abc af");
    expect(doc.wordCount).toBe(3);
  });
});

/**
 * Regressões do parser de streams.
 *
 * O parser antigo empurrava para `chunks` o resultado de
 * `inflate(streamRegex.exec(...)[1])` para TODOS os streams do arquivo, e o
 * `inflate` devolvia os bytes crus quando a descompressão falhava. Isso fazia
 * payload de imagem, fonte, ICC e metadata virarem texto. Os testes abaixo
 * plantam armadilhas que o parser antigo decodificava como texto e o novo
 * precisa descartar.
 */
describe("parsePdfText — descarte de streams", () => {
  /** Monta um stream FlateDecode a partir de bytes arbitrários. */
  function streamObject(dict: string, bytes: Buffer): string {
    const data = zlib.deflateSync(bytes);
    return `<< ${dict} /Length ${data.length} /Filter /FlateDecode >>\nstream\n${data.toString(
      "latin1",
    )}\nendstream`;
  }

  it("10. descarta stream de imagem mesmo contendo operadores de texto", () => {
    // O payload binário planta "(falso) Tj" de propósito: o parser antigo
    // extraía "falso" como palavra real do meio de uma imagem.
    const imageBytes = Buffer.concat([
      Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x00, 0x01]),
      Buffer.from("(falso) Tj", "latin1"),
      Buffer.from([0xff, 0xfe, 0x00, 0x03, 0x42, 0x49, 0x00]),
    ]);

    const pdf = buildPdf({
      content: "BT /F1 12 Tf (real) Tj ET",
      extraObjects: [
        streamObject(
          "/Type /XObject /Subtype /Image /Width 10 /Height 10",
          imageBytes,
        ),
      ],
    });

    const doc = parsePdfText(pdf, "com-imagem.pdf");

    // Só o texto real: nada de "falso" vindo do payload da imagem. Se o
    // parser aceitasse a imagem, wordCount seria 2.
    expect(doc.rawTextSnippet).toBe("real");
    expect(doc.wordCount).toBe(1);
    expect(doc.rawTextSnippet).not.toContain("falso");
  });

  it("11. descarta stream que declara FlateDecode mas não está comprimido", () => {
    // /Filter dishonesto: o parser antigo fazia inflate, falhava e devolvia os
    // bytes crus — binário virava texto. O novo descarta e conta.
    const raw = Buffer.from([0x00, 0x01, 0x02, 0xff, 0xfe, 0x7f, 0x03]);
    const pdf = Buffer.from(
      [
        "%PDF-1.4",
        "1 0 obj",
        `<< /Length ${raw.length} /Filter /FlateDecode >>`,
        "stream",
        raw.toString("latin1"),
        "endstream",
        "endobj",
        "2 0 obj",
        "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
        "endobj",
        "3 0 obj",
        "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 1 0 R >>",
        "endobj",
        "trailer",
        "<< /Root 2 0 R /Size 4 >>",
        "%%EOF",
      ].join("\n"),
      "latin1",
    );

    const doc = parsePdfText(pdf, "filtro-falso.pdf");

    // Binário NÃO pode virar palavra.
    expect(doc.wordCount).toBe(0);
    // Nenhum byte de controle escapou para o texto (exceto \t, \n, \r).
    const temControle = [...doc.rawTextSnippet].some((ch) => {
      const cp = ch.codePointAt(0) ?? 0;
      return cp < 0x20 && cp !== 0x09 && cp !== 0x0a && cp !== 0x0d;
    });
    expect(temControle).toBe(false);
    const info = doc.qualityIssues.find((q) =>
      q.description.includes("indecodificável"),
    );
    expect(info?.severity).toBe("INFO");
  });

  it("12. usa o /Length declarado quando o payload contém 'endstream' falso", () => {
    // Deflate nível 0 (armazenado) copia os bytes da entrada literalmente, então
    // a linha "endstream" do comentário vira o MESMO byte a byte dentro do dado
    // comprimido. O regex antigo (`[\s\S]*?` até o próximo "\nendstream")
    // truncava ali: o inflate falhava e TODO o texto real, que vem DEPOIS,
    // era perdido. Com /Length, o fim exato é o do dicionário.
    const pdf = buildPdf({
      content: "% comentario\nendstream\nBT /F1 12 Tf (conteudo integro) Tj ET",
      deflateLevel: 0,
    });

    const doc = parsePdfText(pdf, "endstream-falso.pdf");

    expect(doc.rawTextSnippet).toBe("conteudo integro");
    expect(doc.wordCount).toBe(2);
    expect(doc.rawTextSnippet).not.toContain("endstream");
  });

  it("13. sinaliza PDF sem /ToUnicode em vez de reportar score inflado", () => {
    // Regressão do pior caso: sem nenhum /ToUnicode o texto é bytes crus
    // lidos como latin1. A legibilidade pode parecer boa (score alto), mas a
    // extração não é confiável — o parse precisa AVISAR, não passar em silêncio.
    const pdf = buildPdf({
      content: "BT /F1 12 Tf (Texto sem ToUnicode) Tj ET",
    });

    const doc = parsePdfText(pdf, "sem-tounicode.pdf");

    expect(doc.wordCount).toBe(3);
    const warning = doc.qualityIssues.find(
      (q) => q.type === "LOW_READABILITY" && q.severity === "WARNING",
    );
    expect(warning).toBeDefined();
    expect(warning?.description).toContain("sem /ToUnicode");
  });
});
