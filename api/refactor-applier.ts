import { applyAstRefactoring } from "../packages/core/lib/analysis/refactor-applier.js";
import { saveEndpointOutput } from "../packages/core/lib/cache.js";
import { trackEngineUsage } from "../src/services/analytics.js";

export default async function handler(req: any, res: any) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader(
    "Access-Control-Allow-Headers",
    "X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization"
  );

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  trackEngineUsage(null, "mrcp_engine_request", { method: req.method, endpoint: "/api/refactor-applier" });

  try {
    const { action, targetSymbol, newSymbolName, targetFilePath, repoUrl } = req.body || {};

    if (!action || !targetSymbol) {
      return res.status(400).json({
        status: "error",
        error_code: "MISSING_PARAMETERS",
        system_instruction_for_llm: "Adicione 'action' e 'targetSymbol' no corpo JSON."
      });
    }

    const result = await applyAstRefactoring({
      action,
      targetSymbol,
      newSymbolName,
      targetFilePath,
      repoUrl
    });

    saveEndpointOutput("ast_refactor_applier", repoUrl || "local", result);

    return res.status(200).json({
      status: "success",
      refactor_result: result
    });
  } catch (error: any) {
    console.error("Erro em /api/refactor-applier:", error);
    return res.status(500).json({
      status: "error",
      details: error.message || "Erro ao aplicar refatoração AST."
    });
  }
}
