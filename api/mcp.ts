import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types";
import { saveEndpointOutput } from "../packages/core/lib/cache.js";
import { trackEngineUsage } from "../src/services/analytics.js";

/**
 * MRCP-Engine — Endpoint MCP via Streamable HTTP (Stateless)
 * 
 * Compatível com Vercel Serverless. Cada request cria um contexto MCP efêmero,
 * processa a chamada e responde. Sem SSE, sem conexão persistente.
 * 
 * Uso: POST https://mrcp-engine.vercel.app/api/mcp
 *      GET  https://mrcp-engine.vercel.app/api/mcp  → Discovery/Health
 */

// ─── Tool Definitions ───────────────────────────
const TOOLS = [
  // --- Category: Core Engine ---
  {
    name: "analyze_repository",
    description:
      "[Category: Core Engine] Analyzes the structural AST graph of a GitHub repository. Returns nodes (files, modules, functions), edges (dependencies), metrics (complexity, coupling, hotspots), and architecture insights. Use this to understand a codebase without reading raw files.",
    inputSchema: {
      type: "object",
      properties: {
        repo: {
          type: "string",
          description:
            "Full URL of the GitHub repository (e.g., https://github.com/user/project)",
        },
      },
      required: ["repo"],
    },
  },
  {
    name: "get_repository_skills_contract",
    description:
      "[Category: Core Engine] Returns actionable skill contracts for hotspot files in a repository. Each contract includes the detected language, complexity metrics, structural status, dependency shielding rules, and strict directives for refactoring. Use after analyze_repository to get improvement recommendations.",
    inputSchema: {
      type: "object",
      properties: {
        repo: {
          type: "string",
          description: "Full URL of the GitHub repository",
        },
      },
      required: ["repo"],
    },
  },

  // --- Category: Predictive & Security Engineering ---
  {
    name: "mrcp_impact_analysis",
    description:
      "[Category: Predictive & Security Engineering] Calculates the AST Blast Radius of code changes. Traces downstream impacted files, functions, and unit tests before committing.",
    inputSchema: {
      type: "object",
      properties: {
        repo: { type: "string", description: "Full URL of the GitHub repository" },
        modifiedFiles: { type: "array", items: { type: "string" }, description: "List of modified file paths" },
        diffContent: { type: "string", description: "Optional git diff string" }
      },
      required: ["repo", "modifiedFiles"]
    }
  },
  {
    name: "mrcp_security_compliance_audit",
    description:
      "[Category: Predictive & Security Engineering] Performs static AST security audit (OWASP, hardcoded secrets, unsafe execution, package licenses).",
    inputSchema: {
      type: "object",
      properties: {
        repo: { type: "string", description: "Full URL of the GitHub repository" },
        severityThreshold: { type: "string", enum: ["LOW", "MEDIUM", "HIGH", "CRITICAL"], default: "LOW" }
      },
      required: ["repo"]
    }
  },
  {
    name: "mrcp_architectural_drift_detector",
    description:
      "[Category: Predictive & Security Engineering] Detects architectural drift, circular dependencies, and cross-layer violations against Clean Architecture.",
    inputSchema: {
      type: "object",
      properties: {
        repo: { type: "string", description: "Full URL of the GitHub repository" },
        architectureType: { type: "string", enum: ["CLEAN_ARCHITECTURE", "HEXAGONAL", "FEATURE_FIRST", "LAYERED"], default: "CLEAN_ARCHITECTURE" },
        maxAllowedCyclicDependencies: { type: "number", default: 0 }
      },
      required: ["repo"]
    }
  },
  {
    name: "mrcp_auto_test_coverage_gap_finder",
    description:
      "[Category: Predictive & Security Engineering] Maps high-complexity function nodes against tests to identify uncovered gaps and generate Vitest/Jest stubs.",
    inputSchema: {
      type: "object",
      properties: {
        repo: { type: "string", description: "Full URL of the GitHub repository" },
        targetHotspotsOnly: { type: "boolean", default: true },
        generateStubs: { type: "boolean", default: true }
      },
      required: ["repo"]
    }
  },
  {
    name: "mrcp_context_pruning_pack",
    description:
      "[Category: Predictive & Security Engineering] Slices a minimal, hyper-focused AST context prompt pack for a specific task to optimize LLM token budget.",
    inputSchema: {
      type: "object",
      properties: {
        repo: { type: "string", description: "Full URL of the GitHub repository" },
        taskDescription: { type: "string", description: "Description of the user task for the LLM" },
        maxTokenBudget: { type: "number", default: 8000 }
      },
      required: ["repo", "taskDescription"]
    }
  },

  // --- Category: High-Efficiency Agent Offloading ---
  {
    name: "mrcp_ast_refactor_applier",
    description:
      "[Category: High-Efficiency Agent Offloading] Applies deterministic AST refactoring (rename symbols, extract interfaces, update imports) in batch without LLM token cost.",
    inputSchema: {
      type: "object",
      properties: {
        action: { type: "string", enum: ["RENAME_SYMBOL", "EXTRACT_INTERFACE", "UPDATE_IMPORT"] },
        targetSymbol: { type: "string" },
        newSymbolName: { type: "string" },
        targetFilePath: { type: "string" },
        dryRun: { type: "boolean", default: false }
      },
      required: ["action", "targetSymbol"]
    }
  },
  {
    name: "mrcp_type_signature_extractor",
    description:
      "[Category: High-Efficiency Agent Offloading] Extracts only TypeScript .d.ts interfaces and type signatures from files, eliminating implementation body tokens.",
    inputSchema: {
      type: "object",
      properties: {
        repo: { type: "string", description: "Full URL of the GitHub repository" },
        targetFilePath: { type: "string" }
      },
      required: ["repo"]
    }
  },
  {
    name: "mrcp_git_diff_semantic_summarizer",
    description:
      "[Category: High-Efficiency Agent Offloading] Strips whitespace/formatting noise from git diffs and summarizes changes by business domain at AST level.",
    inputSchema: {
      type: "object",
      properties: {
        diffContent: { type: "string" },
        stripFormattingNoise: { type: "boolean", default: true }
      },
      required: ["diffContent"]
    }
  },
  {
    name: "mrcp_dependency_compatibility_resolver",
    description:
      "[Category: High-Efficiency Agent Offloading] Resolves SemVer package version compatibility, peer dependency mismatches, and breaking change risks.",
    inputSchema: {
      type: "object",
      properties: {
        packageName: { type: "string" },
        targetVersion: { type: "string", default: "latest" }
      },
      required: ["packageName"]
    }
  },
  {
    name: "mrcp_dead_code_pruner",
    description:
      "[Category: High-Efficiency Agent Offloading] Performs AST tree-shaking reachability analysis to identify unreferenced exports, dead variables, and unused imports.",
    inputSchema: {
      type: "object",
      properties: {
        repo: { type: "string", description: "Full URL of the GitHub repository" }
      },
      required: ["repo"]
    }
  },
  {
    name: "mrcp_sql_schema_orm_contract_generator",
    description:
      "[Category: High-Efficiency Agent Offloading] Parses SQL DDL, Prisma schemas, or Drizzle/TypeORM models to expose typed DB tables, foreign keys, and queries.",
    inputSchema: {
      type: "object",
      properties: {
        repo: { type: "string", description: "Full URL of the GitHub repository" },
        schemaFilePath: { type: "string" }
      }
    }
  },

  // --- Category: Triage & HR ---
  {
    name: "mrcp_triage_parse_resume",
    description:
      "[Category: Triage & HR] Extrai nome, email e skills de um currículo em texto bruto via regex.",
    inputSchema: {
      type: "object",
      properties: {
        content: { type: "string" },
        contentType: { type: "string" },
      },
      required: ["content"],
    },
  },
  {
    name: "mrcp_triage_score_candidate",
    description:
      "[Category: Triage & HR] Calcula a aderência entre um candidato e uma vaga via teoria de conjuntos.",
    inputSchema: {
      type: "object",
      properties: {
        resumeData: { type: "object" },
        jobDescription: { type: "string" },
      },
      required: ["resumeData", "jobDescription"],
    },
  },
  {
    name: "mrcp_triage_generate_hr_report",
    description:
      "[Category: Triage & HR] Gera um parecer de triagem formatado (PDF simulado).",
    inputSchema: {
      type: "object",
      properties: {
        candidateName: { type: "string" },
        targetRole: { type: "string" },
        aiDossierContent: { type: "string" },
      },
      required: ["candidateName", "targetRole", "aiDossierContent"],
    },
  },

  // --- Category: Web Scraper ---
  {
    name: "mrcp_web_search",
    description:
      "[Category: Web Scraper] Pesquisa na web e retorna títulos, URLs e snippets. Útil para descobrir links relevantes sem ler a página toda.",
    inputSchema: {
      type: "object",
      properties: {
        query: { type: "string", description: "A pergunta ou tema para buscar no motor de busca." },
      },
      required: ["query"],
    },
  },
  {
    name: "mrcp_web_scrape",
    description:
      "[Category: Web Scraper] Abre uma URL e extrai APENAS o texto limpo, eliminando navegação e anúncios. Use para ler o conteúdo de um link.",
    inputSchema: {
      type: "object",
      properties: {
        url: { type: "string", description: "A URL completa da página a ser lida." },
      },
      required: ["url"],
    },
  },
  {
    name: "mrcp_web_smart_search",
    description:
      "[Category: Web Scraper] Faz busca, ranqueia os links mais relevantes por palavras-chave e já extrai o texto completo das 'topN' páginas. Orquestrador definitivo.",
    inputSchema: {
      type: "object",
      properties: {
        query: { type: "string", description: "O tema a ser pesquisado profundamente." },
        topN: { type: "number", description: "Quantos links abrir simultaneamente. Default: 2" },
        minScore: { type: "number", description: "Score mínimo aceitável. Default: 0" },
      },
      required: ["query"],
    },
  },
];

// ─── Tool Execution ─────────────────────────────
async function executeTool(toolName: string, args: any): Promise<any> {
  // Core Engine Tools
  if (toolName === "analyze_repository") {
    const repoUrl = String(args?.repo || "");
    if (!repoUrl) return { content: [{ type: "text", text: "Error: 'repo' parameter is required." }], isError: true };
    try {
      const { runAnalysis } = await import("../packages/core/lib/analysis/pipeline.js");
      const result = await runAnalysis({ repoUrl, githubToken: process.env.GITHUB_TOKEN, maxFiles: 2000 });
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    } catch (error: any) {
      return { content: [{ type: "text", text: `Error analyzing repository: ${error.message}` }], isError: true };
    }
  }

  if (toolName === "get_repository_skills_contract") {
    const repoUrl = String(args?.repo || "");
    if (!repoUrl) return { content: [{ type: "text", text: "Error: 'repo' parameter is required." }], isError: true };
    try {
      const { runAnalysis } = await import("../packages/core/lib/analysis/pipeline.js");
      const { processRepositoryHotspots } = await import("../packages/core/lib/analysis/mrcp-skill-injector.js");
      const result = await runAnalysis({ repoUrl, githubToken: process.env.GITHUB_TOKEN, maxFiles: 2000 });
      const contracts = processRepositoryHotspots(result.analysis?.nodes || result.nodes || []);
      return { content: [{ type: "text", text: JSON.stringify(contracts, null, 2) }] };
    } catch (error: any) {
      return { content: [{ type: "text", text: `Error generating skill contracts: ${error.message}` }], isError: true };
    }
  }

  // Predictive & Security Engineering Tools
  if (toolName === "mrcp_impact_analysis") {
    const repoUrl = String(args?.repo || "");
    const modifiedFiles = args?.modifiedFiles || [];
    if (!repoUrl) return { content: [{ type: "text", text: "Error: 'repo' parameter is required." }], isError: true };
    try {
      const { calculateImpactAnalysis } = await import("../packages/core/lib/analysis/impact-analysis.js");
      const result = await calculateImpactAnalysis({ repoUrl, modifiedFiles, diffContent: args?.diffContent });
      saveEndpointOutput(toolName, repoUrl, result);
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    } catch (error: any) {
      return { content: [{ type: "text", text: `Error executing impact analysis: ${error.message}` }], isError: true };
    }
  }

  if (toolName === "mrcp_security_compliance_audit") {
    const repoUrl = String(args?.repo || "");
    if (!repoUrl) return { content: [{ type: "text", text: "Error: 'repo' parameter is required." }], isError: true };
    try {
      const { runSecurityAudit } = await import("../packages/core/lib/analysis/security-audit.js");
      const result = await runSecurityAudit({ repoUrl, severityThreshold: args?.severityThreshold });
      saveEndpointOutput(toolName, repoUrl, result);
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    } catch (error: any) {
      return { content: [{ type: "text", text: `Error executing security audit: ${error.message}` }], isError: true };
    }
  }

  if (toolName === "mrcp_architectural_drift_detector") {
    const repoUrl = String(args?.repo || "");
    if (!repoUrl) return { content: [{ type: "text", text: "Error: 'repo' parameter is required." }], isError: true };
    try {
      const { detectArchitectureDrift } = await import("../packages/core/lib/analysis/architecture-drift.js");
      const result = await detectArchitectureDrift({
        repoUrl,
        architectureType: args?.architectureType,
        maxAllowedCyclicDependencies: args?.maxAllowedCyclicDependencies
      });
      saveEndpointOutput(toolName, repoUrl, result);
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    } catch (error: any) {
      return { content: [{ type: "text", text: `Error detecting architecture drift: ${error.message}` }], isError: true };
    }
  }

  if (toolName === "mrcp_auto_test_coverage_gap_finder") {
    const repoUrl = String(args?.repo || "");
    if (!repoUrl) return { content: [{ type: "text", text: "Error: 'repo' parameter is required." }], isError: true };
    try {
      const { findTestCoverageGaps } = await import("../packages/core/lib/analysis/test-gap-analysis.js");
      const result = await findTestCoverageGaps({
        repoUrl,
        targetHotspotsOnly: args?.targetHotspotsOnly,
        generateStubs: args?.generateStubs
      });
      saveEndpointOutput(toolName, repoUrl, result);
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    } catch (error: any) {
      return { content: [{ type: "text", text: `Error finding test coverage gaps: ${error.message}` }], isError: true };
    }
  }

  if (toolName === "mrcp_context_pruning_pack") {
    const repoUrl = String(args?.repo || "");
    const taskDescription = String(args?.taskDescription || "");
    if (!repoUrl || !taskDescription) {
      return { content: [{ type: "text", text: "Error: 'repo' and 'taskDescription' parameters are required." }], isError: true };
    }
    try {
      const { buildContextPack } = await import("../packages/core/lib/analysis/context-pack.js");
      const result = await buildContextPack({
        repoUrl,
        taskDescription,
        maxTokenBudget: args?.maxTokenBudget
      });
      saveEndpointOutput(toolName, repoUrl, result);
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    } catch (error: any) {
      return { content: [{ type: "text", text: `Error generating context pruning pack: ${error.message}` }], isError: true };
    }
  }

  // High-Efficiency Agent Offloading Tools
  if (toolName === "mrcp_ast_refactor_applier") {
    try {
      const { applyAstRefactoring } = await import("../packages/core/lib/analysis/refactor-applier.js");
      const result = await applyAstRefactoring({
        action: args.action,
        targetSymbol: args.targetSymbol,
        newSymbolName: args.newSymbolName,
        targetFilePath: args.targetFilePath,
        dryRun: args.dryRun
      });
      saveEndpointOutput(toolName, args.repoUrl || "local", result);
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    } catch (error: any) {
      return { content: [{ type: "text", text: `Error applying AST refactoring: ${error.message}` }], isError: true };
    }
  }

  if (toolName === "mrcp_type_signature_extractor") {
    const repoUrl = String(args?.repo || "");
    if (!repoUrl) return { content: [{ type: "text", text: "Error: 'repo' parameter is required." }], isError: true };
    try {
      const { extractTypeSignatures } = await import("../packages/core/lib/analysis/type-signature-extractor.js");
      const result = await extractTypeSignatures({ repoUrl, targetFilePath: args.targetFilePath });
      saveEndpointOutput(toolName, repoUrl, result);
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    } catch (error: any) {
      return { content: [{ type: "text", text: `Error extracting type signatures: ${error.message}` }], isError: true };
    }
  }

  if (toolName === "mrcp_git_diff_semantic_summarizer") {
    const diffContent = String(args?.diffContent || "");
    if (!diffContent) return { content: [{ type: "text", text: "Error: 'diffContent' parameter is required." }], isError: true };
    try {
      const { summarizeGitDiff } = await import("../packages/core/lib/analysis/diff-summarizer.js");
      const result = await summarizeGitDiff({ diffContent, stripFormattingNoise: args.stripFormattingNoise });
      saveEndpointOutput(toolName, "diff-session", result);
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    } catch (error: any) {
      return { content: [{ type: "text", text: `Error summarizing git diff: ${error.message}` }], isError: true };
    }
  }

  if (toolName === "mrcp_dependency_compatibility_resolver") {
    const packageName = String(args?.packageName || "");
    if (!packageName) return { content: [{ type: "text", text: "Error: 'packageName' parameter is required." }], isError: true };
    try {
      const { resolveDependencyCompatibility } = await import("../packages/core/lib/analysis/dependency-resolver.js");
      const result = await resolveDependencyCompatibility({ packageName, targetVersion: args.targetVersion });
      saveEndpointOutput(toolName, packageName, result);
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    } catch (error: any) {
      return { content: [{ type: "text", text: `Error resolving dependency compatibility: ${error.message}` }], isError: true };
    }
  }

  if (toolName === "mrcp_dead_code_pruner") {
    const repoUrl = String(args?.repo || "");
    if (!repoUrl) return { content: [{ type: "text", text: "Error: 'repo' parameter is required." }], isError: true };
    try {
      const { findDeadCode } = await import("../packages/core/lib/analysis/dead-code-pruner.js");
      const result = await findDeadCode({ repoUrl });
      saveEndpointOutput(toolName, repoUrl, result);
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    } catch (error: any) {
      return { content: [{ type: "text", text: `Error finding dead code: ${error.message}` }], isError: true };
    }
  }

  if (toolName === "mrcp_sql_schema_orm_contract_generator") {
    try {
      const { generateSqlOrmContract } = await import("../packages/core/lib/analysis/sql-orm-contract.js");
      const result = await generateSqlOrmContract({ repoUrl: args.repo, schemaFilePath: args.schemaFilePath });
      saveEndpointOutput(toolName, args.repo || "schema-session", result);
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    } catch (error: any) {
      return { content: [{ type: "text", text: `Error generating SQL/ORM contract: ${error.message}` }], isError: true };
    }
  }

  // Triage & HR Tools
  if (toolName === "mrcp_triage_parse_resume") {
    const { parseResume } = await import("../packages/core/lib/triage/mcp-tools.js");
    const result = parseResume({ content: args.content, contentType: args.contentType });
    return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
  }

  if (toolName === "mrcp_triage_score_candidate") {
    const { scoreCandidate } = await import("../packages/core/lib/triage/mcp-tools.js");
    const result = scoreCandidate({ resumeData: args.resumeData, jobDescription: args.jobDescription });
    return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
  }

  if (toolName === "mrcp_triage_generate_hr_report") {
    const { generateHrReport } = await import("../packages/core/lib/triage/mcp-tools.js");
    const result = generateHrReport({ candidateName: args.candidateName, targetRole: args.targetRole, aiDossierContent: args.aiDossierContent });
    return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
  }

  // Web Scraper Tools
  if (toolName === "mrcp_web_search") {
    const { searchDuckDuckGo } = await import("../packages/core/lib/web/scraper-tools.js");
    const result = await searchDuckDuckGo(args.query);
    return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
  }

  if (toolName === "mrcp_web_scrape") {
    const { scrapeUrl } = await import("../packages/core/lib/web/scraper-tools.js");
    const result = await scrapeUrl(args.url);
    return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
  }

  if (toolName === "mrcp_web_smart_search") {
    const { smartSearchPipeline } = await import("../packages/core/lib/web/scraper-tools.js");
    const result = await smartSearchPipeline(args.query, args.topN ?? 2, args.minScore ?? 0);
    return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
  }

  return {
    content: [{ type: "text", text: `Unknown tool: ${toolName}` }],
    isError: true,
  };
}

// ─── HTTP Handler (Vercel Serverless) ───────────
export default async function handler(req: any, res: any) {
  // CORS
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  trackEngineUsage(null, 'mrcp_engine_request', { method: req.method, endpoint: '/api/mcp' });

  // GET → Discovery endpoint (retorna info do servidor e tools disponíveis)
  if (req.method === "GET") {
    return res.status(200).json({
      name: "mrcp-engine",
      version: "2.1.0",
      description: "Machine-Readable Context Protocol Engine — Structural intelligence for AI agents",
      protocol: "MCP/Streamable-HTTP",
      tools: TOOLS,
      endpoints: {
        analyze: "GET /api/analyze?repo=<url>",
        skills: "GET /api/skills?repo=<url>",
        mcp: "POST /api/mcp (JSON-RPC 2.0)",
      },
      instructions: "Send a JSON-RPC 2.0 POST with method 'tools/list' or 'tools/call' to interact with the MCP server.",
    });
  }

  // POST → JSON-RPC 2.0 (MCP protocol)
  if (req.method === "POST") {
    try {
      const body = req.body;
      const { jsonrpc, method, id, params } = body;

      if (jsonrpc !== "2.0") {
        return res.status(400).json({
          jsonrpc: "2.0",
          id: id || null,
          error: { code: -32600, message: "Invalid Request: jsonrpc must be '2.0'" },
        });
      }

      // tools/list
      if (method === "tools/list") {
        return res.status(200).json({
          jsonrpc: "2.0",
          id,
          result: { tools: TOOLS },
        });
      }

      // tools/call
      if (method === "tools/call") {
        const toolName = params?.name;
        const toolArgs = params?.arguments || {};

        if (!toolName) {
          return res.status(400).json({
            jsonrpc: "2.0",
            id,
            error: { code: -32602, message: "Invalid params: 'name' is required" },
          });
        }

        const result = await executeTool(toolName, toolArgs);

        return res.status(200).json({
          jsonrpc: "2.0",
          id,
          result,
        });
      }

      // initialize (handshake)
      if (method === "initialize") {
        return res.status(200).json({
          jsonrpc: "2.0",
          id,
          result: {
            protocolVersion: "2024-11-05",
            capabilities: { tools: {} },
            serverInfo: {
              name: "mrcp-engine",
              version: "2.1.0",
            },
          },
        });
      }

      // notifications/initialized (ack — no response needed but we send one for HTTP)
      if (method === "notifications/initialized") {
        return res.status(200).json({ jsonrpc: "2.0", id, result: {} });
      }

      // Unknown method
      return res.status(200).json({
        jsonrpc: "2.0",
        id,
        error: { code: -32601, message: `Method not found: ${method}` },
      });
    } catch (err: any) {
      return res.status(500).json({
        jsonrpc: "2.0",
        id: null,
        error: { code: -32603, message: `Internal error: ${err.message}` },
      });
    }
  }

  return res.status(405).json({ error: "Method Not Allowed" });
}
