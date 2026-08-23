import { describe, it, expect } from 'vitest';
import { generateApiContract } from './api-contract-generator.js';

describe('MRCP API Contract & OpenAPI Spec Generator Suite', () => {
  it('should discover API routes and generate valid OpenAPI 3.0 spec', async () => {
    const result = await generateApiContract({
      repoUrl: '.'
    });

    expect(result).toBeDefined();
    expect(result.isApplicable).toBe(true);
    expect(result.totalRoutes).toBeGreaterThan(0);
    expect(result.openapiSpec).toBeDefined();
    expect(result.openapiSpec.openapi).toMatch(/^3\.0\./);
    expect(result.typescriptSdkSnippet).toContain('export class ApiClient');
  });

  it('should handle non-existent paths gracefully', async () => {
    const result = await generateApiContract({
      repoUrl: '/invalid/empty/repo'
    });

    expect(result).toBeDefined();
    expect(result.isApplicable).toBe(false);
  });
});
