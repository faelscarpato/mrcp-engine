import { describe, it, expect, vi } from 'vitest';
import { runAnalysisPipeline, parseTargetUrl } from './pipeline.js';

// Mock dependencies
vi.mock('./graph-builder.js', () => ({
  buildGraph: vi.fn().mockResolvedValue({
    nodes: [{ id: 'n1', label: 'Node 1', path: 'file1.ts', complexity: 60, degree: 30 }],
    edges: [],
    languages: { TypeScript: 1 }
  }),
  computeMetrics: vi.fn().mockReturnValue({})
}));

vi.mock('./mrcp-skill-injector.js', () => ({
  injectSkillAndContract: vi.fn().mockReturnValue({ skill: 'injected' })
}));

describe('Analysis Pipeline', () => {
  describe('parseTargetUrl', () => {
    it('should parse local directory correctly', () => {
      const parsed = parseTargetUrl('./local-dir');
      expect(parsed?.targetType).toBe('local');
      expect(parsed?.owner).toBe('local');
    });

    it('should parse github url correctly', () => {
      const parsed = parseTargetUrl('https://github.com/owner/repo.git');
      expect(parsed?.targetType).toBe('github');
      expect(parsed?.owner).toBe('owner');
      expect(parsed?.repo).toBe('repo');
    });

    it('should parse generic website correctly', () => {
      const parsed = parseTargetUrl('https://example.com');
      expect(parsed?.targetType).toBe('website');
      expect(parsed?.owner).toBe('web');
      expect(parsed?.repo).toBe('example.com');
    });
  });

  describe('runAnalysisPipeline', () => {
    it('should run pipeline and inject contracts', async () => {
      const result = await runAnalysisPipeline('https://github.com/owner/repo.git', [{ path: 'file1.ts', content: 'content' }]);
      expect(result.status).toBe('success');
      expect(result.owner).toBe('owner');
      expect(result.repo).toBe('repo');
      expect(result.mrcpInjectedContracts?.length).toBe(1);
      expect(result.mrcpInjectedContracts?.[0]).toEqual({ skill: 'injected' });
    });
  });
});
