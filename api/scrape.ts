import { scrapeUrl } from "../packages/core/lib/web/scraper-tools.js";

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

  let urlParam = req.query?.url;
  if (!urlParam) {
    try {
      const urlObj = new URL(req.url, `http://${req.headers.host}`);
      urlParam = urlObj.searchParams.get("url");
    } catch {}
  }

  if (!urlParam) {
    return res.status(400).json({ error: "O parâmetro ?url= é obrigatório." });
  }

  try {
    const page = await scrapeUrl(urlParam as string);
    return res.status(200).json({ url: urlParam, page });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
}
