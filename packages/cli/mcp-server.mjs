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

  throw new Error(`Tool not found: ${toolName}`);
});

// Inicia comunicação via stdio
const transport = new StdioServerTransport();
await server.connect(transport);
console.error("MRCP-Engine MCP Server running on stdio (bridge mode)");
