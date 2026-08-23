"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getDashboardHtml = getDashboardHtml;
function getDashboardHtml(result) {
    if (!result) {
        return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <style>
    body {
      font-family: var(--vscode-font-family, sans-serif);
      background-color: var(--vscode-editor-background);
      color: var(--vscode-editor-foreground);
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      height: 90vh;
      text-align: center;
    }
    .btn {
      background-color: var(--vscode-button-background);
      color: var(--vscode-button-foreground);
      border: none;
      padding: 12px 24px;
      font-size: 16px;
      border-radius: 6px;
      cursor: pointer;
      font-weight: 600;
      margin-top: 20px;
    }
    .btn:hover {
      background-color: var(--vscode-button-hoverBackground);
    }
  </style>
</head>
<body>
  <h1>🚀 MRCP Engine Cockpit</h1>
  <p>Nenhuma análise foi executada ainda para este workspace.</p>
  <button class="btn" onclick="runAnalysis()">⚡ Executar Diagnóstico Completo</button>
  <script>
    const vscode = acquireVsCodeApi();
    function runAnalysis() {
      vscode.postMessage({ command: 'runSuite' });
    }
  </script>
</body>
</html>`;
    }
    const { summary, files, godModules, duplicateModules, securityIssues, envIssues, dependencyCycles, testGaps, deadCodeItems, apiRoutes, documents, provenance } = result;
    const gradeColor = summary.letterGrade === 'A' ? '#10b981' : summary.letterGrade === 'B' ? '#3b82f6' : summary.letterGrade === 'C' ? '#f59e0b' : '#ef4444';
    return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>MRCP Engine Cockpit</title>
  <style>
    :root {
      --bg: var(--vscode-editor-background);
      --fg: var(--vscode-editor-foreground);
      --card-bg: var(--vscode-editorWidget-background, rgba(255,255,255,0.04));
      --border: var(--vscode-widget-border, rgba(255,255,255,0.1));
      --accent: var(--vscode-button-background, #6366f1);
      --accent-fg: var(--vscode-button-foreground, #fff);
    }
    body {
      font-family: var(--vscode-font-family, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif);
      background-color: var(--bg);
      color: var(--fg);
      margin: 0;
      padding: 24px;
      line-height: 1.5;
    }
    .header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      border-bottom: 1px solid var(--border);
      padding-bottom: 16px;
      margin-bottom: 24px;
    }
    .title-group h1 {
      margin: 0;
      font-size: 24px;
      display: flex;
      align-items: center;
      gap: 10px;
    }
    .meta-subtitle {
      font-size: 13px;
      opacity: 0.7;
      margin-top: 4px;
    }
    .btn-group {
      display: flex;
      gap: 10px;
    }
    .btn {
      background-color: var(--accent);
      color: var(--accent-fg);
      border: none;
      padding: 8px 16px;
      border-radius: 6px;
      font-size: 13px;
      cursor: pointer;
      font-weight: 500;
      display: flex;
      align-items: center;
      gap: 6px;
    }
    .btn:hover {
      opacity: 0.9;
    }
    .btn-secondary {
      background-color: transparent;
      border: 1px solid var(--border);
      color: var(--fg);
    }
    .btn-secondary:hover {
      background-color: var(--card-bg);
    }
    
    /* KPIS GRID */
    .kpi-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
      gap: 16px;
      margin-bottom: 24px;
    }
    .kpi-card {
      background-color: var(--card-bg);
      border: 1px solid var(--border);
      border-radius: 8px;
      padding: 16px;
      display: flex;
      flex-direction: column;
    }
    .kpi-title {
      font-size: 12px;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      opacity: 0.7;
      margin-bottom: 8px;
    }
    .kpi-value {
      font-size: 28px;
      font-weight: 700;
      margin-bottom: 4px;
    }
    .kpi-sub {
      font-size: 12px;
      opacity: 0.8;
    }
    .grade-badge {
      display: inline-block;
      padding: 2px 8px;
      border-radius: 4px;
      font-size: 18px;
      color: #fff;
      font-weight: 700;
    }

    /* TABS */
    .tabs-nav {
      display: flex;
      gap: 8px;
      border-bottom: 1px solid var(--border);
      margin-bottom: 20px;
    }
    .tab-btn {
      background: none;
      border: none;
      color: var(--fg);
      opacity: 0.7;
      padding: 8px 16px;
      cursor: pointer;
      font-size: 14px;
      border-bottom: 2px solid transparent;
    }
    .tab-btn.active {
      opacity: 1;
      font-weight: 600;
      border-bottom-color: var(--accent);
    }
    .tab-content {
      display: none;
    }
    .tab-content.active {
      display: block;
    }

    /* TABLES */
    .table-container {
      overflow-x: auto;
      border: 1px solid var(--border);
      border-radius: 8px;
      background-color: var(--card-bg);
    }
    table {
      width: 100%;
      border-collapse: collapse;
      text-align: left;
      font-size: 13px;
    }
    th, td {
      padding: 10px 14px;
      border-bottom: 1px solid var(--border);
    }
    th {
      background-color: rgba(255,255,255,0.02);
      font-weight: 600;
    }
    tr:last-child td {
      border-bottom: none;
    }
    .file-link {
      color: var(--accent);
      cursor: pointer;
      text-decoration: underline;
    }
    .severity-badge {
      display: inline-block;
      padding: 2px 6px;
      border-radius: 4px;
      font-size: 11px;
      font-weight: 600;
      text-transform: uppercase;
    }
    .severity-critical { background-color: #ef4444; color: #fff; }
    .severity-high { background-color: #f97316; color: #fff; }
    .severity-medium { background-color: #f59e0b; color: #000; }
    .severity-low { background-color: #10b981; color: #fff; }

    .graph-box {
      border: 1px solid var(--border);
      border-radius: 8px;
      padding: 20px;
      background-color: var(--card-bg);
      text-align: center;
    }
  </style>
</head>
<body>
  <div class="header">
    <div class="title-group">
      <h1>🛡️ MRCP Engine Cockpit <span class="grade-badge" style="background-color: ${gradeColor}">${summary.letterGrade}</span></h1>
      <div class="meta-subtitle">
        Diagnóstico Executado em <strong>${new Date(result.timestamp).toLocaleString()}</strong> | ${summary.totalFiles} arquivos analisados (${summary.totalLinesOfCode} linhas) | Rev: <code>${provenance.repositoryRevision}</code>
      </div>
    </div>
    <div class="btn-group">
      <button class="btn btn-secondary" onclick="copyContext()">📋 Copiar Contexto IA</button>
      <button class="btn btn-secondary" onclick="exportReport()">📄 Exportar Relatório MD</button>
      <button class="btn" onclick="runSuite()">⚡ Re-executar Suíte</button>
    </div>
  </div>

  <!-- KPIS -->
  <div class="kpi-grid">
    <div class="kpi-card">
      <div class="kpi-title">Health Score</div>
      <div class="kpi-value" style="color: ${gradeColor}">${summary.healthScore}<span style="font-size: 16px; font-weight: normal;">/100</span></div>
      <div class="kpi-sub">Nota: <strong>Grade ${summary.letterGrade}</strong></div>
    </div>
    <div class="kpi-card">
      <div class="kpi-title">Índice de Manutenibilidade</div>
      <div class="kpi-value">${summary.maintainabilityIndex}<span style="font-size: 16px; font-weight: normal;">/100</span></div>
      <div class="kpi-sub">Complexidade Média: <strong>${summary.avgComplexity}</strong> / função</div>
    </div>
    <div class="kpi-card">
      <div class="kpi-title">Economia de Tokens LLM</div>
      <div class="kpi-value" style="color: #10b981">~${summary.tokenSavingsPercent}%</div>
      <div class="kpi-sub">${summary.estimatedTokensWithMrcp} vs ${summary.estimatedTokensWithoutMrcp} tokens brutos</div>
    </div>
    <div class="kpi-card">
      <div class="kpi-title">Inteligência Não-Código</div>
      <div class="kpi-value">${summary.documentQualityScore}<span style="font-size: 16px; font-weight: normal;">/100</span></div>
      <div class="kpi-sub">${summary.documentsCount} docs analisados (DQI)</div>
    </div>
  </div>

  <!-- TABS NAV -->
  <div class="tabs-nav">
    <button class="tab-btn active" onclick="switchTab('overview')">📊 Visão Geral & Hotspots</button>
    <button class="tab-btn" onclick="switchTab('godmodules')">🏛️ God Modules (${godModules.length})</button>
    <button class="tab-btn" onclick="switchTab('security')">🛡️ Segurança & Segredos (${securityIssues.length + envIssues.length})</button>
    <button class="tab-btn" onclick="switchTab('quality')">🧪 Gaps & Código Morto (${testGaps.length + deadCodeItems.length})</button>
    <button class="tab-btn" onclick="switchTab('documents')">📄 Documentos & DQI (${documents.length})</button>
    <button class="tab-btn" onclick="switchTab('api')">🌐 Contratos de API (${apiRoutes.length})</button>
  </div>

  <!-- TAB: OVERVIEW -->
  <div id="tab-overview" class="tab-content active">
    <div style="background: linear-gradient(135deg, rgba(16, 185, 129, 0.12) 0%, rgba(59, 130, 246, 0.12) 100%); border: 1px solid rgba(16, 185, 129, 0.35); border-radius: 8px; padding: 18px; margin-bottom: 24px;">
      <h3 style="margin-top: 0; color: #10b981; display: flex; align-items: center; gap: 8px;">
        ⚡ Comprovação de Eficiência & ROI de Tokens (MRCP Engine)
      </h3>
      <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 16px; margin-top: 12px;">
        <div>
          <div style="font-size: 12px; opacity: 0.8;">Baseline sem MRCP (Raw Tokens):</div>
          <div style="font-size: 18px; font-weight: bold; color: var(--fg);">${summary.estimatedTokensWithoutMrcp.toLocaleString()} <span style="font-size: 12px; font-weight: normal;">tokens brutos</span></div>
        </div>
        <div>
          <div style="font-size: 12px; opacity: 0.8;">Contexto Otimizado MRCP:</div>
          <div style="font-size: 18px; font-weight: bold; color: #10b981;">${summary.estimatedTokensWithMrcp.toLocaleString()} <span style="font-size: 12px; font-weight: normal;">tokens AST</span></div>
        </div>
        <div>
          <div style="font-size: 12px; opacity: 0.8;">Economia Real por Consulta:</div>
          <div style="font-size: 18px; font-weight: bold; color: #10b981;">~${Math.max(0, summary.estimatedTokensWithoutMrcp - summary.estimatedTokensWithMrcp).toLocaleString()} tokens <span style="font-size: 12px; font-weight: normal;">(${summary.tokenSavingsPercent}%)</span></div>
        </div>
        <div>
          <div style="font-size: 12px; opacity: 0.8;">Custo Médio Economizado / Análise:</div>
          <div style="font-size: 18px; font-weight: bold; color: #3b82f6;">~$${(((Math.max(0, summary.estimatedTokensWithoutMrcp - summary.estimatedTokensWithMrcp)) / 1000) * 0.003).toFixed(2)} USD</div>
        </div>
      </div>
    </div>

    <h3>🔥 Hotspots de Manutenção & Complexidade de Arquivos</h3>
    <div class="table-container">
      <table>
        <thead>
          <tr>
            <th>Arquivo</th>
            <th>Linguagem</th>
            <th>Linhas</th>
            <th>Complexidade</th>
            <th>Símbolos</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          ${files.slice(0, 25).map(f => `
            <tr>
              <td><span class="file-link" onclick="openFile('${f.relativePath}', 1)">${f.relativePath}</span></td>
              <td>${f.language}</td>
              <td>${f.linesCount}</td>
              <td><strong>${f.complexity}</strong></td>
              <td>${f.symbols.length}</td>
              <td>${f.isGodModule ? '<span class="severity-badge severity-high">God Module</span>' : '<span class="severity-badge severity-low">Saudável</span>'}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
  </div>

  <!-- TAB: GOD MODULES -->
  <div id="tab-godmodules" class="tab-content">
    <h3>🏛️ Módulos Monolíticos (God Modules) & Diagnóstico Detalhado</h3>
    <div class="table-container">
      <table>
        <thead>
          <tr>
            <th>Arquivo</th>
            <th>Linhas de Código</th>
            <th>Complexidade Ciclomática</th>
            <th>Diagnóstico & Ação Recomendada</th>
          </tr>
        </thead>
        <tbody>
          ${godModules.length === 0 ? '<tr><td colspan="4" style="text-align: center; padding: 20px;">✅ Nenhum God Module detectado! Código altamente modular.</td></tr>' : ''}
          ${godModules.map(g => `
            <tr>
              <td><span class="file-link" onclick="openFile('${g.file}', 1)">${g.file}</span></td>
              <td><strong>${g.linesCount}</strong></td>
              <td><span class="severity-badge severity-medium">${g.complexity}</span></td>
              <td>${g.reason}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
  </div>

  <!-- TAB: SECURITY -->
  <div id="tab-security" class="tab-content">
    <h3>🛡️ Auditoria de Segurança e Chaves de Ambiente</h3>
    <div class="table-container">
      <table>
        <thead>
          <tr>
            <th>Severidade</th>
            <th>Regra / Diagnóstico</th>
            <th>Arquivo & Linha</th>
            <th>Ação Recomendada</th>
          </tr>
        </thead>
        <tbody>
          ${securityIssues.length === 0 && envIssues.length === 0 ? '<tr><td colspan="4" style="text-align: center; padding: 20px;">✅ Nenhuma vulnerabilidade detectável pelas regras atuais (Zero falhas detectadas pelos padrões estáticos).</td></tr>' : ''}
          ${securityIssues.map(s => `
            <tr>
              <td><span class="severity-badge severity-${s.severity}">${s.severity}</span></td>
              <td><strong>${s.rule}:</strong> ${s.message}</td>
              <td><span class="file-link" onclick="openFile('${s.file}', ${s.line})">${s.file}:${s.line}</span></td>
              <td>${s.remediation || 'Sanitize credentials.'}</td>
            </tr>
          `).join('')}
          ${envIssues.map(e => `
            <tr>
              <td><span class="severity-badge severity-medium">ENV_MISSING</span></td>
              <td><strong>Variável Ausente:</strong> process.env.${e.variableName} usada no código mas não declarada no .env</td>
              <td><span class="file-link" onclick="openFile('${e.file}', ${e.line})">${e.file}:${e.line}</span></td>
              <td>Adicione ${e.variableName} ao .env e .env.example.</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
  </div>

  <!-- TAB: QUALITY -->
  <div id="tab-quality" class="tab-content">
    <h3>🧪 Gaps de Cobertura de Testes & Código Morto</h3>
    <div class="table-container">
      <table>
        <thead>
          <tr>
            <th>Tipo</th>
            <th>Símbolo</th>
            <th>Arquivo & Linha</th>
            <th>Diagnóstico</th>
          </tr>
        </thead>
        <tbody>
          ${deadCodeItems.length === 0 && testGaps.length === 0 ? '<tr><td colspan="4" style="text-align: center; padding: 20px;">✅ Zero código morto e todas as funções complexas possuem cobertura de testes detectada!</td></tr>' : ''}
          ${deadCodeItems.map(d => `
            <tr>
              <td><span class="severity-badge severity-medium">Código Morto</span></td>
              <td><strong>${d.symbolName}</strong> (${d.kind})</td>
              <td><span class="file-link" onclick="openFile('${d.file}', ${d.line})">${d.file}:${d.line}</span></td>
              <td>${d.reason || 'Export nunca referenciado no projeto.'}</td>
            </tr>
          `).join('')}
          ${testGaps.map(g => `
            <tr>
              <td><span class="severity-badge severity-low">Gap de Teste</span></td>
              <td><strong>${g.functionName}()</strong></td>
              <td><span class="file-link" onclick="openFile('${g.file}', ${g.line})">${g.file}:${g.line}</span></td>
              <td>Função pública com complexidade (${g.complexity}) sem teste unitário correspondente.</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
  </div>

  <!-- TAB: DOCUMENTS -->
  <div id="tab-documents" class="tab-content">
    <h3>📄 Inteligência Documental (Não-Código & DQI)</h3>
    <div class="table-container">
      <table>
        <thead>
          <tr>
            <th>Documento</th>
            <th>Formato</th>
            <th>Tamanho</th>
            <th>Palavras</th>
            <th>Qualidade (DQI)</th>
          </tr>
        </thead>
        <tbody>
          ${documents.slice(0, 30).map(d => `
            <tr>
              <td><span class="file-link" onclick="openFile('${d.file}', 1)">${d.file}</span></td>
              <td><strong>${d.format}</strong></td>
              <td>${Math.round(d.size / 1024)} KB</td>
              <td>${d.wordCount}</td>
              <td><span class="severity-badge severity-low">${d.qualityScore}/100</span></td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
  </div>

  <!-- TAB: API -->
  <div id="tab-api" class="tab-content">
    <h3>🌐 Contratos de API & Rotas REST / RPC Detectadas</h3>
    <div class="table-container">
      <table>
        <thead>
          <tr>
            <th>Métodos Permitidos</th>
            <th>Endpoint / Rota</th>
            <th>Arquivo & Linha</th>
            <th>Detalhes / Protocolo</th>
          </tr>
        </thead>
        <tbody>
          ${apiRoutes.length === 0 ? '<tr><td colspan="4" style="text-align: center; padding: 20px;">Nenhuma rota REST detectada explicitamente.</td></tr>' : ''}
          ${apiRoutes.map(a => `
            <tr>
              <td><span class="severity-badge severity-low">${a.acceptedMethods.join(', ')}</span></td>
              <td><code>${a.path}</code> ${a.aliases.length > 0 ? `<small style="opacity: 0.7;">(Aliases: ${a.aliases.join(', ')})</small>` : ''}</td>
              <td><span class="file-link" onclick="openFile('${a.file}', ${a.line})">${a.file}:${a.line}</span></td>
              <td>${a.description || a.source}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
  </div>

  <script>
    const vscode = acquireVsCodeApi();

    function switchTab(tabId) {
      document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
      document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
      
      event.target.classList.add('active');
      const target = document.getElementById('tab-' + tabId);
      if (target) target.classList.add('active');
    }

    function runSuite() {
      vscode.postMessage({ command: 'runSuite' });
    }

    function copyContext() {
      vscode.postMessage({ command: 'copyContext' });
    }

    function exportReport() {
      vscode.postMessage({ command: 'exportReport' });
    }

    function openFile(file, line) {
      vscode.postMessage({ command: 'openFile', file, line });
    }
  </script>
</body>
</html>`;
}
//# sourceMappingURL=dashboard-template.js.map