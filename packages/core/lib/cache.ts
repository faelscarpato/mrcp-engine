<<<<<<< HEAD
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { saveAllReportsLocally } from './report-manager.js';

// LRU in-memory genérico (para funções serverless quentes)
const memoryCache = new Map<string, { data: any, timestamp: number }>();
const MAX_MEMORY_ITEMS = 100;
const CACHE_TTL_MS = 1000 * 60 * 60; // 1 hora

function getCacheKey(repoUrl: string): string {
  return crypto.createHash('sha256').update(repoUrl).digest('hex');
}

export async function getCachedAnalysis(repoUrl: string, isLocalCLI: boolean = false): Promise<any | null> {
  const key = getCacheKey(repoUrl);

  // Verifica na memória (API Serverless)
  if (memoryCache.has(key)) {
    const entry = memoryCache.get(key)!;
    if (Date.now() - entry.timestamp < CACHE_TTL_MS) {
      console.log(`[Cache] Memory hit para ${repoUrl}`);
      return entry.data;
    } else {
      memoryCache.delete(key);
    }
  }

  // Verifica no sistema de arquivos (MCP CLI local)
  if (isLocalCLI) {
    try {
      const cacheDir = path.resolve('.cache');
      const cacheFile = path.join(cacheDir, `${key}.json`);
      if (fs.existsSync(cacheFile)) {
        const stats = fs.statSync(cacheFile);
        if (Date.now() - stats.mtimeMs < CACHE_TTL_MS) {
          const content = fs.readFileSync(cacheFile, 'utf-8');
          console.log(`[Cache] FS hit para ${repoUrl}`);
          return JSON.parse(content);
        }
      }
    } catch (e) {
      console.error('[Cache] Erro ao ler cache local', e);
    }
  }

  return null;
}

export async function setCachedAnalysis(repoUrl: string, data: any, isLocalCLI: boolean = false): Promise<void> {
  const key = getCacheKey(repoUrl);

  // Grava na memória
  if (memoryCache.size >= MAX_MEMORY_ITEMS) {
    const oldestKey = memoryCache.keys().next().value;
    if (oldestKey) memoryCache.delete(oldestKey);
  }
  memoryCache.set(key, { data, timestamp: Date.now() });

  // Grava no disco (somente para CLI local)
  if (isLocalCLI) {
    try {
      const cacheDir = path.resolve('.cache');
      if (!fs.existsSync(cacheDir)) {
        fs.mkdirSync(cacheDir, { recursive: true });
      }
      const cacheFile = path.join(cacheDir, `${key}.json`);
      fs.writeFileSync(cacheFile, JSON.stringify(data), 'utf-8');
    } catch (e) {
      console.error('[Cache] Erro ao gravar cache local', e);
    }
  }
}

export function saveEndpointOutput(endpointName: string, repoUrl: string, data: any): void {
  try {
    saveAllReportsLocally(endpointName, repoUrl, data);
  } catch (e: any) {
    console.error(`[MRCP Auto-Save Error] Falha ao salvar resultado de ${endpointName}:`, e.message);
  }
}
=======
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { saveAllReportsLocally } from './report-manager.js';

// LRU in-memory genérico (para funções serverless quentes)
const memoryCache = new Map<string, { data: any, timestamp: number }>();
const MAX_MEMORY_ITEMS = 100;
const CACHE_TTL_MS = 1000 * 60 * 60; // 1 hora

function getCacheKey(repoUrl: string): string {
  return crypto.createHash('sha256').update(repoUrl).digest('hex');
}

export async function getCachedAnalysis(repoUrl: string, isLocalCLI: boolean = false): Promise<any | null> {
  const key = getCacheKey(repoUrl);

  // Verifica na memória (API Serverless)
  if (memoryCache.has(key)) {
    const entry = memoryCache.get(key)!;
    if (Date.now() - entry.timestamp < CACHE_TTL_MS) {
      console.log(`[Cache] Memory hit para ${repoUrl}`);
      return entry.data;
    } else {
      memoryCache.delete(key);
    }
  }

  // Verifica no sistema de arquivos (MCP CLI local)
  if (isLocalCLI) {
    try {
      const cacheDir = path.resolve('.cache');
      const cacheFile = path.join(cacheDir, `${key}.json`);
      if (fs.existsSync(cacheFile)) {
        const stats = fs.statSync(cacheFile);
        if (Date.now() - stats.mtimeMs < CACHE_TTL_MS) {
          const content = fs.readFileSync(cacheFile, 'utf-8');
          console.log(`[Cache] FS hit para ${repoUrl}`);
          return JSON.parse(content);
        }
      }
    } catch (e) {
      console.error('[Cache] Erro ao ler cache local', e);
    }
  }

  return null;
}

export async function setCachedAnalysis(repoUrl: string, data: any, isLocalCLI: boolean = false): Promise<void> {
  const key = getCacheKey(repoUrl);

  // Grava na memória
  if (memoryCache.size >= MAX_MEMORY_ITEMS) {
    const oldestKey = memoryCache.keys().next().value;
    if (oldestKey) memoryCache.delete(oldestKey);
  }
  memoryCache.set(key, { data, timestamp: Date.now() });

  // Grava no disco (somente para CLI local)
  if (isLocalCLI) {
    try {
      const cacheDir = path.resolve('.cache');
      if (!fs.existsSync(cacheDir)) {
        fs.mkdirSync(cacheDir, { recursive: true });
      }
      const cacheFile = path.join(cacheDir, `${key}.json`);
      fs.writeFileSync(cacheFile, JSON.stringify(data), 'utf-8');
    } catch (e) {
      console.error('[Cache] Erro ao gravar cache local', e);
    }
  }
}

export function saveEndpointOutput(endpointName: string, repoUrl: string, data: any): void {
  try {
<<<<<<< HEAD
    saveAllReportsLocally(endpointName, repoUrl, data);
  } catch (e: any) {
    console.error(`[MRCP Auto-Save Error] Falha ao salvar resultado de ${endpointName}:`, e.message);
  }
}
=======
    const cacheFile = path.resolve('mrcp-analysis.json');
    let currentData: any = { repoUrl, updatedAt: new Date().toISOString(), endpoints: {} };

    if (fs.existsSync(cacheFile)) {
      try {
        currentData = JSON.parse(fs.readFileSync(cacheFile, 'utf-8'));
        if (!currentData.endpoints) currentData.endpoints = {};
      } catch (e) {
        /* ignore invalid json */
      }
    }

    currentData.repoUrl = repoUrl || currentData.repoUrl;
    currentData.updatedAt = new Date().toISOString();
    currentData.endpoints[endpointName] = data;

    fs.writeFileSync(cacheFile, JSON.stringify(currentData, null, 2), 'utf-8');
    console.log(`[MRCP Auto-Save] Resultado de ${endpointName} salvo em ${cacheFile}`);
  } catch (e) {
    console.error(`[MRCP Auto-Save Error] Falha ao salvar resultado de ${endpointName}:`, e);
  }
}

>>>>>>> d6b6b143eac7885322e1cb04fd8155dc5ebb9b9e
>>>>>>> 0a10f0543a8d313cd48c6d2ae1e9fdefdee2a770
