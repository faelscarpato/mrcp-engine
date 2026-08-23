// Tool definitions for MRCP-Engine MCP Server
export const TOOLS = [
  // --- Category: Core Engine ---
  {
    name: "analyze_repository",
    description:
      "[Category: Core Engine] Analyzes the structural AST graph of a GitHub repository. Returns nodes (files, modules, functions), edges (dependencies), metrics (complexity, coupling, hotspots), and architecture insights. Use this to understand a codebase without reading raw files.",
    inputSchema: {
      type: "object",
      properties: {
        repo: {
          type: "string",
          description:
            "Full URL of the GitHub repository (e.g., https://github.com/user/project)",
        },
      },
      required: ["repo"],
    },
  },
  {
    name: "get_repository_skills_contract",
    description:
      "[Category: Core Engine] Returns actionable skill contracts for hotspot files in a repository. Each contract includes the detected language, complexity metrics, structural status, dependency shielding rules, and strict directives for refactoring. Use after analyze_repository to get improvement recommendations.",
    inputSchema: {
      type: "object",
      properties: {
        repo: {
          type: "string",
          description: "Full URL of the GitHub repository",
        },
      },
      required: ["repo"],
    },
  },
  {
    name: "mrcp_run_full_repository_suite",
    description:
      "[Category: Core Engine / Full Suite] Runs all 12 repository intelligence tools in a single automated pipeline (AST Graph, Skills Contracts, Code Health, Security Audit, Architecture Drift, Test Gaps, Dead Code, Env Validator, API Contracts, Monorepo Topology, Docstrings, SQL Schema). Progressively saves results to mrcp-analysis.json and returns a complete executive dashboard report.",
    inputSchema: {
      type: "object",
      properties: {
        repo: {
          type: "string",
          description: "Full URL or path of the GitHub repository or local directory",
        },
        taskContext: {
          type: "string",
          description: "Optional context or task description to guide the diagnostic focus",
        },
      },
      required: ["repo"],
    },
  },

  // --- Category: Predictive & Security Engineering ---
  {
    name: "mrcp_impact_analysis",
    description:
      "[Category: Predictive & Security Engineering] Calculates the AST Blast Radius of code changes. Traces downstream impacted files, functions, and unit tests before committing.",
    inputSchema: {
      type: "object",
      properties: {
        repo: { type: "string", description: "Full URL of the GitHub repository" },
        modifiedFiles: { type: "array", items: { type: "string" }, description: "List of modified file paths" },
        diffContent: { type: "string", description: "Optional git diff string" }
      },
      required: ["repo", "modifiedFiles"]
    }
  },
  {
    name: "mrcp_security_compliance_audit",
    description:
      "[Category: Predictive & Security Engineering] Performs static AST security audit (OWASP, hardcoded secrets, unsafe execution, package licenses).",
    inputSchema: {
      type: "object",
      properties: {
        repo: { type: "string", description: "Full URL of the GitHub repository" },
        severityThreshold: { type: "string", enum: ["LOW", "MEDIUM", "HIGH", "CRITICAL"], default: "LOW" }
      },
      required: ["repo"]
    }
  },
  {
    name: "mrcp_architectural_drift_detector",
    description:
      "[Category: Predictive & Security Engineering] Detects architectural drift, circular dependencies, and cross-layer violations against Clean Architecture.",
    inputSchema: {
      type: "object",
      properties: {
        repo: { type: "string", description: "Full URL of the GitHub repository" },
        architectureType: { type: "string", enum: ["CLEAN_ARCHITECTURE", "HEXAGONAL", "FEATURE_FIRST", "LAYERED"], default: "CLEAN_ARCHITECTURE" },
        maxAllowedCyclicDependencies: { type: "number", default: 0 }
      },
      required: ["repo"]
    }
  },
  {
    name: "mrcp_auto_test_coverage_gap_finder",
    description:
      "[Category: Predictive & Security Engineering] Maps high-complexity function nodes against tests to identify uncovered gaps and generate Vitest/Jest stubs.",
    inputSchema: {
      type: "object",
      properties: {
        repo: { type: "string", description: "Full URL of the GitHub repository" },
        targetHotspotsOnly: { type: "boolean", default: true },
        generateStubs: { type: "boolean", default: true }
      },
      required: ["repo"]
    }
  },
  {
    name: "mrcp_context_pruning_pack",
    description:
      "[Category: Predictive & Security Engineering] Slices a minimal, hyper-focused AST context prompt pack for a specific task to optimize LLM token budget.",
    inputSchema: {
      type: "object",
      properties: {
        repo: { type: "string", description: "Full URL of the GitHub repository" },
        taskDescription: { type: "string", description: "Description of the user task for the LLM" },
        maxTokenBudget: { type: "number", default: 8000 }
      },
      required: ["repo", "taskDescription"]
    }
  },

  // --- Category: High-Efficiency Agent Offloading ---
  {
    name: "mrcp_ast_refactor_applier",
    description:
      "[Category: High-Efficiency Agent Offloading] Applies deterministic AST refactoring (rename symbols, extract interfaces, update imports) in batch without LLM token cost.",
    inputSchema: {
      type: "object",
      properties: {
        action: { type: "string", enum: ["RENAME_SYMBOL", "EXTRACT_INTERFACE", "UPDATE_IMPORT"] },
        targetSymbol: { type: "string", description: "Target symbol name or import specifier to refactor" },
        newSymbolName: { type: "string", description: "New name or replacement import path" },
        targetFilePath: { type: "string", description: "Path to the file to modify" },
        dryRun: { type: "boolean", default: true, description: "Whether to simulate changes without writing to disk (default: true for safety)" }
      },
      required: ["action", "targetSymbol", "targetFilePath"]
    }
  },
  {
    name: "mrcp_type_signature_extractor",
    description:
      "[Category: High-Efficiency Agent Offloading] Extracts only TypeScript, Python, Go, Rust, or JS type signatures and interfaces, eliminating implementation body tokens.",
    inputSchema: {
      type: "object",
      properties: {
        repo: { type: "string", description: "Full URL or path of the repository" },
        targetFilePath: { type: "string", description: "Optional specific file path to extract signatures from" }
      },
      required: ["repo"]
    }
  },
  {
    name: "mrcp_git_diff_semantic_summarizer",
    description:
      "[Category: High-Efficiency Agent Offloading] Strips whitespace/formatting noise from git diffs and summarizes changes by domain and modified functions.",
    inputSchema: {
      type: "object",
      properties: {
        diffContent: { type: "string", description: "Git diff output string" },
        stripFormattingNoise: { type: "boolean", default: true }
      },
      required: ["diffContent"]
    }
  },
  {
    name: "mrcp_dependency_compatibility_resolver",
    description:
      "[Category: High-Efficiency Agent Offloading] Queries the real NPM Registry to resolve package versions, peer dependency conflicts, deprecations, and breaking change risks.",
    inputSchema: {
      type: "object",
      properties: {
        packageName: { type: "string", description: "NPM package name (e.g. react, typescript)" },
        targetVersion: { type: "string", default: "latest", description: "Target SemVer version or tag (default: latest)" },
        repo: { type: "string", description: "Optional repository URL or path to check against local package.json" },
        manifestFilePath: { type: "string", description: "Optional path to package.json (default: package.json)" }
      },
      required: ["packageName"]
    }
  },
  {
    name: "mrcp_dead_code_pruner",
    description:
      "[Category: High-Efficiency Agent Offloading] Performs AST tree-shaking reachability analysis to identify unreferenced exports, dead variables, and unused imports.",
    inputSchema: {
      type: "object",
      properties: {
        repo: { type: "string", description: "Full URL of the GitHub repository" }
      },
      required: ["repo"]
    }
  },
  {
    name: "mrcp_sql_schema_orm_contract_generator",
    description:
      "[Category: High-Efficiency Agent Offloading] Parses real Prisma schemas, SQL DDL, or Drizzle/TypeORM models to expose typed DB tables, columns, foreign keys, and TypeScript interfaces.",
    inputSchema: {
      type: "object",
      properties: {
        repo: { type: "string", description: "Full URL or path of the repository" },
        schemaFilePath: { type: "string", description: "Optional path to schema file (e.g., schema.prisma, schema.sql)" }
      }
    }
  },
  {
    name: "mrcp_api_contract_generator",
    description:
      "[Category: High-Efficiency Agent Offloading] Scans codebase for API route handlers (Next.js, Express, Fastify, Hono, FastAPI, Flask) and outputs OpenAPI 3.0 specs and typed TypeScript SDK client.",
    inputSchema: {
      type: "object",
      properties: {
        repo: { type: "string", description: "Full URL or path of the repository" },
        frameworkHint: { type: "string", description: "Optional framework hint" }
      },
      required: ["repo"]
    }
  },
  {
    name: "mrcp_code_metrics_health_scorer",
    description:
      "[Category: Predictive & Security Engineering] Calculates Maintainability Index (MI 0-100), technical debt score, cognitive load distribution, and top 5 hotspot refactoring priorities.",
    inputSchema: {
      type: "object",
      properties: {
        repo: { type: "string", description: "Full URL or path of the repository" }
      },
      required: ["repo"]
    }
  },
  {
    name: "mrcp_env_secret_contract_validator",
    description:
      "[Category: Predictive & Security Engineering] Scans codebase for environment variables (process.env, os.environ), validates against .env.example, checks leaks, and generates typed Zod schemas.",
    inputSchema: {
      type: "object",
      properties: {
        repo: { type: "string", description: "Full URL or path of the repository" }
      },
      required: ["repo"]
    }
  },
  {
    name: "mrcp_monorepo_package_graph_analyzer",
    description:
      "[Category: High-Efficiency Agent Offloading] Maps monorepo workspace packages (pnpm, turbo, lerna, nx), internal dependencies, circular links, topological build order, and affected packages.",
    inputSchema: {
      type: "object",
      properties: {
        repo: { type: "string", description: "Full URL or path of the repository" },
        changedFiles: { type: "array", items: { type: "string" }, description: "Optional list of modified files" }
      },
      required: ["repo"]
    }
  },
  {
    name: "mrcp_docstring_api_doc_generator",
    description:
      "[Category: High-Efficiency Agent Offloading] Generates standardized TSDoc / JSDoc / Python docstrings and markdown API reference tables for undocumented public functions.",
    inputSchema: {
      type: "object",
      properties: {
        repo: { type: "string", description: "Full URL or path of the repository" },
        targetFilePath: { type: "string", description: "Optional single file path" },
        format: { type: "string", enum: ["TSDOC", "JSDOC", "PYTHON_DOCSTRING", "MARKDOWN"], default: "TSDOC" }
      },
      required: ["repo"]
    }
  },
  {
    name: "mrcp_document_analyzer",
    description:
      "[Category: Core Engine / Document Intelligence] Parses and analyzes non-code document repositories (CSV, TSV, TXT, MD, DOCX, XLSX, XLS, PDF, JSON, YAML, XML, LOG). Extracts structured knowledge graph, topic clusters, tabular schemas, data quality metrics, broken links, and LLM context contracts without requiring OCR.",
    inputSchema: {
      type: "object",
      properties: {
        repo: { type: "string", description: "Full URL or path of the document repository or local directory" },
        filterExtensions: { type: "array", items: { type: "string" }, description: "Optional array of file extensions to include (e.g. ['csv', 'md', 'docx', 'pdf'])" },
        maxFiles: { type: "number", default: 500, description: "Maximum number of document files to analyze (default: 500)" }
      },
      required: ["repo"]
    }
  },

  // --- Category: Triage & HR ---
  {
    name: "mrcp_triage_parse_resume",
    description:
      "[Category: Triage & HR] Deterministically extracts candidate name, email, and skills from raw resume text via regex and dictionary parsing.",
    inputSchema: {
      type: "object",
      properties: {
        content: { type: "string", description: "Raw resume text content" },
        contentType: { type: "string", description: "MIME or file type hint" },
      },
      required: ["content"],
    },
  },
  {
    name: "mrcp_triage_score_candidate",
    description:
      "[Category: Triage & HR] Calculates candidate match score against a job description using deterministic set theory and keyword overlap.",
    inputSchema: {
      type: "object",
      properties: {
        resumeData: { type: "object", description: "Parsed resume object from mrcp_triage_parse_resume" },
        jobDescription: { type: "string", description: "Job description text" },
      },
      required: ["resumeData", "jobDescription"],
    },
  },
  {
    name: "mrcp_triage_generate_hr_report",
    description:
      "[Category: Triage & HR] Generates formatted HR triage report summary from AI dossier evaluation.",
    inputSchema: {
      type: "object",
      properties: {
        candidateName: { type: "string" },
        targetRole: { type: "string" },
        aiDossierContent: { type: "string" },
      },
      required: ["candidateName", "targetRole", "aiDossierContent"],
    },
  },

  // --- Category: Web Scraper ---
  {
    name: "mrcp_web_search",
    description:
      "[Category: Web Scraper] Searches DuckDuckGo for relevant links, titles, and snippets without downloading full page bodies.",
    inputSchema: {
      type: "object",
      properties: {
        query: { type: "string", description: "Search query string" },
      },
      required: ["query"],
    },
  },
  {
    name: "mrcp_web_scrape",
    description:
      "[Category: Web Scraper] Fetches a URL and extracts clean sanitized text content, stripping navigation, ads, and scripts.",
    inputSchema: {
      type: "object",
      properties: {
        url: { type: "string", description: "Full URL to scrape" },
      },
      required: ["url"],
    },
  },
  {
    name: "mrcp_web_smart_search",
    description:
      "[Category: Web Scraper] Orchestrates search, keyword relevance ranking, and scrapes top N matching pages simultaneously.",
    inputSchema: {
      type: "object",
      properties: {
        query: { type: "string", description: "Deep search topic" },
        topN: { type: "number", description: "Number of top links to scrape (default: 2)" },
        minScore: { type: "number", description: "Minimum relevance score threshold (default: 0)" },
      },
      required: ["query"],
    },
  },
];
