import { buildContextPack } from "../packages/core/lib/analysis/context-pack.js";
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

  trackEngineUsage(null, "mrcp_engine_request", { method: req.method, endpoint: "/api/context-pack" });

  try {
    const repoUrl = req.query.repo || req.body?.repoUrl || req.body?.repo;
    const taskDescription = req.query.task || req.body?.taskDescription || "Refatoração e análise de código";
    const maxTokenBudget = Number(req.query.maxTokens || req.body?.maxTokenBudget || 8000);

    if (!repoUrl) {
      return res.status(400).json({
        status: "error",
        error_code: "MISSING_TARGET_URL",
        system_instruction_for_llm: "Adicione o parâmetro '?repo=' com a URL do repositório para extração do pacote de contexto."
      });
    }

    const result = await buildContextPack({
      repoUrl,
      taskDescription,
      maxTokenBudget
    });

    saveEndpointOutput("context_pack", repoUrl, result);

    return res.status(200).json({
      status: "success",
      analyzed_url: repoUrl,
      context_pack: result
    });
  } catch (error: any) {
    console.error("Erro em /api/context-pack:", error);
    return res.status(500).json({
      status: "error",
      details: error.message || "Erro desconhecido ao gerar o pacote de contexto."
    });
  }
}
