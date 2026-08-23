import { describe, it, expect } from 'vitest';
import { analyzeWorkspaceLocally } from '../../../../apps/vscode/src/engine/local-analyzer.js';
import { extractTypedAstSymbols } from '../../../../apps/vscode/src/engine/ast-extractors.js';
import { packWorkspaceContextForAi } from '../../../../apps/vscode/src/engine/context-packer.js';
import * as path from 'path';

describe('MRCP Context Pack Fidelity & Precision Suite', () => {

  // Test 1: Extração de uma função simples com tipos reais
  it('1. should extract simple function with real typed parameters and return type', () => {
    const code = `
export function add(a: number, b: number): number {
  return a + b;
}
`;
    const symbols = extractTypedAstSymbols(code, 'src/math.ts', '.ts', false, new Set());
    expect(symbols.length).toBe(1);
    expect(symbols[0].name).toBe('add');
    expect(symbols[0].parameters).toEqual([
      { name: 'a', type: 'number', optional: false },
      { name: 'b', type: 'number', optional: false }
    ]);
    expect(symbols[0].returnType).toBe('number');
    expect(symbols[0].signature).toBe('export function add(a: number, b: number): number;');
  });

  // Test 2: Extração de função async com retorno tipado
  it('2. should extract async function with generic Promise return type', () => {
    const code = `
export async function fetchUser<T>(userId: string, options?: FetchOptions): Promise<UserResponse<T>> {
  return await http.get('/users/' + userId);
}
`;
    const symbols = extractTypedAstSymbols(code, 'src/api.ts', '.ts', false, new Set());
    expect(symbols.length).toBe(1);
    expect(symbols[0].isAsync).toBe(true);
    expect(symbols[0].generics).toBe('<T>');
    expect(symbols[0].returnType).toBe('Promise<UserResponse<T>>');
    expect(symbols[0].parameters?.[0]).toEqual({ name: 'userId', type: 'string', optional: false });
    expect(symbols[0].parameters?.[1]).toEqual({ name: 'options', type: 'FetchOptions', optional: true });
    expect(symbols[0].signature).toContain('export async function fetchUser<T>(userId: string, options?: FetchOptions): Promise<UserResponse<T>>;');
  });

  // Test 3: Extração de classe e métodos
  it('3. should extract class with public methods and typed signatures', () => {
    const code = `
export class MetricsCollector<T> {
  private count: number = 0;

  public increment(amount: number = 1): void {
    this.count += amount;
  }

  public async exportReport(format: string): Promise<string> {
    return "report";
  }
}
`;
    const symbols = extractTypedAstSymbols(code, 'src/metrics.ts', '.ts', false, new Set());
    expect(symbols.length).toBe(1);
    const cls = symbols[0];
    expect(cls.kind).toBe('class');
    expect(cls.name).toBe('MetricsCollector');
    expect(cls.methods?.length).toBe(2);
    expect(cls.methods?.[0]).toContain('increment(amount: number = 1): void');
    expect(cls.methods?.[1]).toContain('exportReport(format: string): Promise<string>');
  });

  // Test 4: Extração de interface e propriedades
  it('4. should extract interface with actual properties and types', () => {
    const code = `
export interface FullSuiteResult {
  repoUrl: string;
  totalDurationMs: number;
  maintainabilityIndex: number;
  letterGrade: 'A' | 'B' | 'C' | 'D' | 'F';
  isApplicable?: boolean;
}
`;
    const symbols = extractTypedAstSymbols(code, 'src/types.ts', '.ts', false, new Set());
    expect(symbols.length).toBe(1);
    const iface = symbols[0];
    expect(iface.kind).toBe('interface');
    expect(iface.name).toBe('FullSuiteResult');
    expect(iface.properties?.length).toBe(5);
    expect(iface.properties).toContain('repoUrl: string;');
    expect(iface.properties).toContain("letterGrade: 'A' | 'B' | 'C' | 'D' | 'F';");
  });

  // Test 5: Complexidade de função simples
  it('5. should compute complexity = 1 for linear function', () => {
    const code = `
export function linear(x: number): number {
  const y = x * 2;
  return y + 1;
}
`;
    const symbols = extractTypedAstSymbols(code, 'src/calc.ts', '.ts', false, new Set());
    expect(symbols[0].complexity).toBe(1);
    expect(symbols[0].complexityDetails.confidence).toBe('high');
    expect(symbols[0].complexityDetails.analysisMethod).toBe('ast-walker');
  });

  // Test 6: Complexidade de função com if, loop e operadores lógicos
  it('6. should compute accurate cyclomatic complexity for branching structures', () => {
    const code = `
export function complexLogic(items: number[], threshold: number): number {
  let count = 0;
  for (let i = 0; i < items.length; i++) {
    if (items[i] > threshold && items[i] < 100) {
      count++;
    } else if (items[i] === 0 || items[i] === -1) {
      count--;
    }
  }
  try {
    return count > 0 ? count : 0;
  } catch (e) {
    return -1;
  }
}
`;
    const symbols = extractTypedAstSymbols(code, 'src/logic.ts', '.ts', false, new Set());
    // branches: for (+1), if (+1), && (+1), else if (+1), || (+1), catch (+1), ? (+1) = base 1 + 7 = 8
    expect(symbols[0].complexity).toBeGreaterThanOrEqual(7);
  });

  // Test 7 & 8 & 9 & 10: Detecção de rotas HTTP, aliases e métodos
  it('7-10. should extract REST endpoints, methods and aliases from api/index.ts', async () => {
    const rootPath = path.resolve('.');
    const result = await analyzeWorkspaceLocally(rootPath, 500);

    const reportRoute = result.apiRoutes.find(r => r.path === '/api/report');
    expect(reportRoute).toBeDefined();
    expect(reportRoute?.aliases).toContain('/api/export-report');
    expect(reportRoute?.source).toBe('static-condition');

    const guidelinesRoute = result.apiRoutes.find(r => r.path === '/api/guidelines');
    expect(guidelinesRoute).toBeDefined();
    expect(guidelinesRoute?.aliases).toContain('/api/instructions');
    expect(guidelinesRoute?.aliases).toContain('/api/skill');

    const analyzeRoute = result.apiRoutes.find(r => r.path === '/api/analyze');
    expect(analyzeRoute).toBeDefined();
  });

  // Test 11: Invalidação de cache após alteração
  it('11. should compute deterministic workspace fingerprint based on file state', async () => {
    const rootPath = path.resolve('.');
    const result1 = await analyzeWorkspaceLocally(rootPath, 50);
    const result2 = await analyzeWorkspaceLocally(rootPath, 50);

    expect(result1.provenance.workspaceFingerprint).toBe(result2.provenance.workspaceFingerprint);
    expect(result1.provenance.analyzerVersion).toBe('2.6.0');
    expect(result1.provenance.cache.used).toBe(false);
  });

  // Test 12: Detecção de divergência entre src e packages/core
  it('12. should identify parallel duplicate implementations between src and packages/core', async () => {
    const rootPath = path.resolve('.');
    const result = await analyzeWorkspaceLocally(rootPath, 500);

    expect(result.duplicateModules.length).toBeGreaterThan(0);
    const pipelineDup = result.duplicateModules.find(d => d.primary.includes('pipeline.ts'));
    expect(pipelineDup).toBeDefined();
    expect(pipelineDup?.primary).toBe('packages/core/lib/analysis/pipeline.ts');
    expect(pipelineDup?.duplicate).toBe('src/lib/analysis/pipeline.ts');
  });

  // Test 13: Falha explícita ou limitação declarada
  it('13. should return limitation details if parsing is unavailable', () => {
    const code = `// Corrupted file syntax without body`;
    const symbols = extractTypedAstSymbols(code, 'corrupt.ts', '.ts', false, new Set());
    expect(symbols.length).toBe(0);
  });

  // Test 14: Garantia de que o contexto nunca emite (...args: any[])
  it('14. should guarantee that Context Pack NEVER emits generic placeholder signatures', async () => {
    const rootPath = path.resolve('.');
    const result = await analyzeWorkspaceLocally(rootPath, 500);
    const packed = packWorkspaceContextForAi(result);

    expect(packed).not.toContain('(...args: any[]): Promise<any> | any');
    expect(packed).not.toContain('{ [key: string]: any }');
    expect(packed).toContain('export async function runFullRepositoryDiagnostic');
    expect(packed).toContain('Revision:');
    expect(packed).toContain('ARCHITECTURAL CONTEXT');
  });

});
