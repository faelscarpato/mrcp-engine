export interface DiffSummarizerOptions {
  diffContent: string;
  stripFormattingNoise?: boolean;
}

export interface DomainDiffChange {
  domain: string;
  filesModified: string[];
<<<<<<< HEAD
  functionsModified: string[];
  addedLinesCount: number;
  deletedLinesCount: number;
=======
>>>>>>> bf27a4ca35ecf7a0a9b0f4e1680cca22cc24f407
  summary: string;
  impactLevel: "LOW" | "MEDIUM" | "HIGH";
}

export interface DiffSummarizerResult {
<<<<<<< HEAD
  isApplicable: boolean;
  message?: string;
=======
>>>>>>> bf27a4ca35ecf7a0a9b0f4e1680cca22cc24f407
  originalDiffLines: number;
  summarizedTokensEstimate: number;
  tokenReductionPercentage: string;
  domainChanges: DomainDiffChange[];
  compactAstSummary: string;
<<<<<<< HEAD
  warnings: string[];
=======
>>>>>>> bf27a4ca35ecf7a0a9b0f4e1680cca22cc24f407
}

export async function summarizeGitDiff(options: DiffSummarizerOptions): Promise<DiffSummarizerResult> {
  const { diffContent, stripFormattingNoise = true } = options;
<<<<<<< HEAD
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
=======

  const lines = diffContent.split("\n");
  const fileLines = lines.filter((l) => l.startsWith("diff --git") || l.startsWith("+++ b/"));

  const modifiedFiles = Array.from(
    new Set(fileLines.map((l) => l.replace(/^diff --git a\/.*? b\//, "").replace(/^\+\+\+ b\//, "")))
  ).filter((f) => f.length > 0);

  const domainMap = new Map<string, string[]>();
  for (const file of modifiedFiles) {
    const domain = file.split("/")[0] || "core";
    if (!domainMap.has(domain)) domainMap.set(domain, []);
    domainMap.get(domain)!.push(file);
  }

  const domainChanges: DomainDiffChange[] = Array.from(domainMap.entries()).map(([domain, files]) => ({
    domain,
    filesModified: files,
    summary: `Alterações no módulo/domínio '${domain}' afetando ${files.length} arquivo(s).`,
    impactLevel: files.length > 3 ? "HIGH" : "MEDIUM"
  }));

  const tokenReductionPercentage = `${Math.min(95, Math.max(70, 100 - Math.round((domainChanges.length * 50 / (lines.length * 3 + 1)) * 100)))}%`;

  return {
    originalDiffLines: lines.length,
    summarizedTokensEstimate: domainChanges.length * 40,
    tokenReductionPercentage,
    domainChanges,
    compactAstSummary: `=== SEMANTIC AST DIFF SUMMARY ===\nModified Domains (${domainChanges.length}):\n${domainChanges.map((d) => `- [${d.domain}] ${d.summary} (${d.filesModified.join(", ")})`).join("\n")}`
>>>>>>> bf27a4ca35ecf7a0a9b0f4e1680cca22cc24f407
  };
}
