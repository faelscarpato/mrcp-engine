import { extractTypeSignatures } from "../packages/core/lib/analysis/type-signature-extractor.js";
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

  trackEngineUsage(null, "mrcp_engine_request", { method: req.method, endpoint: "/api/type-signature-extractor" });

  try {
    const repoUrl = req.query.repo || req.body?.repoUrl || req.body?.repo;
    const targetFilePath = req.query.file || req.body?.targetFilePath;

    if (!repoUrl) {
      return res.status(400).json({
        status: "error",
        error_code: "MISSING_TARGET_URL",
        system_instruction_for_llm: "Adicione '?repo=' para extração de assinaturas de tipo."
      });
    }

    const result = await extractTypeSignatures({
      repoUrl,
      targetFilePath
    });

    saveEndpointOutput("type_signature_extractor", repoUrl, result);

    return res.status(200).json({
      status: "success",
      type_signatures: result
    });
  } catch (error: any) {
    console.error("Erro em /api/type-signature-extractor:", error);
    return res.status(500).json({
      status: "error",
      details: error.message || "Erro ao extrair assinaturas de tipos."
    });
  }
}
