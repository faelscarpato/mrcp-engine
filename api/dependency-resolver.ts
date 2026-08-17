import { resolveDependencyCompatibility } from "../packages/core/lib/analysis/dependency-resolver.js";
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

  trackEngineUsage(null, "mrcp_engine_request", { method: req.method, endpoint: "/api/dependency-resolver" });

  try {
    const packageName = req.query.package || req.body?.packageName;
    const targetVersion = req.query.version || req.body?.targetVersion || "latest";

    if (!packageName) {
      return res.status(400).json({
        status: "error",
        error_code: "MISSING_PACKAGE_NAME",
        system_instruction_for_llm: "Adicione o parâmetro '?package=' com o nome do pacote."
      });
    }

    const result = await resolveDependencyCompatibility({
      packageName,
      targetVersion
    });

    saveEndpointOutput("dependency_compatibility_resolver", packageName, result);

    return res.status(200).json({
      status: "success",
      dependency_resolution: result
    });
  } catch (error: any) {
    console.error("Erro em /api/dependency-resolver:", error);
    return res.status(500).json({
      status: "error",
      details: error.message || "Erro ao resolver compatibilidade de dependências."
    });
  }
}
