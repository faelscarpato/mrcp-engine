import { searchDuckDuckGo } from "../packages/core/lib/web/scraper-tools.js";

export default async function handler(req: any, res: any) {
  // Configurações de CORS
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method Not Allowed" });
  }

  // Support Vercel API structure (query object) or fallback to search parameters
  let q = req.query?.q;
  if (!q) {
    try {
      const url = new URL(req.url, `http://${req.headers.host}`);
      q = url.searchParams.get("q");
    } catch {
      // ignore URL parsing error
    }
  }

  if (!q) {
    return res.status(400).json({ error: "O parâmetro ?q= é obrigatório." });
  }

  try {
    const results = await searchDuckDuckGo(q as string);
    return res.status(200).json({ query: q, total: results.length, results });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
}
