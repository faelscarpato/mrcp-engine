import { saveEndpointOutput } from "../packages/core/lib/cache.js";
import { sendFormattedResponse } from "../packages/core/lib/report-manager.js";
import fs from "fs";
import path from "path";

export const routeHandlers: Record<
  string,
  (req: any, res: any) => Promise<any>
> = {
  // 0. /api/report & /api/export-report
  "/api/report": async (req, res) => {
    const repoUrl =
      req.query.repo || req.body?.repoUrl || req.body?.repo || "local";
    const rootJsonPath = path.resolve("mrcp-analysis.json");
    let analysisData: any = null;
    if (fs.existsSync(rootJsonPath)) {
      try {
        analysisData = JSON.parse(fs.readFileSync(rootJsonPath, "utf-8"));
      } catch {
        // JSON existente pode estar corrompido; reanalisa na sequência
      }
    }
    if (!analysisData) {
      const { runFullRepositoryDiagnostic } =
        await import("../packages/core/lib/analysis/full-suite.js");
      analysisData = await runFullRepositoryDiagnostic({ repoUrl });
    }
    return sendFormattedResponse(
      req,
      res,
      "full_repository_diagnostic_suite",
      repoUrl,
      analysisData,
    );
  },
  "/api/export-report": async (req, res) =>
    routeHandlers["/api/report"](req, res),

  // 0.1 /api/guidelines & aliases
  "/api/guidelines": async (req, res) => {
    const guidelinesPath = path.resolve("MRCP_AI_GUIDELINES.md");
    let guidelinesContent = "";
    if (fs.existsSync(guidelinesPath)) {
      guidelinesContent = fs.readFileSync(guidelinesPath, "utf-8");
    } else {
      guidelinesContent =
        "# MRCP Engine AI Guidelines\nExecute mrcp_run_full_repository_suite for first-time repository analysis.";
    }
    res.setHeader("Content-Type", "text/markdown; charset=utf-8");
    return res.status(200).send(guidelinesContent);
  },
  "/api/instructions": async (req, res) =>
    routeHandlers["/api/guidelines"](req, res),
  "/api/skill": async (req, res) => routeHandlers["/api/guidelines"](req, res),

  // 1. /api/analyze
  "/api/analyze": async (req, res) => {
    const repoUrl = req.query.repo || req.body?.repoUrl || req.body?.repo;
    if (!repoUrl)
      return res
        .status(400)
        .json({ status: "error", error_code: "MISSING_TARGET_URL" });
    const { runAnalysis } =
      await import("../packages/core/lib/analysis/pipeline.js");
    const result = await runAnalysis({
      repoUrl,
      githubToken: process.env.GITHUB_TOKEN,
      maxFiles: 2000,
    });
    return sendFormattedResponse(
      req,
      res,
      "analyze_repository",
      repoUrl,
      result,
    );
  },

  // 2. /api/skills
  "/api/skills": async (req, res) => {
    const repoUrl = req.query.repo || req.body?.repoUrl || req.body?.repo;
    if (!repoUrl)
      return res
        .status(400)
        .json({ status: "error", error_code: "MISSING_TARGET_URL" });
    const { runAnalysis } =
      await import("../packages/core/lib/analysis/pipeline.js");
    const { processRepositoryHotspots } =
      await import("../packages/core/lib/analysis/mrcp-skill-injector.js");
    const analysisResult = await runAnalysis({
      repoUrl,
      githubToken: process.env.GITHUB_TOKEN,
      maxFiles: 2000,
    });
    const nodes =
      (analysisResult as any).analysis?.nodes ||
      (analysisResult as any).nodes ||
      [];
    const contracts = processRepositoryHotspots(nodes);
    const result = {
      status: "success",
      analyzed_url: repoUrl,
      skill_contracts: contracts,
    };
    return sendFormattedResponse(req, res, "skills_contract", repoUrl, result);
  },

  // 3. /api/impact-analysis
  "/api/impact-analysis": async (req, res) => {
    const repoUrl = req.query.repo || req.body?.repoUrl || req.body?.repo;
    const modifiedFiles =
      req.body?.modifiedFiles ||
      (req.query.modifiedFiles
        ? String(req.query.modifiedFiles).split(",")
        : []);
    if (!repoUrl)
      return res
        .status(400)
        .json({ status: "error", error_code: "MISSING_TARGET_URL" });
    const { calculateImpactAnalysis } =
      await import("../packages/core/lib/analysis/impact-analysis.js");
    const result = await calculateImpactAnalysis({
      repoUrl,
      modifiedFiles,
      diffContent: req.body?.diffContent,
    });
    return sendFormattedResponse(req, res, "impact_analysis", repoUrl, {
      status: "success",
      impact_analysis: result,
    });
  },

  // 4. /api/security-audit
  "/api/security-audit": async (req, res) => {
    const repoUrl = req.query.repo || req.body?.repoUrl || req.body?.repo;
    if (!repoUrl)
      return res
        .status(400)
        .json({ status: "error", error_code: "MISSING_TARGET_URL" });
    const { runSecurityAudit } =
      await import("../packages/core/lib/analysis/security-audit.js");
    const result = await runSecurityAudit({
      repoUrl,
      severityThreshold: req.query.severity,
    });
    return sendFormattedResponse(
      req,
      res,
      "security_compliance_audit",
      repoUrl,
      { status: "success", security_audit: result },
    );
  },

  // 5. /api/architecture-drift
  "/api/architecture-drift": async (req, res) => {
    const repoUrl = req.query.repo || req.body?.repoUrl || req.body?.repo;
    if (!repoUrl)
      return res
        .status(400)
        .json({ status: "error", error_code: "MISSING_TARGET_URL" });
    const { detectArchitectureDrift } =
      await import("../packages/core/lib/analysis/architecture-drift.js");
    const result = await detectArchitectureDrift({
      repoUrl,
      architectureType: req.query.arch,
    });
    return sendFormattedResponse(
      req,
      res,
      "architectural_drift_detector",
      repoUrl,
      { status: "success", architecture_drift: result },
    );
  },

  // 6. /api/test-gap-analysis
  "/api/test-gap-analysis": async (req, res) => {
    const repoUrl = req.query.repo || req.body?.repoUrl || req.body?.repo;
    if (!repoUrl)
      return res
        .status(400)
        .json({ status: "error", error_code: "MISSING_TARGET_URL" });
    const { findTestCoverageGaps } =
      await import("../packages/core/lib/analysis/test-gap-analysis.js");
    const result = await findTestCoverageGaps({
      repoUrl,
      generateStubs: req.query.stubs !== "false",
    });
    return sendFormattedResponse(
      req,
      res,
      "auto_test_coverage_gap_finder",
      repoUrl,
      { status: "success", test_coverage_gaps: result },
    );
  },

  // 7. /api/context-pack
  "/api/context-pack": async (req, res) => {
    const repoUrl = req.query.repo || req.body?.repoUrl || req.body?.repo;
    const taskDescription =
      req.query.task || req.body?.taskDescription || "General refactoring task";
    if (!repoUrl)
      return res
        .status(400)
        .json({ status: "error", error_code: "MISSING_TARGET_URL" });
    const { buildContextPack } =
      await import("../packages/core/lib/analysis/context-pack.js");
    const result = await buildContextPack({ repoUrl, taskDescription });
    return sendFormattedResponse(req, res, "context_pruning_pack", repoUrl, {
      status: "success",
      context_pack: result,
    });
  },

  // 8. /api/refactor-applier
  "/api/refactor-applier": async (req, res) => {
    const { action, targetSymbol, newSymbolName, targetFilePath, repoUrl } =
      req.body || {};
    if (!action || !targetSymbol)
      return res
        .status(400)
        .json({ status: "error", error_code: "MISSING_PARAMETERS" });
    const { applyAstRefactoring } =
      await import("../packages/core/lib/analysis/refactor-applier.js");
    const result = await applyAstRefactoring({
      action,
      targetSymbol,
      newSymbolName,
      targetFilePath,
      repoUrl,
    });
    return sendFormattedResponse(
      req,
      res,
      "ast_refactor_applier",
      repoUrl || "local",
      { status: "success", refactor_result: result },
    );
  },

  // 9. /api/type-signature-extractor
  "/api/type-signature-extractor": async (req, res) => {
    const repoUrl = req.query.repo || req.body?.repoUrl || req.body?.repo;
    if (!repoUrl)
      return res
        .status(400)
        .json({ status: "error", error_code: "MISSING_TARGET_URL" });
    const { extractTypeSignatures } =
      await import("../packages/core/lib/analysis/type-signature-extractor.js");
    const result = await extractTypeSignatures({
      repoUrl,
      targetFilePath: req.query.file,
    });
    return sendFormattedResponse(
      req,
      res,
      "type_signature_extractor",
      repoUrl,
      { status: "success", type_signatures: result },
    );
  },

  // 10. /api/diff-summarizer
  "/api/diff-summarizer": async (req, res) => {
    const { diffContent, repoUrl } = req.body || {};
    if (!diffContent)
      return res
        .status(400)
        .json({ status: "error", error_code: "MISSING_DIFF_CONTENT" });
    const { summarizeGitDiff } =
      await import("../packages/core/lib/analysis/diff-summarizer.js");
    const result = await summarizeGitDiff({ diffContent });
    return sendFormattedResponse(
      req,
      res,
      "git_diff_semantic_summarizer",
      repoUrl || "diff-session",
      { status: "success", diff_summary: result },
    );
  },

  // 11. /api/dependency-resolver
  "/api/dependency-resolver": async (req, res) => {
    const packageName = req.query.package || req.body?.packageName;
    if (!packageName)
      return res
        .status(400)
        .json({ status: "error", error_code: "MISSING_PACKAGE_NAME" });
    const { resolveDependencyCompatibility } =
      await import("../packages/core/lib/analysis/dependency-resolver.js");
    const result = await resolveDependencyCompatibility({
      packageName,
      targetVersion: req.query.version || "latest",
    });
    return sendFormattedResponse(
      req,
      res,
      "dependency_compatibility_resolver",
      packageName,
      { status: "success", dependency_resolution: result },
    );
  },

  // 12. /api/dead-code-pruner
  "/api/dead-code-pruner": async (req, res) => {
    const repoUrl = req.query.repo || req.body?.repoUrl || req.body?.repo;
    if (!repoUrl)
      return res
        .status(400)
        .json({ status: "error", error_code: "MISSING_TARGET_URL" });
    const { findDeadCode } =
      await import("../packages/core/lib/analysis/dead-code-pruner.js");
    const result = await findDeadCode({ repoUrl });
    return sendFormattedResponse(req, res, "dead_code_pruner", repoUrl, {
      status: "success",
      dead_code_analysis: result,
    });
  },

  // 13. /api/sql-orm-contract
  "/api/sql-orm-contract": async (req, res) => {
    const repoUrl = req.query.repo || req.body?.repoUrl || req.body?.repo;
    const { generateSqlOrmContract } =
      await import("../packages/core/lib/analysis/sql-orm-contract.js");
    const result = await generateSqlOrmContract({
      repoUrl,
      schemaFilePath: req.query.schema,
    });
    return sendFormattedResponse(
      req,
      res,
      "sql_schema_orm_contract_generator",
      repoUrl || "schema-session",
      { status: "success", sql_orm_contract: result },
    );
  },

  // 14. /api/web-search
  "/api/web-search": async (req, res) => {
    const query = req.query.q || req.body?.q;
    if (!query)
      return res
        .status(400)
        .json({ status: "error", error_code: "MISSING_QUERY" });
    const { searchDuckDuckGo } =
      await import("../packages/core/lib/web/scraper-tools.js");
    const result = await searchDuckDuckGo(query);
    return res.status(200).json({ status: "success", search_results: result });
  },

  // 15. /api/scrape
  "/api/scrape": async (req, res) => {
    const targetUrl = req.query.url || req.body?.url;
    if (!targetUrl)
      return res
        .status(400)
        .json({ status: "error", error_code: "MISSING_URL" });
    const { scrapeUrl } =
      await import("../packages/core/lib/web/scraper-tools.js");
    const result = await scrapeUrl(targetUrl);
    return res.status(200).json({ status: "success", scraped_content: result });
  },

  // 16. /api/smart-search
  "/api/smart-search": async (req, res) => {
    const query = req.query.q || req.body?.q;
    if (!query)
      return res
        .status(400)
        .json({ status: "error", error_code: "MISSING_QUERY" });
    const { smartSearchPipeline } =
      await import("../packages/core/lib/web/scraper-tools.js");
    const result = await smartSearchPipeline(
      query,
      Number(req.query.topN || 2),
    );
    return res
      .status(200)
      .json({ status: "success", smart_search_results: result });
  },

  // 17. /api/search
  "/api/search": async (req, res) => {
    const repoUrl = req.query.repo || req.body?.repoUrl || req.body?.repo;
    const query = req.query.q || req.query.query || req.body?.query;
    if (!repoUrl || !query)
      return res
        .status(400)
        .json({ status: "error", error_code: "MISSING_PARAMETERS" });
    const { runAnalysis } =
      await import("../packages/core/lib/analysis/pipeline.js");
    const analysis = await runAnalysis({
      repoUrl,
      githubToken: process.env.GITHUB_TOKEN,
      maxFiles: 2000,
    });
    const nodes =
      (analysis as any).analysis?.nodes || (analysis as any).nodes || [];
    const queryLower = String(query).toLowerCase();
    const matches = nodes.filter(
      (n: any) =>
        (n.label && n.label.toLowerCase().includes(queryLower)) ||
        (n.path && n.path.toLowerCase().includes(queryLower)),
    );
    const result = {
      status: "success",
      query_asked: query,
      total_matches: matches.length,
      matches: matches.slice(0, 50),
    };
    return sendFormattedResponse(req, res, "semantic_search", repoUrl, result);
  },

  // 18. /api/api-contract
  "/api/api-contract": async (req, res) => {
    const repoUrl = req.query.repo || req.body?.repoUrl || req.body?.repo;
    if (!repoUrl)
      return res
        .status(400)
        .json({ status: "error", error_code: "MISSING_TARGET_URL" });
    const { generateApiContract } =
      await import("../packages/core/lib/analysis/api-contract-generator.js");
    const result = await generateApiContract({
      repoUrl,
      frameworkHint: req.query.framework || req.body?.frameworkHint,
    });
    return sendFormattedResponse(req, res, "api_contract_generator", repoUrl, {
      status: "success",
      api_contract: result,
    });
  },

  // 19. /api/code-health
  "/api/code-health": async (req, res) => {
    const repoUrl = req.query.repo || req.body?.repoUrl || req.body?.repo;
    if (!repoUrl)
      return res
        .status(400)
        .json({ status: "error", error_code: "MISSING_TARGET_URL" });
    const { calculateCodeHealth } =
      await import("../packages/core/lib/analysis/code-health.js");
    const result = await calculateCodeHealth({ repoUrl });
    return sendFormattedResponse(
      req,
      res,
      "code_metrics_health_scorer",
      repoUrl,
      { status: "success", code_health: result },
    );
  },

  // 20. /api/env-validator
  "/api/env-validator": async (req, res) => {
    const repoUrl = req.query.repo || req.body?.repoUrl || req.body?.repo;
    if (!repoUrl)
      return res
        .status(400)
        .json({ status: "error", error_code: "MISSING_TARGET_URL" });
    const { validateEnvironmentContract } =
      await import("../packages/core/lib/analysis/env-validator.js");
    const result = await validateEnvironmentContract({ repoUrl });
    return sendFormattedResponse(
      req,
      res,
      "env_secret_contract_validator",
      repoUrl,
      { status: "success", env_contract: result },
    );
  },

  // 21. /api/monorepo-graph
  "/api/monorepo-graph": async (req, res) => {
    const repoUrl = req.query.repo || req.body?.repoUrl || req.body?.repo;
    const changedFiles =
      req.body?.changedFiles ||
      (req.query.changedFiles ? String(req.query.changedFiles).split(",") : []);
    if (!repoUrl)
      return res
        .status(400)
        .json({ status: "error", error_code: "MISSING_TARGET_URL" });
    const { analyzeMonorepoGraph } =
      await import("../packages/core/lib/analysis/monorepo-graph.js");
    const result = await analyzeMonorepoGraph({ repoUrl, changedFiles });
    return sendFormattedResponse(
      req,
      res,
      "monorepo_package_graph_analyzer",
      repoUrl,
      { status: "success", monorepo_graph: result },
    );
  },

  // 22. /api/doc-generator
  "/api/doc-generator": async (req, res) => {
    const repoUrl = req.query.repo || req.body?.repoUrl || req.body?.repo;
    if (!repoUrl)
      return res
        .status(400)
        .json({ status: "error", error_code: "MISSING_TARGET_URL" });
    const { generateDocumentation } =
      await import("../packages/core/lib/analysis/doc-generator.js");
    const result = await generateDocumentation({
      repoUrl,
      targetFilePath: req.query.file || req.body?.targetFilePath,
      format: req.query.format || req.body?.format,
    });
    return sendFormattedResponse(
      req,
      res,
      "docstring_api_doc_generator",
      repoUrl,
      { status: "success", doc_generator: result },
    );
  },

  // 23. /api/document-analyzer & aliases
  "/api/document-analyzer": async (req, res) => {
    const repoUrl = req.query.repo || req.body?.repoUrl || req.body?.repo;
    if (!repoUrl)
      return res
        .status(400)
        .json({ status: "error", error_code: "MISSING_TARGET_URL" });
    const { analyzeDocumentRepository } =
      await import("../packages/core/lib/analysis/document-analyzer.js");
    const filterExtensions = req.query.ext
      ? String(req.query.ext).split(",")
      : req.body?.filterExtensions;
    const maxFiles = req.query.maxFiles
      ? parseInt(String(req.query.maxFiles), 10)
      : req.body?.maxFiles;
    const result = await analyzeDocumentRepository({
      repoUrl,
      filterExtensions,
      maxFiles,
      githubToken: process.env.GITHUB_TOKEN,
    });
    return sendFormattedResponse(req, res, "document_analyzer", repoUrl, {
      status: "success",
      document_analysis: result,
    });
  },
  "/api/document-analysis": async (req, res) =>
    routeHandlers["/api/document-analyzer"](req, res),
  "/api/doc-analyzer": async (req, res) =>
    routeHandlers["/api/document-analyzer"](req, res),

  // 24. /api/full-suite & aliases
  "/api/full-suite": async (req, res) => {
    const repoUrl = req.query.repo || req.body?.repoUrl || req.body?.repo;
    if (!repoUrl)
      return res
        .status(400)
        .json({ status: "error", error_code: "MISSING_TARGET_URL" });
    const { runFullRepositoryDiagnostic } =
      await import("../packages/core/lib/analysis/full-suite.js");
    const result = await runFullRepositoryDiagnostic({
      repoUrl,
      taskContext: req.query.task || req.body?.task,
      generateStubs: req.query.stubs !== "false",
    });
    return sendFormattedResponse(
      req,
      res,
      "full_repository_diagnostic_suite",
      repoUrl,
      { status: "success", full_diagnostic: result },
    );
  },
  "/api/full-analysis": async (req, res) =>
    routeHandlers["/api/full-suite"](req, res),
  "/api/deep-analysis": async (req, res) =>
    routeHandlers["/api/full-suite"](req, res),
};
