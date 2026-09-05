import { saveEndpointOutput } from "../packages/core/lib/cache.js";

export async function executeTool(toolName: string, args: any): Promise<any> {
  // Core Engine Tools
  if (toolName === "analyze_repository") {
    const repoUrl = String(args?.repo || "");
    if (!repoUrl)
      return {
        content: [
          { type: "text", text: "Error: 'repo' parameter is required." },
        ],
        isError: true,
      };
    try {
      const { runAnalysis } =
        await import("../packages/core/lib/analysis/pipeline.js");
      const result = await runAnalysis({
        repoUrl,
        githubToken: process.env.GITHUB_TOKEN,
        maxFiles: 2000,
      });
      saveEndpointOutput(toolName, repoUrl, result);
      return {
        content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
      };
    } catch (error: any) {
      return {
        content: [
          {
            type: "text",
            text: `Error analyzing repository: ${error.message}`,
          },
        ],
        isError: true,
      };
    }
  }

  if (toolName === "get_repository_skills_contract") {
    const repoUrl = String(args?.repo || "");
    if (!repoUrl)
      return {
        content: [
          { type: "text", text: "Error: 'repo' parameter is required." },
        ],
        isError: true,
      };
    try {
      const { runAnalysis } =
        await import("../packages/core/lib/analysis/pipeline.js");
      const { processRepositoryHotspots } =
        await import("../packages/core/lib/analysis/mrcp-skill-injector.js");
      const result = await runAnalysis({
        repoUrl,
        githubToken: process.env.GITHUB_TOKEN,
        maxFiles: 2000,
      });
      const contracts = processRepositoryHotspots(
        (result as any).analysis?.nodes || (result as any).nodes || [],
      );
      saveEndpointOutput(toolName, repoUrl, contracts);
      return {
        content: [{ type: "text", text: JSON.stringify(contracts, null, 2) }],
      };
    } catch (error: any) {
      return {
        content: [
          {
            type: "text",
            text: `Error generating skill contracts: ${error.message}`,
          },
        ],
        isError: true,
      };
    }
  }

  if (toolName === "mrcp_run_full_repository_suite") {
    const repoUrl = String(args?.repo || "");
    if (!repoUrl)
      return {
        content: [
          { type: "text", text: "Error: 'repo' parameter is required." },
        ],
        isError: true,
      };
    try {
      const { runFullRepositoryDiagnostic } =
        await import("../packages/core/lib/analysis/full-suite.js");
      const result = await runFullRepositoryDiagnostic({
        repoUrl,
        taskContext: args?.taskContext,
      });
      return {
        content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
      };
    } catch (error: any) {
      return {
        content: [
          {
            type: "text",
            text: `Error executing full repository diagnostic suite: ${error.message}`,
          },
        ],
        isError: true,
      };
    }
  }

  // Predictive & Security Engineering Tools
  if (toolName === "mrcp_impact_analysis") {
    const repoUrl = String(args?.repo || "");
    const modifiedFiles = args?.modifiedFiles || [];
    if (!repoUrl)
      return {
        content: [
          { type: "text", text: "Error: 'repo' parameter is required." },
        ],
        isError: true,
      };
    try {
      const { calculateImpactAnalysis } =
        await import("../packages/core/lib/analysis/impact-analysis.js");
      const result = await calculateImpactAnalysis({
        repoUrl,
        modifiedFiles,
        diffContent: args?.diffContent,
      });
      saveEndpointOutput(toolName, repoUrl, result);
      return {
        content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
      };
    } catch (error: any) {
      return {
        content: [
          {
            type: "text",
            text: `Error executing impact analysis: ${error.message}`,
          },
        ],
        isError: true,
      };
    }
  }

  if (toolName === "mrcp_security_compliance_audit") {
    const repoUrl = String(args?.repo || "");
    if (!repoUrl)
      return {
        content: [
          { type: "text", text: "Error: 'repo' parameter is required." },
        ],
        isError: true,
      };
    try {
      const { runSecurityAudit } =
        await import("../packages/core/lib/analysis/security-audit.js");
      const result = await runSecurityAudit({
        repoUrl,
        severityThreshold: args?.severityThreshold,
      });
      saveEndpointOutput(toolName, repoUrl, result);
      return {
        content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
      };
    } catch (error: any) {
      return {
        content: [
          {
            type: "text",
            text: `Error executing security audit: ${error.message}`,
          },
        ],
        isError: true,
      };
    }
  }

  if (toolName === "mrcp_architectural_drift_detector") {
    const repoUrl = String(args?.repo || "");
    if (!repoUrl)
      return {
        content: [
          { type: "text", text: "Error: 'repo' parameter is required." },
        ],
        isError: true,
      };
    try {
      const { detectArchitectureDrift } =
        await import("../packages/core/lib/analysis/architecture-drift.js");
      const result = await detectArchitectureDrift({
        repoUrl,
        architectureType: args?.architectureType,
        maxAllowedCyclicDependencies: args?.maxAllowedCyclicDependencies,
      });
      saveEndpointOutput(toolName, repoUrl, result);
      return {
        content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
      };
    } catch (error: any) {
      return {
        content: [
          {
            type: "text",
            text: `Error detecting architecture drift: ${error.message}`,
          },
        ],
        isError: true,
      };
    }
  }

  if (toolName === "mrcp_auto_test_coverage_gap_finder") {
    const repoUrl = String(args?.repo || "");
    if (!repoUrl)
      return {
        content: [
          { type: "text", text: "Error: 'repo' parameter is required." },
        ],
        isError: true,
      };
    try {
      const { findTestCoverageGaps } =
        await import("../packages/core/lib/analysis/test-gap-analysis.js");
      const result = await findTestCoverageGaps({
        repoUrl,
        targetHotspotsOnly: args?.targetHotspotsOnly,
        generateStubs: args?.generateStubs,
      });
      saveEndpointOutput(toolName, repoUrl, result);
      return {
        content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
      };
    } catch (error: any) {
      return {
        content: [
          {
            type: "text",
            text: `Error finding test coverage gaps: ${error.message}`,
          },
        ],
        isError: true,
      };
    }
  }

  if (toolName === "mrcp_context_pruning_pack") {
    const repoUrl = String(args?.repo || "");
    const taskDescription = String(args?.taskDescription || "");
    if (!repoUrl || !taskDescription) {
      return {
        content: [
          {
            type: "text",
            text: "Error: 'repo' and 'taskDescription' parameters are required.",
          },
        ],
        isError: true,
      };
    }
    try {
      const { buildContextPack } =
        await import("../packages/core/lib/analysis/context-pack.js");
      const result = await buildContextPack({
        repoUrl,
        taskDescription,
        maxTokenBudget: args?.maxTokenBudget,
      });
      saveEndpointOutput(toolName, repoUrl, result);
      return {
        content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
      };
    } catch (error: any) {
      return {
        content: [
          {
            type: "text",
            text: `Error generating context pruning pack: ${error.message}`,
          },
        ],
        isError: true,
      };
    }
  }

  // High-Efficiency Agent Offloading Tools
  if (toolName === "mrcp_ast_refactor_applier") {
    try {
      const { applyAstRefactoring } =
        await import("../packages/core/lib/analysis/refactor-applier.js");
      const result = await applyAstRefactoring({
        action: args.action,
        targetSymbol: args.targetSymbol,
        newSymbolName: args.newSymbolName,
        targetFilePath: args.targetFilePath,
        dryRun: args.dryRun !== undefined ? args.dryRun : true,
      });
      saveEndpointOutput(
        toolName,
        args.repoUrl || args.repo || "local",
        result,
      );
      return {
        content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
      };
    } catch (error: any) {
      return {
        content: [
          {
            type: "text",
            text: `Error applying AST refactoring: ${error.message}`,
          },
        ],
        isError: true,
      };
    }
  }

  if (toolName === "mrcp_type_signature_extractor") {
    const repoUrl = String(args?.repo || args?.repoUrl || "");
    if (!repoUrl)
      return {
        content: [
          { type: "text", text: "Error: 'repo' parameter is required." },
        ],
        isError: true,
      };
    try {
      const { extractTypeSignatures } =
        await import("../packages/core/lib/analysis/type-signature-extractor.js");
      const result = await extractTypeSignatures({
        repoUrl,
        targetFilePath: args.targetFilePath,
      });
      saveEndpointOutput(toolName, repoUrl, result);
      return {
        content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
      };
    } catch (error: any) {
      return {
        content: [
          {
            type: "text",
            text: `Error extracting type signatures: ${error.message}`,
          },
        ],
        isError: true,
      };
    }
  }

  if (toolName === "mrcp_git_diff_semantic_summarizer") {
    const diffContent = String(args?.diffContent || "");
    if (!diffContent)
      return {
        content: [
          { type: "text", text: "Error: 'diffContent' parameter is required." },
        ],
        isError: true,
      };
    try {
      const { summarizeGitDiff } =
        await import("../packages/core/lib/analysis/diff-summarizer.js");
      const result = await summarizeGitDiff({
        diffContent,
        stripFormattingNoise: args.stripFormattingNoise,
      });
      saveEndpointOutput(toolName, "diff-session", result);
      return {
        content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
      };
    } catch (error: any) {
      return {
        content: [
          {
            type: "text",
            text: `Error summarizing git diff: ${error.message}`,
          },
        ],
        isError: true,
      };
    }
  }

  if (toolName === "mrcp_dependency_compatibility_resolver") {
    const packageName = String(args?.packageName || "");
    if (!packageName)
      return {
        content: [
          { type: "text", text: "Error: 'packageName' parameter is required." },
        ],
        isError: true,
      };
    try {
      const { resolveDependencyCompatibility } =
        await import("../packages/core/lib/analysis/dependency-resolver.js");
      const result = await resolveDependencyCompatibility({
        packageName,
        targetVersion: args.targetVersion,
        repoUrl: args.repo || args.repoUrl,
        manifestFilePath: args.manifestFilePath,
      });
      saveEndpointOutput(toolName, packageName, result);
      return {
        content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
      };
    } catch (error: any) {
      return {
        content: [
          {
            type: "text",
            text: `Error resolving dependency compatibility: ${error.message}`,
          },
        ],
        isError: true,
      };
    }
  }

  if (toolName === "mrcp_dead_code_pruner") {
    const repoUrl = String(args?.repo || "");
    if (!repoUrl)
      return {
        content: [
          { type: "text", text: "Error: 'repo' parameter is required." },
        ],
        isError: true,
      };
    try {
      const { findDeadCode } =
        await import("../packages/core/lib/analysis/dead-code-pruner.js");
      const result = await findDeadCode({ repoUrl });
      saveEndpointOutput(toolName, repoUrl, result);
      return {
        content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
      };
    } catch (error: any) {
      return {
        content: [
          { type: "text", text: `Error finding dead code: ${error.message}` },
        ],
        isError: true,
      };
    }
  }

  if (toolName === "mrcp_sql_schema_orm_contract_generator") {
    try {
      const { generateSqlOrmContract } =
        await import("../packages/core/lib/analysis/sql-orm-contract.js");
      const result = await generateSqlOrmContract({
        repoUrl: args.repo,
        schemaFilePath: args.schemaFilePath,
      });
      saveEndpointOutput(toolName, args.repo || "schema-session", result);
      return {
        content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
      };
    } catch (error: any) {
      return {
        content: [
          {
            type: "text",
            text: `Error generating SQL/ORM contract: ${error.message}`,
          },
        ],
        isError: true,
      };
    }
  }

  if (toolName === "mrcp_api_contract_generator") {
    try {
      const { generateApiContract } =
        await import("../packages/core/lib/analysis/api-contract-generator.js");
      const result = await generateApiContract({
        repoUrl: args.repo,
        frameworkHint: args.frameworkHint,
      });
      saveEndpointOutput(toolName, args.repo || "local", result);
      return {
        content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
      };
    } catch (error: any) {
      return {
        content: [
          {
            type: "text",
            text: `Error generating API contract: ${error.message}`,
          },
        ],
        isError: true,
      };
    }
  }

  if (toolName === "mrcp_code_metrics_health_scorer") {
    try {
      const { calculateCodeHealth } =
        await import("../packages/core/lib/analysis/code-health.js");
      const result = await calculateCodeHealth({ repoUrl: args.repo });
      saveEndpointOutput(toolName, args.repo || "local", result);
      return {
        content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
      };
    } catch (error: any) {
      return {
        content: [
          { type: "text", text: `Error scoring code health: ${error.message}` },
        ],
        isError: true,
      };
    }
  }

  if (toolName === "mrcp_env_secret_contract_validator") {
    try {
      const { validateEnvironmentContract } =
        await import("../packages/core/lib/analysis/env-validator.js");
      const result = await validateEnvironmentContract({ repoUrl: args.repo });
      saveEndpointOutput(toolName, args.repo || "local", result);
      return {
        content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
      };
    } catch (error: any) {
      return {
        content: [
          {
            type: "text",
            text: `Error validating environment contract: ${error.message}`,
          },
        ],
        isError: true,
      };
    }
  }

  if (toolName === "mrcp_monorepo_package_graph_analyzer") {
    try {
      const { analyzeMonorepoGraph } =
        await import("../packages/core/lib/analysis/monorepo-graph.js");
      const result = await analyzeMonorepoGraph({
        repoUrl: args.repo,
        changedFiles: args.changedFiles,
      });
      saveEndpointOutput(toolName, args.repo || "local", result);
      return {
        content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
      };
    } catch (error: any) {
      return {
        content: [
          {
            type: "text",
            text: `Error analyzing monorepo graph: ${error.message}`,
          },
        ],
        isError: true,
      };
    }
  }

  if (toolName === "mrcp_docstring_api_doc_generator") {
    try {
      const { generateDocumentation } =
        await import("../packages/core/lib/analysis/doc-generator.js");
      const result = await generateDocumentation({
        repoUrl: args.repo,
        targetFilePath: args.targetFilePath,
        format: args.format,
      });
      saveEndpointOutput(toolName, args.repo || "local", result);
      return {
        content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
      };
    } catch (error: any) {
      return {
        content: [
          {
            type: "text",
            text: `Error generating docstrings/documentation: ${error.message}`,
          },
        ],
        isError: true,
      };
    }
  }

  if (toolName === "mrcp_document_analyzer") {
    const repoUrl = String(args?.repo || args?.repoUrl || "");
    if (!repoUrl)
      return {
        content: [
          { type: "text", text: "Error: 'repo' parameter is required." },
        ],
        isError: true,
      };
    try {
      const { analyzeDocumentRepository } =
        await import("../packages/core/lib/analysis/document-analyzer.js");
      const result = await analyzeDocumentRepository({
        repoUrl,
        filterExtensions: args?.filterExtensions,
        maxFiles: args?.maxFiles ? Number(args.maxFiles) : 500,
        githubToken: process.env.GITHUB_TOKEN,
      });
      saveEndpointOutput(toolName, repoUrl, result);
      return {
        content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
      };
    } catch (error: any) {
      return {
        content: [
          {
            type: "text",
            text: `Error analyzing document repository: ${error.message}`,
          },
        ],
        isError: true,
      };
    }
  }

  // Triage & HR Tools
  if (toolName === "mrcp_triage_parse_resume") {
    const { parseResume } =
      await import("../packages/core/lib/triage/mcp-tools.js");
    const result = parseResume({
      content: args.content,
      contentType: args.contentType,
    });
    return {
      content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
    };
  }

  if (toolName === "mrcp_triage_score_candidate") {
    const { scoreCandidate } =
      await import("../packages/core/lib/triage/mcp-tools.js");
    const result = scoreCandidate({
      resumeData: args.resumeData,
      jobDescription: args.jobDescription,
    });
    return {
      content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
    };
  }

  if (toolName === "mrcp_triage_generate_hr_report") {
    const { generateHrReport } =
      await import("../packages/core/lib/triage/mcp-tools.js");
    const result = generateHrReport({
      candidateName: args.candidateName,
      targetRole: args.targetRole,
      aiDossierContent: args.aiDossierContent,
    });
    return {
      content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
    };
  }

  // Web Scraper Tools
  if (toolName === "mrcp_web_search") {
    const { searchDuckDuckGo } =
      await import("../packages/core/lib/web/scraper-tools.js");
    const result = await searchDuckDuckGo(args.query);
    return {
      content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
    };
  }

  if (toolName === "mrcp_web_scrape") {
    const { scrapeUrl } =
      await import("../packages/core/lib/web/scraper-tools.js");
    const result = await scrapeUrl(args.url);
    return {
      content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
    };
  }

  if (toolName === "mrcp_web_smart_search") {
    const { smartSearchPipeline } =
      await import("../packages/core/lib/web/scraper-tools.js");
    const result = await smartSearchPipeline(
      args.query,
      args.topN ?? 2,
      args.minScore ?? 0,
    );
    return {
      content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
    };
  }

  return {
    content: [{ type: "text", text: `Unknown tool: ${toolName}` }],
    isError: true,
  };
}

// ─── HTTP Handler (Vercel Serverless) ───────────
