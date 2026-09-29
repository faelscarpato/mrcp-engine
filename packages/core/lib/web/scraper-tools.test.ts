import { describe, it, expect, afterEach, beforeEach, vi } from "vitest";
import {
  searchDuckDuckGo,
  scrapeUrl,
  scrapeUrlOrThrow,
  WebToolError,
  WEB_ERROR_CATEGORY,
} from "./scraper-tools.js";

/**
 * A classificação anti-bot vs. falha de upstream acontece na origem, porque é
 * lá que o status HTTP real e o corpo do provedor ainda existem. Se essa
 * distinção se perde, as rotas voltam a colidir em um único código e o cliente
 * não sabe se deve repetir ou investigar.
 */
function mockFetch(
  impl: (url: string, init?: RequestInit) => Promise<Response> | Response,
) {
  const spy = vi.fn(impl as never);
  globalThis.fetch = spy as never;
  return spy;
}

function res(status: number, body: string): Response {
  return {
    status,
    ok: status >= 200 && status < 300,
    text: async () => body,
  } as unknown as Response;
}

const RESULTS_HTML = `<html><body>
  <div class="result__body">
    <h2 class="result__title"><a class="result__a" href="https://exemplo.dev/a">Titulo A</a></h2>
    <a class="result__url" href="https://exemplo.dev/a">exemplo.dev/a</a>
    <a class="result__snippet">Trecho A</a>
  </div>
</body></html>`;

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});



describe("scraper-tools — classificação de erro de busca", () => {
  it("1. anti-bot 202 vira SEARCH_ANTI_BOT com o status HTTP real", async () => {
    mockFetch(() => res(202, "<html>desafio</html>"));

    await expect(searchDuckDuckGo("qualquer")).rejects.toThrowError(WebToolError);
    await expect(searchDuckDuckGo("qualquer")).rejects.toMatchObject({
      code: "SEARCH_ANTI_BOT",
      httpStatus: 202,
    });
  });

  it("2. anti-bot 429 vira SEARCH_ANTI_BOT", async () => {
    mockFetch(() => res(429, "<html>rate limited</html>"));

    await expect(searchDuckDuckGo("qualquer")).rejects.toThrowError(WebToolError);
    await expect(searchDuckDuckGo("qualquer")).rejects.toMatchObject({
      code: "SEARCH_ANTI_BOT",
      httpStatus: 429,
    });
  });

  it("3. pagina de desafio com HTTP 200 ainda e anti-bot", async () => {
    mockFetch(() =>
      res(200, "<html><body>unusual traffic — are you a robot?</body></html>"),
    );

    await expect(searchDuckDuckGo("qualquer")).rejects.toThrowError(WebToolError);
    await expect(searchDuckDuckGo("qualquer")).rejects.toMatchObject({
      code: "SEARCH_ANTI_BOT",
      httpStatus: 200,
    });
  });

  it("4. HTTP 500 do provedor e SEARCH_UPSTREAM_ERROR, nao bloqueio", async () => {
    mockFetch(() => res(500, "<html>erro interno</html>"));

    await expect(searchDuckDuckGo("qualquer")).rejects.toThrowError(WebToolError);
    await expect(searchDuckDuckGo("qualquer")).rejects.toMatchObject({
      code: "SEARCH_UPSTREAM_ERROR",
      httpStatus: 500,
    });
  });

  it("5. erro de rede/timeout e SEARCH_UPSTREAM_ERROR sem status", async () => {
    mockFetch(() => {
      throw new TypeError("fetch failed");
    });

    await expect(searchDuckDuckGo("qualquer")).rejects.toThrowError(WebToolError);
    await expect(searchDuckDuckGo("qualquer")).rejects.toMatchObject({
      code: "SEARCH_UPSTREAM_ERROR",
      httpStatus: null,
      cause: expect.any(TypeError),
    });
  });

  it("6. busca bem-sucedida devolve resultados e nao lanca", async () => {
    mockFetch(() => res(200, RESULTS_HTML));

    const results = await searchDuckDuckGo("qualquer");

    expect(Array.isArray(results)).toBe(true);
    expect(results.length).toBeGreaterThanOrEqual(0);
  });
});

describe("scraper-tools — classificação de erro de raspagem", () => {
  it("7. 403 no alvo e SCRAPE_ANTI_BOT, propagado por scrapeUrlOrThrow", async () => {
    mockFetch(() => res(403, "<html>forbidden</html>"));

    await expect(scrapeUrlOrThrow("https://alvo.dev")).rejects.toThrowError(WebToolError);
    await expect(scrapeUrlOrThrow("https://alvo.dev")).rejects.toMatchObject({
      code: "SCRAPE_ANTI_BOT",
      httpStatus: 403,
    });
  });

  it("8. 500 no alvo e SCRAPE_UPSTREAM_ERROR", async () => {
    mockFetch(() => res(500, "boom"));

    await expect(scrapeUrlOrThrow("https://alvo.dev")).rejects.toThrowError(WebToolError);
    await expect(scrapeUrlOrThrow("https://alvo.dev")).rejects.toMatchObject({
      code: "SCRAPE_UPSTREAM_ERROR",
      httpStatus: 500,
    });
  });

  it("9. conteudo legitimo com a palavra 'blocked' NAO e classificado como anti-bot", async () => {
    mockFetch(() =>
      res(
        200,
        "<html><head><title>Blog</title></head><body><h1>Post</h1><p>Seu recurso foi blocked por engano.</p></body></html>",
      ),
    );

    const page = await scrapeUrlOrThrow("https://alvo.dev");

    expect(page.title).toBe("Blog");
    expect(page.text).toContain("blocked");
  });

  it("10. scrapeUrl preserva o contrato sentinela (pipeline nao quebra)", async () => {
    mockFetch(() => res(500, "boom"));

    const page = await scrapeUrl("https://alvo.dev");

    expect(page.title).toBe("Erro");
    expect(page.wordCount).toBe(0);
    expect(page.text).toBe("Falha na extração.");
  });

  it("11. a categoria generica antiga continua disponivel", () => {
    expect(WEB_ERROR_CATEGORY).toBe("SEARCH_BLOCKED");
  });
});
