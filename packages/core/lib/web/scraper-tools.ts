// --- Dynamic Cheerio Loader with Native Regex Fallback ---
async function loadCheerio(): Promise<any> {
  try {
    const mod = await import("cheerio");
    return (mod as { default?: unknown }).default ?? mod;
  } catch {
    return null;
  }
}

/**
 * Códigos de erro estáveis das ferramentas de busca/scraping.
 *
 * Anti-bot e falha de upstream NÃO são a mesma coisa para o cliente: o
 * primeiro é temporário (esperar/backoff e repetir), o segundo exige
 * investigação (o provedor está fora do ar ou a rede falhou). Antes os dois
 * colapsavam em um único "SEARCH_BLOCKED", indistinguível na prática.
 */
export type WebToolErrorCode =
  | "SEARCH_ANTI_BOT"
  | "SEARCH_UPSTREAM_ERROR"
  | "SCRAPE_ANTI_BOT"
  | "SCRAPE_UPSTREAM_ERROR";

/** Categoria genérica preservada para clientes que só conhecem este rótulo. */
export const WEB_ERROR_CATEGORY = "SEARCH_BLOCKED";

/**
 * Erro tipado das ferramentas de rede. `httpStatus` carrega o status real do
 * provedor quando existe (null em timeout/erro de rede), para o cliente poder
 * decidir sem analisar a mensagem.
 */
export class WebToolError extends Error {
  readonly code: WebToolErrorCode;
  readonly httpStatus: number | null;
  override readonly cause: unknown;

  constructor(
    code: WebToolErrorCode,
    message: string,
    httpStatus: number | null = null,
    cause?: unknown,
  ) {
    super(message);
    this.name = "WebToolError";
    this.code = code;
    this.httpStatus = httpStatus;
    this.cause = cause;
  }
}

// --- Tipagens de Saída ---
export interface SearchResult {
  title: string;
  url: string;
  snippet: string;
}

export interface ScrapedPage {
  title: string;
  headings: string[];
  wordCount: number;
  text: string;
}

export interface RankedResult extends SearchResult {
  score: number;
  coverage: number;
  matched: string[];
  missing: string[];
}

export interface SmartSearchResult {
  keywords: string[];
  results: RankedResult[];
  scraped: Array<{
    url: string;
    page: ScrapedPage;
  }>;
}

// --- Helpers e Stopwords ---
const STOPWORDS = new Set([
  "o",
  "a",
  "os",
  "as",
  "um",
  "uma",
  "uns",
  "umas",
  "de",
  "do",
  "da",
  "dos",
  "das",
  "em",
  "no",
  "na",
  "nos",
  "nas",
  "por",
  "para",
  "com",
  "sem",
  "que",
  "como",
  "e",
  "ou",
  "mas",
  "se",
  "ate",
  "sobre",
  "ao",
  "aos",
  "qual",
  "quais",
  "onde",
  "quando",
]);

function normalizeText(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\w\s]/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function extractKeywords(query: string): string[] {
  const words = normalizeText(query).split(" ");
  return words.filter((w) => w.length > 1 && !STOPWORDS.has(w));
}

const FETCH_HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
  "Accept-Language": "pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7",
};

// --- Ferramenta 1: Busca Simples (DuckDuckGo) ---
/**
 * O DuckDuckGo responde 202/429 com uma página de desafio anti-bot em vez de
 * erro HTTP. Sem esta detecção, o parser encontra zero resultados e a busca
 * "funciona" devolvendo [] silenciosamente. Nunca devolvemos resultados
 * inventados: sinalizamos o bloqueio para o chamador decidir.
 */
function isAntiBotPage(status: number, html: string): boolean {
  if (status === 202 || status === 429) return true;
  return /anomaly|unusual traffic|are you a robot|captcha|challenge-form|blocked/i.test(
    html,
  );
}

/**
 * Detecção de bloqueio para alvos ARBITRÁRIOS (não para o endpoint do DDG).
 * Não reaproveita `isAntiBotPage` de propósito: o padrão `/blocked/i` lá é
 * seguro porque a resposta é sempre a página de desafio do DuckDuckGo, enquanto
 * num site qualquer a palavra "blocked" aparece no conteúdo legítimo e
 * classificaria uma raspagem bem-sucedida como bloqueio.
 */
const CHALLENGE_MARKERS =
  /anomaly|unusual traffic|are you a robot|captcha|challenge-form|just a moment/i;

function isScrapeBlocked(status: number, html: string): boolean {
  if (status === 202 || status === 403 || status === 429) return true;
  return CHALLENGE_MARKERS.test(html);
}

async function fetchDuckDuckGoHtml(
  query: string,
): Promise<{ status: number; html: string }> {
  const url = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`;
  let res: Response;
  try {
    res = await fetch(url, {
      headers: FETCH_HEADERS,
      cache: "no-store",
    });
  } catch (err) {
    // Timeout/DNS/rede: nunca chegou a existir resposta do provedor, logo não
    // é bloqueio — é falha de upstream e precisa de investigação.
    throw new WebToolError(
      "SEARCH_UPSTREAM_ERROR",
      `Falha de rede ao contatar o DuckDuckGo: ${
        err instanceof Error ? err.message : String(err)
      }`,
      null,
      err,
    );
  }
  const html = await res.text();

  // Sem retentativa: o DDG limita por IP e insistir em rajada só prolonga o
  // bloqueio. O chamador decide o backoff.
  if (isAntiBotPage(res.status, html)) {
    throw new WebToolError(
      "SEARCH_ANTI_BOT",
      `DuckDuckGo bloqueou a busca (anti-bot, HTTP ${res.status}). Tente novamente em instantes.`,
      res.status,
    );
  }
  if (!res.ok) {
    throw new WebToolError(
      "SEARCH_UPSTREAM_ERROR",
      `Falha HTTP do DuckDuckGo: ${res.status}`,
      res.status,
    );
  }
  return { status: res.status, html };
}

export async function searchDuckDuckGo(query: string): Promise<SearchResult[]> {
  const { html } = await fetchDuckDuckGoHtml(query);
  const cheerio = await loadCheerio();
  const results: SearchResult[] = [];

  if (cheerio) {
    const $ = cheerio.load(html);
    $(".result__body").each((_: any, el: any) => {
      const title = $(el).find(".result__title .result__a").text().trim();
      const rawUrl = $(el).find(".result__url").attr("href") ?? "";
      const snippet = $(el).find(".result__snippet").text().trim();

      // Desofusca a URL do DuckDuckGo
      let url = rawUrl;
      if (url.startsWith("//duckduckgo.com/l/?uddg=")) {
        try {
          const urlObj = new URL(`https:${url}`);
          url = decodeURIComponent(urlObj.searchParams.get("uddg") || rawUrl);
        } catch {
          /* ignora erro de parse */
        }
      }

      if (title && url) {
        results.push({ title, url, snippet });
      }
    });
  } else {
    // Fallback regex resiliente caso cheerio não esteja instalado
    const titleRegex =
      /<a[^>]*class="[^"]*result__a[^"]*"[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi;
    let match: RegExpExecArray | null;
    while ((match = titleRegex.exec(html)) !== null) {
      const rawUrl = match[1];
      const title = match[2].replace(/<[^>]+>/g, "").trim();
      let url = rawUrl;
      if (url.startsWith("//duckduckgo.com/l/?uddg=")) {
        try {
          const urlObj = new URL(`https:${url}`);
          url = decodeURIComponent(urlObj.searchParams.get("uddg") || rawUrl);
        } catch {
          /* ignore decode error */
        }
      }
      if (title && url) {
        results.push({ title, url, snippet: title });
      }
    }
  }

  return results;
}

// --- Ferramenta 2: Scraper Limpo ---
/**
 * Raspagem que PROPAGA erro tipado. Use quando o chamador precisa distinguir
 * bloqueio de upstream de sucesso. O pipeline engole a falha e devolve uma
 * página sentinela, o que é correto para o pipeline (um resultado ruim não
 * deve derrubar a busca inteira). Mas a rota HTTP precisa que este erro
 * propague para responder 4xx/5xx em vez de 200 com "Erro".
 */
export async function scrapeUrl(url: string): Promise<ScrapedPage> {
  let res: Response;
  try {
    res = await fetch(url, { headers: FETCH_HEADERS, cache: "no-store" });
  } catch (err) {
    throw new WebToolError(
      "SCRAPE_UPSTREAM_ERROR",
      `Falha de rede ao acessar ${url}: ${
        err instanceof Error ? err.message : String(err)
      }`,
      null,
      err,
    );
  }

  const html = await res.text();
  if (isScrapeBlocked(res.status, html)) {
    throw new WebToolError(
      "SCRAPE_ANTI_BOT",
      `Alvo bloqueou a raspagem (anti-bot, HTTP ${res.status}): ${url}`,
      res.status,
    );
  }
  if (!res.ok) {
    throw new WebToolError(
      "SCRAPE_UPSTREAM_ERROR",
      `Falha HTTP ao acessar ${url}: ${res.status}`,
      res.status,
    );
  }

  const cheerio = await loadCheerio();

  let title = url;
  const headings: string[] = [];
  let cleanText = "";

  if (cheerio) {
    const $ = cheerio.load(html);

    // Remove a poluição da DOM para economizar tokens
    $(
      "script, style, nav, footer, header, aside, iframe, noscript, svg, form, button",
    ).remove();

    title = $("title").text().trim() || url;

    $("h1, h2, h3").each((_: any, el: any) => {
      const hText = $(el).text().trim();
      if (hText) headings.push(hText);
    });

    const rawText = $("body").text();
    cleanText = rawText.replace(/\s+/g, " ").trim();
  } else {
    // Fallback regex sem dependência externa
    const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
    if (titleMatch) title = titleMatch[1].replace(/<[^>]+>/g, "").trim();

    const hRegex = /<h[1-3][^>]*>([\s\S]*?)<\/h[1-3]>/gi;
    let hMatch: RegExpExecArray | null;
    while ((hMatch = hRegex.exec(html)) !== null) {
      const h = hMatch[1].replace(/<[^>]+>/g, "").trim();
      if (h) headings.push(h);
    }

    cleanText = html
      .replace(/<script[\s\S]*?<\/script>/gi, " ")
      .replace(/<style[\s\S]*?<\/style>/gi, " ")
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  }

  return {
    title,
    headings: headings.slice(0, 10), // Limitado aos 10 principais
    wordCount: cleanText.split(" ").length,
    text: cleanText.substring(0, 12000), // Hard-limit de 12k caracteres
  };
}

// --- Ferramenta 3: Rankeador ---
function rankResults(query: string, results: SearchResult[]): RankedResult[] {
  const keywords = extractKeywords(query);
  if (keywords.length === 0)
    return results.map((r) => ({
      ...r,
      score: 0,
      coverage: 0,
      matched: [],
      missing: [],
    }));

  const normalizedQuery = normalizeText(query);

  return results
    .map((result, index) => {
      let score = 0;
      const matched = new Set<string>();
      const normTitle = normalizeText(result.title);
      const normUrl = normalizeText(result.url);
      const normSnippet = normalizeText(result.snippet);

      keywords.forEach((kw) => {
        let kwScore = 0;
        if (normTitle.includes(kw)) {
          kwScore += 3;
          matched.add(kw);
        }
        if (normUrl.includes(kw)) {
          kwScore += 2;
          matched.add(kw);
        }
        if (normSnippet.includes(kw)) {
          kwScore += 1;
          matched.add(kw);
        }
        score += kwScore;
      });

      if (normTitle.includes(normalizedQuery)) score += 5;
      if (normSnippet.includes(normalizedQuery)) score += 3;

      score -= index * 0.1; // Penalidade leve por estar mais abaixo na busca original

      const missing = keywords.filter((kw) => !matched.has(kw));
      return {
        ...result,
        score: Number(Math.max(0, score).toFixed(2)),
        coverage: Number((matched.size / keywords.length).toFixed(2)),
        matched: Array.from(matched),
        missing,
      };
    })
    .sort((a, b) => b.score - a.score);
}

// --- Ferramenta 4: Pipeline Completo (Orquestrador) ---
export async function smartSearchPipeline(
  query: string,
  topN: number = 2,
  minScore: number = 0,
): Promise<SmartSearchResult> {
  const rawResults = await searchDuckDuckGo(query);
  const keywords = extractKeywords(query);
  const ranked = rankResults(query, rawResults);

  const bestResults = ranked.filter((r) => r.score >= minScore).slice(0, topN);

  const scrapedPromises = bestResults.map(async (res) => {
    try {
      const page = await scrapeUrl(res.url);
      return { url: res.url, page };
    } catch (e) {
      return {
        url: res.url,
        page: {
          title: "Erro",
          headings: [],
          wordCount: 0,
          text: "Falha na extração.",
        },
      };
    }
  });

  const scraped = await Promise.all(scrapedPromises);

  return { keywords, results: bestResults, scraped };
}
