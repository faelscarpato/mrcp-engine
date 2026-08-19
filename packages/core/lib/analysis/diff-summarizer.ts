export interface DiffSummarizerOptions {
  diffContent: string;
  stripFormattingNoise?: boolean;
}

export interface DomainDiffChange {
  domain: string;
  filesModified: string[];
  functionsModified: string[];
  addedLinesCount: number;
  deletedLinesCount: number;
  summary: string;
  impactLevel: "LOW" | "MEDIUM" | "HIGH";
}

export interface DiffSummarizerResult {
  isApplicable: boolean;
  message?: string;
  originalDiffLines: number;
  summarizedTokensEstimate: number;
  tokenReductionPercentage: string;
  domainChanges: DomainDiffChange[];
  compactAstSummary: string;
  warnings: string[];
}

export async function summarizeGitDiff(options: DiffSummarizerOptions): Promise<DiffSummarizerResult> {
  const { diffContent, stripFormattingNoise = true } = options;
  const warnings: string[] = [];

  const rawLines = (diffContent || "").split("\n");
  const lines = stripFormattingNoise
    ? rawLines.filter((l) => !l.trim().match(/^(\/\/|\/\*|\*|\s*$)/))
    : rawLines;

  if (!diffContent || lines.length === 0 || !diffContent.includes("diff --git") && !diffContent.includes("--- a/")) {
    return {
      isApplicable: false,
      message: "Não se aplica: Conteúdo de git diff vazio ou em formato inválido.",
      originalDiffLines: rawLines.length,
      summarizedTokensEstimate: 0,
      tokenReductionPercentage: "0%",
      domainChanges: [],
      compactAstSummary: "",
      warnings: ["Formato de diff não reconhecido."]
    };
  }

  const fileLines = rawLines.filter((l) => l.startsWith("diff --git") || l.startsWith("+++ b/"));
  const modifiedFiles = Array.from(
    new Set(fileLines.map((l) => l.replace(/^diff --git a\/.*? b\//, "").replace(/^\+\+\+ b\//, "")))
  ).filter((f) => f.length > 0 && f !== "/dev/null");

  if (modifiedFiles.length === 0) {
    return {
      isApplicable: false,
      message: "Não se aplica: Nenhum arquivo modificado detectado no diff fornecido.",
      originalDiffLines: rawLines.length,
      summarizedTokensEstimate: 0,
      tokenReductionPercentage: "0%",
      domainChanges: [],
      compactAstSummary: "",
      warnings
    };
  }

  // Agrupamento por domínio / pasta
  const domainMap = new Map<
    string,
    { files: Set<string>; functions: Set<string>; added: number; deleted: number }
  >();

  let currentFile = "";
  let currentDomain = "root";

  for (const line of rawLines) {
    if (line.startsWith("diff --git") || line.startsWith("+++ b/")) {
      const parsedFile = line.replace(/^diff --git a\/.*? b\//, "").replace(/^\+\+\+ b\//, "");
      if (parsedFile && parsedFile !== "/dev/null") {
        currentFile = parsedFile;
        currentDomain = currentFile.split("/")[0] || "root";
        if (!domainMap.has(currentDomain)) {
          domainMap.set(currentDomain, {
            files: new Set(),
            functions: new Set(),
            added: 0,
            deleted: 0
          });
        }
        domainMap.get(currentDomain)!.files.add(currentFile);
      }
    } else if (line.startsWith("@@")) {
      // Extrai nome de função do cabeçalho do hunk @@ ... @@ functionName
      const hunkHeaderMatch = line.match(/@@\s+[^@]+@@\s*(.*)$/);
      if (hunkHeaderMatch && hunkHeaderMatch[1].trim()) {
        const signature = hunkHeaderMatch[1].trim().split("(")[0].trim();
        if (signature && domainMap.has(currentDomain)) {
          domainMap.get(currentDomain)!.functions.add(signature);
        }
      }
    } else if (line.startsWith("+") && !line.startsWith("+++")) {
      if (domainMap.has(currentDomain)) domainMap.get(currentDomain)!.added++;
    } else if (line.startsWith("-") && !line.startsWith("---")) {
      if (domainMap.has(currentDomain)) domainMap.get(currentDomain)!.deleted++;
    }
  }

  const domainChanges: DomainDiffChange[] = Array.from(domainMap.entries()).map(([domain, data]) => {
    const filesList = Array.from(data.files);
    const funcsList = Array.from(data.functions);
    const totalChanges = data.added + data.deleted;

    let impactLevel: "LOW" | "MEDIUM" | "HIGH" = "LOW";
    if (filesList.length > 3 || totalChanges > 100) impactLevel = "HIGH";
    else if (filesList.length > 1 || totalChanges > 20) impactLevel = "MEDIUM";

    const funcSummary = funcsList.length > 0 ? ` (Funções alteradas: ${funcsList.slice(0, 3).join(", ")})` : "";
    const summary = `Módulo '${domain}': ${filesList.length} arquivo(s) [+${data.added}/-${data.deleted}]${funcSummary}.`;

    return {
      domain,
      filesModified: filesList,
      functionsModified: funcsList,
      addedLinesCount: data.added,
      deletedLinesCount: data.deleted,
      summary,
      impactLevel
    };
  });

  const summarizedTokens = domainChanges.length * 45;
  const originalTokens = Math.max(1, Math.round(rawLines.length * 4));
  const reductionPct = Math.max(0, Math.min(95, Math.round(((originalTokens - summarizedTokens) / originalTokens) * 100)));

  return {
    isApplicable: true,
    originalDiffLines: rawLines.length,
    summarizedTokensEstimate: summarizedTokens,
    tokenReductionPercentage: `${reductionPct}%`,
    domainChanges,
    compactAstSummary: `=== SEMANTIC AST DIFF SUMMARY ===\nModified Domains (${domainChanges.length}):\n${domainChanges.map((d) => `- [${d.domain}] ${d.summary}`).join("\n")}`,
    warnings
  };
}
