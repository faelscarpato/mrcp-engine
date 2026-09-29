import { trackEngineUsage } from "../src/services/analytics.js";
import { routeHandlers } from "./routes.js";
import fs from "fs";
import path from "path";

/** Extrai o alvo do pedido, independente do formato (query ou body). */
function extractTarget(req: any): string | undefined {
  return req?.query?.repo || req?.body?.repoUrl || req?.body?.repo || undefined;
}

/**
 * Rotas que, na ausência de alvo, assumem "o cwd do servidor" (sentinela
 * "local"). Para elas o guard precisa adotar a MESMA semântica, senão um
 * pedido sem `repo` escapava da validação e a rota fabricava/analysisva o
 * diretório do container.
 *
 * É deliberadamente uma lista: exigir alvo em toda rota derrubaria
 * /api/guidelines e demais endpoints sem repositório.
 */
const DEFAULT_TARGET_ROUTES = new Set(["/api/report", "/api/export-report"]);

/**
 * Guard de integridade: a API hospedada não tem acesso ao disco do cliente.
 * Sem este guard, um path local caía no gerador determinístico e devolvia
 * MI/arquivos inventados — número falso é pior que erro.
 *
 * Reusa `parseTargetUrl` do core em vez de reimplementar a detecção: duas
 * cópias dessa lógica já divergiram (a do handler não via /absolutos POSIX).
 *
 * Na Vercel nenhum path local é válido (o cliente é remoto), mesmo os que por
 * acaso existam no container do servidor — analisar esses devolveria métricas
 * da própria hospedagem, não do projeto do usuário. Rodando localmente
 * (vercel dev / self-hosted) o path é válido se existir de fato.
 */
async function rejectUnreachableLocalTarget(
  req: any,
  res: any,
  urlPath: string,
): Promise<boolean> {
  const explicit = extractTarget(req);
  const target =
    explicit ?? (DEFAULT_TARGET_ROUTES.has(urlPath) ? "local" : undefined);
  if (!target) return false;

  // "local" é o sentinela usado por /api/report para significar "cwd".
  const trimmed = target.trim();
  const candidate = trimmed === "local" ? process.cwd() : trimmed;

  const { parseTargetUrl } =
    await import("../packages/core/lib/analysis/pipeline.js");
  const parsed = parseTargetUrl(candidate);
  if (!parsed || parsed.targetType !== "local") return false;

  const resolved = path.resolve(candidate);
  const hosted = Boolean(process.env.VERCEL);
  if (hosted || !fs.existsSync(resolved)) {
    res.status(400).json({
      status: "error",
      error_code: "LOCAL_TARGET_NOT_FOUND",
      message: hosted
        ? `Alvo local não é suportado pela API hospedada: ${resolved}`
        : `Alvo local não encontrado no servidor: ${resolved}`,
      hint: "A API hospedada não enxerga o seu disco. Use o CLI/MCP local (mrcp analyze --path <dir>) ou informe a URL de um repositório.",
    });
    return true;
  }
  return false;
}

export default async function handler(req: any, res: any) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader(
    "Access-Control-Allow-Headers",
    "X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization",
  );

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  const urlPath = (req.url || "").split("?")[0].replace(/\/$/, "");

  trackEngineUsage(null, "mrcp_engine_request", {
    method: req.method,
    endpoint: urlPath,
  });

  try {
    if (routeHandlers[urlPath]) {
      if (await rejectUnreachableLocalTarget(req, res, urlPath)) return;
      return await routeHandlers[urlPath](req, res);
    }

    // Endpoint não encontrado
    return res.status(404).json({
      status: "error",
      error_code: "ENDPOINT_NOT_FOUND",
      message: `Rota '${urlPath}' não encontrada.`,
    });
  } catch (error: any) {
    console.error(`Erro na rota ${urlPath}:`, error);
    return res.status(500).json({
      status: "error",
      details: error.message || "Erro interno do servidor.",
    });
  }
}
