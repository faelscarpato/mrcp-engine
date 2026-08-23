import { trackEngineUsage } from "../src/services/analytics.js";
import { routeHandlers } from "./routes.js";

export default async function handler(req: any, res: any) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader(
    "Access-Control-Allow-Headers",
    "X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization"
  );

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  const urlPath = (req.url || "").split("?")[0].replace(/\/$/, "");

  trackEngineUsage(null, "mrcp_engine_request", { method: req.method, endpoint: urlPath });

  try {
    if (routeHandlers[urlPath]) {
      return await routeHandlers[urlPath](req, res);
    }

    // Endpoint não encontrado
    return res.status(404).json({
      status: "error",
      error_code: "ENDPOINT_NOT_FOUND",
      message: `Rota '${urlPath}' não encontrada.`
    });
  } catch (error: any) {
    console.error(`Erro na rota ${urlPath}:`, error);
    return res.status(500).json({ status: "error", details: error.message || "Erro interno do servidor." });
  }
}
