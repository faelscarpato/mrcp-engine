import { smartSearchPipeline } from "../packages/core/lib/web/scraper-tools.js";

export default async function handler(req: any, res: any) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method Not Allowed" });
  }

  let q = req.query?.q;
  let topN = req.query?.topN ? parseInt(req.query.topN as string) : 2;
  let minScore = req.query?.minScore ? parseFloat(req.query.minScore as string) : 0;

  if (!q) {
    try {
      const urlObj = new URL(req.url, `http://${req.headers.host}`);
      q = urlObj.searchParams.get("q");
      if (urlObj.searchParams.has("topN")) topN = parseInt(urlObj.searchParams.get("topN") as string);
      if (urlObj.searchParams.has("minScore")) minScore = parseFloat(urlObj.searchParams.get("minScore") as string);
    } catch {}
  }

  if (!q) {
    return res.status(400).json({ error: "O parâmetro ?q= é obrigatório." });
  }

  try {
    const result = await smartSearchPipeline(q as string, topN, minScore);
    return res.status(200).json(result);
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
}
