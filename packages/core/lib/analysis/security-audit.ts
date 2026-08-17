import { runAnalysis } from "./pipeline.js";
import { getCachedAnalysis } from "../cache.js";

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
}

const SEVERITY_WEIGHTS = {
  LOW: 1,
  MEDIUM: 2,
  HIGH: 3,
  CRITICAL: 4
};

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
    const path = node.path || node.label || "";

    // 1. Verificação de dependências externas para pacotes com vulnerabilidades ou licenças restritivas
    if (node.kind === "external") {
      const depName = node.label || "";

      if (depName.includes("eval") || depName.includes("vulnerable-pack")) {
        vulnerabilities.push({
          id: `SEC-${String(vulnCounter++).padStart(3, "0")}`,
          file: "package.json",
          category: "OUTDATED_VULNERABLE_DEP",
          severity: "HIGH",
          description: `Dependência vulnerável conhecida detectada: ${depName}.`,
          remediationSnippet: `npm update ${depName}`
        });
      }
    }

    // 2. Verificação de arquivos de configuração contendo potenciais segredos ou credenciais em texto claro
    if (
      path.endsWith(".env") ||
      path.endsWith(".env.local") ||
      path.endsWith("credentials.json") ||
      path.endsWith("config.json")
    ) {
      vulnerabilities.push({
        id: `SEC-${String(vulnCounter++).padStart(3, "0")}`,
        file: path,
        category: "HARDCODED_SECRET",
        severity: "CRITICAL",
        description: `Arquivo contendo segredos ou configurações sensíveis no repositório: ${path}.`,
        remediationSnippet: `Adicione ${path} ao .gitignore e use variáveis de ambiente seguras.`
      });
    }

    // 3. Verificação de padrões inseguros baseados em nós de arquivos JS/TS
    if (path.endsWith(".ts") || path.endsWith(".js") || path.endsWith(".mjs")) {
      // Exemplo de nós de alta complexidade acumulando execuções de shell sem sanitização
      if (node.complexity && node.complexity > 100) {
        vulnerabilities.push({
          id: `SEC-${String(vulnCounter++).padStart(3, "0")}`,
          file: path,
          category: "UNSAFE_SHELL_EXECUTION",
          severity: "MEDIUM",
          description: `Módulo de altíssima complexidade (${node.complexity}) com superfície de ataque ampliada.`,
          remediationSnippet: `Sanitize todas as entradas de usuário e isole funções de execução no módulo ${path}.`
        });
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
    summary
  };
}
