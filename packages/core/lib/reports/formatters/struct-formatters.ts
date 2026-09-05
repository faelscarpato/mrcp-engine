export function formatApiContract(header: string, ac: any): string {
  const lines = [
    header,
    `## 🔌 Contratos de API & Especificação OpenAPI 3.0`,
    ``,
    `* **Framework Detectado:** \`${ac.framework || "Generic"}\``,
    `* **Total de Endpoints Mapeados:** ${ac.totalRoutes || ac.routes?.length || 0}`,
    ``,
    `### 📋 Tabela de Rotas de API`,
    ``,
    `| Método | Caminho da Rota | Arquivo Fonte | Parâmetros / Headers |`,
    `| :-: | :--- | :--- | :--- |`,
  ];

  if (ac.routes && ac.routes.length > 0) {
    for (const r of ac.routes) {
      lines.push(
        `| **${r.method || "GET"}** | \`${r.path || "/"}\` | \`${r.filePath || ""}\` | \`${r.queryParams?.join(", ") || r.parameters?.join(", ") || "Nenhum"}\` |`,
      );
    }
  } else {
    lines.push(`| - | *Nenhuma rota identificada* | - | - |`);
  }

  if (ac.typeScriptClientSdk) {
    lines.push(
      ``,
      `### 💻 SDK TypeScript Tipado Auto-Gerado`,
      ``,
      `\`\`\`typescript`,
      ac.typeScriptClientSdk,
      `\`\`\``,
    );
  }
  return lines.join("\n");
}

export function formatEnvContract(header: string, env: any): string {
  const lines = [
    header,
    `## 🔐 Validação de Variáveis de Ambiente & Segredos`,
    ``,
    `* **Total de Variáveis Detectadas no Código:** ${env.totalVariablesDetected ?? env.variables?.length ?? 0}`,
    `* **Variáveis Ausentes no .env.example:** ${env.missingFromExample?.length ?? 0}`,
    `* **Conformidade:** ${env.isCompliant ? "🟢 100% Conforme" : "🔴 Inconsistências Detectadas"}`,
    ``,
  ];
  if (env.variables && env.variables.length > 0) {
    lines.push(
      `| Variável | Arquivos Onde é Usada | Presente no .env.example? |`,
    );
    lines.push(`| :--- | :--- | :-: |`);
    for (const v of env.variables) {
      lines.push(
        `| **\`${v.name}\`** | \`${v.occurrences?.join(", ") || "Global"}\` | ${v.definedInExample ? "✅" : "❌"} |`,
      );
    }
  }
  if (env.zodValidationSchema) {
    lines.push(
      ``,
      `### 🛡️ Schema Zod Tipado de Validação`,
      ``,
      `\`\`\`typescript`,
      env.zodValidationSchema,
      `\`\`\``,
    );
  }
  return lines.join("\n");
}

export function formatMonorepoGraph(header: string, mg: any): string {
  return [
    header,
    `## 📦 Topologia e Grafo de Pacotes do Monorepo`,
    ``,
    `* **Gerenciador / Monorepo Tool:** \`${mg.monorepoTool || "Standalone"}\``,
    `* **Total de Pacotes:** ${mg.packagesCount ?? mg.packages?.length ?? 0}`,
    `* **Ordem Topológica de Build:** ${mg.topologicalBuildOrder?.map((p: string) => "`" + p + "`").join(" → ") || "N/A"}`,
    ``,
  ].join("\n");
}

export function formatDeadCode(header: string, dc: any): string {
  const lines = [
    header,
    `## ✂️ Detecção de Código Morto & Símbolos Não Utilizados`,
    ``,
    `* **Total de Símbolos Não Utilizados:** ${dc.totalDeadSymbolsFound ?? dc.deadSymbols?.length ?? 0}`,
    `* **Pronto para Tree-Shaking:** ${dc.treeShakingReady ? "Sim" : "Verificar"}`,
    ``,
  ];
  if (dc.deadSymbols && dc.deadSymbols.length > 0) {
    lines.push(`| Símbolo | Arquivo | Linha | Tipo |`);
    lines.push(`| :--- | :--- | :-: | :--- |`);
    for (const s of dc.deadSymbols.slice(0, 15)) {
      lines.push(
        `| \`${s.name || s.symbol}\` | \`${s.file || s.path}\` | ${s.line || "-"} | \`${s.kind || "export"}\` |`,
      );
    }
  } else {
    lines.push(`* ✅ Nenhum símbolo morto ou exportação órfã identificada.`);
  }
  return lines.join("\n");
}

export function formatArchitectureDrift(header: string, ad: any): string {
  const lines = [
    header,
    `## 🏗️ Detector de Drift de Arquitetura & Dependências Cíclicas`,
    ``,
    `* **Arquitetura Alvo:** \`${ad.targetArchitecture || "Clean Architecture"}\``,
    `* **Dependências Cíclicas Encontradas:** ${ad.cyclicDependencies?.length || 0}`,
    `* **Violações de Camadas:** ${ad.violations?.length || 0}`,
    ``,
  ];
  if (ad.violations && ad.violations.length > 0) {
    lines.push(`### ⚠️ Violações de Arquitetura:`);
    for (const v of ad.violations) {
      lines.push(
        `* **[${v.severity || "WARNING"}]** ${v.description || v.message} em \`${v.file || ""}\``,
      );
    }
  } else {
    lines.push(
      `* ✅ Nenhuma violação estrutural ou ciclo de dependência detectado.`,
    );
  }
  return lines.join("\n");
}

export function formatDocumentAnalysis(header: string, da: any): string {
  const lines = [
    header,
    `## 📑 Inteligência Documental & Base de Conhecimento Estruturada`,
    ``,
    `* **Total de Documentos Analisados:** ${da.totalDocumentsAnalyzed ?? da.documents?.length ?? 0}`,
    `* **Total de Palavras:** ${(da.totalWords ?? 0).toLocaleString()} (~${Math.ceil((da.totalWords || 0) / 200)} min de leitura total)`,
    `* **Tabelas / Datasets Extraídos:** ${da.totalTables ?? 0}`,
    `* **Document Quality Index (DQI):** **${da.documentQualityIndex?.overallScore ?? 100}/100** (Nota **${da.documentQualityIndex?.letterGrade ?? "A"}**)`,
    ``,
    `### 📊 Distribuição por Formato & Categoria`,
    ``,
  ];

  if (da.formatsDistribution) {
    const activeFormats = Object.entries(da.formatsDistribution)
      .filter(([_, count]: any) => count > 0)
      .map(([fmt, count]) => "`" + fmt + "`: " + count)
      .join(" | ");
    lines.push(`* **Formatos:** ${activeFormats || "N/A"}`);
  }

  if (da.categoriesDistribution) {
    const activeCategories = Object.entries(da.categoriesDistribution)
      .filter(([_, count]: any) => count > 0)
      .map(([cat, count]) => "`" + cat + "`: " + count)
      .join(" | ");
    lines.push(`* **Categorias:** ${activeCategories || "N/A"}`);
  }

  lines.push(
    ``,
    `### 🗂️ Master Knowledge Index (Mapeamento Completo de Documentos)`,
    ``,
  );
  lines.push(
    `| Arquivo | Formato | Categoria | Palavras | DQI | Tópicos Principais / Schemas |`,
  );
  lines.push(`| :--- | :-: | :--- | :-: | :-: | :--- |`);

  if (da.masterKnowledgeIndex && da.masterKnowledgeIndex.length > 0) {
    for (const doc of da.masterKnowledgeIndex) {
      const topics =
        doc.mainTopics?.slice(0, 3).join(", ") ||
        doc.schemaOrTables?.join(", ") ||
        "Geral";
      lines.push(
        `| \`${doc.filePath}\` | **${doc.format}** | \`${doc.category}\` | ${doc.wordCount.toLocaleString()} | **${doc.qualityScore}** | ${topics} |`,
      );
    }
  } else {
    lines.push(`| - | - | *Nenhum documento mapeado* | - | - | - |`);
  }

  // Datasets / Schemas details
  const docsWithTables = (da.documents || []).filter(
    (d: any) => d.tables && d.tables.length > 0,
  );
  if (docsWithTables.length > 0) {
    lines.push(``, `### 🗄️ Schemas de Dados Tabulares Extraídos`, ``);
    for (const d of docsWithTables) {
      for (const t of d.tables) {
        lines.push(
          `#### 📋 Tabela: \`${t.tableName}\` (${t.totalRows} registros x ${t.totalColumns} colunas em \`${d.path}\`)`,
        );
        lines.push(`| Coluna | Tipo Inferido | Nulos (%) | Amostra |`);
        lines.push(`| :--- | :-: | :-: | :--- |`);
        for (const col of t.columns || []) {
          lines.push(
            `| **\`${col.name}\`** | \`${col.inferredType}\` | ${col.nullPercentage}% | \`${col.sampleValues?.slice(0, 3).join(", ") || "-"}\` |`,
          );
        }
        if (t.generatedTypeScriptSchema) {
          lines.push(
            ``,
            `\`\`\`typescript`,
            t.generatedTypeScriptSchema,
            `\`\`\``,
            ``,
          );
        }
      }
    }
  }

  // Quality Alerts
  const allIssues = (da.documents || []).flatMap(
    (d: any) => d.qualityIssues || [],
  );
  if (allIssues.length > 0) {
    lines.push(
      ``,
      `### ⚠️ Alertas de Qualidade & Inconsistências Detectadas`,
      ``,
    );
    for (const issue of allIssues.slice(0, 15)) {
      const lineStr = issue.line ? ` (Linha ${issue.line})` : "";
      lines.push(
        `* **[${issue.severity}]** \`${issue.type}\`: ${issue.description}${lineStr}`,
      );
    }
  }

  // LLM Directives
  if (da.llmQueryDirectives?.systemDirective) {
    lines.push(``, `### 🤖 Diretivas do MRCP para Agentes de IA`, ``);
    lines.push(`> ${da.llmQueryDirectives.systemDirective}`);
  }

  return lines.join("\n");
}
