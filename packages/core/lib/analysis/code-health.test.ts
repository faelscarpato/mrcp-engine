import { describe, it, expect, vi, beforeEach } from "vitest";

const cachedGraph = { current: null as unknown };

vi.mock("../cache.js", () => ({
  getCachedAnalysis: async () => cachedGraph.current,
  setCachedAnalysis: async () => {},
}));

vi.mock("./pipeline.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./pipeline.js")>();
  return {
    ...actual,
    runAnalysis: async (opts: unknown) => {
      if (cachedGraph.current) {
        throw new Error(
          "runAnalysis não deveria ser chamado: grafo já no cache",
        );
      }
      return actual.runAnalysis(opts as never);
    },
  };
});

const { calculateCodeHealth } = await import("./code-health.js");

describe("MRCP Code Health & Maintainability Index Suite", () => {
  beforeEach(() => {
    cachedGraph.current = null;
  });

  it("should score local repository health accurately", async () => {
    const result = await calculateCodeHealth({
      repoUrl: ".",
    });

    expect(result).toBeDefined();
    expect(result.isApplicable).toBe(true);
    expect(result.maintainabilityIndex).toBeGreaterThan(70);
    expect(["A", "B"]).toContain(result.letterGrade);
    expect(result.summary.totalFiles).toBeGreaterThan(10);
    expect(Array.isArray(result.topRefactoringPriorities)).toBe(true);
  });

  // Regressão do fallback determinístico: ele semeia loc/complexidade por PRNG a
  // partir da URL. Se esses nós entrarem no cálculo, a API devolve um MI
  // inventado com aparência de medição real.
  it("não calcula Maintainability Index a partir de nós sintéticos", async () => {
    cachedGraph.current = {
      analysis: {
        nodes: [
          { id: "mod:a", label: "core", kind: "module", synthetic: true },
          {
            id: "file:src/core/index.ts",
            label: "index.ts",
            kind: "file",
            path: "src/core/index.ts",
            loc: 280,
            complexity: 14,
            synthetic: true,
          },
          {
            id: "file:src/core/types.ts",
            label: "types.ts",
            kind: "file",
            path: "src/core/types.ts",
            loc: 195,
            complexity: 9,
            synthetic: true,
          },
        ],
        edges: [
          { source: "mod:a", target: "file:src/core/index.ts", kind: "import" },
        ],
      },
    };

    const result = await calculateCodeHealth({ repoUrl: "acme/ghost" });

    expect(result.maintainabilityIndex).toBeNull();
    expect(result.letterGrade).toBeNull();
    expect(result.technicalDebtScore).toBeNull();
    // Nenhum agregado pode carregar os números semeados.
    expect(result.summary.totalLinesOfCode).toBeNull();
    expect(result.summary.averageComplexityPerFile).toBeNull();
    expect(result.limitations.join(" ")).toMatch(/LOC|complexidade|MI/i);
  });

  it("calcula MI normalmente quando os nós têm métricas reais", async () => {
    cachedGraph.current = {
      analysis: {
        nodes: [
          { id: "mod:a", label: "core", kind: "module" },
          {
            id: "file:src/core/index.ts",
            label: "index.ts",
            kind: "file",
            path: "src/core/index.ts",
            loc: 120,
            complexity: 4,
          },
        ],
        edges: [],
      },
    };

    const result = await calculateCodeHealth({ repoUrl: "acme/real" });

    expect(result.maintainabilityIndex).toBeGreaterThan(0);
    expect(result.summary.totalLinesOfCode).toBe(120);
  });
});
