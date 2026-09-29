import fs from "fs";
import path from "path";

const MRCP_API_BASE = "https://mrcp-engine.vercel.app";
const CACHE_FILE = "mrcp-analysis.json";

// === Analise local ============================================================
// A API hospedada nao enxerga o disco do cliente. Para alvo local (path), usar
// o core compilado localmente em vez de enviar o path para a Vercel -- antes
// isso acabava no gerador deterministico, devolvendo MI/arquivos inventados.
let corePromise = null;
function loadCore() {
  if (!corePromise) {
    corePromise = import("@mrcp/core/analysis/pipeline").catch((e) => {
      corePromise = null;
      throw new Error(
        `Core local indisponivel (${e.message}). Rode: pnpm --filter @mrcp/core build`,
      );
    });
  }
  return corePromise;
}

async function runLocalAnalysis(repoUrl) {
  if (!repoUrl) return null;
  const { parseTargetUrl, runAnalysis } = await loadCore();
  if (parseTargetUrl(repoUrl)?.targetType !== "local") return null;
  return await runAnalysis({
    repoUrl,
    githubToken: process.env.GITHUB_TOKEN,
    maxFiles: 2000,
  });
}

function getCachedResult(repoUrl, type) {
  const cacheFile = path.join(process.cwd(), CACHE_FILE);
  if (fs.existsSync(cacheFile)) {
    try {
      const data = JSON.parse(fs.readFileSync(cacheFile, "utf-8"));
      if (data.repoUrl === repoUrl && data[type]) {
        return data[type];
      }
    } catch (e) {
      /* ignore */
    }
  }
  return null;
}

function setCachedResult(repoUrl, type, content) {
  const cacheFile = path.join(process.cwd(), CACHE_FILE);
  let data = { repoUrl };
  if (fs.existsSync(cacheFile)) {
    try {
      data = JSON.parse(fs.readFileSync(cacheFile, "utf-8"));
    } catch (e) {
      /* ignore */
    }
  }
  data.repoUrl = repoUrl;
  data[type] = content;
  try {
    fs.writeFileSync(cacheFile, JSON.stringify(data, null, 2), "utf-8");
  } catch (e) {
    /* ignore */
  }
}

function formatResponseForAi(endpoint, data) {
  if (!data) return "No data returned from analysis.";

  // 0. Page Cloner Pro Engine
  if (data.aiPrompt) {
    return data.aiPrompt;
  }

  // 1. Context Pruning Pack: Return compact prompt payload directly (maximum token efficiency)
  if (
    endpoint.includes("context-pack") ||
    data.compactPromptPayload ||
    data.context_pack
  ) {
    const pack = data.context_pack || data;
    const tokens = pack.estimatedTotalTokens || 0;
    const efficiency = pack.pruningEfficiency || "90%";
    const payload =
      pack.compactPromptPayload ||
      (pack.contextPack ? JSON.stringify(pack.contextPack, null, 2) : "");
    return [
      `### ⚡ MRCP Context Pruning Pack (${efficiency} Pruning Efficiency | ~${tokens} tokens)`,
      `> Context surgically pruned. Full raw AST is cached in \`mrcp-analysis.json\`.`,
      ``,
      payload,
    ].join("\n");
  }

  // 2. Full Suite / Executive Diagnostic: Return executive markdown summary
  if (
    endpoint.includes("full-analysis") ||
    endpoint.includes("full-suite") ||
    data.executiveDashboardMarkdown ||
    data.full_diagnostic
  ) {
    const diag = data.full_diagnostic || data;
    if (diag.executiveDashboardMarkdown) {
      return diag.executiveDashboardMarkdown;
    }
    const summary = diag.executiveSummary || {};
    // `null`/ausente = etapa não mediu. `|| 85`, `|| "A"` e `|| 15` fabricavam
    // um diagnóstico Optimista a partir de nada.
    const nd = "indisponível (não medido)";
    const num = (v) => (v === null || v === undefined ? nd : v);
    return [
      `# 🧠 MRCP Engine - Executive Repository Diagnostic`,
      `* **Maintainability Index:** ${summary.maintainabilityIndex === null || summary.maintainabilityIndex === undefined ? nd : `${summary.maintainabilityIndex}/100`} (Grade ${summary.letterGrade ?? nd})`,
      `* **Technical Debt:** ${summary.technicalDebtScore === null || summary.technicalDebtScore === undefined ? nd : `${summary.technicalDebtScore}%`}`,
      `* **Security Audit:** ${summary.securityAuditPassed === null || summary.securityAuditPassed === undefined ? `⚪ INCONCLUSIVE (${nd})` : summary.securityAuditPassed ? "✅ PASSED (0 Critical Vulnerabilities)" : "⚠️ VULNERABILITIES DETECTED"}`,
      `* **God Modules:** ${num(summary.godModulesCount)}`,
      `* **Dead Symbols:** ${num(summary.deadSymbolsCount)}`,
      `* **API Routes:** ${num(summary.totalApiRoutes)}`,
      `* **Documents Analyzed:** ${num(summary.totalDocumentsAnalyzed)}`,
      ``,
      `> [!NOTE]`,
      `> Full 360° graph and all sub-reports are cached locally in \`mrcp-analysis.json\`.`,
    ].join("\n");
  }

  // 3. Code Health Scorer
  if (endpoint.includes("code-health") || data.code_health) {
    const ch = data.code_health || data;
    const summary = ch.summary || {};
    const nd = "indisponível (não medido)";
    const num = (v) => (v === null || v === undefined ? nd : v);
    const lines = [
      `### 📊 Code Health & Maintainability: ${ch.maintainabilityIndex === null || ch.maintainabilityIndex === undefined ? nd : `${ch.maintainabilityIndex}/100`} (Grade ${ch.letterGrade ?? nd} - ${ch.maintainabilityRating ?? nd})`,
      `* **Technical Debt:** ${ch.technicalDebtScore === null || ch.technicalDebtScore === undefined ? nd : `${ch.technicalDebtScore}%`} | **Total Files:** ${num(summary.totalFiles)} (~${summary.totalLinesOfCode === null || summary.totalLinesOfCode === undefined ? nd : summary.totalLinesOfCode.toLocaleString()} LOC)`,
      `* **God Modules Detected:** ${num(summary.godModulesCount)}`,
      ``,
    ];
    if (ch.topRefactoringPriorities && ch.topRefactoringPriorities.length > 0) {
      lines.push(`**Top Refactoring Priorities:**`);
      for (const p of ch.topRefactoringPriorities.slice(0, 5)) {
        lines.push(
          `* \`${p.file}\` (Complexity: ${p.cyclomaticComplexity}, LOC: ${p.linesOfCode}) - Action: ${p.recommendedAction}`,
        );
      }
    }
    return lines.join("\n");
  }

  // 4. Security Audit
  if (endpoint.includes("security-audit") || data.security_audit) {
    const sec = data.security_audit || data;
    const vulns = sec.vulnerabilities || [];
    const nd = "indisponível (não medido)";
    const passed = sec.auditPassed;
    const lines = [
      `### 🛡️ Security Audit: ${passed === null || passed === undefined ? `⚪ INCONCLUSIVE (${nd})` : passed ? "✅ PASSED" : "⚠️ VULNERABILITIES FOUND"}`,
      `* **Total Alerts:** ${sec.totalVulnerabilities === null || sec.totalVulnerabilities === undefined ? nd : sec.totalVulnerabilities}`,
      ``,
    ];
    if (vulns.length > 0) {
      lines.push(`| Severity | File:Line | Description | Remediation |`);
      lines.push(`| :--- | :--- | :--- | :--- |`);
      for (const v of vulns.slice(0, 10)) {
        lines.push(
          `| **${v.severity}** | \`${v.file}:${v.line || 1}\` | ${v.description} | \`${v.remediationSnippet || "Inspect code"}\` |`,
        );
      }
    } else if (passed === null || passed === undefined) {
      // Ausência de alertas não é aprovação quando nada foi inspecionado.
      lines.push(
        `* ⚪ Audit inconclusive: no source content was read and inspected. Absence of alerts does not mean absence of vulnerabilities.`,
      );
    } else {
      lines.push(`* ✅ No security vulnerabilities or secrets exposed.`);
    }
    return lines.join("\n");
  }

  // 5. Test Gaps
  if (endpoint.includes("test-gap") || data.test_coverage_gaps) {
    const tg = data.test_coverage_gaps || data;
    const uncov = tg.uncoveredFunctions || [];
    const lines = [
      `### 🧪 Test Coverage Gap Analysis`,
      `* **Uncovered High-Complexity Functions:** ${tg.totalUncovered || uncov.length}`,
      ``,
    ];
    if (uncov.length > 0) {
      for (const fn of uncov.slice(0, 8)) {
        lines.push(
          `* \`${fn.name || fn.functionName}\` in \`${fn.file || fn.filePath}\``,
        );
      }
    }
    if (tg.generatedTestStubCode) {
      lines.push(
        ``,
        `\`\`\`typescript`,
        tg.generatedTestStubCode.slice(0, 800) +
          (tg.generatedTestStubCode.length > 800 ? "\n// ... [truncated]" : ""),
        `\`\`\``,
      );
    }
    return lines.join("\n");
  }

  // 6. Dead code
  if (endpoint.includes("dead-code") || data.dead_code_analysis) {
    const dc = data.dead_code_analysis || data;
    const symbols = dc.deadSymbols || [];
    return [
      `### 🧹 Dead Code & Unused Exports Analysis`,
      `* **Total Dead Symbols:** ${dc.totalDeadSymbols || symbols.length}`,
      symbols.length > 0
        ? symbols
            .slice(0, 10)
            .map(
              (s) =>
                `* \`${s.symbolName || s.name}\` in \`${s.filePath || s.file}\``,
            )
            .join("\n")
        : "* ✅ No dead exports detected.",
    ].join("\n");
  }

  // 7. General analyze_repository (AST Graph):
  if (endpoint.includes("/api/analyze") || data.analysis?.nodes) {
    const nodes = data.analysis?.nodes || data.nodes || [];
    const edges = data.analysis?.edges || data.edges || [];
    const sourceUsed = data.analysis?.sourceUsed || data.sourceUsed;
    return [
      `### 🌳 Repository Architecture & AST Analysis`,
      `* **Total Files / Symbols:** ${nodes.length}`,
      `* **Dependencies & Call Edges:** ${edges.length}`,
      ...(sourceUsed ? [`* **Fonte da analise:** \`${sourceUsed}\``] : []),
      `* **Top Entry Points:** ${nodes
        .slice(0, 5)
        .map((n) => `\`${n.path || n.label}\``)
        .join(", ")}`,
      ``,
      `> [!NOTE]`,
      `> Complete graph nodes cached locally in \`mrcp-analysis.json\`. Use \`mrcp_context_pruning_pack\` for task-specific code context.`,
    ].join("\n");
  }

  // Fallback: If JSON is small, return JSON; otherwise summarize cleanly
  const jsonStr = JSON.stringify(data, null, 2);
  if (jsonStr.length < 3000) {
    return jsonStr;
  }
  return JSON.stringify(
    {
      status: data.status || "success",
      message: "Analysis completed. Full details cached in mrcp-analysis.json.",
      summary: data.summary || { resultKeys: Object.keys(data) },
    },
    null,
    2,
  );
}

async function handleGet(endpoint, repoUrl, cacheKey = null) {
  if (cacheKey) {
    const cached = getCachedResult(repoUrl, cacheKey);
    if (cached)
      return {
        content: [
          { type: "text", text: formatResponseForAi(endpoint, cached) },
        ],
      };
  }
  try {
    const response = await fetch(`${MRCP_API_BASE}${endpoint}`);
    const data = await response.json();
    if (cacheKey) setCachedResult(repoUrl, cacheKey, data);
    return {
      content: [{ type: "text", text: formatResponseForAi(endpoint, data) }],
    };
  } catch (error) {
    return {
      content: [{ type: "text", text: `Error: ${error.message}` }],
      isError: true,
    };
  }
}

async function handlePost(endpoint, args) {
  try {
    const response = await fetch(`${MRCP_API_BASE}${endpoint}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(args),
    });
    const data = await response.json();
    return {
      content: [{ type: "text", text: formatResponseForAi(endpoint, data) }],
    };
  } catch (error) {
    return {
      content: [{ type: "text", text: `Error: ${error.message}` }],
      isError: true,
    };
  }
}

export const MCP_HANDLERS = {
  analyze_repository: async (args, repoUrl) => {
    try {
      const local = await runLocalAnalysis(repoUrl);
      if (local) {
        return {
          content: [
            {
              type: "text",
              // `raw` evita o resumo em markdown para consumidores programaticos.
              // Compacto de proposito: o transporte stdio do MCP tem buffer de 10 MB.
              text: args?.raw
                ? JSON.stringify(local)
                : formatResponseForAi("/api/analyze", local),
            },
          ],
        };
      }
    } catch (localError) {
      // Alvo local que falhou localmente nao pode virar chamada remota: a API
      // responderia 400 e, antes do guard, chegaria a sintetizar dados.
      if (String(localError.message).includes("Core local")) throw localError;
      return {
        content: [
          {
            type: "text",
            text: `Erro na analise local: ${localError.message}`,
          },
        ],
        isError: true,
      };
    }
    return handleGet(
      `/api/analyze?repo=${encodeURIComponent(repoUrl)}`,
      repoUrl,
      "analysis",
    );
  },
  get_repository_skills_contract: (args, repoUrl) =>
    handleGet(
      `/api/skills?repo=${encodeURIComponent(repoUrl)}`,
      repoUrl,
      "skills",
    ),
  mrcp_run_full_repository_suite: (args, repoUrl) => {
    const taskContext = args.taskContext
      ? `&task=${encodeURIComponent(args.taskContext)}`
      : "";
    return handleGet(
      `/api/full-analysis?repo=${encodeURIComponent(repoUrl)}${taskContext}`,
      repoUrl,
      "full_suite",
    );
  },
  mrcp_impact_analysis: (args) => handlePost(`/api/impact-analysis`, args),
  mrcp_security_compliance_audit: (args, repoUrl) =>
    handleGet(
      `/api/security-audit?repo=${encodeURIComponent(repoUrl)}`,
      repoUrl,
      "security",
    ),
  mrcp_architectural_drift_detector: (args, repoUrl) =>
    handleGet(
      `/api/architecture-drift?repo=${encodeURIComponent(repoUrl)}`,
      repoUrl,
      "drift",
    ),
  mrcp_auto_test_coverage_gap_finder: (args, repoUrl) =>
    handleGet(
      `/api/test-gap-analysis?repo=${encodeURIComponent(repoUrl)}`,
      repoUrl,
      "test_gaps",
    ),
  mrcp_context_pruning_pack: (args, repoUrl) => {
    const task = encodeURIComponent(args.taskDescription || "");
    return handleGet(
      `/api/context-pack?repo=${encodeURIComponent(repoUrl)}&task=${task}`,
      repoUrl,
    );
  },
  mrcp_ast_refactor_applier: (args) =>
    handlePost(`/api/refactor-applier`, args),
  mrcp_type_signature_extractor: (args, repoUrl) =>
    handleGet(
      `/api/type-signature-extractor?repo=${encodeURIComponent(repoUrl)}`,
      repoUrl,
    ),
  mrcp_git_diff_semantic_summarizer: (args) =>
    handlePost(`/api/diff-summarizer`, args),
  mrcp_dependency_compatibility_resolver: (args) => {
    const pkg = encodeURIComponent(args.packageName || "");
    return handleGet(`/api/dependency-resolver?package=${pkg}`, null);
  },
  mrcp_dead_code_pruner: (args, repoUrl) =>
    handleGet(
      `/api/dead-code-pruner?repo=${encodeURIComponent(repoUrl)}`,
      repoUrl,
      "dead_code",
    ),
  mrcp_sql_schema_orm_contract_generator: (args, repoUrl) =>
    handleGet(
      `/api/sql-orm-contract?repo=${encodeURIComponent(repoUrl)}`,
      repoUrl,
      "sql_orm",
    ),
  mrcp_api_contract_generator: (args, repoUrl) =>
    handleGet(
      `/api/api-contract?repo=${encodeURIComponent(repoUrl)}`,
      repoUrl,
      "api_contract",
    ),
  mrcp_code_metrics_health_scorer: (args, repoUrl) =>
    handleGet(
      `/api/code-health?repo=${encodeURIComponent(repoUrl)}`,
      repoUrl,
      "code_health",
    ),
  mrcp_env_secret_contract_validator: (args, repoUrl) =>
    handleGet(
      `/api/env-validator?repo=${encodeURIComponent(repoUrl)}`,
      repoUrl,
      "env_secrets",
    ),
  mrcp_monorepo_package_graph_analyzer: (args, repoUrl) =>
    handleGet(
      `/api/monorepo-graph?repo=${encodeURIComponent(repoUrl)}`,
      repoUrl,
      "monorepo",
    ),
  mrcp_docstring_api_doc_generator: (args, repoUrl) => {
    const targetFile = args.targetFilePath
      ? `&file=${encodeURIComponent(args.targetFilePath)}`
      : "";
    return handleGet(
      `/api/doc-generator?repo=${encodeURIComponent(repoUrl)}${targetFile}`,
      repoUrl,
    );
  },
  mrcp_document_analyzer: (args, repoUrl) => {
    const maxFiles = args.maxFiles
      ? `&maxFiles=${encodeURIComponent(args.maxFiles)}`
      : "";
    const ext = args.filterExtensions
      ? `&ext=${encodeURIComponent(args.filterExtensions.join(","))}`
      : "";
    return handleGet(
      `/api/document-analyzer?repo=${encodeURIComponent(repoUrl)}${maxFiles}${ext}`,
      repoUrl,
      "documents",
    );
  },
  mrcp_clone_page: (args) => handlePost("/api/clone", args),
};
