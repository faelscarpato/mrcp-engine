import fs from 'fs';
import path from 'path';

export interface ReportOptions {
  format?: 'json' | 'markdown' | 'md';
  download?: boolean;
  saveDir?: string;
}

/**
 * Ensures the target reports directory exists and writes files safely.
 */
function ensureDirAndWrite(filePath: string, content: string): boolean {
  try {
    const dir = path.dirname(filePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(filePath, content, 'utf-8');
    return true;
  } catch (err: any) {
    // If running in a read-only container like Vercel cloud, gracefully fallback to /tmp or log
    try {
      const tmpPath = path.join('/tmp', path.basename(filePath));
      fs.writeFileSync(tmpPath, content, 'utf-8');
    } catch {
      // ignore
    }
    return false;
  }
}

/**
 * Generates formatted Markdown for any endpoint result.
 */
export function formatEndpointToMarkdown(endpointName: string, repoUrl: string, data: any): string {
  const timestamp = new Date().toLocaleString();
  const header = [
    `# 🧠 MRCP Engine - Relatório Técnico: \`${endpointName}\``,
    ``,
    `**Alvo:** \`${repoUrl || 'Local / Sessão Atual'}\`  `,
    `**Gerado em:** ${timestamp}  `,
    `**Motor:** MRCP Engine v2.4.0 (AST Determinístico Sem Alucinação)  `,
    ``,
    `---`,
    ``
  ].join('\n');

  if (!data) {
    return header + '\n*Nenhum dado retornado para esta análise.*';
  }

  // 1. Full Suite / Executive Report
  if (endpointName === 'full_repository_diagnostic_suite' || data.executiveDashboardMarkdown || data.full_diagnostic) {
    const diag = data.full_diagnostic || data;
    if (diag.executiveDashboardMarkdown) {
      return diag.executiveDashboardMarkdown;
    }
  }

  // 2. Security Compliance Audit
  if (endpointName === 'security_compliance_audit' || data.security_audit || data.vulnerabilities !== undefined) {
    const sec = data.security_audit || data;
    const lines = [
      header,
      `## 🛡️ Auditoria Estática de Segurança & Conformidade`,
      ``,
      `* **Status da Auditoria:** ${sec.auditPassed ? '🟢 **APROVADA (0 Vulnerabilidades Críticas/Altas)**' : '🔴 **VULNERABILIDADES DETECTADAS**'}`,
      `* **Total de Alertas:** ${sec.totalVulnerabilities ?? (sec.vulnerabilities?.length || 0)}`,
      `* **Resumo:** Críticos: ${sec.summary?.critical ?? 0} | Altos: ${sec.summary?.high ?? 0} | Médios: ${sec.summary?.medium ?? 0} | Baixos: ${sec.summary?.low ?? 0}`,
      ``,
      `### 📋 Detalhamento dos Alertas`,
      ``
    ];

    if (sec.vulnerabilities && sec.vulnerabilities.length > 0) {
      lines.push(`| ID | Severidade | Categoria | Arquivo:Linha | Descrição | Remediação Recomendada |`);
      lines.push(`| :-: | :-: | :-: | :--- | :--- | :--- |`);
      for (const v of sec.vulnerabilities) {
        lines.push(
          `| \`${v.id || 'SEC'}\` | **${v.severity}** | \`${v.category}\` | \`${v.file}:${v.line || 1}\` | ${v.description} | \`${v.remediationSnippet || 'Verificar código'}\` |`
        );
      }
    } else {
      lines.push(`* ✅ Nenhuma vulnerabilidade ou segredo exposto detectado no repositório.`);
    }
    return lines.join('\n');
  }

  // 3. Code Health & Maintainability Scoring
  if (endpointName === 'code_metrics_health_scorer' || data.code_health || data.maintainabilityIndex !== undefined) {
    const ch = data.code_health || data;
    const lines = [
      header,
      `## 📊 Métricas de Saúde de Código & Débito Técnico`,
      ``,
      `| Métrica | Valor | Avaliação |`,
      `| :--- | :--- | :--- |`,
      `| **Maintainability Index (MI)** | **${ch.maintainabilityIndex}/100** | Nota **${ch.letterGrade || 'N/A'}** (${ch.maintainabilityRating || 'N/A'}) |`,
      `| **Débito Técnico Estimado** | **${ch.technicalDebtScore}%** | ${ch.technicalDebtScore < 30 ? '🟢 Baixo' : '🔴 Alto'} |`,
      `| **Total de Arquivos** | **${ch.summary?.totalFiles ?? 0}** | ~${(ch.summary?.totalLinesOfCode ?? 0).toLocaleString()} LOC |`,
      `| **God Modules Detectados** | **${ch.summary?.godModulesCount ?? 0}** | Arquivos com alta complexidade |`,
      ``,
      `### 🎯 Prioridades de Refatoração Recomendadas`,
      ``
    ];

    if (ch.topRefactoringPriorities && ch.topRefactoringPriorities.length > 0) {
      for (const p of ch.topRefactoringPriorities) {
        lines.push(`* **\`${p.file}\`** (Complexidade Ciclomática: ${p.cyclomaticComplexity}, Linhas: ${p.linesOfCode})`);
        lines.push(`  * *Problema:* ${p.primaryIssue}`);
        lines.push(`  * *Ação:* ${p.recommendedAction}`);
      }
    } else {
      lines.push(`* ✅ Nenhum hotspot crítico detectado.`);
    }
    return lines.join('\n');
  }

  // 4. API Contract & OpenAPI
  if (endpointName === 'api_contract_generator' || data.api_contract || data.openApiSpec) {
    const ac = data.api_contract || data;
    const lines = [
      header,
      `## 🔌 Contratos de API & Especificação OpenAPI 3.0`,
      ``,
      `* **Framework Detectado:** \`${ac.framework || 'Generic'}\``,
      `* **Total de Endpoints Mapeados:** ${ac.totalRoutes || ac.routes?.length || 0}`,
      ``,
      `### 📋 Tabela de Rotas de API`,
      ``,
      `| Método | Caminho da Rota | Arquivo Fonte | Parâmetros / Headers |`,
      `| :-: | :--- | :--- | :--- |`
    ];

    if (ac.routes && ac.routes.length > 0) {
      for (const r of ac.routes) {
        lines.push(`| **${r.method || 'GET'}** | \`${r.path || '/'}\` | \`${r.filePath || ''}\` | \`${r.queryParams?.join(', ') || r.parameters?.join(', ') || 'Nenhum'}\` |`);
      }
    } else {
      lines.push(`| - | *Nenhuma rota identificada* | - | - |`);
    }

    if (ac.typeScriptClientSdk) {
      lines.push(``, `### 💻 SDK TypeScript Tipado Auto-Gerado`, ``, `\`\`\`typescript`, ac.typeScriptClientSdk, `\`\`\``);
    }
    return lines.join('\n');
  }

  // 5. Test Coverage Gap Finder
  if (endpointName === 'auto_test_coverage_gap_finder' || data.test_coverage_gaps || data.uncoveredFunctions) {
    const tg = data.test_coverage_gaps || data;
    const lines = [
      header,
      `## 🧪 Análise de Lacunas de Testes Unitários`,
      ``,
      `* **Funções de Alta Complexidade Descobertas:** ${tg.totalUncovered ?? tg.uncoveredFunctions?.length ?? 0}`,
      `* **Stubs de Testes Gerados:** ${tg.stubsGenerated ? 'Sim (Vitest/Jest)' : 'Não'}`,
      ``
    ];

    if (tg.uncoveredFunctions && tg.uncoveredFunctions.length > 0) {
      lines.push(`### ⚠️ Funções Críticas Sem Cobertura de Testes:`);
      for (const fn of tg.uncoveredFunctions.slice(0, 10)) {
        lines.push(`* **\`${fn.name || fn.functionName}\`** em \`${fn.file || fn.filePath}\` (Complexidade: ${fn.complexity ?? 'Alta'})`);
      }
    }

    if (tg.generatedTestStubCode) {
      lines.push(``, `### 📝 Esboço de Testes Auto-Gerado`, ``, `\`\`\`typescript`, tg.generatedTestStubCode, `\`\`\``);
    }
    return lines.join('\n');
  }

  // 6. Impact Analysis
  if (endpointName === 'impact_analysis' || data.impact_analysis || data.blastRadius) {
    const ia = data.impact_analysis || data;
    const lines = [
      header,
      `## 💥 Análise de Impacto de Mudanças (Blast Radius)`,
      ``,
      `* **Arquivos Modificados:** ${ia.modifiedFiles?.length || 0}`,
      `* **Arquivos Dependentes Impactados:** ${ia.downstreamImpactedFiles?.length || 0}`,
      `* **Testes que Devem Ser Executados:** ${ia.impactedTests?.length || 0}`,
      ``
    ];
    if (ia.downstreamImpactedFiles && ia.downstreamImpactedFiles.length > 0) {
      lines.push(`### ⚠️ Arquivos Impactados:`);
      for (const f of ia.downstreamImpactedFiles) {
        lines.push(`* \`${f}\``);
      }
    }
    return lines.join('\n');
  }

  // 7. Environment & Secrets Contract
  if (endpointName === 'env_secret_contract_validator' || data.env_contract || data.variables) {
    const env = data.env_contract || data;
    const lines = [
      header,
      `## 🔐 Validação de Variáveis de Ambiente & Segredos`,
      ``,
      `* **Total de Variáveis Detectadas no Código:** ${env.totalVariablesDetected ?? env.variables?.length ?? 0}`,
      `* **Variáveis Ausentes no .env.example:** ${env.missingFromExample?.length ?? 0}`,
      `* **Conformidade:** ${env.isCompliant ? '🟢 100% Conforme' : '🔴 Inconsistências Detectadas'}`,
      ``
    ];
    if (env.variables && env.variables.length > 0) {
      lines.push(`| Variável | Arquivos Onde é Usada | Presente no .env.example? |`);
      lines.push(`| :--- | :--- | :-: |`);
      for (const v of env.variables) {
        lines.push(`| **\`${v.name}\`** | \`${v.occurrences?.join(', ') || 'Global'}\` | ${v.definedInExample ? '✅' : '❌'} |`);
      }
    }
    if (env.zodValidationSchema) {
      lines.push(``, `### 🛡️ Schema Zod Tipado de Validação`, ``, `\`\`\`typescript`, env.zodValidationSchema, `\`\`\``);
    }
    return lines.join('\n');
  }

  // 8. Monorepo Package Graph
  if (endpointName === 'monorepo_package_graph_analyzer' || data.monorepo_graph || data.packages) {
    const mg = data.monorepo_graph || data;
    const lines = [
      header,
      `## 📦 Topologia e Grafo de Pacotes do Monorepo`,
      ``,
      `* **Gerenciador / Monorepo Tool:** \`${mg.monorepoTool || 'Standalone'}\``,
      `* **Total de Pacotes:** ${mg.packagesCount ?? mg.packages?.length ?? 0}`,
      `* **Ordem Topológica de Build:** ${mg.topologicalBuildOrder?.map((p: string) => `\`${p}\``).join(' → ') || 'N/A'}`,
      ``
    ];
    return lines.join('\n');
  }

  // 9. Dead Code & Unused Exports
  if (endpointName === 'dead_code_pruner' || data.dead_code_analysis || data.deadSymbols) {
    const dc = data.dead_code_analysis || data;
    const lines = [
      header,
      `## ✂️ Detecção de Código Morto & Símbolos Não Utilizados`,
      ``,
      `* **Total de Símbolos Não Utilizados:** ${dc.totalDeadSymbolsFound ?? dc.deadSymbols?.length ?? 0}`,
      `* **Pronto para Tree-Shaking:** ${dc.treeShakingReady ? 'Sim' : 'Verificar'}`,
      ``
    ];
    if (dc.deadSymbols && dc.deadSymbols.length > 0) {
      lines.push(`| Símbolo | Arquivo | Linha | Tipo |`);
      lines.push(`| :--- | :--- | :-: | :--- |`);
      for (const s of dc.deadSymbols.slice(0, 15)) {
        lines.push(`| \`${s.name || s.symbol}\` | \`${s.file || s.path}\` | ${s.line || '-'} | \`${s.kind || 'export'}\` |`);
      }
    } else {
      lines.push(`* ✅ Nenhum símbolo morto ou exportação órfã identificada.`);
    }
    return lines.join('\n');
  }

  // 10. Architecture Drift
  if (endpointName === 'architectural_drift_detector' || data.architecture_drift || data.violations) {
    const ad = data.architecture_drift || data;
    const lines = [
      header,
      `## 🏗️ Detector de Drift de Arquitetura & Dependências Cíclicas`,
      ``,
      `* **Arquitetura Alvo:** \`${ad.targetArchitecture || 'Clean Architecture'}\``,
      `* **Dependências Cíclicas Encontradas:** ${ad.cyclicDependencies?.length || 0}`,
      `* **Violações de Camadas:** ${ad.violations?.length || 0}`,
      ``
    ];
    if (ad.violations && ad.violations.length > 0) {
      lines.push(`### ⚠️ Violações de Arquitetura:`);
      for (const v of ad.violations) {
        lines.push(`* **[${v.severity || 'WARNING'}]** ${v.description || v.message} em \`${v.file || ''}\``);
      }
    } else {
      lines.push(`* ✅ Nenhuma violação estrutural ou ciclo de dependência detectado.`);
    }
    return lines.join('\n');
  }

<<<<<<< HEAD
  // 11. Document Intelligence & Non-Code Knowledge Base Analyzer
  if (endpointName === 'document_analyzer' || endpointName === 'document_repository_intelligence' || data.document_analysis || data.masterKnowledgeIndex) {
    const da = data.document_analysis || data;
    const lines = [
      header,
      `## 📑 Inteligência Documental & Base de Conhecimento Estruturada`,
      ``,
      `* **Total de Documentos Analisados:** ${da.totalDocumentsAnalyzed ?? da.documents?.length ?? 0}`,
      `* **Total de Palavras:** ${(da.totalWords ?? 0).toLocaleString()} (~${Math.ceil((da.totalWords || 0) / 200)} min de leitura total)`,
      `* **Tabelas / Datasets Extraídos:** ${da.totalTables ?? 0}`,
      `* **Document Quality Index (DQI):** **${da.documentQualityIndex?.overallScore ?? 100}/100** (Nota **${da.documentQualityIndex?.letterGrade ?? 'A'}**)`,
      ``,
      `### 📊 Distribuição por Formato & Categoria`,
      ``
    ];

    if (da.formatsDistribution) {
      const activeFormats = Object.entries(da.formatsDistribution)
        .filter(([_, count]: any) => count > 0)
        .map(([fmt, count]) => `\`${fmt}\`: ${count}`)
        .join(' | ');
      lines.push(`* **Formatos:** ${activeFormats || 'N/A'}`);
    }

    if (da.categoriesDistribution) {
      const activeCategories = Object.entries(da.categoriesDistribution)
        .filter(([_, count]: any) => count > 0)
        .map(([cat, count]) => `\`${cat}\`: ${count}`)
        .join(' | ');
      lines.push(`* **Categorias:** ${activeCategories || 'N/A'}`);
    }

    lines.push(``, `### 🗂️ Master Knowledge Index (Mapeamento Completo de Documentos)`, ``);
    lines.push(`| Arquivo | Formato | Categoria | Palavras | DQI | Tópicos Principais / Schemas |`);
    lines.push(`| :--- | :-: | :--- | :-: | :-: | :--- |`);

    if (da.masterKnowledgeIndex && da.masterKnowledgeIndex.length > 0) {
      for (const doc of da.masterKnowledgeIndex) {
        const topics = doc.mainTopics?.slice(0, 3).join(', ') || doc.schemaOrTables?.join(', ') || 'Geral';
        lines.push(
          `| \`${doc.filePath}\` | **${doc.format}** | \`${doc.category}\` | ${doc.wordCount.toLocaleString()} | **${doc.qualityScore}** | ${topics} |`
        );
      }
    } else {
      lines.push(`| - | - | *Nenhum documento mapeado* | - | - | - |`);
    }

    // Datasets / Schemas details
    const docsWithTables = (da.documents || []).filter((d: any) => d.tables && d.tables.length > 0);
    if (docsWithTables.length > 0) {
      lines.push(``, `### 🗄️ Schemas de Dados Tabulares Extraídos`, ``);
      for (const d of docsWithTables) {
        for (const t of d.tables) {
          lines.push(`#### 📋 Tabela: \`${t.tableName}\` (${t.totalRows} registros x ${t.totalColumns} colunas em \`${d.path}\`)`);
          lines.push(`| Coluna | Tipo Inferido | Nulos (%) | Amostra |`);
          lines.push(`| :--- | :-: | :-: | :--- |`);
          for (const col of t.columns || []) {
            lines.push(`| **\`${col.name}\`** | \`${col.inferredType}\` | ${col.nullPercentage}% | \`${col.sampleValues?.slice(0, 3).join(', ') || '-'}\` |`);
          }
          if (t.generatedTypeScriptSchema) {
            lines.push(``, `\`\`\`typescript`, t.generatedTypeScriptSchema, `\`\`\``, ``);
          }
        }
      }
    }

    // Quality Alerts
    const allIssues = (da.documents || []).flatMap((d: any) => d.qualityIssues || []);
    if (allIssues.length > 0) {
      lines.push(``, `### ⚠️ Alertas de Qualidade & Inconsistências Detectadas`, ``);
      for (const issue of allIssues.slice(0, 15)) {
        lines.push(`* **[${issue.severity}]** \`${issue.type}\`: ${issue.description} ${issue.line ? `(Linha ${issue.line})` : ''}`);
      }
    }

    // LLM Directives
    if (da.llmQueryDirectives?.systemDirective) {
      lines.push(``, `### 🤖 Diretivas do MRCP para Agentes de IA`, ``);
      lines.push(`> ${da.llmQueryDirectives.systemDirective}`);
    }

    return lines.join('\n');
  }

=======
>>>>>>> 1cf5a33b621e387ba881b9d8fd08a0f9f524dfc7
  // Generic JSON dump in markdown block
  return [
    header,
    `## 📄 Dados Estruturados da Análise`,
    ``,
    `\`\`\`json`,
    JSON.stringify(data, null, 2),
    `\`\`\``
  ].join('\n');
}

/**
 * Saves all reports locally in ./reports/ and ./mrcp-analysis.json
 */
export function saveAllReportsLocally(
  endpointName: string,
  repoUrl: string,
  data: any,
  projectDir: string = process.cwd()
): { jsonReportPath: string; markdownReportPath: string; executiveReportPath?: string } {
  const reportsDir = path.join(projectDir, 'reports');
  const jsonReportPath = path.join(reportsDir, 'mrcp-analysis.json');
  const markdownReportPath = path.join(reportsDir, `MRCP_${endpointName.toUpperCase().replace(/[^A-Z0-9_]/g, '_')}.md`);
  const rootJsonPath = path.join(projectDir, 'mrcp-analysis.json');
  const executiveReportPath = path.join(projectDir, 'MRCP_EXECUTIVE_REPORT.md');

  try {
    // 1. Update consolidated JSON
    let currentData: any = { repoUrl, updatedAt: new Date().toISOString(), endpoints: {} };
    if (fs.existsSync(rootJsonPath)) {
      try {
        currentData = JSON.parse(fs.readFileSync(rootJsonPath, 'utf-8'));
        if (!currentData.endpoints) currentData.endpoints = {};
      } catch {
        // ignore
      }
    }

    currentData.repoUrl = repoUrl || currentData.repoUrl;
    currentData.updatedAt = new Date().toISOString();
    currentData.endpoints[endpointName] = data;

    const formattedJson = JSON.stringify(currentData, null, 2);
    ensureDirAndWrite(rootJsonPath, formattedJson);
    ensureDirAndWrite(jsonReportPath, formattedJson);

    // 2. Generate and save Markdown report
    const markdownContent = formatEndpointToMarkdown(endpointName, repoUrl, data);
    ensureDirAndWrite(markdownReportPath, markdownContent);

    // 3. If full suite or executive dashboard, also update root MRCP_EXECUTIVE_REPORT.md
    if (endpointName === 'full_repository_diagnostic_suite' || endpointName === 'full_analysis' || data.executiveDashboardMarkdown || data.full_diagnostic) {
      ensureDirAndWrite(executiveReportPath, markdownContent);
      ensureDirAndWrite(path.join(reportsDir, 'MRCP_EXECUTIVE_REPORT.md'), markdownContent);
    }

    console.log(`[MRCP Report Engine] ✅ Relatórios salvos com sucesso:`);
    console.log(`   - JSON: ${rootJsonPath}`);
    console.log(`   - Markdown: ${markdownReportPath}`);

    return { jsonReportPath, markdownReportPath, executiveReportPath };
  } catch (err: any) {
    console.error(`[MRCP Report Engine Error] Falha ao gravar relatórios:`, err.message);
    return { jsonReportPath, markdownReportPath };
  }
}

/**
 * Handles HTTP response formatting based on query parameters (?format=markdown, ?download=true, etc.)
 */
export function sendFormattedResponse(
  req: any,
  res: any,
  endpointName: string,
  repoUrl: string,
  data: any
) {
  // Always trigger local disk save
  saveAllReportsLocally(endpointName, repoUrl, data);

  const format = String(req.query?.format || req.body?.format || '').toLowerCase();
  const shouldDownload = req.query?.download === 'true' || req.query?.download === '1' || req.body?.download === true;

  // Markdown format requested
  if (format === 'markdown' || format === 'md' || req.headers?.accept === 'text/markdown') {
    const md = formatEndpointToMarkdown(endpointName, repoUrl, data);
    res.setHeader('Content-Type', 'text/markdown; charset=utf-8');
    if (shouldDownload) {
      res.setHeader('Content-Disposition', `attachment; filename="mrcp-${endpointName.replace(/_/g, '-')}-report.md"`);
    }
    return res.status(200).send(md);
  }

  // File download requested in JSON
  if (shouldDownload) {
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="mrcp-${endpointName.replace(/_/g, '-')}-report.json"`);
    return res.status(200).json(data);
  }

  // Standard JSON response
  return res.status(200).json(data);
}
