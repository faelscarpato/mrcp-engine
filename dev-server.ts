/**
 * dev-server.ts — Servidor local para emular as Vercel Serverless Functions.
 * 
 * Uso: npx tsx dev-server.ts
 * 
 * Sobe na porta 3000, que é o target do proxy do Vite.
 * Quando o Vite roda na 5173, ele redireciona /api/* → localhost:3000/api/*.
 */
import { createServer, IncomingMessage, ServerResponse } from "node:http";
import { URL } from "node:url";

// Dynamic imports das rotas serverless
const PORT = 3000;

async function loadHandler(routePath: string) {
  const mod = await import(routePath);
  return mod.default;
}

// Mapeamento rota → arquivo handler
const ROUTES: Record<string, string> = {
  "/api/search": "./api/search.ts",
  "/api/scrape": "./api/scrape.ts",
  "/api/smart-search": "./api/smart-search.ts",
  "/api/mcp": "./api/mcp.ts",
  "/api/analyze": "./api/analyze.ts",
  "/api/skills": "./api/skills.ts",
  "/api/read": "./api/read.ts",
};

function parseBody(req: IncomingMessage): Promise<any> {
  return new Promise((resolve) => {
    let body = "";
    req.on("data", (chunk: string) => (body += chunk));
    req.on("end", () => {
      try {
        resolve(JSON.parse(body));
      } catch {
        resolve({});
      }
    });
  });
}

createServer(async (req: IncomingMessage, res: ServerResponse) => {
  const url = new URL(req.url || "/", `http://localhost:${PORT}`);
  const pathname = url.pathname;

  // Adaptar req para o formato que os handlers Vercel esperam
  const query: Record<string, string> = {};
  url.searchParams.forEach((v, k) => (query[k] = v));

  const vercelReq: any = Object.assign(req, {
    query,
    body: req.method === "POST" ? await parseBody(req) : undefined,
  });

  const vercelRes: any = Object.assign(res, {
    status(code: number) {
      res.statusCode = code;
      return vercelRes;
    },
    json(data: any) {
      res.setHeader("Content-Type", "application/json");
      res.end(JSON.stringify(data));
      return vercelRes;
    },
    send(data: string) {
      res.end(data);
      return vercelRes;
    },
  });

  // Encontrar o handler
  const routeFile = ROUTES[pathname];
  if (!routeFile) {
    vercelRes.status(404).json({ error: `Rota não encontrada: ${pathname}` });
    return;
  }

  try {
    const handler = await loadHandler(routeFile);
    await handler(vercelReq, vercelRes);
  } catch (err: any) {
    console.error(`Erro em ${pathname}:`, err);
    if (!res.headersSent) {
      vercelRes.status(500).json({ error: err.message });
    }
  }
}).listen(PORT, () => {
  console.log(`\n🚀 MRCP Dev Server rodando em http://localhost:${PORT}`);
  console.log(`\nEndpoints disponíveis:`);
  console.log(`  GET  /api/search?q=<query>`);
  console.log(`  GET  /api/scrape?url=<url>`);
  console.log(`  GET  /api/smart-search?q=<query>&topN=2`);
  console.log(`  GET  /api/mcp                (Discovery)`);
  console.log(`  POST /api/mcp                (JSON-RPC 2.0)`);
  console.log(`  GET  /api/analyze?repo=<url>`);
  console.log(`  GET  /api/skills?repo=<url>`);
  console.log(`\nPronto para receber requisições via curl ou navegador!\n`);
});
