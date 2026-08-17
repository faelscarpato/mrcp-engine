import { findDeadCode } from "../packages/core/lib/analysis/dead-code-pruner.js";
import { saveEndpointOutput } from "../packages/core/lib/cache.js";
import { trackEngineUsage } from "../src/services/analytics.js";

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

  trackEngineUsage(null, "mrcp_engine_request", { method: req.method, endpoint: "/api/dead-code-pruner" });

  try {
    const repoUrl = req.query.repo || req.body?.repoUrl || req.body?.repo;

    if (!repoUrl) {
      return res.status(400).json({
        status: "error",
        error_code: "MISSING_TARGET_URL",
        system_instruction_for_llm: "Adicione o parâmetro '?repo=' com a URL do repositório."
      });
    }

    const result = await findDeadCode({
      repoUrl
    });

    saveEndpointOutput("dead_code_pruner", repoUrl, result);

    return res.status(200).json({
      status: "success",
      analyzed_url: repoUrl,
      dead_code_analysis: result
    });
  } catch (error: any) {
    console.error("Erro em /api/dead-code-pruner:", error);
    return res.status(500).json({
      status: "error",
      details: error.message || "Erro ao detectar código morto."
    });
  }
}
