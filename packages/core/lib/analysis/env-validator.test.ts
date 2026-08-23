import { describe, it, expect } from 'vitest';
import { validateEnvironmentContract } from './env-validator.js';

describe('MRCP Environment & Secret Contract Validator Suite', () => {
  it('should validate workspace env definitions without false positives', async () => {
    const result = await validateEnvironmentContract({
      repoUrl: '.'
    });

    expect(result).toBeDefined();
    expect(result.isApplicable).toBe(true);
    expect(Array.isArray(result.variables)).toBe(true);
    expect(Array.isArray(result.exampleFilesFound)).toBe(true);
    expect(Array.isArray(result.undocumentedVariables)).toBe(true);
    expect(Array.isArray(result.securityWarnings)).toBe(true);
    expect(result.securityWarnings.length).toBe(0);
  });

  it('should return non-applicable for empty or non-existent repo', async () => {
    const result = await validateEnvironmentContract({
      repoUrl: '/non/existent/repo/xyz'
    });

    expect(result).toBeDefined();
    expect(result.isApplicable).toBe(false);
  });
});
