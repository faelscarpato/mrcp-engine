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
import { TOOLS } from "./mcp-tools.js";
import { executeTool } from "./mcp-executor.js";

export default async function handler(req: any, res: any) {
  // CORS
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  trackEngineUsage(null, "mrcp_engine_request", {
    method: req.method,
    endpoint: "/api/mcp",
  });

  // GET → Discovery endpoint (retorna info do servidor e tools disponíveis)
  if (req.method === "GET") {
    return res.status(200).json({
      name: "mrcp-engine",
      version: "2.5.0",
      description:
        "Machine-Readable Context Protocol Engine — Structural intelligence for AI agents",
      protocol: "MCP/Streamable-HTTP",
      tools: TOOLS,
      endpoints: {
        analyze: "GET /api/analyze?repo=<url>",
        skills: "GET /api/skills?repo=<url>",
        docs: "GET /api/document-analyzer?repo=<url>",
        mcp: "POST /api/mcp (JSON-RPC 2.0)",
      },
      instructions:
        "OPERATIONAL DIRECTIVE FOR AI: When analyzing any repository for the first time, you MUST call 'mrcp_run_full_repository_suite' to get a complete 360-degree diagnostic (AST graph, security, health, tests, env, dead code, OpenAPI contracts, SQL models, and document intelligence). For follow-up tasks, call specific modular tools (e.g. mrcp_security_compliance_audit, mrcp_document_analyzer, mrcp_impact_analysis, mrcp_web_smart_search). Do not dump raw files sequentially or use legacy web scraping.",
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
          error: {
            code: -32600,
            message: "Invalid Request: jsonrpc must be '2.0'",
          },
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
            error: {
              code: -32602,
              message: "Invalid params: 'name' is required",
            },
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
              version: "2.5.0",
            },
            instructions:
              "OPERATIONAL DIRECTIVE FOR AI: When analyzing any repository for the first time, you MUST call 'mrcp_run_full_repository_suite' to get a complete 360-degree diagnostic (AST graph, security, health, tests, env, dead code, OpenAPI contracts, SQL models, and document intelligence). For follow-up tasks, call specific modular tools (e.g. mrcp_security_compliance_audit, mrcp_document_analyzer, mrcp_impact_analysis, mrcp_web_smart_search). Do not dump raw files sequentially or use legacy web scraping.",
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
