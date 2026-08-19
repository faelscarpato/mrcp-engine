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
