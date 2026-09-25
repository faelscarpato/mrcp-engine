/**
 * MRCP Engine — Tríade de Orquestração Autônoma
 * Tipos e Contratos Fundamentais (MCP Native)
 */

export type AgentRole =
  "TECH_LEAD" | "FRONTEND" | "BACKEND" | "DATABASE" | "QA_GATEKEEPER";

export type TaskStatus =
  "PENDING" | "IN_PROGRESS" | "VALIDATING" | "APPROVED" | "REJECTED" | "FAILED";

export interface ArchitecturalConstraint {
  ruleId: string;
  description: string;
  allowedImports: string[];
  forbiddenImports: string[];
  maxCyclomaticComplexity?: number;
}

export interface AgentTask {
  id: string;
  title: string;
  description: string;
  role: AgentRole;
  targetFiles: string[];
  architecturalRules: string[];
  constraints?: ArchitecturalConstraint;
  dependencies: string[];
  status: TaskStatus;
  assignedAgent: string;
  contextPayload?: string;
  retryCount: number;
  maxRetries: number;
  createdAt: number;
  updatedAt: number;
}

export interface GatekeeperViolation {
  ruleId: string;
  file: string;
  message: string;
  severity: "ERROR" | "WARNING";
  explanation: string;
  suggestedFix?: string;
  line?: number;
}

export interface GatekeeperValidationResult {
  isValid: boolean;
  timestamp: number;
  checkedFiles: string[];
  violations: GatekeeperViolation[];
  metrics: {
    maintainabilityIndex?: number;
    letterGrade?: "A" | "B" | "C" | "D" | "F";
    cyclicDependenciesCount: number;
    layerViolationsCount: number;
    godModulesCount: number;
    totalFilesChecked: number;
  };
  formattedCritique: string;
}

export interface ResearchFinding {
  query: string;
  timestamp: number;
  snippetSummary: string;
  urls: string[];
  recommendedPatterns: string[];
}

export interface ArchitecturePlan {
  projectName: string;
  macroGoal: string;
  targetDirectory: string;
  techStack: {
    frontend: string[];
    backend: string[];
    database: string[];
    tooling: string[];
  };
  directoryStructure: Record<string, string>;
  boundaries: {
    frontendAllowedImports: string[];
    backendForbiddenImports: string[];
    coreIsolated: boolean;
  };
  tasks: AgentTask[];
  researchSummary: ResearchFinding[];
}

export interface OrchestratorState {
  projectGoal: string;
  targetDir: string;
  phase:
    | "IDLE"
    | "RESEARCHING"
    | "PLANNING"
    | "DISPATCHING"
    | "WAITING_IDE_LLM"
    | "VALIDATING"
    | "APPROVED"
    | "COMPLETED"
    | "FAILED";
  plan: ArchitecturePlan | null;
  activeTaskId: string | null;
  tasks: AgentTask[];
  lastValidation: GatekeeperValidationResult | null;
  history: Array<{
    timestamp: number;
    phase: string;
    message: string;
  }>;
}

export interface McpDirectivePrompt {
  role: AgentRole;
  personaTitle: string;
  objective: string;
  activeTask: {
    id: string;
    title: string;
    targetFiles: string[];
    instructions: string[];
  };
  architecturalBoundaries: {
    allowedImports: string[];
    forbiddenImports: string[];
    guidelines: string[];
  };
  rejectionCritique?: string;
  requiredMcpTools: string[];
  outputExpectation: string;
}
