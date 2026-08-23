import { describe, it, expect } from 'vitest';
import { computeAnalysisDiff } from './diff.js';

describe('MRCP Git Diff Metrics Suite', () => {
  it('should compute added and removed nodes and edges correctly', () => {
    const base: any = {
      nodes: [{ id: 'n1', label: 'a.ts', kind: 'file' }, { id: 'n2', label: 'b.ts', kind: 'file' }],
      edges: [{ source: 'n1', target: 'n2', kind: 'import' }]
    };
    const head: any = {
      nodes: [{ id: 'n1', label: 'a.ts', kind: 'file' }, { id: 'n3', label: 'c.ts', kind: 'file' }],
      edges: [{ source: 'n1', target: 'n3', kind: 'import' }]
    };

    const diff = computeAnalysisDiff(base, head);

    expect(diff).toBeDefined();
    expect(diff.addedNodes.length).toBe(1);
    expect(diff.deletedNodes.length).toBe(1);
    expect(diff.summary.nodesAdded).toBe(1);
    expect(diff.summary.nodesDeleted).toBe(1);
  });
});
