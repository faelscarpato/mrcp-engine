import { summarizeGitDiff } from "../packages/core/lib/analysis/diff-summarizer.js";
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

  trackEngineUsage(null, "mrcp_engine_request", { method: req.method, endpoint: "/api/diff-summarizer" });

  try {
    const { diffContent, repoUrl } = req.body || {};

    if (!diffContent) {
      return res.status(400).json({
        status: "error",
        error_code: "MISSING_DIFF_CONTENT",
        system_instruction_for_llm: "Forneça 'diffContent' no corpo JSON."
      });
    }

    const result = await summarizeGitDiff({
      diffContent
    });

    saveEndpointOutput("git_diff_semantic_summarizer", repoUrl || "diff-session", result);

    return res.status(200).json({
      status: "success",
      diff_summary: result
    });
  } catch (error: any) {
    console.error("Erro em /api/diff-summarizer:", error);
    return res.status(500).json({
      status: "error",
      details: error.message || "Erro ao resumir git diff."
    });
  }
}
