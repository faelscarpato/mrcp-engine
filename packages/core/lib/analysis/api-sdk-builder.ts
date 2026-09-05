import type {
  ApiParameter,
  ApiRouteDefinition,
} from "./api-contract-generator.js";

export function sanitizeMethodName(method: string, path: string): string {
  const cleanPath = path
    .replace(/^\//, "")
    .replace(/[^a-zA-Z0-9]/g, "_")
    .replace(/_+/g, "_")
    .replace(/_$/, "");
  const m = method.toLowerCase();
  return `${m}_${cleanPath || "root"}`;
}

export function extractParamsFromSource(
  code: string,
  routePath: string,
): ApiParameter[] {
  const params: ApiParameter[] = [];
  const seen = new Set<string>();

  const pathParamMatches = routePath.match(/\{(\w+)\}/g);
  if (pathParamMatches) {
    for (const m of pathParamMatches) {
      const name = m.replace(/[\{\}]/g, "");
      if (!seen.has(name)) {
        seen.add(name);
        params.push({ name, in: "path", required: true, type: "string" });
      }
    }
  }

  const queryRegex =
    /(?:req\.query\.(\w+)|req\.query\[["'](\w+)["']|searchParams\.get\(["'](\w+)["']\))/g;
  let qm: RegExpExecArray | null;
  while ((qm = queryRegex.exec(code)) !== null) {
    const qName = qm[1] || qm[2] || qm[3];
    if (qName && !seen.has(qName)) {
      seen.add(qName);
      params.push({
        name: qName,
        in: "query",
        required: false,
        type: "string",
      });
    }
  }

  return params;
}

export function extractParamsFromBlock(
  block: string,
  routePath: string,
): ApiParameter[] {
  const params: ApiParameter[] = [];
  const seen = new Set<string>();

  const queryRegex =
    /(?:req\.query\.(\w+)|req\.query\[["'](\w+)["']|searchParams\.get\(["'](\w+)["']\))/g;
  let qm: RegExpExecArray | null;
  while ((qm = queryRegex.exec(block)) !== null) {
    const qName = qm[1] || qm[2] || qm[3];
    if (qName && !seen.has(qName)) {
      seen.add(qName);
      params.push({
        name: qName,
        in: "query",
        required: false,
        type: "string",
      });
    }
  }

  const bodyRegex = /req\.body(?:\?\.|\.)(\w+)/g;
  let bm: RegExpExecArray | null;
  while ((bm = bodyRegex.exec(block)) !== null) {
    const bName = bm[1];
    if (bName && !seen.has(bName)) {
      seen.add(bName);
      params.push({ name: bName, in: "body", required: false, type: "any" });
    }
  }

  return params;
}

export function buildTypeScriptSdkSnippet(
  repoUrl: string,
  uniqueRoutes: ApiRouteDefinition[],
): string {
  const sdkLines: string[] = [
    `// ==========================================================`,
    `// 🚀 Auto-Generated Typed API Client SDK for ${repoUrl}`,
    `// Generated deterministically by MRCP Engine v2.3.0`,
    `// ==========================================================`,
    ``,
    `export class ApiClient {`,
    `  constructor(private baseUrl: string = "") {}`,
    ``,
    `  private async request<T>(path: string, options: RequestInit = {}): Promise<T> {`,
    `    const url = \`\${this.baseUrl}\${path}\`;`,
    `    const res = await fetch(url, options);`,
    `    if (!res.ok) throw new Error(\`API error \${res.status}: \${res.statusText}\`);`,
    `    return res.json() as Promise<T>;`,
    `  }`,
    ``,
  ];

  for (const r of uniqueRoutes) {
    const methodName = sanitizeMethodName(r.method, r.path);
    const pathParams = r.parameters.filter((p) => p.in === "path");
    const queryParams = r.parameters.filter((p) => p.in === "query");
    const hasBody =
      r.method === "POST" || r.method === "PUT" || r.method === "PATCH";

    const args: string[] = [];
    if (pathParams.length > 0) {
      pathParams.forEach((p) => args.push(`${p.name}: string`));
    }
    if (queryParams.length > 0) {
      args.push(
        `query?: { ${queryParams.map((q) => `${q.name}${q.required ? "" : "?"}: string`).join("; ")} }`,
      );
    }
    if (hasBody) {
      args.push(`body?: Record<string, any>`);
    }

    let urlExpression = `\`${r.path.replace(/\{(\w+)\}/g, "${$1}")}\``;
    if (queryParams.length > 0) {
      urlExpression = `\`${r.path.replace(/\{(\w+)\}/g, "${$1}")}\${query ? '?' + new URLSearchParams(query as any).toString() : ''}\``;
    }

    sdkLines.push(`  /** ${r.summary} (${r.sourceFile}) */`);
    sdkLines.push(`  async ${methodName}(${args.join(", ")}): Promise<any> {`);
    sdkLines.push(`    return this.request(${urlExpression}, {`);
    sdkLines.push(`      method: "${r.method}",`);
    if (hasBody) {
      sdkLines.push(`      headers: { "Content-Type": "application/json" },`);
      sdkLines.push(`      body: body ? JSON.stringify(body) : undefined,`);
    }
    sdkLines.push(`    });`);
    sdkLines.push(`  }`);
    sdkLines.push(``);
  }

  sdkLines.push(`}`);
  return sdkLines.join("\n");
}
