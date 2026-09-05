import { generateApiContract } from "./api-contract-generator.js";
import { calculateCodeHealth } from "./code-health.js";
import { validateEnvironmentContract } from "./env-validator.js";
import { analyzeMonorepoGraph } from "./monorepo-graph.js";
import { generateDocumentation } from "./doc-generator.js";

async function testAllNewEndpoints() {
  console.log(
    "==================================================================",
  );
  console.log(
    "🧪 INICIANDO TESTES DOS 5 NOVOS ENDPOINTS DO MRCP ENGINE (v2.3.0)",
  );
  console.log(
    "==================================================================",
  );

  const localRepo = "/home/scarpatoweb/mrcp-engine";
  let passCount = 0;
  let failCount = 0;

  function test(name: string, condition: boolean, details?: any) {
    if (condition) {
      console.log(`✅ [PASS] ${name}`);
      passCount++;
    } else {
      console.error(`❌ [FAIL] ${name}`, details || "");
      failCount++;
    }
  }

  // 1. API Contract Generator
  try {
    const apiRes = await generateApiContract({ repoUrl: localRepo });
    test(
      "1. API Contract Generator: detecta rotas e gera OpenAPI 3.0",
      apiRes.isApplicable &&
        apiRes.totalRoutes > 0 &&
        apiRes.openapiSpec.openapi === "3.0.3",
      {
        totalRoutes: apiRes.totalRoutes,
        frameworks: apiRes.frameworksDetected,
        routesSample: apiRes.routes.slice(0, 3),
      },
    );
    test(
      "1. API Contract Generator: gera SDK TypeScript tipado",
      Boolean(apiRes.typescriptSdkSnippet.includes("class ApiClient")),
      {
        sdkLength: apiRes.typescriptSdkSnippet.length,
      },
    );
  } catch (e: any) {
    test("1. API Contract Generator", false, e.message);
  }

  // 2. Code Health Scorer
  try {
    const healthRes = await calculateCodeHealth({ repoUrl: localRepo });
    test(
      "2. Code Health Scorer: calcula Maintainability Index e Nota",
      healthRes.isApplicable &&
        healthRes.maintainabilityIndex > 0 &&
        ["A", "B", "C", "D", "F"].includes(healthRes.letterGrade),
      {
        maintainabilityIndex: healthRes.maintainabilityIndex,
        letterGrade: healthRes.letterGrade,
        rating: healthRes.maintainabilityRating,
        techDebt: healthRes.technicalDebtScore,
        summary: healthRes.summary,
      },
    );
    test(
      "2. Code Health Scorer: identifica prioridades de refatoração",
      Array.isArray(healthRes.topRefactoringPriorities),
      {
        hotspotsCount: healthRes.topRefactoringPriorities.length,
      },
    );
  } catch (e: any) {
    test("2. Code Health Scorer", false, e.message);
  }

  // 3. Environment Secret Contract Validator
  try {
    const envRes = await validateEnvironmentContract({ repoUrl: localRepo });
    test(
      "3. Env Validator: mapeia variáveis de ambiente e gera Zod schema",
      envRes.isApplicable &&
        envRes.totalVariablesDetected > 0 &&
        envRes.zodSchemaSnippet.includes("z.object"),
      {
        totalVars: envRes.totalVariablesDetected,
        varsSample: envRes.variables.map((v) => v.name).slice(0, 5),
        hasZod: envRes.zodSchemaSnippet.length > 0,
      },
    );
  } catch (e: any) {
    test("3. Env Validator", false, e.message);
  }

  // 4. Monorepo Package Graph Analyzer
  try {
    const monoRes = await analyzeMonorepoGraph({
      repoUrl: localRepo,
      changedFiles: ["packages/core/lib/cache.ts"],
    });
    test(
      "4. Monorepo Graph: mapeia workspaces, dependências e ordem de build",
      monoRes.isMonorepo &&
        monoRes.packagesCount > 0 &&
        monoRes.topologicalBuildOrder.length > 0,
      {
        tool: monoRes.monorepoTool,
        packagesCount: monoRes.packagesCount,
        packages: monoRes.packages.map((p) => p.name),
        buildOrder: monoRes.topologicalBuildOrder,
        affected: monoRes.affectedPackages,
      },
    );
  } catch (e: any) {
    test("4. Monorepo Graph", false, e.message);
  }

  // 5. Docstring / API Doc Generator
  try {
    const docRes = await generateDocumentation({
      repoUrl: localRepo,
      targetFilePath: "packages/core/lib/analysis/code-health.ts",
    });
    test(
      "5. Doc Generator: extrai símbolos sem doc e gera TSDoc",
      docRes.isApplicable &&
        docRes.totalUndocumentedSymbols > 0 &&
        docRes.markdownApiReference.includes("API Reference"),
      {
        totalUndocumented: docRes.totalUndocumentedSymbols,
        symbolsSample: docRes.symbols.slice(0, 3).map((s) => s.name),
      },
    );
  } catch (e: any) {
    test("5. Doc Generator", false, e.message);
  }

  console.log(
    "==================================================================",
  );
  console.log(
    `📊 RESULTADO FINAL: ${passCount} PASSOU / ${failCount} FALHOU (Total: ${passCount + failCount})`,
  );
  console.log(
    "==================================================================",
  );

  if (failCount > 0) {
    process.exit(1);
  }
}

testAllNewEndpoints().catch((err) => {
  console.error("Erro fatal na execução dos testes:", err);
  process.exit(1);
});
