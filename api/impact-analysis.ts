import { calculateImpactAnalysis } from "../packages/core/lib/analysis/impact-analysis.js";
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

  trackEngineUsage(null, "mrcp_engine_request", { method: req.method, endpoint: "/api/impact-analysis" });

  try {
    let repoUrl = req.query.repo || req.body?.repoUrl || req.body?.repo;
    let modifiedFiles: string[] = [];

    if (req.method === "POST" && req.body) {
      modifiedFiles = req.body.modifiedFiles || req.body.files || [];
    } else if (req.query.modifiedFiles) {
      modifiedFiles = String(req.query.modifiedFiles).split(",");
    }

    if (!repoUrl) {
      return res.status(400).json({
        status: "error",
        error_code: "MISSING_TARGET_URL",
        system_instruction_for_llm: "Adicione o parâmetro '?repo=' (ou 'repoUrl' no corpo POST) com o alvo da análise."
      });
    }

    const diffContent = req.body?.diffContent || req.query.diffContent;

    const result = await calculateImpactAnalysis({
      repoUrl,
      modifiedFiles,
      diffContent
    });

    saveEndpointOutput("impact_analysis", repoUrl, result);

    return res.status(200).json({
      status: "success",
      analyzed_url: repoUrl,
      impact_analysis: result
    });
  } catch (error: any) {
    console.error("Erro em /api/impact-analysis:", error);
    return res.status(500).json({
      status: "error",
      details: error.message || "Erro desconhecido ao calcular o raio de impacto."
    });
  }
}
