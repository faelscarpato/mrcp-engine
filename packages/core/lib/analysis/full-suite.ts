import { runAnalysis } from "./pipeline.js";
import { getEngineVersion } from "./engine-version.js";
import { processRepositoryHotspots } from "./mrcp-skill-injector.js";
import { calculateCodeHealth, CodeHealthResult } from "./code-health.js";
import { runSecurityAudit, SecurityAuditResult } from "./security-audit.js";
import {
  detectArchitectureDrift,
  ArchitectureDriftResult,
} from "./architecture-drift.js";
import {
  findTestCoverageGaps,
  TestGapAnalysisResult,
} from "./test-gap-analysis.js";
import { findDeadCode, DeadCodePrunerResult } from "./dead-code-pruner.js";
import {
  validateEnvironmentContract,
  EnvValidatorResult,
} from "./env-validator.js";
import {
  generateApiContract,
  ApiContractResult,
} from "./api-contract-generator.js";
import { analyzeMonorepoGraph, MonorepoGraphResult } from "./monorepo-graph.js";
import { generateDocumentation, DocGeneratorResult } from "./doc-generator.js";
import {
  generateSqlOrmContract,
  SqlOrmContractResult,
} from "./sql-orm-contract.js";
import {
  analyzeDocumentRepository,
  DocumentRepositoryAnalysis,
} from "./document-analyzer.js";
import { saveEndpointOutput, setCachedAnalysis } from "../cache.js";

export interface FullSuiteOptions {
  repoUrl: string;
  githubToken?: string;
  taskContext?: string;
  generateStubs?: boolean;
}

export interface PipelineStepStatus {
  step: string;
  status: "SUCCESS" | "SKIPPED" | "ERROR";
  durationMs: number;
  message?: string;
}

export const SUITE_STEPS = {
  astGraph: "AST Graph Analysis",
  skillContracts: "Skill Contracts Generation",
  codeHealth: "Code Health & Maintainability Scoring",
  securityAudit: "Security & Compliance Audit",
  architectureDrift: "Architecture Drift & Dependency Cycle Detection",
  testGaps: "Test Coverage Gap Analysis",
  deadCode: "Dead Code & Unused Exports Detection",
  envValidator: "Environment Variables & Secrets Contract",
  apiContract: "API Contract & OpenAPI 3.0 Extraction",
  monorepoGraph: "Monorepo Topology & Build Pipeline Analysis",
  documentation: "Docstring & API Reference Generation",
  sqlOrm: "SQL / ORM Schema Contract Analysis",
  documentIntel: "Document Intelligence & Knowledge Graph",
} as const;

export interface FullSuiteResult {
  repoUrl: string;
  timestamp: string;
  totalDurationMs: number;
  pipelineStatus: PipelineStepStatus[];
  executiveSummary: {
    // Todo campo derivado de uma etapa é `null` quando a etapa falhou, expirou
    // ou não produziu dado. Não existe valor substituto otimista: 85/100 de
    // MI, "A", 15% de dívida ou "auditoria aprovada" sem medição alguma são
    // afirmações falsas sobre o repositório do usuário.
    maintainabilityIndex: number | null;
    letterGrade: "A" | "B" | "C" | "D" | "F" | null;
    maintainabilityRating: string | null;
    technicalDebtScore: number | null;
    securityAuditPassed: boolean | null;
    totalVulnerabilities: number | null;
    godModulesCount: number | null;
    hotspotFilesCount: number | null;
    deadSymbolsCount: number | null;
    totalApiRoutes: number | null;
    envVariablesCount: number | null;
    monorepoTool: string | null;
    totalFilesAnalyzed: number | null;
    totalLinesOfCode: number | null;
    totalDocumentsAnalyzed: number | null;
    documentQualityScore: number | null;
    /** Etapas que não produziram os dados que estes campos resumem. */
    unavailableSteps: string[];
  };
  executiveDashboardMarkdown: string;
  reports: {
    astGraph?: any;
    skillContracts?: any[];
    codeHealth?: CodeHealthResult;
    securityAudit?: SecurityAuditResult;
    architectureDrift?: ArchitectureDriftResult;
    testGaps?: TestGapAnalysisResult;
    deadCode?: DeadCodePrunerResult;
    envValidator?: EnvValidatorResult;
    apiContract?: ApiContractResult;
    monorepoGraph?: MonorepoGraphResult;
    documentation?: DocGeneratorResult;
    sqlOrmContract?: SqlOrmContractResult;
    documentIntelligence?: DocumentRepositoryAnalysis;
  };
}

export async function runFullRepositoryDiagnostic(
  options: FullSuiteOptions,
): Promise<FullSuiteResult> {
  const {
    repoUrl,
    githubToken = process.env.GITHUB_TOKEN,
    generateStubs = true,
  } = options;
  const startTime = Date.now();
  const pipelineStatus: PipelineStepStatus[] = [];
  const reports: FullSuiteResult["reports"] = {};

  console.error(
    `[MRCP Suite] 🚀 Iniciando Diagnóstico Completo Otimizado para: ${repoUrl}`,
  );

  // Helper para executar etapa com medição de tempo, timeout e persistência progressiva
  const STEP_TIMEOUT_MS = 45_000;
  async function runStep<T>(
    stepName: string,
    endpointKey: string,
    fn: () => Promise<T>,
  ): Promise<T | null> {
    const stepStart = Date.now();
    try {
      const timeoutPromise = new Promise<never>((_, reject) =>
        setTimeout(
          () =>
            reject(
              new Error(
                `Step "${stepName}" timed out after ${STEP_TIMEOUT_MS / 1000}s`,
              ),
            ),
          STEP_TIMEOUT_MS,
        ),
      );
      const res = await Promise.race([fn(), timeoutPromise]);
      const duration = Date.now() - stepStart;
      saveEndpointOutput(endpointKey, repoUrl, res);
      pipelineStatus.push({
        step: stepName,
        status: "SUCCESS",
        durationMs: duration,
      });
      return res;
    } catch (err: any) {
      const duration = Date.now() - stepStart;
      console.warn(`[MRCP Suite] ⚠️ Aviso na etapa ${stepName}:`, err.message);
      pipelineStatus.push({
        step: stepName,
        status: "ERROR",
        durationMs: duration,
        message: err.message,
      });
      return null;
    }
  }

  // 1. AST Graph Pipeline (Base fundamental para todas as análises)
  const astResult = await runStep(
    SUITE_STEPS.astGraph,
    "analyze_repository",
    async () => {
      const res = await runAnalysis({ repoUrl, githubToken, maxFiles: 2000 });
      await setCachedAnalysis(repoUrl, res);
      return res;
    },
  );
  reports.astGraph = astResult;
  const nodes = astResult?.analysis?.nodes ?? [];

  // 2-13. Execução Paralela Concorrente Ultra-Rápida de todas as ferramentas de diagnóstico
  const [
    skillRes,
    healthRes,
    secRes,
    driftRes,
    testRes,
    deadRes,
    envRes,
    apiRes,
    monoRes,
    docRes,
    sqlRes,
    docIntelRes,
  ] = await Promise.all([
    runStep(SUITE_STEPS.skillContracts, "skills_contract", async () =>
      nodes.length > 0 ? processRepositoryHotspots(nodes) : [],
    ),
    runStep(SUITE_STEPS.codeHealth, "code_metrics_health_scorer", async () =>
      calculateCodeHealth({ repoUrl }),
    ),
    runStep(SUITE_STEPS.securityAudit, "security_compliance_audit", async () =>
      runSecurityAudit({ repoUrl }),
    ),
    runStep(
      SUITE_STEPS.architectureDrift,
      "architectural_drift_detector",
      async () => detectArchitectureDrift({ repoUrl }),
    ),
    runStep(SUITE_STEPS.testGaps, "auto_test_coverage_gap_finder", async () =>
      findTestCoverageGaps({ repoUrl, generateStubs }),
    ),
    runStep(SUITE_STEPS.deadCode, "dead_code_pruner", async () =>
      findDeadCode({ repoUrl }),
    ),
    runStep(
      SUITE_STEPS.envValidator,
      "env_secret_contract_validator",
      async () => validateEnvironmentContract({ repoUrl }),
    ),
    runStep(SUITE_STEPS.apiContract, "api_contract_generator", async () =>
      generateApiContract({ repoUrl }),
    ),
    runStep(
      SUITE_STEPS.monorepoGraph,
      "monorepo_package_graph_analyzer",
      async () => analyzeMonorepoGraph({ repoUrl }),
    ),
    runStep(
      SUITE_STEPS.documentation,
      "docstring_api_doc_generator",
      async () => generateDocumentation({ repoUrl }),
    ),
    runStep(SUITE_STEPS.sqlOrm, "sql_schema_orm_contract_generator", async () =>
      generateSqlOrmContract({ repoUrl }),
    ),
    runStep(SUITE_STEPS.documentIntel, "document_analyzer", async () =>
      analyzeDocumentRepository({ repoUrl, githubToken, maxFiles: 30 }),
    ),
  ]);

  if (skillRes) reports.skillContracts = skillRes;
  if (healthRes) reports.codeHealth = healthRes;
  if (secRes) reports.securityAudit = secRes;
  if (driftRes) reports.architectureDrift = driftRes;
  if (testRes) reports.testGaps = testRes;
  if (deadRes) reports.deadCode = deadRes;
  if (envRes) reports.envValidator = envRes;
  if (apiRes) reports.apiContract = apiRes;
  if (monoRes) reports.monorepoGraph = monoRes;
  if (docRes) reports.documentation = docRes;
  if (sqlRes) reports.sqlOrmContract = sqlRes;
  if (docIntelRes) reports.documentIntelligence = docIntelRes;

  const totalDuration = Date.now() - startTime;

  // Montar Resumo Executivo Consolidado
  //
  // Regra: cada campo reflete exatamente o que a etapa mediu. Etapa ausente,
  // com timeout ou sem dados produz `null` — nunca um número plausível.
  const unavailableSteps: string[] = [];
  const markUnavailable = (step: string) => {
    if (!unavailableSteps.includes(step)) unavailableSteps.push(step);
  };
  // Só declara a etapa indisponível quando ela realmente não entregou o dado.
  const resolve = <T>(value: T | null | undefined, step: string): T | null => {
    if (value !== null && value !== undefined) return value;
    markUnavailable(step);
    return null;
  };

  const mi = resolve(
    reports.codeHealth?.maintainabilityIndex,
    SUITE_STEPS.codeHealth,
  );
  const grade = resolve(
    reports.codeHealth?.letterGrade,
    SUITE_STEPS.codeHealth,
  );
  const rating = resolve(
    reports.codeHealth?.maintainabilityRating,
    SUITE_STEPS.codeHealth,
  );
  const techDebt = resolve(
    reports.codeHealth?.technicalDebtScore,
    SUITE_STEPS.codeHealth,
  );
  // `false` (reprovada) é um dado válido; só a ausência vira null.
  const secPassed = resolve(
    reports.securityAudit?.auditPassed,
    SUITE_STEPS.securityAudit,
  );
  const totalVulns = resolve(
    reports.securityAudit?.totalVulnerabilities,
    SUITE_STEPS.securityAudit,
  );
  const godModules = resolve(
    reports.codeHealth?.summary?.godModulesCount,
    SUITE_STEPS.codeHealth,
  );
  const hotspotCount = resolve(
    reports.skillContracts?.length,
    SUITE_STEPS.skillContracts,
  );
  const deadCount = resolve(
    reports.deadCode?.totalDeadSymbolsFound,
    SUITE_STEPS.deadCode,
  );
  const apiRoutesCount = resolve(
    reports.apiContract?.totalRoutes,
    SUITE_STEPS.apiContract,
  );
  const envCount = resolve(
    reports.envValidator?.totalVariablesDetected,
    SUITE_STEPS.envValidator,
  );
  // "NONE" só é válido quando a etapa rodou e confirmou que não é monorepo.
  const monorepoTool = resolve(
    reports.monorepoGraph?.monorepoTool,
    SUITE_STEPS.monorepoGraph,
  );
  // Contagem de arquivos: usa o code health quando disponível, senão o grafo.
  // Se o grafo nem existe, "0 arquivos" seria mentira — a etapa que descobre os
  // arquivos é justamente a que falhou.
  const astSucceeded = !!astResult;
  const totalFiles = astSucceeded
    ? (reports.codeHealth?.summary?.totalFiles ??
      nodes.filter((n: any) => n.kind === "file").length)
    : resolve(null, SUITE_STEPS.astGraph);
  const totalLoc = resolve(
    reports.codeHealth?.summary?.totalLinesOfCode,
    SUITE_STEPS.codeHealth,
  );
  const totalDocs = reports.documentIntelligence
    ? reports.documentIntelligence.totalDocumentsAnalyzed
    : resolve(null, SUITE_STEPS.documentIntel);
  const docScore = reports.documentIntelligence
    ? reports.documentIntelligence.documentQualityIndex.overallScore
    : resolve(null, SUITE_STEPS.documentIntel);
  if (docScore === null && reports.documentIntelligence) {
    markUnavailable(SUITE_STEPS.documentIntel);
  }

  const executiveSummary = {
    maintainabilityIndex: mi,
    letterGrade: grade,
    maintainabilityRating: rating,
    technicalDebtScore: techDebt,
    securityAuditPassed: secPassed,
    totalVulnerabilities: totalVulns,
    godModulesCount: godModules,
    hotspotFilesCount: hotspotCount,
    deadSymbolsCount: deadCount,
    totalApiRoutes: apiRoutesCount,
    envVariablesCount: envCount,
    monorepoTool,
    totalFilesAnalyzed: totalFiles,
    totalLinesOfCode: totalLoc,
    totalDocumentsAnalyzed: totalDocs,
    documentQualityScore: docScore,
    unavailableSteps,
  };

  // Gerar Dashboard Executivo em Markdown
  const dashboardMarkdown = generateExecutiveDashboardMarkdown(
    repoUrl,
    executiveSummary,
    pipelineStatus,
    reports,
  );

  const fullResult: FullSuiteResult = {
    repoUrl,
    timestamp: new Date().toISOString(),
    totalDurationMs: totalDuration,
    pipelineStatus,
    executiveSummary,
    executiveDashboardMarkdown: dashboardMarkdown,
    reports,
  };

  // Salva resultado consolidado final
  saveEndpointOutput("full_repository_diagnostic_suite", repoUrl, fullResult);
  console.error(
    `[MRCP Suite] ✅ Diagnóstico Completo Finalizado em ${totalDuration}ms. Gravado em mrcp-analysis.json!`,
  );

  return fullResult;
}

// Rótulos para quando a etapa não entregou o dado. Um campo ausente nunca é
// renderizado como 0, "A" ou "APROVADA" — o texto diz exatamente o que houve.
const MARKER_NOT_RUN = "indisponível (etapa não executada)";
const MARKER_FAILED = "indisponível (etapa falhou)";
const MARKER_SKIPPED = "indisponível (etapa ignorada)";
const MARKER_NO_DATA = "indisponível (etapa sem dados)";

function unavailableReason(
  pipeline: PipelineStepStatus[],
  step: string,
): string {
  const status = pipeline.find((p) => p.step === step)?.status;
  if (status === "ERROR") return MARKER_FAILED;
  if (status === "SKIPPED") return MARKER_SKIPPED;
  if (status === undefined) return MARKER_NOT_RUN;
  return MARKER_NO_DATA;
}

/** Formata um número ou, quando ausente, o motivo pelo qual não existe. */
function metric(value: number | null | undefined, unavailable: string): string {
  if (value === null || value === undefined) return unavailable;
  return value.toLocaleString();
}

function generateExecutiveDashboardMarkdown(
  repoUrl: string,
  summary: FullSuiteResult["executiveSummary"],
  pipeline: PipelineStepStatus[],
  reports: FullSuiteResult["reports"],
): string {
  const noCodeHealth = unavailableReason(pipeline, SUITE_STEPS.codeHealth);
  const noSecurity = unavailableReason(pipeline, SUITE_STEPS.securityAudit);
  const noDeadCode = unavailableReason(pipeline, SUITE_STEPS.deadCode);
  const noApi = unavailableReason(pipeline, SUITE_STEPS.apiContract);
  const noEnv = unavailableReason(pipeline, SUITE_STEPS.envValidator);
  const noMonorepo = unavailableReason(pipeline, SUITE_STEPS.monorepoGraph);
  const noDocIntel = unavailableReason(pipeline, SUITE_STEPS.documentIntel);
  const noAst = unavailableReason(pipeline, SUITE_STEPS.astGraph);
  const noSkills = unavailableReason(pipeline, SUITE_STEPS.skillContracts);

  const debt = summary.technicalDebtScore;
  const debtLabel =
    debt === null
      ? `⚪ ${noCodeHealth}`
      : debt < 30
        ? "🟢 Baixo Débito"
        : debt < 60
          ? "🟡 Moderado"
          : "🔴 Crítico";

  const securityLabel =
    summary.securityAuditPassed === null
      ? `⚪ INCONCLUSIVA (${noSecurity})`
      : summary.securityAuditPassed
        ? "🟢 APROVADA"
        : "🔴 VULNERABILIDADES";

  const monorepoPackages = reports.monorepoGraph?.packagesCount;

  const lines: string[] = [
    `# 🧠 MRCP Engine - Relatório de Diagnóstico Estrutural Completo`,
    ``,
    `**Repositório:** \`${repoUrl}\`  `,
    `**Data do Diagnóstico:** ${new Date().toLocaleString()}  `,
    `**Pipeline de Execução:** ${pipeline.filter((p) => p.status === "SUCCESS").length}/${pipeline.length} etapas concluídas com sucesso  `,
    ``,
    `> Campos marcados como \`indisponível\` não foram medidos: a etapa responsável falhou, expirou ou não encontrou dados. Ausência de dado nunca é substituída por 0, nota máxima ou aprovação.`,
    ``,
    `---`,
    ``,
    `## 📊 Resumo Executivo & Saúde do Código`,
    ``,
    `| Métrica | Valor | Avaliação |`,
    `| :--- | :--- | :--- |`,
    `| **Maintainability Index (MI)** | **${summary.maintainabilityIndex === null ? noCodeHealth : `${summary.maintainabilityIndex}/100`}** | ${summary.letterGrade === null ? `Nota indisponível (${noCodeHealth})` : `Nota **${summary.letterGrade}** (${summary.maintainabilityRating ?? MARKER_NO_DATA})`} |`,
    `| **Débito Técnico Estimado** | **${debt === null ? noCodeHealth : `${debt}%`}** | ${debtLabel} |`,
    `| **Auditoria de Segurança** | **${securityLabel}** | ${summary.totalVulnerabilities === null ? noSecurity : `${summary.totalVulnerabilities} alertas detectados`} |`,
    `| **Total de Arquivos / LOC** | **${summary.totalFilesAnalyzed === null ? noAst : `${metric(summary.totalFilesAnalyzed, noAst)} arquivos`}** | ${summary.totalLinesOfCode === null ? noCodeHealth : `~${summary.totalLinesOfCode.toLocaleString()} linhas de código`} |`,
    `| **God Modules / Hotspots** | **${summary.godModulesCount === null ? noCodeHealth : `${summary.godModulesCount} God Modules`}** | ${summary.hotspotFilesCount === null ? noSkills : `${summary.hotspotFilesCount} contratos de refatoração`} |`,
    `| **Código Morto Identificado** | **${summary.deadSymbolsCount === null ? noDeadCode : `${summary.deadSymbolsCount} símbolos`}** | ${summary.deadSymbolsCount === null ? noDeadCode : "Pronto para tree-shaking"} |`,
    `| **Rotas de API Mapeadas** | **${summary.totalApiRoutes === null ? noApi : `${summary.totalApiRoutes} endpoints`}** | ${summary.totalApiRoutes === null ? noApi : "OpenAPI 3.0 e SDK TypeScript gerados"} |`,
    `| **Variáveis de Ambiente** | **${summary.envVariablesCount === null ? noEnv : `${summary.envVariablesCount} variáveis`}** | ${summary.envVariablesCount === null ? noEnv : "Schema Zod tipado disponível"} |`,
    `| **Topologia de Monorepo** | **${summary.monorepoTool ?? noMonorepo}** | ${monorepoPackages === null || monorepoPackages === undefined ? noMonorepo : `${monorepoPackages} pacotes`} |`,
    `| **Base Documental & Conhecimento** | **${summary.totalDocumentsAnalyzed === null ? noDocIntel : `${summary.totalDocumentsAnalyzed} documentos`}** | ${summary.documentQualityScore === null ? `DQI ${noDocIntel}` : `DQI: **${summary.documentQualityScore}/100**`} |`,
    ``,
    `---`,
    ``,
    `## 🎯 Principais Hotspots de Refatoração Recomendados`,
    ``,
  ];

  // A fonte e a qualidade do grafo decidem se todo o relatório acima descreve o
  // repositório real. Sem isso, o leitor não distingue "não achou" de "não viu".
  const astAnalysis = reports.astGraph?.analysis;
  const sourceUsed = astAnalysis?.sourceUsed ?? null;
  const astQuality = astAnalysis?.quality ?? null;
  const astLimitations: string[] = Array.isArray(astAnalysis?.limitations)
    ? astAnalysis.limitations
    : [];
  const syntheticSource =
    sourceUsed === "deterministic" ||
    sourceUsed === null ||
    astQuality === "degraded";

  lines.push(
    `## 🧬 Qualidade da Análise & Limitações`,
    ``,
    `* **Fonte de dados do grafo:** ${sourceUsed === null ? noAst : `\`${sourceUsed}\`${sourceUsed === "deterministic" ? " — ⚠️ GRAFO SINTÉTICO, derivado da URL e não do conteúdo real do repositório" : ""}`}`,
    `* **Qualidade do grafo:** ${astQuality === null ? noAst : `\`${astQuality}\`${astQuality === "degraded" ? " — ⚠️ análise degradada" : astQuality === "partial" ? " — ⚠️ cobertura parcial" : ""}`}`,
    `* **Etapas com dados indisponíveis:** ${summary.unavailableSteps.length === 0 ? "nenhuma" : summary.unavailableSteps.map((s) => `\`${s}\``).join(", ")}`,
    ``,
  );

  if (syntheticSource) {
    lines.push(
      `> [!CAUTION]`,
      `> Este relatório **não** se apoia no código real do repositório. As métricas acima descrevem uma estrutura ${sourceUsed === "deterministic" ? "sintética gerada a partir do identificador do repositório" : "parcial ou indisponível"}. Trate cada número como ilustrativo e reexecute a análise com uma fonte legível antes de tomar qualquer decisão.`,
      ``,
    );
  }

  const reportLimitations: string[] = [];
  for (const lim of reports.codeHealth?.limitations ?? []) {
    reportLimitations.push(`[Code Health] ${lim}`);
  }
  for (const lim of reports.securityAudit?.limitations ?? []) {
    reportLimitations.push(`[Segurança] ${lim}`);
  }
  for (const w of reports.testGaps?.warnings ?? []) {
    reportLimitations.push(`[Cobertura de Testes] ${w}`);
  }

  const failedSteps = pipeline.filter((p) => p.status !== "SUCCESS");
  if (failedSteps.length > 0) {
    lines.push(`**Etapas que não concluíram:**`, ``);
    for (const f of failedSteps) {
      lines.push(
        `* ❌ \`${f.step}\` — ${f.status}${f.message ? `: ${f.message}` : ""}`,
      );
    }
    lines.push(``);
  }

  const allLimitations = [...astLimitations, ...reportLimitations];
  if (allLimitations.length > 0) {
    lines.push(`**Limitações declaradas pelas etapas:**`, ``);
    for (const l of allLimitations) {
      lines.push(`* ⚠️ ${l}`);
    }
    lines.push(``);
  } else if (astQuality === "full" && failedSteps.length === 0) {
    lines.push(`Nenhuma limitação declarada pelas etapas; grafo completo.`, ``);
  }

  lines.push(`---`, ``);

  if (
    reports.documentIntelligence &&
    reports.documentIntelligence.totalDocumentsAnalyzed > 0
  ) {
    const dqi = reports.documentIntelligence.documentQualityIndex;
    lines.push(
      `## 📑 Base de Conhecimento & Documentação Mapeada`,
      ``,
      `* **Total de Documentos:** ${reports.documentIntelligence.totalDocumentsAnalyzed} (${reports.documentIntelligence.totalWords.toLocaleString()} palavras, ${reports.documentIntelligence.totalTables} tabelas)`,
      `* **Document Quality Index (DQI):** ${dqi.overallScore === null ? `**${noDocIntel}**` : `**${dqi.overallScore}/100** (${dqi.letterGrade})`}`,
      `* **Formatos Detectados:** ${Object.entries(
        reports.documentIntelligence.formatsDistribution,
      )
        .filter(([_, c]) => c > 0)
        .map(([f, c]) => `\`${f}\`: ${c}`)
        .join(" | ")}`,
      ``,
      `---`,
      ``,
    );
  } else if (reports.documentIntelligence) {
    // A etapa rodou e respondeu "nenhum documento". Isso é um dado real
    // (zero documentos), diferente de a etapa ter falhado.
    lines.push(
      `## 📑 Base de Conhecimento & Documentação Mapeada`,
      ``,
      `* Nenhum documento foi localizado no repositório.`,
      `* **Document Quality Index (DQI):** **${noDocIntel}** — ${reports.documentIntelligence.documentQualityIndex.summary}`,
      ``,
      `---`,
      ``,
    );
  }

  if (
    reports.codeHealth?.topRefactoringPriorities &&
    reports.codeHealth.topRefactoringPriorities.length > 0
  ) {
    for (const h of reports.codeHealth.topRefactoringPriorities.slice(0, 3)) {
      lines.push(
        `* **\`${h.file}\`** (Complexidade: ${h.cyclomaticComplexity}, LOC: ${h.linesOfCode})`,
      );
      lines.push(`  * *Problema:* ${h.primaryIssue}`);
      lines.push(`  * *Ação:* ${h.recommendedAction}`);
    }
  } else if (reports.codeHealth) {
    lines.push(`* Nenhum hotspot crítico detectado.`);
  } else {
    lines.push(`* ${noCodeHealth} — nenhum hotspot pôde ser calculado.`);
  }

  lines.push(``, `---`, ``, `## 🛡️ Alertas de Segurança & Conformidade`, ``);
  if (reports.securityAudit?.auditPassed === null) {
    // Sem conteúdo inspecionado não existe "nenhuma vulnerabilidade encontrada".
    lines.push(
      `* ⚪ **Auditoria inconclusiva (${noSecurity}).** ${reports.securityAudit.message ?? ""}`,
      `* Arquivos candidatos: ${reports.securityAudit?.contentInspection.candidateFiles ?? 0} | inspecionados: ${reports.securityAudit?.contentInspection.inspectedFiles ?? 0} | sem leitura: ${reports.securityAudit?.contentInspection.failedFiles ?? 0}`,
    );
  } else if (
    reports.securityAudit?.vulnerabilities &&
    reports.securityAudit.vulnerabilities.length > 0
  ) {
    for (const v of reports.securityAudit.vulnerabilities.slice(0, 5)) {
      lines.push(
        `* **[${v.severity}]** \`${v.file}:${v.line || 1}\` - ${v.description}`,
      );
    }
  } else if (reports.securityAudit) {
    lines.push(
      `* ✅ Nenhuma vulnerabilidade estática detectada em ${reports.securityAudit.contentInspection.inspectedFiles} arquivo(s) inspecionado(s).`,
    );
  } else {
    lines.push(`* ⚪ ${noSecurity} — nenhum alerta pôde ser apurado.`);
  }

  lines.push(
    ``,
    `---`,
    ``,
    `*Gerado deterministamente pelo MRCP Engine v${getEngineVersion()} sem alucinações de LLM.*`,
  );

  return lines.join("\n");
}
