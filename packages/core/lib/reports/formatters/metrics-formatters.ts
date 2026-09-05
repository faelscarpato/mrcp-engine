export function formatSecurityAudit(header: string, sec: any): string {
  const lines = [
    header,
    `## 🛡️ Auditoria Estática de Segurança & Conformidade`,
    ``,
    `* **Status da Auditoria:** ${sec.auditPassed ? "🟢 **APROVADA (0 Vulnerabilidades Críticas/Altas)**" : "🔴 **VULNERABILIDADES DETECTADAS**"}`,
    `* **Total de Alertas:** ${sec.totalVulnerabilities ?? (sec.vulnerabilities?.length || 0)}`,
    `* **Resumo:** Críticos: ${sec.summary?.critical ?? 0} | Altos: ${sec.summary?.high ?? 0} | Médios: ${sec.summary?.medium ?? 0} | Baixos: ${sec.summary?.low ?? 0}`,
    ``,
    `### 📋 Detalhamento dos Alertas`,
    ``,
  ];

  if (sec.vulnerabilities && sec.vulnerabilities.length > 0) {
    lines.push(
      `| ID | Severidade | Categoria | Arquivo:Linha | Descrição | Remediação Recomendada |`,
    );
    lines.push(`| :-: | :-: | :-: | :--- | :--- | :--- |`);
    for (const v of sec.vulnerabilities) {
      lines.push(
        `| \`${v.id || "SEC"}\` | **${v.severity}** | \`${v.category}\` | \`${v.file}:${v.line || 1}\` | ${v.description} | \`${v.remediationSnippet || "Verificar código"}\` |`,
      );
    }
  } else {
    lines.push(
      `* ✅ Nenhuma vulnerabilidade ou segredo exposto detectado no repositório.`,
    );
  }
  return lines.join("\n");
}

export function formatCodeHealth(header: string, ch: any): string {
  const lines = [
    header,
    `## 📊 Métricas de Saúde de Código & Débito Técnico`,
    ``,
    `| Métrica | Valor | Avaliação |`,
    `| :--- | :--- | :--- |`,
    `| **Maintainability Index (MI)** | **${ch.maintainabilityIndex}/100** | Nota **${ch.letterGrade || "N/A"}** (${ch.maintainabilityRating || "N/A"}) |`,
    `| **Débito Técnico Estimado** | **${ch.technicalDebtScore}%** | ${ch.technicalDebtScore < 30 ? "🟢 Baixo" : "🔴 Alto"} |`,
    `| **Total de Arquivos** | **${ch.summary?.totalFiles ?? 0}** | ~${(ch.summary?.totalLinesOfCode ?? 0).toLocaleString()} LOC |`,
    `| **God Modules Detectados** | **${ch.summary?.godModulesCount ?? 0}** | Arquivos com alta complexidade |`,
    ``,
    `### 🎯 Prioridades de Refatoração Recomendadas`,
    ``,
  ];

  if (ch.topRefactoringPriorities && ch.topRefactoringPriorities.length > 0) {
    for (const p of ch.topRefactoringPriorities) {
      lines.push(
        `* **\`${p.file}\`** (Complexidade Ciclomática: ${p.cyclomaticComplexity}, Linhas: ${p.linesOfCode})`,
      );
      lines.push(`  * *Problema:* ${p.primaryIssue}`);
      lines.push(`  * *Ação:* ${p.recommendedAction}`);
    }
  } else {
    lines.push(`* ✅ Nenhum hotspot crítico detectado.`);
  }
  return lines.join("\n");
}

export function formatTestCoverage(header: string, tg: any): string {
  const lines = [
    header,
    `## 🧪 Análise de Lacunas de Testes Unitários`,
    ``,
    `* **Funções de Alta Complexidade Descobertas:** ${tg.totalUncovered ?? tg.uncoveredFunctions?.length ?? 0}`,
    `* **Stubs de Testes Gerados:** ${tg.stubsGenerated ? "Sim (Vitest/Jest)" : "Não"}`,
    ``,
  ];

  if (tg.uncoveredFunctions && tg.uncoveredFunctions.length > 0) {
    lines.push(`### ⚠️ Funções Críticas Sem Cobertura de Testes:`);
    for (const fn of tg.uncoveredFunctions.slice(0, 10)) {
      lines.push(
        `* **\`${fn.name || fn.functionName}\`** em \`${fn.file || fn.filePath}\` (Complexidade: ${fn.complexity ?? "Alta"})`,
      );
    }
  }

  if (tg.generatedTestStubCode) {
    lines.push(
      ``,
      `### 📝 Esboço de Testes Auto-Gerado`,
      ``,
      `\`\`\`typescript`,
      tg.generatedTestStubCode,
      `\`\`\``,
    );
  }
  return lines.join("\n");
}

export function formatImpactAnalysis(header: string, ia: any): string {
  const lines = [
    header,
    `## 💥 Análise de Impacto de Mudanças (Blast Radius)`,
    ``,
    `* **Arquivos Modificados:** ${ia.modifiedFiles?.length || 0}`,
    `* **Arquivos Dependentes Impactados:** ${ia.downstreamImpactedFiles?.length || 0}`,
    `* **Testes que Devem Ser Executados:** ${ia.impactedTests?.length || 0}`,
    ``,
  ];
  if (ia.downstreamImpactedFiles && ia.downstreamImpactedFiles.length > 0) {
    lines.push(`### ⚠️ Arquivos Impactados:`);
    for (const f of ia.downstreamImpactedFiles) {
      lines.push(`* \`${f}\``);
    }
  }
  return lines.join("\n");
}
