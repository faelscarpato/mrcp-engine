export const MCP_TOOLS = [
  {
    name: "analyze_repository",
    description:
      "Analyzes the structural AST graph of a GitHub repository. Returns nodes, edges, metrics, hotspots, and architecture insights. Use this to understand a codebase without reading raw files.",
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
      "Returns actionable skill contracts for hotspot files. Each contract includes language-specific directives for refactoring critical modules.",
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
      "Runs all 12 repository intelligence tools in a single automated pipeline (AST Graph, Skills Contracts, Code Health, Security Audit, Architecture Drift, Test Gaps, Dead Code, Env Validator, API Contracts, Monorepo Topology, Docstrings, SQL Schema).",
    inputSchema: {
      type: "object",
      properties: {
        repo: {
          type: "string",
          description: "Full URL of the GitHub repository or local directory",
        },
        taskContext: {
          type: "string",
          description: "Optional context or task description",
        },
      },
      required: ["repo"],
    },
  },
  {
    name: "mrcp_impact_analysis",
    description:
      "Calculates the AST Blast Radius of code changes before committing.",
    inputSchema: {
      type: "object",
      properties: {
        repo: {
          type: "string",
          description: "Full URL of the GitHub repository",
        },
        modifiedFiles: {
          type: "array",
          items: { type: "string" },
          description: "List of modified file paths",
        },
      },
      required: ["repo", "modifiedFiles"],
    },
  },
  {
    name: "mrcp_security_compliance_audit",
    description:
      "Performs static AST security audit (OWASP, hardcoded secrets, unsafe execution).",
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
    name: "mrcp_architectural_drift_detector",
    description:
      "Detects architectural drift, circular dependencies, and cross-layer violations.",
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
    name: "mrcp_auto_test_coverage_gap_finder",
    description:
      "Maps high-complexity function nodes against tests to identify uncovered gaps and generate stubs.",
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
    name: "mrcp_context_pruning_pack",
    description:
      "Slices a minimal, hyper-focused AST context prompt pack for a specific task.",
    inputSchema: {
      type: "object",
      properties: {
        repo: {
          type: "string",
          description: "Full URL of the GitHub repository",
        },
        taskDescription: {
          type: "string",
          description: "Description of the task",
        },
      },
      required: ["repo", "taskDescription"],
    },
  },
  {
    name: "mrcp_ast_refactor_applier",
    description:
      "Applies deterministic AST refactoring in batch without LLM token cost.",
    inputSchema: {
      type: "object",
      properties: {
        action: { type: "string" },
        targetSymbol: { type: "string" },
        newSymbolName: { type: "string" },
      },
      required: ["action", "targetSymbol"],
    },
  },
  {
    name: "mrcp_type_signature_extractor",
    description:
      "Extracts only TypeScript .d.ts interfaces and type signatures from files.",
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
    name: "mrcp_git_diff_semantic_summarizer",
    description:
      "Strips formatting noise from git diffs and summarizes changes by business domain.",
    inputSchema: {
      type: "object",
      properties: { diffContent: { type: "string" } },
      required: ["diffContent"],
    },
  },
  {
    name: "mrcp_dependency_compatibility_resolver",
    description:
      "Resolves SemVer package version compatibility and peer dependency mismatches.",
    inputSchema: {
      type: "object",
      properties: { packageName: { type: "string" } },
      required: ["packageName"],
    },
  },
  {
    name: "mrcp_dead_code_pruner",
    description:
      "Performs AST tree-shaking reachability analysis to identify unreferenced exports.",
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
    name: "mrcp_sql_schema_orm_contract_generator",
    description:
      "Parses SQL DDL or ORM schemas to expose typed DB tables and queries.",
    inputSchema: {
      type: "object",
      properties: {
        repo: {
          type: "string",
          description: "Full URL of the GitHub repository",
        },
      },
    },
  },
  {
    name: "mrcp_api_contract_generator",
    description:
      "Extracts API routes and generates OpenAPI 3.0 specs and TypeScript client SDKs.",
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
    name: "mrcp_code_metrics_health_scorer",
    description:
      "Calculates Maintainability Index (MI 0-100), technical debt score, and top 5 hotspot refactoring priorities.",
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
    name: "mrcp_env_secret_contract_validator",
    description:
      "Scans codebase for environment variables, validates against .env.example, checks leaks, and generates typed Zod schemas.",
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
    name: "mrcp_monorepo_package_graph_analyzer",
    description:
      "Maps monorepo workspace packages, internal dependencies, topological build order, and affected packages.",
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
    name: "mrcp_docstring_api_doc_generator",
    description:
      "Generates standardized TSDoc / JSDoc / Python docstrings and markdown API reference tables for undocumented public functions.",
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
    name: "mrcp_document_analyzer",
    description:
      "Parses non-code document repositories (CSV, TSV, TXT, MD, DOCX, XLSX, XLS, PDF, JSON, YAML, XML, LOG). Extracts structured knowledge graph, tabular schemas, data quality metrics, broken links, and LLM context contracts without requiring OCR.",
    inputSchema: {
      type: "object",
      properties: {
        repo: {
          type: "string",
          description:
            "Full URL or path of the document repository or local directory",
        },
        filterExtensions: {
          type: "array",
          items: { type: "string" },
          description:
            "Optional array of file extensions to include (e.g. ['csv', 'md', 'docx', 'pdf'])",
        },
        maxFiles: {
          type: "number",
          default: 500,
          description:
            "Maximum number of document files to analyze (default: 500)",
        },
      },
      required: ["repo"],
    },
  },
];
