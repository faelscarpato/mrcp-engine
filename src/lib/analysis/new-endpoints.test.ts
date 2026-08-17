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
      targetHotspotsOnly: false,
      generateStubs: true
    });

    expect(result).toBeDefined();
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
  });
});
