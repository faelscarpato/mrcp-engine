import { findTestCoverageGaps } from "../packages/core/lib/analysis/test-gap-analysis.js";
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

  trackEngineUsage(null, "mrcp_engine_request", { method: req.method, endpoint: "/api/test-gap-analysis" });

  try {
    const repoUrl = req.query.repo || req.body?.repoUrl || req.body?.repo;
    const targetHotspotsOnly = req.query.hotspots !== "false" && req.body?.targetHotspotsOnly !== false;
    const generateStubs = req.query.stubs !== "false" && req.body?.generateStubs !== false;

    if (!repoUrl) {
      return res.status(400).json({
        status: "error",
        error_code: "MISSING_TARGET_URL",
        system_instruction_for_llm: "Adicione o parâmetro '?repo=' com a URL do repositório para análise de cobertura de testes."
      });
    }

    const result = await findTestCoverageGaps({
      repoUrl,
      targetHotspotsOnly,
      generateStubs
    });

    saveEndpointOutput("test_coverage_gaps", repoUrl, result);

    return res.status(200).json({
      status: "success",
      analyzed_url: repoUrl,
      test_coverage_gaps: result
    });
  } catch (error: any) {
    console.error("Erro em /api/test-gap-analysis:", error);
    return res.status(500).json({
      status: "error",
      details: error.message || "Erro desconhecido ao identificar lacunas de testes."
    });
  }
}
