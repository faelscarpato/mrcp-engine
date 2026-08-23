import fs from 'fs';
import path from 'path';

const MRCP_API_BASE = 'https://mrcp-engine.vercel.app';
const CACHE_FILE = 'mrcp-analysis.json';

function getCachedResult(repoUrl, type) {
  const cacheFile = path.join(process.cwd(), CACHE_FILE);
  if (fs.existsSync(cacheFile)) {
    try {
      const data = JSON.parse(fs.readFileSync(cacheFile, 'utf-8'));
      if (data.repoUrl === repoUrl && data[type]) {
        return data[type];
      }
    } catch(e) { /* ignore */ }
  }
  return null;
}

function setCachedResult(repoUrl, type, content) {
  const cacheFile = path.join(process.cwd(), CACHE_FILE);
  let data = { repoUrl };
  if (fs.existsSync(cacheFile)) {
    try { data = JSON.parse(fs.readFileSync(cacheFile, 'utf-8')); } catch(e) { /* ignore */ }
  }
  data.repoUrl = repoUrl;
  data[type] = content;
  try { fs.writeFileSync(cacheFile, JSON.stringify(data, null, 2), 'utf-8'); } catch(e) { /* ignore */ }
}

async function handleGet(endpoint, repoUrl, cacheKey = null) {
  if (cacheKey) {
    const cached = getCachedResult(repoUrl, cacheKey);
    if (cached) return { content: [{ type: "text", text: JSON.stringify(cached, null, 2) }] };
  }
  try {
    const response = await fetch(`${MRCP_API_BASE}${endpoint}`);
    const data = await response.json();
    if (cacheKey) setCachedResult(repoUrl, cacheKey, data);
    return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
  } catch (error) {
    return { content: [{ type: "text", text: `Error: ${error.message}` }], isError: true };
  }
}

async function handlePost(endpoint, args) {
  try {
    const response = await fetch(`${MRCP_API_BASE}${endpoint}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(args)
    });
    const data = await response.json();
    return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
  } catch (error) {
    return { content: [{ type: "text", text: `Error: ${error.message}` }], isError: true };
  }
}

export const MCP_HANDLERS = {
  "analyze_repository": (args, repoUrl) => handleGet(`/api/analyze?repo=${encodeURIComponent(repoUrl)}`, repoUrl, 'analysis'),
  "get_repository_skills_contract": (args, repoUrl) => handleGet(`/api/skills?repo=${encodeURIComponent(repoUrl)}`, repoUrl, 'skills'),
  "mrcp_run_full_repository_suite": (args, repoUrl) => {
    const taskContext = args.taskContext ? `&task=${encodeURIComponent(args.taskContext)}` : "";
    return handleGet(`/api/full-analysis?repo=${encodeURIComponent(repoUrl)}${taskContext}`, repoUrl);
  },
  "mrcp_impact_analysis": (args) => handlePost(`/api/impact-analysis`, args),
  "mrcp_security_compliance_audit": (args, repoUrl) => handleGet(`/api/security-audit?repo=${encodeURIComponent(repoUrl)}`, repoUrl),
  "mrcp_architectural_drift_detector": (args, repoUrl) => handleGet(`/api/architecture-drift?repo=${encodeURIComponent(repoUrl)}`, repoUrl),
  "mrcp_auto_test_coverage_gap_finder": (args, repoUrl) => handleGet(`/api/test-gap-analysis?repo=${encodeURIComponent(repoUrl)}`, repoUrl),
  "mrcp_context_pruning_pack": (args, repoUrl) => {
    const task = encodeURIComponent(args.taskDescription || "");
    return handleGet(`/api/context-pack?repo=${encodeURIComponent(repoUrl)}&task=${task}`, repoUrl);
  },
  "mrcp_ast_refactor_applier": (args) => handlePost(`/api/refactor-applier`, args),
  "mrcp_type_signature_extractor": (args, repoUrl) => handleGet(`/api/type-signature-extractor?repo=${encodeURIComponent(repoUrl)}`, repoUrl),
  "mrcp_git_diff_semantic_summarizer": (args) => handlePost(`/api/diff-summarizer`, args),
  "mrcp_dependency_compatibility_resolver": (args) => {
    const pkg = encodeURIComponent(args.packageName || "");
    return handleGet(`/api/dependency-resolver?package=${pkg}`, null);
  },
  "mrcp_dead_code_pruner": (args, repoUrl) => handleGet(`/api/dead-code-pruner?repo=${encodeURIComponent(repoUrl)}`, repoUrl),
  "mrcp_sql_schema_orm_contract_generator": (args, repoUrl) => handleGet(`/api/sql-orm-contract?repo=${encodeURIComponent(repoUrl)}`, repoUrl),
  "mrcp_api_contract_generator": (args, repoUrl) => handleGet(`/api/api-contract?repo=${encodeURIComponent(repoUrl)}`, repoUrl),
  "mrcp_code_metrics_health_scorer": (args, repoUrl) => handleGet(`/api/code-health?repo=${encodeURIComponent(repoUrl)}`, repoUrl),
  "mrcp_env_secret_contract_validator": (args, repoUrl) => handleGet(`/api/env-validator?repo=${encodeURIComponent(repoUrl)}`, repoUrl),
  "mrcp_monorepo_package_graph_analyzer": (args, repoUrl) => handleGet(`/api/monorepo-graph?repo=${encodeURIComponent(repoUrl)}`, repoUrl),
  "mrcp_docstring_api_doc_generator": (args, repoUrl) => {
    const targetFile = args.targetFilePath ? `&file=${encodeURIComponent(args.targetFilePath)}` : "";
    return handleGet(`/api/doc-generator?repo=${encodeURIComponent(repoUrl)}${targetFile}`, repoUrl);
  },
  "mrcp_document_analyzer": (args, repoUrl) => {
    const maxFiles = args.maxFiles ? `&maxFiles=${encodeURIComponent(args.maxFiles)}` : "";
    const ext = args.filterExtensions ? `&ext=${encodeURIComponent(args.filterExtensions.join(","))}` : "";
    return handleGet(`/api/document-analyzer?repo=${encodeURIComponent(repoUrl)}${maxFiles}${ext}`, repoUrl);
  }
};
