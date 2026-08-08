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
      }
    ]
  };
});

// 2. Executa a chamada para a sua API na Vercel quando a IA pedir
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  if (request.params.name === "analyze_repository") {
    const repoUrl = request.params.arguments.repo;
    const apiUrl = `https://mrcp-engine.vercel.app/api/analyze?repo=${encodeURIComponent(repoUrl)}`;

    try {
      const response = await fetch(apiUrl);
      const data = await response.json();

      return {
        content: [{ type: "text", text: JSON.stringify(data, null, 2) }]
      };
    } catch (error) {
      return {
        content: [{ type: "text", text: `Error fetching structural data: ${error.message}` }],
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
