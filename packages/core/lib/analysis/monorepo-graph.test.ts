import { describe, it, expect } from 'vitest';
import { analyzeMonorepoGraph } from './monorepo-graph.js';

describe('MRCP Monorepo Package Graph Analyzer Suite', () => {
  it('should detect pnpm workspaces and package relationships in local engine', async () => {
    const result = await analyzeMonorepoGraph({
      repoUrl: '/home/scarpatoweb/mrcp-engine'
    });

    expect(result).toBeDefined();
    expect(result.isApplicable).toBe(true);
    expect(['pnpm', 'pnpm-workspace']).toContain(result.monorepoTool);
    expect(result.packagesCount).toBeGreaterThan(0);
    expect(result.packages.some(p => p.name === '@mrcp/core' || p.name === '@mrcp/cli' || p.name === 'mrcp-vscode')).toBe(true);
  });

  it('should handle non-monorepo gracefully', async () => {
    const result = await analyzeMonorepoGraph({
      repoUrl: '/invalid/path'
    });

    expect(result).toBeDefined();
    expect(result.isApplicable).toBe(false);
  });
});
