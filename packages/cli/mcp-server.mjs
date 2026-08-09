#!/usr/bin/env node
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
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

    try {
      const { runAnalysis } = await import("../core/lib/analysis/pipeline.js");
      const { getCachedAnalysis, setCachedAnalysis } = await import("../core/lib/cache.js");
      
      const cachedData = await getCachedAnalysis(repoUrl, true);
      if (cachedData) {
        return {
          content: [{ type: "text", text: JSON.stringify(cachedData, null, 2) }]
        };
      }

      const analysisResult = await runAnalysis({
        repoUrl: repoUrl,
        githubToken: process.env.GITHUB_TOKEN,
        maxFiles: 2000,
      });

      await setCachedAnalysis(repoUrl, analysisResult, true);

      return {
        content: [{ type: "text", text: JSON.stringify(analysisResult, null, 2) }]
      };
    } catch (error) {
      return {
        content: [{ type: "text", text: `Error fetching structural data: ${error.message}` }],
        isError: true
      };
    }
  }

  if (request.params.name === "get_repository_skills_contract") {
    const repoUrl = request.params.arguments.repo;

    try {
      const { runAnalysis } = await import("../core/lib/analysis/pipeline.js");
      const { processRepositoryHotspots } = await import("../core/lib/analysis/mrcp-skill-injector.js");
      const { getCachedAnalysis, setCachedAnalysis } = await import("../core/lib/cache.js");
      
      let analysisResult = await getCachedAnalysis(repoUrl, true);
      
      if (!analysisResult) {
        analysisResult = await runAnalysis({
          repoUrl: repoUrl,
          githubToken: process.env.GITHUB_TOKEN,
          maxFiles: 2000,
        });
        await setCachedAnalysis(repoUrl, analysisResult, true);
      }

      const contracts = processRepositoryHotspots(analysisResult.nodes || analysisResult.architecture_summary?.nodes);

      return {
        content: [{ type: "text", text: JSON.stringify(contracts, null, 2) }]
      };
    } catch (error) {
      return {
        content: [{ type: "text", text: `Error fetching skill contracts: ${error.message}` }],
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
