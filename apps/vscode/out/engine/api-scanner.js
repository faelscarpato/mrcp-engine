"use strict";
var __createBinding =
  (this && this.__createBinding) ||
  (Object.create
    ? function (o, m, k, k2) {
        if (k2 === undefined) k2 = k;
        var desc = Object.getOwnPropertyDescriptor(m, k);
        if (
          !desc ||
          ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)
        ) {
          desc = {
            enumerable: true,
            get: function () {
              return m[k];
            },
          };
        }
        Object.defineProperty(o, k2, desc);
      }
    : function (o, m, k, k2) {
        if (k2 === undefined) k2 = k;
        o[k2] = m[k];
      });
var __setModuleDefault =
  (this && this.__setModuleDefault) ||
  (Object.create
    ? function (o, v) {
        Object.defineProperty(o, "default", { enumerable: true, value: v });
      }
    : function (o, v) {
        o["default"] = v;
      });
var __importStar =
  (this && this.__importStar) ||
  (function () {
    var ownKeys = function (o) {
      ownKeys =
        Object.getOwnPropertyNames ||
        function (o) {
          var ar = [];
          for (var k in o)
            if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
          return ar;
        };
      return ownKeys(o);
    };
    return function (mod) {
      if (mod && mod.__esModule) return mod;
      var result = {};
      if (mod != null)
        for (var k = ownKeys(mod), i = 0; i < k.length; i++)
          if (k[i] !== "default") __createBinding(result, mod, k[i]);
      __setModuleDefault(result, mod);
      return result;
    };
  })();
Object.defineProperty(exports, "__esModule", { value: true });
exports.extractApiRoutes = extractApiRoutes;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
function extractApiRoutes(workspaceRoot, codeFiles, apiRoutes) {
  // 1. Analyze api/index.ts
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
          const subsequentLines = lines
            .slice(i, Math.min(lines.length, i + 35))
            .join("\n");
          const hasBody =
            subsequentLines.includes("req.body") ||
            subsequentLines.includes("POST");
          const hasQuery =
            subsequentLines.includes("req.query") ||
            subsequentLines.includes("GET");
          const acceptedMethods = ["OPTIONS"];
          if (hasQuery || !hasBody) acceptedMethods.unshift("GET");
          if (hasBody) acceptedMethods.push("POST");
          const primaryMethod = hasBody && !hasQuery ? "POST" : "GET";
          if (!apiRoutes.some((r) => r.path === canonical)) {
            apiRoutes.push({
              method: primaryMethod,
              acceptedMethods,
              path: canonical,
              file: "api/index.ts",
              line: lineNum,
              handler: "handler",
              aliases,
              source: "static-condition",
              description: `Aceita ${acceptedMethods.join(", ")} via dispatcher unificado`,
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
//# sourceMappingURL=api-scanner.js.map
