import { describe, it, expect } from "vitest";
import { formatEndpointToMarkdown } from "./endpoint-formatters.js";

describe("formatEndpointToMarkdown", () => {
  const dummyHeader = {
    summary: {
      estimatedTokensWithoutMrcp: 100,
      estimatedTokensWithMrcp: 50,
      tokenSavingsPercent: 50,
    },
  };

  it("should format security_compliance_audit gracefully", () => {
    const data = {
      ...dummyHeader,
      security_audit: {
        auditPassed: false,
        totalVulnerabilities: 1,
        summary: { critical: 1, high: 0, medium: 0, low: 0 },
        vulnerabilities: [
          {
            id: "SEC-01",
            severity: "CRITICAL",
            category: "Auth",
            file: "auth.ts",
            line: 10,
            description: "Token ex",
            remediationSnippet: "Fix",
          },
        ],
      },
    };
    const result = formatEndpointToMarkdown(
      "security_compliance_audit",
      "repo",
      data,
    );
    expect(result).toContain("Auditoria Estática de Segurança & Conformidade");
    expect(result).toContain("VULNERABILIDADES DETECTADAS");
    expect(result).toContain("SEC-01");
  });

  it("should fallback to generic json dump if unknown endpoint", () => {
    const data = { ...dummyHeader, someData: 123 };
    const result = formatEndpointToMarkdown("unknown_endpoint", "repo", data);
    expect(result).toContain("Dados Estruturados da Análise");
    expect(result).toContain('"someData": 123');
  });

  it("should format dead_code_pruner correctly", () => {
    const data = {
      ...dummyHeader,
      dead_code_analysis: {
        totalDeadSymbolsFound: 1,
        treeShakingReady: true,
        deadSymbols: [
          { name: "Test", file: "test.ts", line: 1, kind: "function" },
        ],
      },
    };
    const result = formatEndpointToMarkdown("dead_code_pruner", "repo", data);
    expect(result).toContain("Detecção de Código Morto");
    expect(result).toContain("Pronto para Tree-Shaking:** Sim");
  });
});
