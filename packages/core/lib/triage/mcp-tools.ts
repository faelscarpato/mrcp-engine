/**
 * MCP (Model Context Protocol) — Ferramentas determinísticas de triagem de RH.
 *
 * Objetivo de arquitetura: executar o "trabalho sujo" (parsing por regex e
 * matemática de conjuntos) em Node.js, entregando ao Agente LLM apenas dados
 * estruturados e compactos. Isto poupa tokens porque a IA nunca vê o texto
 * bruto do currículo — apenas o JSON resultante.
 *
 * Nenhuma destas funções usa IA. Tudo é 100% determinístico.
 */

/** Skills reconhecidas pelo motor determinístico. */
export const KNOWN_SKILLS = [
  "javascript",
  "typescript",
  "python",
  "react",
  "node.js",
  "docker",
  "aws",
  "sql",
] as const

export type KnownSkill = (typeof KNOWN_SKILLS)[number]

// ---------------------------------------------------------------------------
// Tipos partilhados entre backend e frontend
// ---------------------------------------------------------------------------

export interface ParseResumeParams {
  content: string
  contentType?: string
}

export interface ParseResumeResult {
  candidate_name: string
  email: string
  skills: string[]
  raw_text_length: number
}

export interface ScoreCandidateParams {
  resumeData: ParseResumeResult
  jobDescription: string
}

export interface ScoreCandidateResult {
  match_score: number
  matched_keywords: string[]
  missing_keywords: string[]
  analysis_summary: string
}

export interface GenerateHrReportParams {
  candidateName: string
  targetRole: string
  aiDossierContent: string
}

export interface GenerateHrReportResult {
  status: "success"
  url: string
  parsedContent: string
}

export type McpToolName = "parse_resume" | "score_candidate" | "generate_hr_report"

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Cruza um texto qualquer com o dicionário KNOWN_SKILLS.
 * Usa limites de palavra para "node.js", "aws", etc., mas com escape seguro.
 */
function extractSkills(text: string): string[] {
  const lower = text.toLowerCase()
  const found = new Set<string>()

  for (const skill of KNOWN_SKILLS) {
    // Escapa caracteres especiais de regex (ex.: o "." em "node.js").
    const escaped = skill.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
    const pattern = new RegExp(`(?:^|[^a-z0-9.])${escaped}(?:$|[^a-z0-9])`, "i")
    if (pattern.test(lower)) {
      found.add(skill)
    }
  }

  return Array.from(found)
}

// ---------------------------------------------------------------------------
// Tool A: parse_resume  (regex determinístico, sem IA)
// ---------------------------------------------------------------------------

export function parseResume(params: ParseResumeParams): ParseResumeResult {
  const content = params.content ?? ""

  // Nome: primeira linha não vazia do documento.
  const firstLine =
    content
      .split("\n")
      .map((line) => line.trim())
      .find((line) => line.length > 0) ?? ""

  // Email: primeira ocorrência via regex.
  const emailMatches = content.match(
    /([a-zA-Z0-9._-]+@[a-zA-Z0-9._-]+\.[a-zA-Z0-9._-]+)/gi,
  )
  const email = emailMatches?.[0] ?? ""

  // Skills: interseção com o dicionário conhecido.
  const skills = extractSkills(content)

  return {
    candidate_name: firstLine,
    email,
    skills,
    raw_text_length: content.length,
  }
}

// ---------------------------------------------------------------------------
// Tool B: score_candidate  (teoria de conjuntos)
// ---------------------------------------------------------------------------

export function scoreCandidate(
  params: ScoreCandidateParams,
): ScoreCandidateResult {
  const candidateSkills = new Set(
    (params.resumeData?.skills ?? []).map((s) => s.toLowerCase()),
  )

  // Skills exigidas pela vaga, extraídas do mesmo dicionário.
  const required = extractSkills(params.jobDescription ?? "")
  const requiredSet = new Set(required)

  // Interseção: exigidas que o candidato tem.
  const matched = required.filter((skill) => candidateSkills.has(skill))

  // Diferença: exigidas que faltam ao candidato.
  const missing = required.filter((skill) => !candidateSkills.has(skill))

  // Score = (matched / required) * 100, arredondado.
  const score =
    requiredSet.size === 0
      ? 0
      : Math.round((matched.length / requiredSet.size) * 100)

  let summary: string
  if (requiredSet.size === 0) {
    summary =
      "Nenhuma skill reconhecida na descrição da vaga. Impossível calcular aderência."
  } else if (score >= 80) {
    summary = `Aderência forte (${score}%). O candidato cobre ${matched.length} de ${requiredSet.size} skills exigidas.`
  } else if (score >= 50) {
    summary = `Aderência parcial (${score}%). Faltam ${missing.length} skills: ${missing.join(", ")}.`
  } else {
    summary = `Aderência baixa (${score}%). O candidato só cobre ${matched.length} de ${requiredSet.size} skills exigidas.`
  }

  return {
    match_score: score,
    matched_keywords: matched,
    missing_keywords: missing,
    analysis_summary: summary,
  }
}

// ---------------------------------------------------------------------------
// Tool C: generate_hr_report  (PDF simulado)
// ---------------------------------------------------------------------------

export function generateHrReport(
  params: GenerateHrReportParams,
): GenerateHrReportResult {
  // Nota: o v0 não tem ambiente para instalar pdfkit, por isso simulamos a
  // geração do PDF devolvendo um link fictício e o conteúdo já formatado.
  const header = [
    "==============================================",
    "  PARECER DE TRIAGEM — RECURSOS HUMANOS",
    "==============================================",
    `Candidato:  ${params.candidateName || "N/D"}`,
    `Vaga alvo:  ${params.targetRole || "N/D"}`,
    `Gerado em:  ${new Date().toISOString()}`,
    "----------------------------------------------",
    "",
  ].join("\n")

  const parsedContent = header + (params.aiDossierContent ?? "")

  return {
    status: "success",
    url: "/reports/simulated-report.pdf",
    parsedContent,
  }
}
