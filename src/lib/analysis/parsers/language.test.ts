import { describe, it, expect } from 'vitest';
import { detectLanguage } from './language';

describe('Módulo de Parsers: Detecção de Linguagem (language.ts)', () => {
  
  it('deve detectar corretamente ficheiros da stack JavaScript/TypeScript', () => {
    expect(detectLanguage('src/components/GraphViewer.tsx')).toBe('TypeScript');
    expect(detectLanguage('src/lib/analyzer.ts')).toBe('TypeScript');
    expect(detectLanguage('eslint.config.js')).toBe('JavaScript');
    expect(detectLanguage('src/utils/helpers.jsx')).toBe('JavaScript');
  });

  it('deve detectar corretamente um ficheiro Python', () => {
    expect(detectLanguage('backend/api/main.py')).toBe('Python');
    expect(detectLanguage('scripts/data_processor.py')).toBe('Python');
  });

  it('deve detectar corretamente um ficheiro Rust', () => {
    expect(detectLanguage('core/engine/src/main.rs')).toBe('Rust');
    expect(detectLanguage('parser.rs')).toBe('Rust');
  });

  it('deve detectar corretamente ficheiros Go e C/C++', () => {
    expect(detectLanguage('server/main.go')).toBe('Go');
    expect(detectLanguage('system/core.cpp')).toBe('C++');
    expect(detectLanguage('system/legacy.c')).toBe('C');
    expect(detectLanguage('include/header.h')).toBe('C'); 
  });

  it('deve detectar corretamente ficheiros Ruby, PHP e Java', () => {
    expect(detectLanguage('app/models/user.rb')).toBe('Ruby');
    expect(detectLanguage('public/index.php')).toBe('PHP');
    expect(detectLanguage('src/main/java/com/app/Main.java')).toBe('Java');
  });

  it('deve detectar corretamente ficheiros de documentação (Markdown)', () => {
    expect(detectLanguage('docs/README.md')).toBe('Markdown');
  });

  it('deve detectar corretamente ficheiros de compilação (Makefile)', () => {
    // O motor reconhece "Makefile", então validamos essa inteligência nativa.
    expect(detectLanguage('Makefile')).toBe('Makefile');
  });

  it('deve retornar undefined para ficheiros sem extensão suportada ou de configuração genérica', () => {
    expect(detectLanguage('LICENSE')).toBeUndefined();
    expect(detectLanguage('.gitignore')).toBeUndefined();
  });

  it('deve lidar corretamente com caminhos completos e absolutos', () => {
    expect(detectLanguage('/Users/fael/projects/gitgraph/src/main.ts')).toBe('TypeScript');
    expect(detectLanguage('C:\\Projetos\\backend\\app.py')).toBe('Python');
  });
});