<<<<<<< HEAD
import { describe, it, expect } from 'vitest';
import { calculateImpactAnalysis } from '../../../packages/core/lib/analysis/impact-analysis.js';
import { runSecurityAudit } from '../../../packages/core/lib/analysis/security-audit.js';
import { detectArchitectureDrift } from '../../../packages/core/lib/analysis/architecture-drift.js';
import { findTestCoverageGaps } from '../../../packages/core/lib/analysis/test-gap-analysis.js';
import { buildContextPack } from '../../../packages/core/lib/analysis/context-pack.js';
import { applyAstRefactoring } from '../../../packages/core/lib/analysis/refactor-applier.js';
import { extractTypeSignatures } from '../../../packages/core/lib/analysis/type-signature-extractor.js';
import { summarizeGitDiff } from '../../../packages/core/lib/analysis/diff-summarizer.js';
import { resolveDependencyCompatibility } from '../../../packages/core/lib/analysis/dependency-resolver.js';
import { findDeadCode } from '../../../packages/core/lib/analysis/dead-code-pruner.js';
import { generateSqlOrmContract } from '../../../packages/core/lib/analysis/sql-orm-contract.js';

describe('MRCP Engine - Real Intelligence & Non-Applicable Handling', () => {
  const localRepo = '/home/scarpatoweb/mrcp-engine';

  it('1. mrcp_dependency_compatibility_resolver should query real NPM registry and resolve react latest (19.2.8)', async () => {
    const result = await resolveDependencyCompatibility({
      packageName: 'react',
      targetVersion: 'latest'
    });

    expect(result).toBeDefined();
    expect(result.packageName).toBe('react');
    expect(result.isApplicable).toBe(true);
    expect(result.resolvedVersion).toBe('19.2.8');
    expect(result.safeInstallCommand).toBe('npm install react@19.2.8');
  });

  it('1b. mrcp_dependency_compatibility_resolver should return non-applicable for non-existent package', async () => {
    const result = await resolveDependencyCompatibility({
      packageName: 'non-existent-pkg-xyz-987654321',
      targetVersion: 'latest'
    });

    expect(result).toBeDefined();
    expect(result.isApplicable).toBe(false);
    expect(result.message).toContain('Não se aplica');
  });

  it('2. mrcp_sql_schema_orm_contract_generator should return non-applicable when repo has no schema', async () => {
    const result = await generateSqlOrmContract({
      repoUrl: localRepo
    });

    expect(result).toBeDefined();
    expect(result.schemaDetected).toBe('NONE');
    expect(result.isApplicable).toBe(false);
    expect(result.message).toContain('Não se aplica a esse repositório');
    expect(result.tablesCount).toBe(0);
    expect(result.tables).toEqual([]);
  });

  it('3. mrcp_type_signature_extractor should extract real TS signatures from local code', async () => {
    const result = await extractTypeSignatures({
      repoUrl: localRepo,
      targetFilePath: 'packages/core/lib/analysis/dependency-resolver.ts'
    });

    expect(result).toBeDefined();
    expect(result.isApplicable).toBe(true);
    expect(result.totalSignaturesCount).toBeGreaterThan(0);
    const ifaceNames = result.signatures.map((s) => s.name);
    expect(ifaceNames).toContain('DependencyResolverOptions');
    expect(ifaceNames).toContain('DependencyResolverResult');
  });

  it('4. mrcp_context_pruning_pack should slice real code snippets without dummy placeholders', async () => {
    const result = await buildContextPack({
      repoUrl: localRepo,
      taskDescription: 'Gerenciamento de cache e métricas'
    });

    expect(result).toBeDefined();
    expect(result.isApplicable).toBe(true);
    expect(result.contextPack.length).toBeGreaterThan(0);
    const snippet = result.contextPack[0].extractedCodeSnippet;
    expect(snippet).not.toContain('export declare class Module');
    expect(snippet).not.toContain('Assinaturas e contratos AST filtrados');
  });

  it('5. mrcp_auto_test_coverage_gap_finder should calculate real function coverage and stubs', async () => {
    const result = await findTestCoverageGaps({
      repoUrl: localRepo,
      targetHotspotsOnly: false,
      generateStubs: true
    });

    expect(result).toBeDefined();
    expect(result.isApplicable).toBe(true);
    expect(result.totalFunctionsAnalyzed).toBeGreaterThan(0);
    expect(result.coverageHealthPercentage).toBeGreaterThanOrEqual(0);
  });

  it('6. mrcp_ast_refactor_applier should be dryRun by default and warn if symbol not found', async () => {
    const result = await applyAstRefactoring({
      action: 'RENAME_SYMBOL',
      targetSymbol: 'nonExistentFunctionSymbol123',
      newSymbolName: 'newSymbolName',
      targetFilePath: '/home/scarpatoweb/mrcp-engine/package.json'
    });

    expect(result).toBeDefined();
    expect(result.dryRun).toBe(true);
    expect(result.isApplicable).toBe(false);
    expect(result.status).toBe('not_found');
    expect(result.message).toContain('Não se aplica');
  });

  it('7. mrcp_git_diff_semantic_summarizer should detect modified functions and return non-applicable on empty diff', async () => {
    const validDiff = `diff --git a/packages/core/lib/cache.ts b/packages/core/lib/cache.ts
--- a/packages/core/lib/cache.ts
+++ b/packages/core/lib/cache.ts
@@ -10,3 +10,4 @@ function getCacheKey(repoUrl: string) {
+  const x = 1;`;

    const validResult = await summarizeGitDiff({ diffContent: validDiff });
    expect(validResult.isApplicable).toBe(true);
    expect(validResult.domainChanges.length).toBeGreaterThan(0);

    const invalidResult = await summarizeGitDiff({ diffContent: 'invalid content' });
    expect(invalidResult.isApplicable).toBe(false);
    expect(invalidResult.message).toContain('Não se aplica');
  });

  it('8. mrcp_impact_analysis and architecture drift should run accurately', async () => {
    const impact = await calculateImpactAnalysis({
      repoUrl: localRepo,
      modifiedFiles: ['packages/core/lib/analysis/pipeline.ts']
    });
    expect(impact).toBeDefined();
    expect(impact.blastRadiusScore).toBeGreaterThanOrEqual(0);

    const drift = await detectArchitectureDrift({
      repoUrl: localRepo,
      architectureType: 'CLEAN_ARCHITECTURE'
    });
    expect(drift).toBeDefined();
    expect(drift.complianceScore).toBeGreaterThanOrEqual(0);
  });
});
=======
import { describe, it, expect } from 'vitest';
import { calculateImpactAnalysis } from '../../../packages/core/lib/analysis/impact-analysis.js';
import { runSecurityAudit } from '../../../packages/core/lib/analysis/security-audit.js';
import { detectArchitectureDrift } from '../../../packages/core/lib/analysis/architecture-drift.js';
import { findTestCoverageGaps } from '../../../packages/core/lib/analysis/test-gap-analysis.js';
import { buildContextPack } from '../../../packages/core/lib/analysis/context-pack.js';
import { applyAstRefactoring } from '../../../packages/core/lib/analysis/refactor-applier.js';
import { extractTypeSignatures } from '../../../packages/core/lib/analysis/type-signature-extractor.js';
import { summarizeGitDiff } from '../../../packages/core/lib/analysis/diff-summarizer.js';
import { resolveDependencyCompatibility } from '../../../packages/core/lib/analysis/dependency-resolver.js';
import { findDeadCode } from '../../../packages/core/lib/analysis/dead-code-pruner.js';
import { generateSqlOrmContract } from '../../../packages/core/lib/analysis/sql-orm-contract.js';

<<<<<<< HEAD
describe('MRCP Engine - Real Intelligence & Non-Applicable Handling', () => {
  const localRepo = '/home/scarpatoweb/mrcp-engine';

  it('1. mrcp_dependency_compatibility_resolver should query real NPM registry and resolve react latest (19.2.8)', async () => {
    const result = await resolveDependencyCompatibility({
      packageName: 'react',
      targetVersion: 'latest'
    });

    expect(result).toBeDefined();
    expect(result.packageName).toBe('react');
    expect(result.isApplicable).toBe(true);
    expect(result.resolvedVersion).toBe('19.2.8');
    expect(result.safeInstallCommand).toBe('npm install react@19.2.8');
  });

  it('1b. mrcp_dependency_compatibility_resolver should return non-applicable for non-existent package', async () => {
    const result = await resolveDependencyCompatibility({
      packageName: 'non-existent-pkg-xyz-987654321',
      targetVersion: 'latest'
    });

    expect(result).toBeDefined();
    expect(result.isApplicable).toBe(false);
    expect(result.message).toContain('Não se aplica');
  });

  it('2. mrcp_sql_schema_orm_contract_generator should return non-applicable when repo has no schema', async () => {
    const result = await generateSqlOrmContract({
      repoUrl: localRepo
    });

    expect(result).toBeDefined();
    expect(result.schemaDetected).toBe('NONE');
    expect(result.isApplicable).toBe(false);
    expect(result.message).toContain('Não se aplica a esse repositório');
    expect(result.tablesCount).toBe(0);
    expect(result.tables).toEqual([]);
  });

  it('3. mrcp_type_signature_extractor should extract real TS signatures from local code', async () => {
    const result = await extractTypeSignatures({
      repoUrl: localRepo,
      targetFilePath: 'packages/core/lib/analysis/dependency-resolver.ts'
    });

    expect(result).toBeDefined();
    expect(result.isApplicable).toBe(true);
    expect(result.totalSignaturesCount).toBeGreaterThan(0);
    const ifaceNames = result.signatures.map((s) => s.name);
    expect(ifaceNames).toContain('DependencyResolverOptions');
    expect(ifaceNames).toContain('DependencyResolverResult');
  });

  it('4. mrcp_context_pruning_pack should slice real code snippets without dummy placeholders', async () => {
    const result = await buildContextPack({
      repoUrl: localRepo,
      taskDescription: 'Gerenciamento de cache e métricas'
    });

    expect(result).toBeDefined();
    expect(result.isApplicable).toBe(true);
    expect(result.contextPack.length).toBeGreaterThan(0);
    const snippet = result.contextPack[0].extractedCodeSnippet;
    expect(snippet).not.toContain('export declare class Module');
    expect(snippet).not.toContain('Assinaturas e contratos AST filtrados');
  });

  it('5. mrcp_auto_test_coverage_gap_finder should calculate real function coverage and stubs', async () => {
    const result = await findTestCoverageGaps({
      repoUrl: localRepo,
=======
describe('MRCP Engine - 11 New Predictive, Security & Offloading Endpoints', () => {
  const dummyRepo = 'https://github.com/faelscarpato/mrcp-engine.git';

  it('1. mrcp_impact_analysis should calculate blast radius', async () => {
    const result = await calculateImpactAnalysis({
      repoUrl: dummyRepo,
      modifiedFiles: ['src/lib/analysis/graph-builder.ts']
    });

    expect(result).toBeDefined();
    expect(result.repoUrl).toBe(dummyRepo);
    expect(result.blastRadiusScore).toBeGreaterThanOrEqual(0);
    expect(result.impactedNodes).toBeInstanceOf(Array);
  });

  it('2. mrcp_security_compliance_audit should audit repository AST', async () => {
    const result = await runSecurityAudit({
      repoUrl: dummyRepo,
      severityThreshold: 'LOW'
    });

    expect(result).toBeDefined();
    expect(result.auditPassed).toBeDefined();
    expect(result.summary).toBeDefined();
  });

  it('3. mrcp_architectural_drift_detector should check architectural compliance', async () => {
    const result = await detectArchitectureDrift({
      repoUrl: dummyRepo,
      architectureType: 'CLEAN_ARCHITECTURE'
    });

    expect(result).toBeDefined();
    expect(result.complianceScore).toBeGreaterThanOrEqual(0);
    expect(result.violations).toBeInstanceOf(Array);
  });

  it('4. mrcp_auto_test_coverage_gap_finder should identify coverage gaps and stubs', async () => {
    const result = await findTestCoverageGaps({
      repoUrl: dummyRepo,
>>>>>>> bf27a4ca35ecf7a0a9b0f4e1680cca22cc24f407
      targetHotspotsOnly: false,
      generateStubs: true
    });

    expect(result).toBeDefined();
<<<<<<< HEAD
    expect(result.isApplicable).toBe(true);
    expect(result.totalFunctionsAnalyzed).toBeGreaterThan(0);
    expect(result.coverageHealthPercentage).toBeGreaterThanOrEqual(0);
  });

  it('6. mrcp_ast_refactor_applier should be dryRun by default and warn if symbol not found', async () => {
    const result = await applyAstRefactoring({
      action: 'RENAME_SYMBOL',
      targetSymbol: 'nonExistentFunctionSymbol123',
      newSymbolName: 'newSymbolName',
      targetFilePath: '/home/scarpatoweb/mrcp-engine/package.json'
    });

    expect(result).toBeDefined();
    expect(result.dryRun).toBe(true);
    expect(result.isApplicable).toBe(false);
    expect(result.status).toBe('not_found');
    expect(result.message).toContain('Não se aplica');
  });

  it('7. mrcp_git_diff_semantic_summarizer should detect modified functions and return non-applicable on empty diff', async () => {
    const validDiff = `diff --git a/packages/core/lib/cache.ts b/packages/core/lib/cache.ts
--- a/packages/core/lib/cache.ts
+++ b/packages/core/lib/cache.ts
@@ -10,3 +10,4 @@ function getCacheKey(repoUrl: string) {
+  const x = 1;`;

    const validResult = await summarizeGitDiff({ diffContent: validDiff });
    expect(validResult.isApplicable).toBe(true);
    expect(validResult.domainChanges.length).toBeGreaterThan(0);

    const invalidResult = await summarizeGitDiff({ diffContent: 'invalid content' });
    expect(invalidResult.isApplicable).toBe(false);
    expect(invalidResult.message).toContain('Não se aplica');
  });

  it('8. mrcp_impact_analysis and architecture drift should run accurately', async () => {
    const impact = await calculateImpactAnalysis({
      repoUrl: localRepo,
      modifiedFiles: ['packages/core/lib/analysis/pipeline.ts']
    });
    expect(impact).toBeDefined();
    expect(impact.blastRadiusScore).toBeGreaterThanOrEqual(0);

    const drift = await detectArchitectureDrift({
      repoUrl: localRepo,
      architectureType: 'CLEAN_ARCHITECTURE'
    });
    expect(drift).toBeDefined();
    expect(drift.complianceScore).toBeGreaterThanOrEqual(0);
=======
    expect(result.gaps).toBeInstanceOf(Array);
  });

  it('5. mrcp_context_pruning_pack should generate compact AST context payload', async () => {
    const result = await buildContextPack({
      repoUrl: dummyRepo,
      taskDescription: 'Refatorar autenticação JWT'
    });

    expect(result).toBeDefined();
    expect(result.compactPromptPayload).toContain('MRCP AST CONTEXT PACK');
    expect(result.contextPack).toBeInstanceOf(Array);
  });

  it('6. mrcp_ast_refactor_applier should process AST refactor action', async () => {
    const result = await applyAstRefactoring({
      action: 'RENAME_SYMBOL',
      targetSymbol: 'getUser',
      newSymbolName: 'fetchUser',
      dryRun: true
    });

    expect(result).toBeDefined();
    expect(result.status).toBe('success');
    expect(result.actionApplied).toBe('RENAME_SYMBOL');
  });

  it('7. mrcp_type_signature_extractor should extract declaration signatures', async () => {
    const result = await extractTypeSignatures({
      repoUrl: dummyRepo
    });

    expect(result).toBeDefined();
    expect(result.signatures).toBeInstanceOf(Array);
    expect(result.tokensSavedEstimate).toBeGreaterThan(0);
  });

  it('8. mrcp_git_diff_semantic_summarizer should summarize git diff by domain', async () => {
    const result = await summarizeGitDiff({
      diffContent: 'diff --git a/src/index.ts b/src/index.ts\n--- a/src/index.ts\n+++ b/src/index.ts\n@@ -1,3 +1,3 @@\n+const x = 1;'
    });

    expect(result).toBeDefined();
    expect(result.domainChanges).toBeInstanceOf(Array);
    expect(result.compactAstSummary).toContain('SEMANTIC AST DIFF SUMMARY');
  });

  it('9. mrcp_dependency_compatibility_resolver should resolve dependency compatibility', async () => {
    const result = await resolveDependencyCompatibility({
      packageName: 'typescript',
      targetVersion: 'latest'
    });

    expect(result).toBeDefined();
    expect(result.packageName).toBe('typescript');
    expect(result.safeInstallCommand).toContain('npm install');
  });

  it('10. mrcp_dead_code_pruner should perform tree-shaking analysis', async () => {
    const result = await findDeadCode({
      repoUrl: dummyRepo
    });

    expect(result).toBeDefined();
    expect(result.deadSymbols).toBeInstanceOf(Array);
  });

  it('11. mrcp_sql_schema_orm_contract_generator should generate ORM contracts', async () => {
    const result = await generateSqlOrmContract({
      repoUrl: dummyRepo,
      schemaFilePath: 'schema.prisma'
    });

    expect(result).toBeDefined();
    expect(result.schemaDetected).toBe('PRISMA');
    expect(result.generatedTypescriptInterface).toContain('interface');
>>>>>>> bf27a4ca35ecf7a0a9b0f4e1680cca22cc24f407
  });
});
>>>>>>> d6b6b143eac7885322e1cb04fd8155dc5ebb9b9e
