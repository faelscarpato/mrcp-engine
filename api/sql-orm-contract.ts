import { generateSqlOrmContract } from "../packages/core/lib/analysis/sql-orm-contract.js";
import { saveEndpointOutput } from "../packages/core/lib/cache.js";
import { trackEngineUsage } from "../src/services/analytics.js";

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

  trackEngineUsage(null, "mrcp_engine_request", { method: req.method, endpoint: "/api/sql-orm-contract" });

  try {
    const repoUrl = req.query.repo || req.body?.repoUrl || req.body?.repo;
    const schemaFilePath = req.query.schema || req.body?.schemaFilePath;

    const result = await generateSqlOrmContract({
      repoUrl,
      schemaFilePath
    });

    saveEndpointOutput("sql_schema_orm_contract_generator", repoUrl || "schema-session", result);

    return res.status(200).json({
      status: "success",
      sql_orm_contract: result
    });
  } catch (error: any) {
    console.error("Erro em /api/sql-orm-contract:", error);
    return res.status(500).json({
      status: "error",
      details: error.message || "Erro ao gerar contrato SQL/ORM."
    });
  }
}
