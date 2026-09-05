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
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { MCP_TOOLS } from "./mcp-tools.mjs";
import { MCP_HANDLERS } from "./mcp-handlers.mjs";

const server = new Server(
  { name: "mrcp-engine", version: "2.5.0" },
  { capabilities: { tools: {} } },
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: MCP_TOOLS,
}));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const toolName = request.params.name;
  const args = request.params.arguments || {};
  const repoUrl = args.repo || null;

  const handler = MCP_HANDLERS[toolName];
  if (!handler) {
    throw new Error(`Tool not found: ${toolName}`);
  }

  return await handler(args, repoUrl);
});

const transport = new StdioServerTransport();
await server.connect(transport);
console.error("MRCP-Engine MCP Server running on stdio (bridge mode)");
