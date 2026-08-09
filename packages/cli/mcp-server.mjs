#!/usr/bin/env node
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import fs from 'fs';
import path from 'path';

// --- Funções de Cache Local no Workspace ---
function getLocalWorkspaceCache(repoUrl, type) {
  const cacheFile = path.join(process.cwd(), 'mrcp-analysis.json');
  if (fs.existsSync(cacheFile)) {
    try {
      const data = JSON.parse(fs.readFileSync(cacheFile, 'utf-8'));
      if (data.repoUrl === repoUrl && data[type]) {
        return data[type];
      }
    } catch(e) {}
  }
  return null;
}

function setLocalWorkspaceCache(repoUrl, type, content) {
  const cacheFile = path.join(process.cwd(), 'mrcp-analysis.json');
  let data = { repoUrl };
  if (fs.existsSync(cacheFile)) {
    try { data = JSON.parse(fs.readFileSync(cacheFile, 'utf-8')); } catch(e) {}
  }
  data.repoUrl = repoUrl;
  data[type] = content;
  try { fs.writeFileSync(cacheFile, JSON.stringify(data, null, 2), 'utf-8'); } catch(e) {}
}
// -------------------------------------------
import { CallToolRequestSchema, ListToolsRequestSchema } from "@modelcontextprotocol/sdk/types.js";

// Instancia o Servidor MCP
const server = new Server(
  { name: "mrcp-engine-bridge", version: "1.0.0" },
  { capabilities: { tools: {} } }
);

// 1. Diz à IA quais ferramentas existem
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: "analyze_repository",
        description: "Fetches the structural AST graph of a repository to avoid AI Tax.",
        inputSchema: {
          type: "object",
          properties: {
            repo: {
              type: "string",
              description: "URL of the repository to analyze (e.g., https://github.com/user/project)"
            }
          },
          required: ["repo"]
        }
      },
      {
        name: "get_repository_skills_contract",
        description: "Returns the skill contracts to be executed on a repository to mitigate identified hotspots.",
        inputSchema: {
          type: "object",
          properties: {
            repo: {
              type: "string",
              description: "URL of the repository"
            }
          },
          required: ["repo"]
        }
      }
    ]
  };
});

// 2. Executa a chamada para a sua API na Vercel quando a IA pedir
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  if (request.params.name === "analyze_repository") {
    const repoUrl = request.params.arguments.repo;

    // 1. Tentar carregar do cache local da pasta atual (Workspace)
    const localCache = getLocalWorkspaceCache(repoUrl, 'analysis');
    if (localCache) {
      return { content: [{ type: "text", text: JSON.stringify(localCache, null, 2) }] };
    }

    const apiUrl = `https://mrcp-engine.vercel.app/api/analyze?repo=${encodeURIComponent(repoUrl)}`;

    try {
      const response = await fetch(apiUrl);
      const data = await response.json();

      // Salva no cache local do Workspace para que as próximas chamadas da IA sejam instantâneas
      setLocalWorkspaceCache(repoUrl, 'analysis', data);

      return {
        content: [{ type: "text", text: JSON.stringify(data, null, 2) }]
      };
    } catch (error) {
      return {
        content: [{ type: "text", text: `Error fetching structural data from Vercel: ${error.message}` }],
        isError: true
      };
    }
  }

  if (request.params.name === "get_repository_skills_contract") {
    const repoUrl = request.params.arguments.repo;

    // 1. Tentar carregar do cache local da pasta atual (Workspace)
    const localCache = getLocalWorkspaceCache(repoUrl, 'skills');
    if (localCache) {
      return { content: [{ type: "text", text: JSON.stringify(localCache, null, 2) }] };
    }

    const apiUrl = `https://mrcp-engine.vercel.app/api/skills?repo=${encodeURIComponent(repoUrl)}`;

    try {
      const response = await fetch(apiUrl);
      const data = await response.json();

      // Salva no cache local do Workspace para que as próximas chamadas da IA sejam instantâneas
      setLocalWorkspaceCache(repoUrl, 'skills', data);

      return {
        content: [{ type: "text", text: JSON.stringify(data, null, 2) }]
      };
    } catch (error) {
      return {
        content: [{ type: "text", text: `Error fetching skill contracts from Vercel: ${error.message}` }],
        isError: true
      };
    }
  }

  throw new Error("Tool not found");
});

// Inicia a comunicação via terminal (STDIO)
const transport = new StdioServerTransport();
await server.connect(transport);
console.error("MRCP-Engine MCP Bridge running on stdio");
