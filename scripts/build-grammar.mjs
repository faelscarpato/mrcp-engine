#!/usr/bin/env node

/**
 * MRCP Engine - Automated Tree-sitter Grammar & WASM Builder
 * 
 * Usage:
 *   node scripts/build-grammar.mjs <grammar-name>
 *   node scripts/build-grammar.mjs --all
 * 
 * Example:
 *   node scripts/build-grammar.mjs sap-cds
 *   node scripts/build-grammar.mjs oracle-plsql
 */

import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');
const packagesDir = path.join(rootDir, 'packages');
const publicWasmDir = path.join(rootDir, 'public', 'tree-sitter');
const distWasmDir = path.join(rootDir, 'dist', 'tree-sitter');

fs.mkdirSync(publicWasmDir, { recursive: true });
fs.mkdirSync(distWasmDir, { recursive: true });

const targetArg = process.argv[2];

if (!targetArg) {
  console.log(`
🧠 MRCP Engine - Grammar WASM Builder

Uso:
  node scripts/build-grammar.mjs <nome-do-pacote-ou-linguagem>
  node scripts/build-grammar.mjs --all

Exemplos:
  pnpm build:grammar sap-cds
  pnpm build:grammar sap-abap
  pnpm build:grammar oracle-plsql
  pnpm build:grammar --all
`);
  process.exit(1);
}

function findGrammarDirs() {
  if (!fs.existsSync(packagesDir)) return [];
  const entries = fs.readdirSync(packagesDir, { withFileTypes: true });
  return entries
    .filter(e => e.isDirectory() && e.name.startsWith('tree-sitter-'))
    .map(e => ({
      name: e.name.replace('tree-sitter-', ''),
      dir: path.join(packagesDir, e.name)
    }));
}

function buildGrammar(grammarName, grammarDir) {
  console.log(`\n======================================================`);
  console.log(`🔨 Compilando Gramática: tree-sitter-${grammarName}`);
  console.log(`📁 Diretório: ${grammarDir}`);
  console.log(`======================================================`);

  if (!fs.existsSync(grammarDir)) {
    console.error(`❌ Diretório não encontrado: ${grammarDir}`);
    return false;
  }

  const grammarJs = path.join(grammarDir, 'grammar.js');
  if (!fs.existsSync(grammarJs)) {
    console.error(`❌ Arquivo grammar.js não encontrado em: ${grammarDir}`);
    return false;
  }

  try {
    // 1. Generate Parser C source
    console.log(`⚙️  1. Executando: tree-sitter generate...`);
    execSync('tree-sitter generate', {
      cwd: grammarDir,
      stdio: 'inherit',
      env: process.env
    });

    // 2. Build WASM
    console.log(`⚙️  2. Compilando binário WebAssembly (tree-sitter build --wasm)...`);
    execSync('tree-sitter build --wasm', {
      cwd: grammarDir,
      stdio: 'inherit',
      env: process.env
    });

    // 3. Locate compiled WASM
    const files = fs.readdirSync(grammarDir);
    const wasmFiles = files.filter(f => f.endsWith('.wasm'));

    if (wasmFiles.length === 0) {
      console.error(`❌ Nenhum arquivo .wasm gerado em ${grammarDir}`);
      return false;
    }

    // 4. Copy to public/tree-sitter and dist/tree-sitter with aliases
    for (const wasmFile of wasmFiles) {
      const srcWasm = path.join(grammarDir, wasmFile);
      const stats = fs.statSync(srcWasm);
      const sizeKb = (stats.size / 1024).toFixed(1);
      const sizeMb = (stats.size / (1024 * 1024)).toFixed(2);

      const targetPublic = path.join(publicWasmDir, wasmFile);
      const targetDist = path.join(distWasmDir, wasmFile);

      fs.copyFileSync(srcWasm, targetPublic);
      fs.copyFileSync(srcWasm, targetDist);

      console.log(`✅ WASM Gerado: ${wasmFile} (${sizeKb} KB / ${sizeMb} MB)`);
      console.log(`   -> Copiado para: public/tree-sitter/${wasmFile}`);
      console.log(`   -> Copiado para: dist/tree-sitter/${wasmFile}`);
    }

    // 5. Cleanup C sources if needed to keep repo clean
    const srcDir = path.join(grammarDir, 'src');
    if (fs.existsSync(srcDir)) {
      console.log(`🧹 Limpando artefatos intermediários em ${srcDir}...`);
      const srcFiles = fs.readdirSync(srcDir);
      for (const f of srcFiles) {
        if (f.endsWith('.o') || f.endsWith('.tmp') || f === 'parser.c') {
          fs.unlinkSync(path.join(srcDir, f));
        }
      }
    }

    console.log(`🎉 Sucesso na compilação da gramática ${grammarName}!\n`);
    return true;
  } catch (error) {
    console.error(`❌ Erro ao compilar a gramática ${grammarName}:`, error.message);
    return false;
  }
}

const allGrammars = findGrammarDirs();

if (targetArg === '--all') {
  console.log(`🚀 Iniciando compilação de todas as ${allGrammars.length} gramáticas customizadas...`);
  let successCount = 0;
  for (const g of allGrammars) {
    const ok = buildGrammar(g.name, g.dir);
    if (ok) successCount++;
  }
  console.log(`\n🏁 Resultado Final: ${successCount}/${allGrammars.length} gramáticas compiladas com sucesso.`);
} else {
  const normName = targetArg.replace(/^tree-sitter-/, '');
  const found = allGrammars.find(g => g.name === normName || g.name.replace('-', '_') === normName.replace('-', '_'));

  if (!found) {
    const targetDir = path.join(packagesDir, `tree-sitter-${normName}`);
    if (fs.existsSync(targetDir)) {
      buildGrammar(normName, targetDir);
    } else {
      console.error(`❌ Gramática não encontrada: '${targetArg}'.`);
      console.log(`Gramáticas disponíveis:`, allGrammars.map(g => g.name).join(', '));
      process.exit(1);
    }
  } else {
    buildGrammar(found.name, found.dir);
  }
}
