import readline from 'readline';
import { writeFileSync, existsSync, mkdirSync } from 'fs';
import { join } from 'path';

const MRCP_API_BASE = process.env.MRCP_API_URL || 'https://mrcp-engine.vercel.app';
const CACHE_FILE = 'mrcp-analysis.json';

const AVAILABLE_TOOLS = [
  {
    id: 'full_suite',
    endpoint: 'full-suite',
    name: '🚀 EXECUTAR SUÍTE COMPLETA (12 Ferramentas em Sequência)',
    desc: 'Diagnóstico estrutural total, AST, segurança, débito técnico e contratos.',
    isSuite: true
  },
  {
    id: 'security_compliance_audit',
    endpoint: 'security-audit',
    name: '🛡️  Auditoria de Segurança & Conformidade (OWASP / Hardcoded Secrets)',
    desc: 'Scanner estático de vulnerabilidades e credenciais expostas.'
  },
  {
    id: 'code_metrics_health_scorer',
    endpoint: 'code-health',
    name: '📊  Saúde do Código & Maintainability Index (MI 0-100)',
    desc: 'Cálculo de débito técnico, God Modules e carga cognitiva.'
  },
  {
    id: 'api_contract_generator',
    endpoint: 'api-contract',
    name: '🔌  Contratos de API (OpenAPI 3.0 & TypeScript Client SDK)',
    desc: 'Extrai rotas de backend (Next.js, Express, Fastify, FastAPI) e gera SDK tipado.'
  },
  {
    id: 'auto_test_coverage_gap_finder',
    endpoint: 'test-gap-analysis',
    name: '🧪  Lacunas de Testes Unitários & Gerador de Stubs (Vitest/Jest)',
    desc: 'Cruza funções de alta complexidade sem cobertura e gera testes.'
  },
  {
    id: 'env_secret_contract_validator',
    endpoint: 'env-validator',
    name: '🔐  Validador de Variáveis de Ambiente & Leaks (.env)',
    desc: 'Mapeia process.env, valida contra .env.example e gera schema Zod.'
  },
  {
    id: 'impact_analysis',
    endpoint: 'impact-analysis',
    name: '💥  Análise de Impacto de Mudanças (AST Blast Radius)',
    desc: 'Rastreia arquivos dependentes e testes impactados antes do commit.'
  },
  {
    id: 'architectural_drift_detector',
    endpoint: 'architecture-drift',
    name: '🏗️  Detector de Violações de Arquitetura Limpa & Ciclos',
    desc: 'Identifica acoplamento indevido e dependências circulares.'
  },
  {
    id: 'dead_code_pruner',
    endpoint: 'dead-code-pruner',
    name: '✂️  Detecção de Código Morto & Símbolos Órfãos (Tree-Shaking)',
    desc: 'Identifica funções, exports e imports não referenciados.'
  },
  {
    id: 'monorepo_package_graph_analyzer',
    endpoint: 'monorepo-graph',
    name: '📦  Grafo de Monorepo & Topologia de Build (pnpm, turbo, nx)',
    desc: 'Mapeia pacotes internos e ordem de compilação.'
  },
  {
    id: 'docstring_api_doc_generator',
    endpoint: 'doc-generator',
    name: '📝  Gerador de Docstrings & Referência de API (TSDoc / Markdown)',
    desc: 'Documenta automaticamente funções e interfaces públicas.'
  },
  {
    id: 'sql_schema_orm_contract_generator',
    endpoint: 'sql-orm-contract',
    name: '🗄️  Contratos de Esquema SQL / ORM (Prisma, SQL, Drizzle)',
    desc: 'Converte schemas de banco em tipagens TypeScript prontas.'
  },
  {
    id: 'skills_contract',
    endpoint: 'skills',
    name: '🧩  Contratos de Habilidades de Refatoração (Hotspots)',
    desc: 'Diretivas de encapsulamento e regras de refatoração para IA.'
  }
];

// ANSI Colors & Styles
const c = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',
  cyan: '\x1b[36m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  red: '\x1b[31m',
  gray: '\x1b[90m',
};

function renderHeader() {
  console.clear();
  console.log(`${c.cyan}${c.bold}╔════════════════════════════════════════════════════════════════════════════╗${c.reset}`);
  console.log(`${c.cyan}${c.bold}║       🧠 MRCP ENGINE — TERMINAL DEVELOPER CONTROL PANEL v2.4.1             ║${c.reset}`);
  console.log(`${c.cyan}${c.bold}║       Machine-Readable Context Protocol • Engenharia de AST Sem Alucinação ║${c.reset}`);
  console.log(`${c.cyan}${c.bold}╚════════════════════════════════════════════════════════════════════════════╝${c.reset}\n`);
}

/**
 * Prompts user for text input
 */
function promptText(question, defaultValue = '') {
  return new Promise((resolve) => {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });
    const promptMsg = defaultValue
      ? `${c.bold}${question}${c.reset} ${c.gray}(default: ${defaultValue})${c.reset}: `
      : `${c.bold}${question}${c.reset}: `;

    rl.question(promptMsg, (answer) => {
      rl.close();
      resolve(answer.trim() || defaultValue);
    });
  });
}

/**
 * Interactive Multi-Select Menu using raw terminal keystrokes
 */
async function selectToolsInteractive() {
  return new Promise((resolve) => {
    let cursor = 0;
    // Default: Full Suite selected
    const selected = new Set([0]);

    function draw() {
      readline.cursorTo(process.stdout, 0, 8);
      readline.clearScreenDown(process.stdout);

      console.log(`${c.yellow}${c.bold}⚡ SELECIONE AS FERRAMENTAS PARA EXECUTAR:${c.reset}`);
      console.log(`${c.gray}   (Navegue com ${c.bold}↑ / ↓${c.reset}${c.gray}, use ${c.bold}ESPAÇO${c.reset}${c.gray} para marcar/desmarcar, pressione ${c.bold}ENTER${c.reset}${c.gray} para rodar)${c.reset}\n`);

      AVAILABLE_TOOLS.forEach((tool, index) => {
        const isCurrent = index === cursor;
        const isChecked = selected.has(index);

        const checkMark = isChecked ? `${c.green}[✓]${c.reset}` : `${c.gray}[ ]${c.reset}`;
        const prefix = isCurrent ? `${c.cyan}❯ ${c.reset}` : '  ';
        const nameColor = isCurrent ? `${c.bold}${c.cyan}` : c.reset;

        console.log(`${prefix}${checkMark} ${nameColor}${tool.name}${c.reset}`);
        if (isCurrent) {
          console.log(`     ${c.dim}${tool.desc}${c.reset}`);
        }
      });

      console.log(`\n${c.gray}────────────────────────────────────────────────────────────────────────${c.reset}`);
      const count = selected.size;
      console.log(`${c.bold}Ferramentas selecionadas:${c.reset} ${c.green}${count}${c.reset} de ${AVAILABLE_TOOLS.length} | ${c.yellow}Pressione ENTER para iniciar${c.reset}`);
    }

    if (process.stdin.isTTY) {
      process.stdin.setRawMode(true);
    }
    process.stdin.resume();
    process.stdin.setEncoding('utf8');

    draw();

    function onKeypress(key) {
      // Ctrl+C / Escape to exit safely
      if (key === '\u0003' || key === '\u001b\u001b') {
        if (process.stdin.isTTY) process.stdin.setRawMode(false);
        process.stdin.pause();
        process.exit(0);
      }

      // Up arrow
      if (key === '\u001b[A') {
        cursor = (cursor - 1 + AVAILABLE_TOOLS.length) % AVAILABLE_TOOLS.length;
        draw();
      }
      // Down arrow
      else if (key === '\u001b[B') {
        cursor = (cursor + 1) % AVAILABLE_TOOLS.length;
        draw();
      }
      // Spacebar
      else if (key === ' ') {
        if (cursor === 0) {
          // If toggling Full Suite
          if (selected.has(0)) {
            selected.delete(0);
          } else {
            selected.clear();
            selected.add(0);
          }
        } else {
          selected.delete(0);
          if (selected.has(cursor)) {
            selected.delete(cursor);
          } else {
            selected.add(cursor);
          }
        }
        draw();
      }
      // Enter
      else if (key === '\r' || key === '\n') {
        process.stdin.removeListener('data', onKeypress);
        if (process.stdin.isTTY) {
          process.stdin.setRawMode(false);
        }
        process.stdin.resume();

        const selectedTools = Array.from(selected).map((idx) => AVAILABLE_TOOLS[idx]);
        if (selectedTools.length === 0) {
          selectedTools.push(AVAILABLE_TOOLS[0]);
        }
        resolve(selectedTools);
      }
    }

    process.stdin.on('data', onKeypress);
  });
}

/**
 * Execute tools and display progress & reports
 */
async function executeSelectedTools(repoUrl, tools) {
  console.log(`\n\n${c.cyan}${c.bold}🚀 INICIANDO PROCESSAMENTO NO MRCP ENGINE...${c.reset}`);
  console.log(`${c.gray}Alvo:${c.reset} ${c.bold}${repoUrl}${c.reset}`);
  console.log(`${c.gray}Servidor:${c.reset} ${MRCP_API_BASE}\n`);

  const reportsDir = join(process.cwd(), 'reports');
  if (!existsSync(reportsDir)) {
    mkdirSync(reportsDir, { recursive: true });
  }

  const results = [];

  for (const tool of tools) {
    process.stdout.write(`${c.yellow}⏳ Executando ${c.bold}${tool.name}${c.reset}... `);
    const startTime = Date.now();

    try {
      const url = `${MRCP_API_BASE}/api/${tool.endpoint}?repo=${encodeURIComponent(repoUrl)}`;
      const res = await fetch(url);

      if (!res.ok) {
        const errText = await res.text().catch(() => '');
        throw new Error(`HTTP ${res.status} ${errText}`.trim());
      }

      const json = await res.json();
      const elapsed = Date.now() - startTime;
      console.log(`${c.green}✔ CONCLUÍDO (${elapsed}ms)${c.reset}`);

      // Fetch markdown version
      let md = '';
      try {
        const mdRes = await fetch(`${url}&format=markdown`);
        if (mdRes.ok) md = await mdRes.text();
      } catch {}

      // Save files locally
      const outJsonReports = join(reportsDir, `MRCP_${tool.endpoint.toUpperCase().replace(/-/g, '_')}.json`);
      const outMdReports = join(reportsDir, `MRCP_${tool.endpoint.toUpperCase().replace(/-/g, '_')}.md`);

      writeFileSync(outJsonReports, JSON.stringify(json, null, 2), 'utf-8');
      if (md) {
        writeFileSync(outMdReports, md, 'utf-8');
      }

      // If full suite, also save root executive report
      if (tool.isSuite) {
        const rootJson = join(process.cwd(), CACHE_FILE);
        const rootMd = join(process.cwd(), 'MRCP_EXECUTIVE_REPORT.md');
        writeFileSync(rootJson, JSON.stringify(json, null, 2), 'utf-8');
        if (md) writeFileSync(rootMd, md, 'utf-8');
      }

      results.push({ tool, json, md, elapsed });
    } catch (err) {
      console.log(`${c.red}✖ ERRO: ${err.message}${c.reset}`);
      results.push({ tool, error: err.message });
    }
  }

  console.log(`\n${c.green}${c.bold}🎉 TODAS AS ETAPAS SELECIONADAS FORAM PROCESSADAS!${c.reset}`);
  console.log(`${c.gray}────────────────────────────────────────────────────────────────────────${c.reset}`);
  console.log(`📁 ${c.bold}Relatórios Gravados em:${c.reset} ${c.cyan}${reportsDir}/${c.reset}`);
  console.log(`📄 ${c.bold}Arquivo Consolidado JSON:${c.reset} ${c.cyan}${join(process.cwd(), CACHE_FILE)}${c.reset}`);
  console.log(`📝 ${c.bold}Dashboard Executivo Markdown:${c.reset} ${c.cyan}${join(process.cwd(), 'MRCP_EXECUTIVE_REPORT.md')}${c.reset}\n`);

  // Exibir resumo do Markdown do primeiro relatório gerado
  const firstMd = results.find((r) => r.md)?.md;
  if (firstMd) {
    console.log(`${c.yellow}${c.bold}═════════════════ PRÉVIA DO RELATÓRIO TÉCNICO ═════════════════${c.reset}\n`);
    console.log(firstMd.slice(0, 1200) + (firstMd.length > 1200 ? `\n\n${c.gray}... [relatório completo disponível em ${reportsDir}/] ...${c.reset}` : ''));
    console.log(`\n${c.yellow}${c.bold}════════════════════════════════════════════════════════════════${c.reset}\n`);
  }
}

/**
 * Main Entrypoint for Terminal UI Dashboard
 */
export async function startInteractiveDashboard(initialRepo = '') {
  renderHeader();

  const repoUrl = await promptText(
    '🔗 Informe o Repositório GitHub (ou diretório local)',
    initialRepo || 'https://github.com/faelscarpato/mrcp-engine.git'
  );

  renderHeader();
  console.log(`${c.bold}Repositório selecionado:${c.reset} ${c.cyan}${repoUrl}${c.reset}\n`);

  const selectedTools = await selectToolsInteractive();
  await executeSelectedTools(repoUrl, selectedTools);

  console.log(`${c.cyan}Dica: Você pode reexecutar a qualquer momento com:${c.reset} ${c.bold}npx mrcp-engine setup${c.reset} ou ${c.bold}npx mrcp-engine <url>${c.reset}\n`);

  // Safe exit without libuv assertion race conditions on Windows
  if (process.stdin.isTTY) {
    process.stdin.setRawMode(false);
  }
  process.stdin.unref();
  setTimeout(() => {
    process.exit(0);
  }, 50);
}
