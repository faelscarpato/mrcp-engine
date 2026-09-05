export interface MrcpSymbolParameter {
  name: string;
  type?: string;
  optional?: boolean;
}

export interface MrcpComplexityDetails {
  complexity: number | null;
  analysisMethod:
    "ast-walker" | "tree-sitter" | "regex-scanner" | "unavailable";
  confidence: "high" | "medium" | "low";
  limitation?: string;
}

export interface MrcpSymbol {
  name: string;
  kind:
    | "function"
    | "class"
    | "interface"
    | "variable"
    | "type"
    | "enum"
    | "method";
  signature: string;
  line: number;
  endLine?: number;
  complexity: number;
  complexityDetails: MrcpComplexityDetails;
  isExported: boolean;
  isAsync?: boolean;
  generics?: string;
  parameters?: MrcpSymbolParameter[];
  returnType?: string;
  properties?: string[]; // For interfaces, type aliases, and enums
  methods?: string[]; // For classes
  hasTests: boolean;
}

export interface MrcpFileAnalysis {
  path: string;
  relativePath: string;
  size: number;
  language: string;
  linesCount: number;
  complexity: number;
  isGodModule?: boolean;
  godModuleReason?: string;
  symbols: MrcpSymbol[];
  imports: string[];
  exports: string[];
  envUsages: Array<{ name: string; line: number }>;
  securityIssues: MrcpSecurityIssue[];
}

export interface MrcpGodModuleItem {
  file: string;
  linesCount: number;
  complexity: number;
  reason: string;
}

export interface MrcpSecurityIssue {
  id: string;
  rule: string;
  severity: "critical" | "high" | "medium" | "low";
  message: string;
  file: string;
  line: number;
  remediation?: string;
}

export interface MrcpEnvIssue {
  variableName: string;
  file: string;
  line: number;
  status: "missing_in_env" | "missing_in_example" | "hardcoded_secret";
}

export interface MrcpDependencyCycle {
  files: string[];
  length: number;
}

export interface MrcpTestGap {
  file: string;
  functionName: string;
  line: number;
  type: string;
  complexity: number;
}

export interface MrcpDeadCodeItem {
  file: string;
  symbolName: string;
  kind: string;
  line: number;
  reason?: string;
}

export interface MrcpApiRoute {
  method: "GET" | "POST" | "PUT" | "DELETE" | "PATCH" | "OPTIONS" | "HEAD";
  acceptedMethods: string[];
  path: string;
  file: string;
  line: number;
  handler: string;
  aliases: string[];
  source: "static-condition" | "file-based" | "express-route" | "mcp-protocol";
  description?: string;
}

export interface MrcpDocItem {
  file: string;
  format: string;
  size: number;
  wordCount: number;
  qualityScore: number;
}

export interface MrcpDuplicateModule {
  primary: string;
  duplicate: string;
  contentEquivalent: boolean;
  risk: "low" | "medium" | "high";
}

export interface MrcpProvenanceMetadata {
  generatedAt: string;
  analyzerVersion: string;
  repositoryRevision: string;
  source: "local-workspace";
  workspaceFingerprint: string;
  includedExtensions: string[];
  excludedDirectories: string[];
  calculationVersion: string;
  cache: {
    used: boolean;
    valid: boolean;
    reason: string | null;
  };
}

export interface MrcpSuiteResult {
  workspaceRoot: string;
  timestamp: string;
  totalDurationMs: number;
  provenance: MrcpProvenanceMetadata;
  summary: {
    healthScore: number;
    letterGrade: "A" | "B" | "C" | "D" | "F";
    maintainabilityIndex: number;
    totalFiles: number;
    totalLinesOfCode: number;
    totalSymbols: number;
    avgComplexity: number;
    godModulesCount: number;
    securityIssuesCount: number;
    missingEnvCount: number;
    dependencyCyclesCount: number;
    testGapsCount: number;
    deadCodeCount: number;
    apiRoutesCount: number;
    documentsCount: number;
    documentQualityScore: number;
    estimatedTokensWithoutMrcp: number;
    estimatedTokensWithMrcp: number;
    tokenSavingsPercent: number;
  };
  godModules: MrcpGodModuleItem[];
  duplicateModules: MrcpDuplicateModule[];
  files: MrcpFileAnalysis[];
  securityIssues: MrcpSecurityIssue[];
  envIssues: MrcpEnvIssue[];
  dependencyCycles: MrcpDependencyCycle[];
  testGaps: MrcpTestGap[];
  deadCodeItems: MrcpDeadCodeItem[];
  apiRoutes: MrcpApiRoute[];
  documents: MrcpDocItem[];
}
