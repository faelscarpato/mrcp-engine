#!/usr/bin/env node

/**
 * MRCP-Engine MCP Server (Local Bridge)
 * 
 * Servidor MCP via stdio para IDEs que preferem processo local.
 * Atua como bridge: faz fetch para https://mrcp-engine.vercel.app
 * e entrega os resultados via protocolo MCP (stdio).
 * 
 * Cache local: salva resultados em mrcp-analysis.json no workspace.
 */

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { CallToolRequestSchema, ListToolsRequestSchema } from "@modelcontextprotocol/sdk/types.js";
import fs from 'fs';
import path from 'path';

const MRCP_API_BASE = 'https://mrcp-engine.vercel.app';
const CACHE_FILE = 'mrcp-analysis.json';

// ─── Cache Local ─────────────────────────────────
function getCachedResult(repoUrl, type) {
  const cacheFile = path.join(process.cwd(), CACHE_FILE);
  if (fs.existsSync(cacheFile)) {
    try {
      const data = JSON.parse(fs.readFileSync(cacheFile, 'utf-8'));
      if (data.repoUrl === repoUrl && data[type]) {
        return data[type];
      }
    } catch(e) { /* ignore */ }
  }
  return null;
}

function setCachedResult(repoUrl, type, content) {
  const cacheFile = path.join(process.cwd(), CACHE_FILE);
  let data = { repoUrl };
  if (fs.existsSync(cacheFile)) {
    try { data = JSON.parse(fs.readFileSync(cacheFile, 'utf-8')); } catch(e) { /* ignore */ }
  }
  data.repoUrl = repoUrl;
  data[type] = content;
  try { fs.writeFileSync(cacheFile, JSON.stringify(data, null, 2), 'utf-8'); } catch(e) { /* ignore */ }
}

// ─── MCP Server ──────────────────────────────────
const server = new Server(
  { name: "mrcp-engine", version: "2.0.0" },
  { capabilities: { tools: {} } }
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    {
      name: "analyze_repository",
      description: "Analyzes the structural AST graph of a GitHub repository. Returns nodes, edges, metrics, hotspots, and architecture insights. Use this to understand a codebase without reading raw files.",
      inputSchema: {
        type: "object",
        properties: {
          repo: {
            type: "string",
            description: "Full URL of the GitHub repository (e.g., https://github.com/user/project)"
          }
        },
        required: ["repo"]
      }
    },
    {
      name: "get_repository_skills_contract",
      description: "Returns actionable skill contracts for hotspot files. Each contract includes language-specific directives for refactoring critical modules.",
      inputSchema: {
        type: "object",
        properties: {
          repo: {
            type: "string",
            description: "Full URL of the GitHub repository"
          }
        },
        required: ["repo"]
      }
    },
    {
      name: "mrcp_impact_analysis",
      description: "Calculates the AST Blast Radius of code changes before committing.",
      inputSchema: {
        type: "object",
        properties: {
          repo: { type: "string", description: "Full URL of the GitHub repository" },
          modifiedFiles: { type: "array", items: { type: "string" }, description: "List of modified file paths" }
        },
        required: ["repo", "modifiedFiles"]
      }
    },
    {
      name: "mrcp_security_compliance_audit",
      description: "Performs static AST security audit (OWASP, hardcoded secrets, unsafe execution).",
      inputSchema: {
        type: "object",
        properties: {
          repo: { type: "string", description: "Full URL of the GitHub repository" }
        },
        required: ["repo"]
      }
    },
    {
      name: "mrcp_architectural_drift_detector",
      description: "Detects architectural drift, circular dependencies, and cross-layer violations.",
      inputSchema: {
        type: "object",
        properties: {
          repo: { type: "string", description: "Full URL of the GitHub repository" }
        },
        required: ["repo"]
      }
    },
    {
      name: "mrcp_auto_test_coverage_gap_finder",
      description: "Maps high-complexity function nodes against tests to identify uncovered gaps and generate stubs.",
      inputSchema: {
        type: "object",
        properties: {
          repo: { type: "string", description: "Full URL of the GitHub repository" }
        },
        required: ["repo"]
      }
    },
    {
      name: "mrcp_context_pruning_pack",
      description: "Slices a minimal, hyper-focused AST context prompt pack for a specific task.",
      inputSchema: {
        type: "object",
        properties: {
          repo: { type: "string", description: "Full URL of the GitHub repository" },
          taskDescription: { type: "string", description: "Description of the task" }
        },
        required: ["repo", "taskDescription"]
      }
    },
    {
      name: "mrcp_ast_refactor_applier",
      description: "Applies deterministic AST refactoring in batch without LLM token cost.",
      inputSchema: {
        type: "object",
        properties: {
          action: { type: "string" },
          targetSymbol: { type: "string" },
          newSymbolName: { type: "string" }
        },
        required: ["action", "targetSymbol"]
      }
    },
    {
      name: "mrcp_type_signature_extractor",
      description: "Extracts only TypeScript .d.ts interfaces and type signatures from files.",
      inputSchema: {
        type: "object",
        properties: {
          repo: { type: "string", description: "Full URL of the GitHub repository" }
        },
        required: ["repo"]
      }
    },
    {
      name: "mrcp_git_diff_semantic_summarizer",
      description: "Strips formatting noise from git diffs and summarizes changes by business domain.",
      inputSchema: {
        type: "object",
        properties: {
          diffContent: { type: "string" }
        },
        required: ["diffContent"]
      }
    },
    {
      name: "mrcp_dependency_compatibility_resolver",
      description: "Resolves SemVer package version compatibility and peer dependency mismatches.",
      inputSchema: {
        type: "object",
        properties: {
          packageName: { type: "string" }
        },
        required: ["packageName"]
      }
    },
    {
      name: "mrcp_dead_code_pruner",
      description: "Performs AST tree-shaking reachability analysis to identify unreferenced exports.",
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
      description: "Parses SQL DDL or ORM schemas to expose typed DB tables and queries.",
      inputSchema: {
        type: "object",
        properties: {
          repo: { type: "string", description: "Full URL of the GitHub repository" }
        }
      }
    }
  ]
}));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const repoUrl = request.params.arguments.repo;
  const toolName = request.params.name;

  if (toolName === "analyze_repository") {
    // Tentar cache local primeiro
    const cached = getCachedResult(repoUrl, 'analysis');
    if (cached) {
      return { content: [{ type: "text", text: JSON.stringify(cached, null, 2) }] };
    }

    try {
      const response = await fetch(`${MRCP_API_BASE}/api/analyze?repo=${encodeURIComponent(repoUrl)}`);
      const data = await response.json();
      setCachedResult(repoUrl, 'analysis', data);
      return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
    } catch (error) {
      return {
        content: [{ type: "text", text: `Error: ${error.message}` }],
        isError: true
      };
    }
  }

  if (toolName === "get_repository_skills_contract") {
    const cached = getCachedResult(repoUrl, 'skills');
    if (cached) {
      return { content: [{ type: "text", text: JSON.stringify(cached, null, 2) }] };
    }

    try {
      const response = await fetch(`${MRCP_API_BASE}/api/skills?repo=${encodeURIComponent(repoUrl)}`);
      const data = await response.json();
      setCachedResult(repoUrl, 'skills', data);
      return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
    } catch (error) {
      return {
        content: [{ type: "text", text: `Error: ${error.message}` }],
        isError: true
      };
    }
  }

  if (toolName === "mrcp_impact_analysis") {
    try {
      const response = await fetch(`${MRCP_API_BASE}/api/impact-analysis`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(request.params.arguments)
      });
      const data = await response.json();
      return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
    } catch (error) {
      return { content: [{ type: "text", text: `Error: ${error.message}` }], isError: true };
    }
  }

  if (toolName === "mrcp_security_compliance_audit") {
    try {
      const response = await fetch(`${MRCP_API_BASE}/api/security-audit?repo=${encodeURIComponent(repoUrl)}`);
      const data = await response.json();
      return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
    } catch (error) {
      return { content: [{ type: "text", text: `Error: ${error.message}` }], isError: true };
    }
  }

  if (toolName === "mrcp_architectural_drift_detector") {
    try {
      const response = await fetch(`${MRCP_API_BASE}/api/architecture-drift?repo=${encodeURIComponent(repoUrl)}`);
      const data = await response.json();
      return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
    } catch (error) {
      return { content: [{ type: "text", text: `Error: ${error.message}` }], isError: true };
    }
  }

  if (toolName === "mrcp_auto_test_coverage_gap_finder") {
    try {
      const response = await fetch(`${MRCP_API_BASE}/api/test-gap-analysis?repo=${encodeURIComponent(repoUrl)}`);
      const data = await response.json();
      return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
    } catch (error) {
      return { content: [{ type: "text", text: `Error: ${error.message}` }], isError: true };
    }
  }

  if (toolName === "mrcp_context_pruning_pack") {
    try {
      const task = encodeURIComponent(request.params.arguments.taskDescription || "");
      const response = await fetch(`${MRCP_API_BASE}/api/context-pack?repo=${encodeURIComponent(repoUrl)}&task=${task}`);
      const data = await response.json();
      return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
    } catch (error) {
      return { content: [{ type: "text", text: `Error: ${error.message}` }], isError: true };
    }
  }

  if (toolName === "mrcp_ast_refactor_applier") {
    try {
      const response = await fetch(`${MRCP_API_BASE}/api/refactor-applier`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(request.params.arguments)
      });
      const data = await response.json();
      return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
    } catch (error) {
      return { content: [{ type: "text", text: `Error: ${error.message}` }], isError: true };
    }
  }

  if (toolName === "mrcp_type_signature_extractor") {
    try {
      const response = await fetch(`${MRCP_API_BASE}/api/type-signature-extractor?repo=${encodeURIComponent(repoUrl)}`);
      const data = await response.json();
      return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
    } catch (error) {
      return { content: [{ type: "text", text: `Error: ${error.message}` }], isError: true };
    }
  }

  if (toolName === "mrcp_git_diff_semantic_summarizer") {
    try {
      const response = await fetch(`${MRCP_API_BASE}/api/diff-summarizer`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(request.params.arguments)
      });
      const data = await response.json();
      return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
    } catch (error) {
      return { content: [{ type: "text", text: `Error: ${error.message}` }], isError: true };
    }
  }

  if (toolName === "mrcp_dependency_compatibility_resolver") {
    try {
      const pkg = encodeURIComponent(request.params.arguments.packageName || "");
      const response = await fetch(`${MRCP_API_BASE}/api/dependency-resolver?package=${pkg}`);
      const data = await response.json();
      return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
    } catch (error) {
      return { content: [{ type: "text", text: `Error: ${error.message}` }], isError: true };
    }
  }

  if (toolName === "mrcp_dead_code_pruner") {
    try {
      const response = await fetch(`${MRCP_API_BASE}/api/dead-code-pruner?repo=${encodeURIComponent(repoUrl)}`);
      const data = await response.json();
      return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
    } catch (error) {
      return { content: [{ type: "text", text: `Error: ${error.message}` }], isError: true };
    }
  }

  if (toolName === "mrcp_sql_schema_orm_contract_generator") {
    try {
      const response = await fetch(`${MRCP_API_BASE}/api/sql-orm-contract?repo=${encodeURIComponent(repoUrl)}`);
      const data = await response.json();
      return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
    } catch (error) {
      return { content: [{ type: "text", text: `Error: ${error.message}` }], isError: true };
    }
  }

  throw new Error(`Tool not found: ${toolName}`);
});

// Inicia comunicação via stdio
const transport = new StdioServerTransport();
await server.connect(transport);
console.error("MRCP-Engine MCP Server running on stdio (bridge mode)");
