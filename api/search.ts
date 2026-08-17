import { runAnalysis } from "../packages/core/lib/analysis/pipeline.js";
import { trackEngineUsage } from "../src/services/analytics.js";
import { saveEndpointOutput } from "../packages/core/lib/cache.js";

export default async function handler(req: any, res: any) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader(
    "Access-Control-Allow-Headers",
    "X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization"
  );

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  trackEngineUsage(null, "mrcp_engine_request", { method: req.method, endpoint: "/api/search" });

  try {
    const repoUrl = req.query.repo || req.body?.repoUrl || req.body?.repo;
    const query = req.query.q || req.query.query || req.body?.query;

    if (!repoUrl || !query) {
      return res.status(400).json({
        status: "error",
        error_code: "MISSING_PARAMETERS",
        system_instruction_for_llm: "Adicione os parâmetros '?repo=' e '?q='."
      });
    }

    const analysis = await runAnalysis({
      repoUrl,
      githubToken: process.env.GITHUB_TOKEN,
      maxFiles: 2000
    });

    const nodes = (analysis as any).analysis?.nodes || (analysis as any).nodes || [];
    const queryLower = String(query).toLowerCase();

    const matches = nodes.filter(
      (n: any) =>
        (n.label && n.label.toLowerCase().includes(queryLower)) ||
        (n.path && n.path.toLowerCase().includes(queryLower))
    );

    const result = {
      status: "success",
      query_asked: query,
      total_matches: matches.length,
      matches: matches.slice(0, 50)
    };

    saveEndpointOutput("semantic_search", repoUrl, result);

    return res.status(200).json(result);
  } catch (error: any) {
    console.error("Erro em /api/search:", error);
    return res.status(500).json({
      status: "error",
      details: error.message || "Erro ao realizar busca semântica no repositório."
    });
  }
}
