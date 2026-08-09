import { runAnalysis } from "../packages/core/lib/analysis/pipeline.js";
import { processRepositoryHotspots } from "../packages/core/lib/analysis/mrcp-skill-injector.js";

export default async function handler(req: any, res: any) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  try {
    const repoUrl = req.query.repo;

    if (!repoUrl) {
      return res.status(400).json({
        status: "error",
        error_code: "MISSING_TARGET_URL",
        system_instruction_for_llm: "Adicione o parâmetro '?repo=' com o alvo da análise."
      });
    }

    const analysisResult = await runAnalysis({
      repoUrl: repoUrl,
      githubToken: process.env.GITHUB_TOKEN,
      maxFiles: 2000,
    });

    const contracts = processRepositoryHotspots(analysisResult.nodes);

    return res.status(200).json({
      status: "success",
      analyzed_url: repoUrl,
      skill_contracts: contracts,
    });
  } catch (error: any) {
    console.error("Erro interno no motor:", error);
    return res.status(500).json({
      status: "error",
      details: error.message || "Erro desconhecido",
    });
  }
}
