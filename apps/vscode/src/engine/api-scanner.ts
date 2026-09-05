import * as fs from "fs";
import * as path from "path";
import { MrcpApiRoute } from "./types";

export function extractApiRoutes(
  workspaceRoot: string,
  codeFiles: string[],
  apiRoutes: MrcpApiRoute[],
): void {
  // 1. Analyze api/routes.ts (Unified Dictionary)
  const apiRoutesPath = path.join(workspaceRoot, "api/routes.ts");
  if (fs.existsSync(apiRoutesPath)) {
    try {
      const content = fs.readFileSync(apiRoutesPath, "utf8");
      const lines = content.split("\n");

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const lineNum = i + 1;

        const match = line.match(/['"](\/api\/[a-zA-Z0-9_\-\/]+)['"]\s*:/);
        if (match) {
          const canonical = match[1];
          const isAlias = line.includes("routeHandlers[");
          if (isAlias) continue; // Will be handled as an alias to the main route

          const aliases: string[] = [];
          for (let j = i + 1; j < Math.min(lines.length, i + 8); j++) {
            const aMatch = lines[j].match(
              /['"](\/api\/[a-zA-Z0-9_\-\/]+)['"]\s*:\s*.*routeHandlers\[['"]([^'"]+)['"]\]/,
            );
            if (aMatch && aMatch[2] === canonical) {
              aliases.push(aMatch[1]);
            }
          }

          if (!apiRoutes.some((r) => r.path === canonical)) {
            apiRoutes.push({
              method: "GET",
              acceptedMethods: ["GET", "POST", "OPTIONS"],
              path: canonical,
              file: "api/routes.ts",
              line: lineNum,
              handler: "handler",
              aliases,
              source: "static-condition",
              description: `Aceita GET, POST via dispatcher unificado`,
            });
          }
        }
      }
    } catch {}
  }

  // 1.1 Legacy Analyze api/index.ts (Fallback if dictionary not used)
  const apiIndexPath = path.join(workspaceRoot, "api/index.ts");
  if (fs.existsSync(apiIndexPath)) {
    try {
      const content = fs.readFileSync(apiIndexPath, "utf8");
      const lines = content.split("\n");

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const lineNum = i + 1;

        const conditionMatches = Array.from(
          line.matchAll(/urlPath\s*===?\s*['"](\/api\/[a-zA-Z0-9_\-\/]+)['"]/g),
        ).map((m) => m[1]);
        if (conditionMatches.length > 0) {
          const canonical = conditionMatches[0];
          const aliases = conditionMatches.slice(1);
          if (!apiRoutes.some((r) => r.path === canonical)) {
            apiRoutes.push({
              method: "GET",
              acceptedMethods: ["GET", "POST", "OPTIONS"],
              path: canonical,
              file: "api/index.ts",
              line: lineNum,
              handler: "handler",
              aliases,
              source: "static-condition",
              description: `Aceita GET, POST`,
            });
          }
        }
      }
    } catch {}
  }

  // 2. Scan api/mcp.ts explicitly
  const mcpPath = path.join(workspaceRoot, "api/mcp.ts");
  if (fs.existsSync(mcpPath)) {
    if (!apiRoutes.some((r) => r.path === "/api/mcp")) {
      apiRoutes.push({
        method: "POST",
        acceptedMethods: ["POST", "GET", "OPTIONS"],
        path: "/api/mcp",
        file: "api/mcp.ts",
        line: 1,
        handler: "handler",
        aliases: [],
        source: "mcp-protocol",
        description:
          "POST (JSON-RPC 2.0 execution) | GET (Discovery & Healthcheck)",
      });
    }
  }

  // 3. Scan file-based routes in api/*.ts
  for (const f of codeFiles) {
    const relPath = path.relative(workspaceRoot, f).replace(/\\/g, "/");
    if (
      relPath.startsWith("api/") &&
      relPath !== "api/index.ts" &&
      relPath !== "api/mcp.ts"
    ) {
      const routePath =
        "/" + relPath.replace(/\.(ts|js)$/, "").replace(/\/index$/, "");
      if (!apiRoutes.some((r) => r.path === routePath)) {
        const isPost = relPath.includes("refactor") || relPath.includes("diff");
        apiRoutes.push({
          method: isPost ? "POST" : "GET",
          acceptedMethods: isPost
            ? ["POST", "OPTIONS"]
            : ["GET", "POST", "OPTIONS"],
          path: routePath,
          file: relPath,
          line: 1,
          handler: "defaultHandler",
          aliases: [],
          source: "file-based",
        });
      }
    }
  }
}
