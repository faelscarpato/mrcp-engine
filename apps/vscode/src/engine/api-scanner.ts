import * as fs from 'fs';
import * as path from 'path';
import { MrcpApiRoute } from './types';

export function extractApiRoutes(workspaceRoot: string, codeFiles: string[], apiRoutes: MrcpApiRoute[]): void {
  // 1. Analyze api/index.ts
  const apiIndexPath = path.join(workspaceRoot, 'api/index.ts');
  if (fs.existsSync(apiIndexPath)) {
    try {
      const content = fs.readFileSync(apiIndexPath, 'utf8');
      const lines = content.split('\n');

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const lineNum = i + 1;

        const conditionMatches = Array.from(line.matchAll(/urlPath\s*===?\s*['"](\/api\/[a-zA-Z0-9_\-\/]+)['"]/g)).map(m => m[1]);
        if (conditionMatches.length > 0) {
          const canonical = conditionMatches[0];
          const aliases = conditionMatches.slice(1);

          const subsequentLines = lines.slice(i, Math.min(lines.length, i + 35)).join('\n');
          const hasBody = subsequentLines.includes('req.body') || subsequentLines.includes('POST');
          const hasQuery = subsequentLines.includes('req.query') || subsequentLines.includes('GET');

          const acceptedMethods: string[] = ['OPTIONS'];
          if (hasQuery || !hasBody) acceptedMethods.unshift('GET');
          if (hasBody) acceptedMethods.push('POST');

          const primaryMethod = (hasBody && !hasQuery ? 'POST' : 'GET') as any;

          if (!apiRoutes.some(r => r.path === canonical)) {
            apiRoutes.push({
              method: primaryMethod,
              acceptedMethods,
              path: canonical,
              file: 'api/index.ts',
              line: lineNum,
              handler: 'handler',
              aliases,
              source: 'static-condition',
              description: `Aceita ${acceptedMethods.join(', ')} via dispatcher unificado`
            });
          }
        }
      }
    } catch {}
  }

  // 2. Scan api/mcp.ts explicitly
  const mcpPath = path.join(workspaceRoot, 'api/mcp.ts');
  if (fs.existsSync(mcpPath)) {
    if (!apiRoutes.some(r => r.path === '/api/mcp')) {
      apiRoutes.push({
        method: 'POST',
        acceptedMethods: ['POST', 'GET', 'OPTIONS'],
        path: '/api/mcp',
        file: 'api/mcp.ts',
        line: 1,
        handler: 'handler',
        aliases: [],
        source: 'mcp-protocol',
        description: 'POST (JSON-RPC 2.0 execution) | GET (Discovery & Healthcheck)'
      });
    }
  }

  // 3. Scan file-based routes in api/*.ts
  for (const f of codeFiles) {
    const relPath = path.relative(workspaceRoot, f).replace(/\\/g, '/');
    if (relPath.startsWith('api/') && relPath !== 'api/index.ts' && relPath !== 'api/mcp.ts') {
      const routePath = '/' + relPath.replace(/\.(ts|js)$/, '').replace(/\/index$/, '');
      if (!apiRoutes.some(r => r.path === routePath)) {
        const isPost = relPath.includes('refactor') || relPath.includes('diff');
        apiRoutes.push({
          method: isPost ? 'POST' : 'GET',
          acceptedMethods: isPost ? ['POST', 'OPTIONS'] : ['GET', 'POST', 'OPTIONS'],
          path: routePath,
          file: relPath,
          line: 1,
          handler: 'defaultHandler',
          aliases: [],
          source: 'file-based'
        });
      }
    }
  }
}
