import { Server } from "@modelcontextprotocol/sdk/server/index";
import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types";

const server = new Server(
  {
    name: "mrcp-engine",
    version: "1.0.0",
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

// 1. Listar as ferramentas disponíveis
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: "analyze_repository",
        description: "Analisa a estrutura e código de um repositório do GitHub.",
        inputSchema: {
          type: "object",
          properties: {
            repo: {
              type: "string",
              description: "URL completa do repositório do GitHub (ex: https://github.com/usuario/repositorio)",
            },
          },
          required: ["repo"],
        },
      },
    ],
  };
});

// 2. Executar a ferramenta
server.setRequestHandler(CallToolRequestSchema, async (request: any) => {
  if (request.params.name === "analyze_repository") {
    const repoUrl = String(request.params.arguments?.repo);

    try {
      const { runAnalysis } = await import("../src/lib/analysis/pipeline.js");
      const analysisResult = await runAnalysis({
        repoUrl: repoUrl,
        githubToken: process.env.GITHUB_TOKEN,
        maxFiles: 2000,
      });

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(analysisResult, null, 2),
          },
        ],
      };
    } catch (error: any) {
      return {
        content: [
          {
            type: "text",
            text: `Erro ao analisar o repositório: ${error.message}`
          }
        ],
        isError: true
      };
    }
  }

  throw new Error(`Ferramenta não encontrada: ${request.params.name}`);
});

let transport: SSEServerTransport | null = null;

export default async function handler(req: any, res: any) {
  // Configurações de CORS recomendadas
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  if (req.method === "GET") {
    // Configura o transporte SSE
    transport = new SSEServerTransport("/api/mcp", res);
    await server.connect(transport);
    
    // Importante: No Vercel Edge/Serverless, conexões longas podem ser interrompidas
    // dependendo do plano, mas este é o padrão exigido pelo MCP via HTTP.
    return;
  }

  if (req.method === "POST") {
    if (!transport) {
      return res.status(400).json({ error: "SSE transport não iniciado. Faça uma requisição GET primeiro para estabelecer a conexão." });
    }
    
    // O MCP SDK espera lidar com a requisição e resposta diretamente
    await transport.handlePostMessage(req, res);
    return;
  }

  res.status(405).json({ error: "Method Not Allowed. Use GET para conectar via SSE ou POST para enviar mensagens (após conectado)." });
}
