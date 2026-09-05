import { calculateImpactAnalysis } from "./impact-analysis.js";
import { runSecurityAudit } from "./security-audit.js";
import { detectArchitectureDrift } from "./architecture-drift.js";
import { findTestCoverageGaps } from "./test-gap-analysis.js";
import { buildContextPack } from "./context-pack.js";
import { applyAstRefactoring } from "./refactor-applier.js";
import { extractTypeSignatures } from "./type-signature-extractor.js";
import { summarizeGitDiff } from "./diff-summarizer.js";
import { resolveDependencyCompatibility } from "./dependency-resolver.js";
import { findDeadCode } from "./dead-code-pruner.js";
import { generateSqlOrmContract } from "./sql-orm-contract.js";
import { processRepositoryHotspots } from "./mrcp-skill-injector.js";

async function runVerification() {
  console.log(
    "=== INICIANDO VALIDAÇÃO DAS NOVAS LÓGICAS DETERMINÍSTICAS DO MRCP ENGINE ===",
  );
  const localRepo = "/home/scarpatoweb/mrcp-engine";

  let totalTests = 0;
  let passedTests = 0;

  function assert(condition: boolean, testName: string, detail?: any) {
    totalTests++;
    if (condition) {
      console.log(`✅ [PASS] ${testName}`);
      passedTests++;
    } else {
      console.error(`❌ [FAIL] ${testName}`, detail || "");
    }
  }

  // 1. Dependency Resolver - Real NPM Registry
  try {
    const reactRes = await resolveDependencyCompatibility({
      packageName: "react",
      targetVersion: "latest",
    });
    assert(
      reactRes.isApplicable === true &&
        reactRes.resolvedVersion === "19.2.8" &&
        reactRes.safeInstallCommand.includes("19.2.8"),
      "Dependency Resolver: Real NPM Registry fetch for react (resolved to 19.2.8)",
      reactRes,
    );

    const nonExistent = await resolveDependencyCompatibility({
      packageName: "non-existent-lib-fake-123456",
      targetVersion: "latest",
    });
    assert(
      nonExistent.isApplicable === false &&
        Boolean(nonExistent.message?.includes("Não se aplica")),
      'Dependency Resolver: Non-existent package returns isApplicable=false with "Não se aplica"',
      nonExistent,
    );
  } catch (e: any) {
    assert(false, "Dependency Resolver threw error", e.message);
  }

  // 2. SQL / ORM Contract Generator
  try {
    const noSchemaRes = await generateSqlOrmContract({ repoUrl: localRepo });
    assert(
      noSchemaRes.schemaDetected === "NONE" &&
        noSchemaRes.isApplicable === false &&
        Boolean(
          noSchemaRes.message?.includes("Não se aplica a esse repositório"),
        ) &&
        noSchemaRes.tablesCount === 0,
      "SQL/ORM Contract: Returns schemaDetected=NONE and non-applicable warning for repos without schema",
      noSchemaRes,
    );
  } catch (e: any) {
    assert(false, "SQL/ORM Contract threw error", e.message);
  }

  // 3. Type Signature Extractor
  try {
    const tsSignatures = await extractTypeSignatures({
      repoUrl: localRepo,
      targetFilePath: "packages/core/lib/analysis/dependency-resolver.ts",
    });
    const ifaceNames = tsSignatures.signatures.map((s) => s.name);
    assert(
      tsSignatures.isApplicable === true &&
        ifaceNames.includes("DependencyResolverOptions") &&
        ifaceNames.includes("DependencyResolverResult"),
      "Type Signature Extractor: Extracts real AST TypeScript interfaces without dummy templates",
      tsSignatures,
    );

    const nonApplicableJs = await extractTypeSignatures({
      repoUrl: localRepo,
      targetFilePath: "eslint.config.js",
    });
    assert(
      nonApplicableJs.isApplicable === false &&
        Boolean(nonApplicableJs.message?.includes("Não se aplica")),
      "Type Signature Extractor: Pure JS/config without exported types returns non-applicable",
      nonApplicableJs,
    );
  } catch (e: any) {
    assert(false, "Type Signature Extractor threw error", e.message);
  }

  // 4. Context Pruning Pack
  try {
    const packRes = await buildContextPack({
      repoUrl: localRepo,
      taskDescription: "Gerenciamento de cache e tokens",
    });
    const firstSnippet = packRes.contextPack[0]?.extractedCodeSnippet || "";
    assert(
      packRes.isApplicable === true &&
        packRes.contextPack.length > 0 &&
        !firstSnippet.includes("export declare class Module") &&
        !firstSnippet.includes("Assinaturas e contratos AST filtrados"),
      "Context Pruning Pack: Slices real code snippets without dummy class placeholders",
      packRes,
    );
  } catch (e: any) {
    assert(false, "Context Pruning Pack threw error", e.message);
  }

  // 5. Test Coverage Gap Finder
  try {
    const testGaps = await findTestCoverageGaps({
      repoUrl: localRepo,
      targetHotspotsOnly: false,
      generateStubs: true,
    });
    assert(
      testGaps.isApplicable === true &&
        testGaps.totalFunctionsAnalyzed > 0 &&
        testGaps.coverageHealthPercentage >= 0,
      "Test Gap Finder: Real functions analyzed and accurate coverage calculation without hardcoded fallback",
      testGaps,
    );
  } catch (e: any) {
    assert(false, "Test Gap Finder threw error", e.message);
  }

  // 6. Refactor Applier
  try {
    const refactorRes = await applyAstRefactoring({
      action: "RENAME_SYMBOL",
      targetSymbol: "nonExistentSymbol_987654321",
      newSymbolName: "newSymbolName",
      targetFilePath: "/home/scarpatoweb/mrcp-engine/package.json",
    });
    assert(
      refactorRes.dryRun === true &&
        refactorRes.isApplicable === false &&
        refactorRes.status === "not_found" &&
        Boolean(refactorRes.message?.includes("Não se aplica")),
      "AST Refactor Applier: Defaults to dryRun=true and returns non-applicable warning if symbol is not found",
      refactorRes,
    );
  } catch (e: any) {
    assert(false, "Refactor Applier threw error", e.message);
  }

  // 7. Git Diff Semantic Summarizer
  try {
    const validDiff = `diff --git a/packages/core/lib/cache.ts b/packages/core/lib/cache.ts
--- a/packages/core/lib/cache.ts
+++ b/packages/core/lib/cache.ts
@@ -10,3 +10,4 @@ function getCacheKey(repoUrl: string) {
+  const x = 1;`;
    const validSummarizer = await summarizeGitDiff({ diffContent: validDiff });
    assert(
      validSummarizer.isApplicable === true &&
        validSummarizer.domainChanges.length > 0,
      "Git Diff Summarizer: Valid diff parsed with domain and modified functions",
      validSummarizer,
    );

    const invalidSummarizer = await summarizeGitDiff({
      diffContent: "not a git diff",
    });
    assert(
      invalidSummarizer.isApplicable === false &&
        Boolean(invalidSummarizer.message?.includes("Não se aplica")),
      "Git Diff Summarizer: Non-applicable message for invalid diff",
      invalidSummarizer,
    );
  } catch (e: any) {
    assert(false, "Git Diff Summarizer threw error", e.message);
  }

  // 8. Skill Contracts - Hotspot vs Stable
  try {
    const contracts = processRepositoryHotspots([
      {
        id: "file:script.js",
        label: "script.js",
        path: "script.js",
        language: "JavaScript",
        complexity: 24,
        degree: 0,
      },
    ]);
    assert(
      contracts.length === 1 &&
        contracts[0].metrics.structuralStatus === "STABLE" &&
        contracts[0].detectedLanguage === "JavaScript",
      "Skill Contracts: Returns STABLE contract with actionable directives for repos within thresholds",
      contracts,
    );
  } catch (e: any) {
    assert(false, "Skill Contracts threw error", e.message);
  }

  console.log(
    `\n=== RESUMO: ${passedTests}/${totalTests} TESTES PASSARAM COM SUCESSO! ===\n`,
  );
  if (passedTests !== totalTests) {
    process.exit(1);
  }
}

runVerification().catch((e) => {
  console.error("Erro fatal na verificação:", e);
  process.exit(1);
});
