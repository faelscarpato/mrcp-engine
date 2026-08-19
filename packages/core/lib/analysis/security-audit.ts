import { runAnalysis } from "./pipeline.js";
import { getCachedAnalysis } from "../cache.js";
import { fetchRepoFile } from "./repo-fetcher.js";

export interface SecurityAuditOptions {
  repoUrl: string;
  severityThreshold?: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
}

export interface SecurityVulnerability {
  id: string;
  file: string;
  line?: number;
  category:
    | "HARDCODED_SECRET"
    | "UNSAFE_DESERIALIZATION"
    | "SQL_INJECTION_RISK"
    | "OUTDATED_VULNERABLE_DEP"
    | "GPL_LICENSE_LEAK"
    | "UNSAFE_SHELL_EXECUTION";
  severity: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  description: string;
  remediationSnippet?: string;
}

export interface SecurityAuditResult {
  repoUrl: string;
  auditPassed: boolean;
  totalVulnerabilities: number;
  vulnerabilities: SecurityVulnerability[];
  summary: {
    critical: number;
    high: number;
    medium: number;
    low: number;
  };
  isApplicable: boolean;
  message?: string;
}

const SEVERITY_WEIGHTS = {
  LOW: 1,
  MEDIUM: 2,
  HIGH: 3,
  CRITICAL: 4
};

// Known sensitive filenames that must not be committed to source repositories
const SENSITIVE_FILENAME_PATTERNS = [
  /^\.env$/i,
  /^\.env\.(local|production|prod|development|dev|staging|stage)$/i,
  /credentials\.json$/i,
  /service[_-]?account(?:[_-]key)?\.json$/i,
  /firebase[_-]adminsdk.*\.json$/i,
  /google[_-]services\.json$/i,
  /client[_-]secret.*\.json$/i,
  /id_rsa$/i,
  /id_ed25519$/i,
  /id_ecdsa$/i,
  /\.(pem|pkcs12|pfx|p12|keystore|jks)$/i,
  /^secrets?\.(json|yaml|yml)$/i,
  /\/secrets?\.(json|yaml|yml)$/i
];

// Safe configuration files that should NEVER be flagged as sensitive secrets
const SAFE_CONFIG_ALLOWLIST = [
  "tsconfig.json",
  "jsconfig.json",
  "package.json",
  "package-lock.json",
  "pnpm-lock.yaml",
  "yarn.lock",
  "bun.lockb",
  "turbo.json",
  "vercel.json",
  "lerna.json",
  "nx.json",
  "docker-compose.yml",
  "docker-compose.yaml",
  "webpack.config.js",
  "vite.config.ts",
  "vite.config.js",
  "rollup.config.js",
  "eslint.config.js",
  ".eslintrc.json",
  ".prettierrc",
  ".prettierrc.json"
];

// Patterns for hardcoded secret detection in source code
const SECRET_REGEX_PATTERNS: Array<{ name: string; regex: RegExp; severity: "CRITICAL" | "HIGH" }> = [
  { name: "Private Key Header", regex: /-----BEGIN\s+(?:RSA|EC|OPENSSH|DSA|PGP)?\s*PRIVATE\s+KEY-----/, severity: "CRITICAL" },
  { name: "GitHub Personal Access Token", regex: /(?:ghp|gho|ghu|ghs|ghr)_[a-zA-Z0-9]{36}|github_pat_[a-zA-Z0-9_]{82}/, severity: "CRITICAL" },
  { name: "OpenAI API Key", regex: /\bsk-(?:proj-)?[a-zA-Z0-9_-]{32,}\b/, severity: "HIGH" },
  { name: "AWS Access Key ID", regex: /\b(?:AKIA|ABIA|ACCA|ASIA)[0-9A-Z]{16}\b/, severity: "HIGH" },
  { name: "Google API Key", regex: /\bAIzaSy[0-9A-Za-z_-]{33}\b/, severity: "HIGH" },
  { name: "Slack Token", regex: /\bxox[baprs]-[0-9a-zA-Z]{10,48}\b/, severity: "HIGH" },
  { name: "Hardcoded Password Assignment", regex: /(?:password|secret|apikey|api_key|access_token)\s*[:=]\s*["'][a-zA-Z0-9@#$%^&*!_+=-]{8,}["']/i, severity: "HIGH" }
];

export async function runSecurityAudit(options: SecurityAuditOptions): Promise<SecurityAuditResult> {
  const { repoUrl, severityThreshold = "LOW" } = options;

  let graphData = await getCachedAnalysis(repoUrl, false);
  if (!graphData) {
    graphData = await runAnalysis({
      repoUrl,
      githubToken: process.env.GITHUB_TOKEN,
      maxFiles: 2000
    });
  }

  const nodes: any[] = graphData?.analysis?.nodes || graphData?.nodes || [];
  const vulnerabilities: SecurityVulnerability[] = [];
  let vulnCounter = 1;

  for (const node of nodes) {
    const filePath = node.path || node.label || "";
    const fileName = filePath.split("/").pop() || "";
    const lowerPath = filePath.toLowerCase();

    // Skip node_modules and vendor
    if (lowerPath.includes("node_modules") || lowerPath.includes(".git")) {
      continue;
    }

    // 1. Verificação de dependências externas conhecidas vulneráveis
    if (node.kind === "external") {
      const depName = node.label || "";
      const vulnerableDeps: Record<string, string> = {
        "event-stream": "Pacote vulnerável com histórico de injeção de malware de roubo de carteira.",
        "flatmap-stream": "Pacote malicioso injetado como dependência de ataque supply-chain.",
        "colors": "Versões comprometidas (ex: 1.4.1/1.4.2) com loop infinito de negação de serviço.",
        "faker": "Versões sabotadas (ex: 6.6.6) que quebram a inicialização de sistemas.",
        "ua-parser-js": "Versões comprometidas historicamente com cryptominer e trojan.",
        "coa": "Versões sequestradas historicamente com injeção de malware."
      };

      if (vulnerableDeps[depName]) {
        vulnerabilities.push({
          id: `SEC-${String(vulnCounter++).padStart(3, "0")}`,
          file: "package.json",
          category: "OUTDATED_VULNERABLE_DEP",
          severity: "CRITICAL",
          description: `Dependência vulnerável/comprometida detectada: ${depName}. ${vulnerableDeps[depName]}`,
          remediationSnippet: `npm uninstall ${depName} && npm cache clean --force`
        });
      }
      continue;
    }

    // 2. Verificação de arquivos de configuração sensíveis / credenciais
    // Ignore explicit safe configs like tsconfig.json, package.json, etc.
    const isSafeConfig = SAFE_CONFIG_ALLOWLIST.includes(fileName.toLowerCase()) ||
      lowerPath.endsWith(".example") ||
      lowerPath.endsWith(".template") ||
      lowerPath.endsWith(".sample") ||
      lowerPath.endsWith(".dist");

    if (!isSafeConfig) {
      const isSensitiveFile = SENSITIVE_FILENAME_PATTERNS.some((pat) => pat.test(filePath) || pat.test(fileName));
      if (isSensitiveFile) {
        vulnerabilities.push({
          id: `SEC-${String(vulnCounter++).padStart(3, "0")}`,
          file: filePath,
          category: "HARDCODED_SECRET",
          severity: "CRITICAL",
          description: `Arquivo de credencial ou segredo em texto claro no repositório: ${filePath}.`,
          remediationSnippet: `Adicione ${filePath} ao .gitignore e remova o histórico do git usando git-filter-repo.`
        });
      }
    }

    // 3. Inspeção de Código-Fonte para Padrões Inseguros (Shell Execution, SQL Injection, Hardcoded Secrets)
    if (
      lowerPath.endsWith(".ts") ||
      lowerPath.endsWith(".tsx") ||
      lowerPath.endsWith(".js") ||
      lowerPath.endsWith(".jsx") ||
      lowerPath.endsWith(".mjs") ||
      lowerPath.endsWith(".py") ||
      lowerPath.endsWith(".go")
    ) {
      // Don't inspect test files for dummy passwords
      if (lowerPath.includes(".test.") || lowerPath.includes(".spec.") || lowerPath.includes("__tests__")) {
        continue;
      }

      const file = await fetchRepoFile(repoUrl, filePath);
      if (file && file.content) {
        const content = file.content;
        const lines = content.split("\n");

        // A. Hardcoded secret strings in code
        for (const pattern of SECRET_REGEX_PATTERNS) {
          const match = pattern.regex.exec(content);
          if (match) {
            // Ignore placeholders and environment variable references
            const matchSnippet = match[0];
            const isPlaceholder = /your_|dummy|test_|example|fake|xxx|<.*>|process\.env|os\.environ/i.test(matchSnippet);
            if (!isPlaceholder) {
              const lineNum = content.slice(0, match.index).split("\n").length;
              vulnerabilities.push({
                id: `SEC-${String(vulnCounter++).padStart(3, "0")}`,
                file: filePath,
                line: lineNum,
                category: "HARDCODED_SECRET",
                severity: pattern.severity,
                description: `Padrão de credencial embutida detectada (${pattern.name}) no código-fonte.`,
                remediationSnippet: `Substitua o valor estático por process.env.${pattern.name.replace(/[^A-Z0-9]/gi, "_").toUpperCase()} e defina no .env.`
              });
            }
          }
        }

        // B. Real Unsafe Shell Execution (eval / exec with dynamic concatenation)
        const unsafeEvalRegex = /\b(?:eval|Function)\s*\([^\)]*[\+\$\{][^\)]*\)/g;
        let em;
        while ((em = unsafeEvalRegex.exec(content)) !== null) {
          const lineNum = content.slice(0, em.index).split("\n").length;
          vulnerabilities.push({
            id: `SEC-${String(vulnCounter++).padStart(3, "0")}`,
            file: filePath,
            line: lineNum,
            category: "UNSAFE_SHELL_EXECUTION",
            severity: "HIGH",
            description: `Uso perigoso de eval() / Function() dinâmico com interpolação de strings em ${filePath}.`,
            remediationSnippet: `Evite eval() arbitrário. Utilize parsers seguros (ex: JSON.parse) ou estratégias de dispatch estático.`
          });
        }

        // C. SQL Injection Risks (raw string concatenation in queries)
        const sqlInjectionRegex = /(?:query|execute|raw)\s*\(\s*`\s*(?:SELECT|INSERT|UPDATE|DELETE|DROP)\s+[^`]*\$\{/gi;
        let sm;
        while ((sm = sqlInjectionRegex.exec(content)) !== null) {
          const lineNum = content.slice(0, sm.index).split("\n").length;
          vulnerabilities.push({
            id: `SEC-${String(vulnCounter++).padStart(3, "0")}`,
            file: filePath,
            line: lineNum,
            category: "SQL_INJECTION_RISK",
            severity: "HIGH",
            description: `Interpolação de variável dinâmica detectada em query SQL bruta no arquivo ${filePath}.`,
            remediationSnippet: `Utilize prepared statements com parâmetros parametrizados (ex: db.query('SELECT ... WHERE id = $1', [id])).`
          });
        }
      }
    }
  }

  // Filtragem por severidade mínima
  const minWeight = SEVERITY_WEIGHTS[severityThreshold] || 1;
  const filteredVulns = vulnerabilities.filter(
    (v) => SEVERITY_WEIGHTS[v.severity] >= minWeight
  );

  const summary = {
    critical: filteredVulns.filter((v) => v.severity === "CRITICAL").length,
    high: filteredVulns.filter((v) => v.severity === "HIGH").length,
    medium: filteredVulns.filter((v) => v.severity === "MEDIUM").length,
    low: filteredVulns.filter((v) => v.severity === "LOW").length
  };

  const auditPassed = summary.critical === 0 && summary.high === 0;

  return {
    repoUrl,
    auditPassed,
    totalVulnerabilities: filteredVulns.length,
    vulnerabilities: filteredVulns,
    summary,
    isApplicable: true,
    message: auditPassed
      ? `Auditoria estática de segurança APROVADA. 0 vulnerabilidades críticas ou altas encontradas.`
      : `Auditoria de segurança encontrou ${filteredVulns.length} alerta(s) de segurança (${summary.critical} Críticos, ${summary.high} Altos).`
  };
}
