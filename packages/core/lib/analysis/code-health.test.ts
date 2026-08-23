import { describe, it, expect } from 'vitest';
import { calculateCodeHealth } from './code-health.js';

describe('MRCP Code Health & Maintainability Index Suite', () => {
  it('should score local repository health accurately', async () => {
    const result = await calculateCodeHealth({
      repoUrl: '/home/scarpatoweb/mrcp-engine'
    });

    expect(result).toBeDefined();
    expect(result.isApplicable).toBe(true);
    expect(result.maintainabilityIndex).toBeGreaterThan(70);
    expect(['A', 'B']).toContain(result.letterGrade);
    expect(result.summary.totalFiles).toBeGreaterThan(10);
    expect(Array.isArray(result.topRefactoringPriorities)).toBe(true);
  });
});
