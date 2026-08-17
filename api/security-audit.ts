import { runSecurityAudit } from "../packages/core/lib/analysis/security-audit.js";
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

  trackEngineUsage(null, "mrcp_engine_request", { method: req.method, endpoint: "/api/security-audit" });

  try {
    const repoUrl = req.query.repo || req.body?.repoUrl || req.body?.repo;
    const severityThreshold = req.query.severity || req.body?.severityThreshold || "LOW";

    if (!repoUrl) {
      return res.status(400).json({
        status: "error",
        error_code: "MISSING_TARGET_URL",
        system_instruction_for_llm: "Adicione o parâmetro '?repo=' com a URL do repositório para auditoria de segurança."
      });
    }

    const result = await runSecurityAudit({
      repoUrl,
      severityThreshold
    });

    saveEndpointOutput("security_audit", repoUrl, result);

    return res.status(200).json({
      status: "success",
      analyzed_url: repoUrl,
      security_audit: result
    });
  } catch (error: any) {
    console.error("Erro em /api/security-audit:", error);
    return res.status(500).json({
      status: "error",
      details: error.message || "Erro desconhecido ao executar auditoria de segurança."
    });
  }
}
