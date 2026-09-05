import { findRepoFiles, fetchRepoFile } from "./repo-fetcher.js";
import {
  extractParamsFromSource,
  extractParamsFromBlock,
  buildTypeScriptSdkSnippet,
  sanitizeMethodName,
} from "./api-sdk-builder.js";

export interface ApiParameter {
  name: string;
  in: "path" | "query" | "header" | "body";
  required: boolean;
  type?: string;
  description?: string;
}

export interface ApiRouteDefinition {
  path: string;
  method: "GET" | "POST" | "PUT" | "DELETE" | "PATCH" | "OPTIONS" | "HEAD";
  framework:
    | "Next.js"
    | "Express"
    | "Fastify"
    | "Hono"
    | "FastAPI"
    | "Flask"
    | "Generic";
  sourceFile: string;
  handlerName?: string;
  parameters: ApiParameter[];
  summary?: string;
}

export interface ApiContractOptions {
  repoUrl: string;
  frameworkHint?: string;
}

export interface ApiContractResult {
  repoUrl: string;
  frameworksDetected: string[];
  totalRoutes: number;
  routes: ApiRouteDefinition[];
  openapiSpec: {
    openapi: string;
    info: { title: string; version: string; description: string };
    paths: Record<string, any>;
  };
  typescriptSdkSnippet: string;
  isApplicable: boolean;
  message?: string;
}

export async function generateApiContract(
  options: ApiContractOptions,
): Promise<ApiContractResult> {
  const { repoUrl } = options;

  // Search for potential route files
  const files = await findRepoFiles(repoUrl, (filePath) => {
    const p = filePath.toLowerCase();
    return (
      (p.startsWith("api/") ||
        p.includes("/api/") ||
        p.includes("routes/") ||
        p.includes("controllers/") ||
        p.endsWith("/route.ts") ||
        p.endsWith("/route.js") ||
        p.endsWith(".router.ts") ||
        p.endsWith(".controller.ts") ||
        p.endsWith("app.py") ||
        p.endsWith("main.py") ||
        p.endsWith("server.ts") ||
        p.endsWith("server.js") ||
        p.endsWith("dev-server.ts")) &&
      !p.includes(".test.") &&
      !p.includes(".spec.")
    );
  });

  const routes: ApiRouteDefinition[] = [];
  const detectedFrameworks = new Set<string>();

  for (const filePath of files) {
    const file = await fetchRepoFile(repoUrl, filePath);
    if (!file || !file.content) continue;

    const content = file.content;

    // 1. Next.js App Router (app/**/route.ts)
    if (
      filePath.includes("app/") &&
      (filePath.endsWith("route.ts") || filePath.endsWith("route.js"))
    ) {
      detectedFrameworks.add("Next.js App Router");
      let routePath = filePath
        .replace(/^.*app\//, "/")
        .replace(/\/route\.(ts|js)$/, "")
        .replace(/\[(\w+)\]/g, "{$1}");
      if (!routePath.startsWith("/")) routePath = "/" + routePath;
      if (routePath === "") routePath = "/";

      const methods: Array<"GET" | "POST" | "PUT" | "DELETE" | "PATCH"> = [
        "GET",
        "POST",
        "PUT",
        "DELETE",
        "PATCH",
      ];
      for (const m of methods) {
        const methodRegex = new RegExp(
          `export\\s+(async\\s+)?function\\s+${m}\\b|export\\s+const\\s+${m}\\s*=`,
          "g",
        );
        if (methodRegex.test(content)) {
          const params = extractParamsFromSource(content, routePath);
          routes.push({
            path: routePath,
            method: m,
            framework: "Next.js",
            sourceFile: filePath,
            handlerName: m,
            parameters: params,
            summary: `${m} handler for ${routePath}`,
          });
        }
      }
    }

    // 2. Next.js Pages Router (pages/api/** or api/**)
    else if (
      filePath.includes("pages/api/") ||
      (filePath.startsWith("api/") && !filePath.includes("/route."))
    ) {
      detectedFrameworks.add("Next.js Pages / Vercel Functions");
      let routePath =
        "/" +
        filePath.replace(/\.(ts|js|mjs)$/, "").replace(/\[(\w+)\]/g, "{$1}");
      if (routePath.endsWith("/index"))
        routePath = routePath.replace(/\/index$/, "") || "/";

      // Check if it's the consolidated index router or the new routes dictionary
      const normalizedPath = filePath.replace(/\\/g, "/");
      if (
        normalizedPath.endsWith("api/index.ts") ||
        normalizedPath.endsWith("api/index.js") ||
        normalizedPath.endsWith("api/routes.ts")
      ) {
        // Fallback para index legado
        const subRouteRegex = /urlPath\s*===?\s*["']([^"']+)["']/g;
        // Nova versão dicionário routes.ts
        const dictRouteRegex = /["'](\/api\/[^"']+)["']\s*:/g;

        let match;
        const foundRoutes = new Set<string>();

        while ((match = subRouteRegex.exec(content)) !== null) {
          const subPath = match[1];
          if (foundRoutes.has(subPath)) continue;
          foundRoutes.add(subPath);

          const hasPost = content
            .slice(match.index, match.index + 500)
            .includes("req.body");
          const method = hasPost ? "POST" : "GET";
          routes.push({
            path: subPath,
            method,
            framework: "Next.js",
            sourceFile: filePath,
            handlerName: subPath.replace(/^\/api\//, ""),
            parameters: extractParamsFromBlock(
              content.slice(match.index, match.index + 800),
              subPath,
            ),
            summary: `Consolidated API endpoint for ${subPath}`,
          });
        }

        while ((match = dictRouteRegex.exec(content)) !== null) {
          const subPath = match[1];
          if (foundRoutes.has(subPath)) continue;
          foundRoutes.add(subPath);

          const hasPost = content
            .slice(match.index, match.index + 500)
            .includes("req.body");
          const method = hasPost ? "POST" : "GET";
          routes.push({
            path: subPath,
            method,
            framework: "Next.js",
            sourceFile: filePath,
            handlerName: subPath.replace(/^\/api\//, ""),
            parameters: extractParamsFromBlock(
              content.slice(match.index, match.index + 800),
              subPath,
            ),
            summary: `Dictionary API endpoint for ${subPath}`,
          });
        }
      } else {
        const hasReqMethodCheck =
          /req\.method\s*===?\s*["'](GET|POST|PUT|DELETE|PATCH)["']/gi;
        let match;
        let foundAny = false;
        while ((match = hasReqMethodCheck.exec(content)) !== null) {
          foundAny = true;
          const method = match[1].toUpperCase() as any;
          routes.push({
            path: routePath,
            method,
            framework: "Next.js",
            sourceFile: filePath,
            handlerName: "handler",
            parameters: extractParamsFromSource(content, routePath),
            summary: `Handler for ${routePath}`,
          });
        }
        if (!foundAny) {
          routes.push({
            path: routePath,
            method: content.includes("req.body") ? "POST" : "GET",
            framework: "Next.js",
            sourceFile: filePath,
            handlerName: "default",
            parameters: extractParamsFromSource(content, routePath),
            summary: `Default handler for ${routePath}`,
          });
        }
      }
    }

    // 3. Express / Fastify / Hono (app.get, router.post, fastify.get, hono.get)
    const expressRegex =
      /(?:app|router|fastify|server)\.(get|post|put|delete|patch)\s*\(\s*["']([^"']+)["']/gi;
    let expMatch;
    while ((expMatch = expressRegex.exec(content)) !== null) {
      const frameworkName = content.includes("fastify")
        ? "Fastify"
        : content.includes("hono")
          ? "Hono"
          : "Express";
      detectedFrameworks.add(frameworkName);
      const method = expMatch[1].toUpperCase() as any;
      let expPath = expMatch[2];
      if (!expPath.startsWith("/")) expPath = "/" + expPath;
      const normalizedPath = expPath.replace(/:([a-zA-Z0-9_]+)/g, "{$1}");

      routes.push({
        path: normalizedPath,
        method,
        framework: frameworkName,
        sourceFile: filePath,
        parameters: extractParamsFromSource(
          content.slice(expMatch.index, expMatch.index + 1000),
          normalizedPath,
        ),
        summary: `${method} endpoint on ${normalizedPath}`,
      });
    }

    // 4. FastAPI / Flask in Python
    if (filePath.endsWith(".py")) {
      const fastApiRegex =
        /@(app|router)\.(get|post|put|delete|patch)\s*\(\s*["']([^"']+)["']/gi;
      let pyMatch;
      while ((pyMatch = fastApiRegex.exec(content)) !== null) {
        detectedFrameworks.add("FastAPI");
        const method = pyMatch[2].toUpperCase() as any;
        const pyPath = pyMatch[3];
        routes.push({
          path: pyPath,
          method,
          framework: "FastAPI",
          sourceFile: filePath,
          parameters: extractParamsFromSource(
            content.slice(pyMatch.index, pyMatch.index + 800),
            pyPath,
          ),
          summary: `FastAPI route on ${pyPath}`,
        });
      }

      const flaskRegex =
        /@app\.route\s*\(\s*["']([^"']+)["'](?:,\s*methods\s*=\s*\[([^\]]+)\])?/gi;
      let flaskMatch;
      while ((flaskMatch = flaskRegex.exec(content)) !== null) {
        detectedFrameworks.add("Flask");
        const fPath = flaskMatch[1];
        const methodsStr = flaskMatch[2] || '"GET"';
        const methods = methodsStr
          .match(/"(\w+)"|'(\w+)'/g)
          ?.map((m) => m.replace(/["']/g, "").toUpperCase()) || ["GET"];
        for (const m of methods) {
          routes.push({
            path: fPath.replace(/<(?:\w+:)?(\w+)>/g, "{$1}"),
            method: m as any,
            framework: "Flask",
            sourceFile: filePath,
            parameters: extractParamsFromSource(
              content.slice(flaskMatch.index, flaskMatch.index + 800),
              fPath,
            ),
            summary: `Flask endpoint for ${fPath}`,
          });
        }
      }
    }
  }

  // Deduplicate routes by method + path
  const uniqueRoutes: ApiRouteDefinition[] = [];
  const seenKeys = new Set<string>();
  for (const r of routes) {
    const key = `${r.method}::${r.path}`;
    if (!seenKeys.has(key)) {
      seenKeys.add(key);
      uniqueRoutes.push(r);
    }
  }

  const isApplicable = uniqueRoutes.length > 0;

  // Build OpenAPI Spec
  const openapiSpec: any = {
    openapi: "3.0.3",
    info: {
      title: "MRCP Auto-Generated API Contract",
      version: "1.0.0",
      description: `Automated API schema extracted deterministically from ${uniqueRoutes.length} codebase routes without LLM hallucinations.`,
    },
    paths: {},
  };

  for (const r of uniqueRoutes) {
    if (!openapiSpec.paths[r.path]) {
      openapiSpec.paths[r.path] = {};
    }
    const operationObj: any = {
      summary: r.summary || `${r.method} ${r.path}`,
      parameters: r.parameters.map((p) => ({
        name: p.name,
        in: p.in,
        required: p.required,
        schema: { type: p.type || "string" },
      })),
      responses: {
        "200": {
          description: "Successful operation",
          content: {
            "application/json": {
              schema: { type: "object" },
            },
          },
        },
      },
    };
    openapiSpec.paths[r.path][r.method.toLowerCase()] = operationObj;
  }

  // Build TypeScript SDK Snippet
  const typescriptSdkSnippet = buildTypeScriptSdkSnippet(repoUrl, uniqueRoutes);

  return {
    repoUrl,
    frameworksDetected: Array.from(detectedFrameworks),
    totalRoutes: uniqueRoutes.length,
    routes: uniqueRoutes,
    openapiSpec,
    typescriptSdkSnippet,
    isApplicable,
    message: isApplicable
      ? `Identificadas ${uniqueRoutes.length} rotas de API em ${detectedFrameworks.size > 0 ? Array.from(detectedFrameworks).join(", ") : "código"}. Contrato OpenAPI 3.0 e SDK TypeScript gerados com sucesso.`
      : "Nenhuma rota ou framework de API (Next.js, Express, Fastify, Hono, FastAPI, Flask) foi detectada no repositório.",
  };
}

export {
  buildTypeScriptSdkSnippet,
  extractParamsFromSource,
  extractParamsFromBlock,
  sanitizeMethodName,
} from "./api-sdk-builder.js";
