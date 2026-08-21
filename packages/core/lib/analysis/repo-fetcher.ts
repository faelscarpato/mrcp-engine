import fs from "fs";
import path from "path";
import { parseTargetUrl } from "./pipeline.js";

export interface FetchedFile {
  path: string;
  content: string;
  size: number;
  isCorrupted?: boolean;
  rawBuffer?: Buffer;
  error?: string;
}

const fileContentCache = new Map<string, FetchedFile>();

export async function fetchRepoBuffer(
  repoUrl: string,
  filePath: string,
  githubToken?: string
): Promise<Buffer | null> {
  const file = await fetchRepoFile(repoUrl, filePath, githubToken);
  if (!file) return null;
  if (file.rawBuffer) return file.rawBuffer;
  return Buffer.from(file.content, "utf-8");
}

export async function fetchRepoFile(
  repoUrl: string,
  filePath: string,
  githubToken?: string
): Promise<FetchedFile | null> {
  const cacheKey = `${repoUrl}::${filePath}`;
  if (fileContentCache.has(cacheKey)) {
    return fileContentCache.get(cacheKey)!;
  }

  const parsed = parseTargetUrl(repoUrl);
  if (!parsed) {
    return null;
  }

  // 1. Local repository / directory
  if (parsed.targetType === "local") {
    let baseDir = repoUrl;
    if (baseDir.startsWith("file://")) {
      baseDir = new URL(baseDir).pathname;
    }
    const fullPath = path.isAbsolute(filePath) ? filePath : path.resolve(baseDir, filePath);
    try {
      if (!fs.existsSync(fullPath)) {
        return null;
      }
      const stat = await fs.promises.stat(fullPath);
      if (stat.isDirectory()) {
        return null;
      }
      const rawBuffer = await fs.promises.readFile(fullPath);
      // Check for binary or corrupted utf-8 content
      const content = rawBuffer.toString("utf-8");
      const isCorrupted = !/\.(pdf|docx|xlsx|xls|doc|png|jpg|jpeg|zip|wasm)$/i.test(filePath) && content.includes("\u0000");

      const file: FetchedFile = {
        path: filePath,
        content,
        size: stat.size,
        rawBuffer,
        isCorrupted
      };
      fileContentCache.set(cacheKey, file);
      return file;
    } catch (err: any) {
      return {
        path: filePath,
        content: "",
        size: 0,
        isCorrupted: true,
        error: err.message
      };
    }
  }

  // 2. GitHub repository
  if (parsed.targetType === "github") {
    const { owner, repo } = parsed;
    const branches = ["main", "master", "develop"];
    const headers: Record<string, string> = {};
    if (githubToken || process.env.GITHUB_TOKEN) {
      headers.Authorization = `Bearer ${githubToken || process.env.GITHUB_TOKEN}`;
    }

    for (const branch of branches) {
      try {
        const rawUrl = `https://raw.githubusercontent.com/${owner}/${repo}/${branch}/${filePath}`;
        const res = await fetch(rawUrl, { headers });
        if (res.ok) {
          const arrayBuffer = await res.arrayBuffer();
          const rawBuffer = Buffer.from(arrayBuffer);
          const content = rawBuffer.toString("utf-8");
          const isCorrupted = !/\.(pdf|docx|xlsx|xls|doc|png|jpg|jpeg|zip|wasm)$/i.test(filePath) && content.includes("\u0000");
          const file: FetchedFile = {
            path: filePath,
            content,
            size: rawBuffer.length,
            rawBuffer,
            isCorrupted
          };
          fileContentCache.set(cacheKey, file);
          return file;
        }
      } catch {
        // Try next branch
      }
    }
    return null;
  }

  return null;
}

export async function findRepoFiles(
  repoUrl: string,
  filterPattern?: (path: string) => boolean,
  githubToken?: string
): Promise<string[]> {
  const parsed = parseTargetUrl(repoUrl);
  if (!parsed) return [];

  // Local
  if (parsed.targetType === "local") {
    let baseDir = repoUrl;
    if (baseDir.startsWith("file://")) {
      baseDir = new URL(baseDir).pathname;
    }
    if (!fs.existsSync(baseDir)) return [];

    const matched: string[] = [];
    async function scan(dir: string) {
      const entries = await fs.promises.readdir(dir, { withFileTypes: true });
      for (const entry of entries) {
        if (
          entry.name === "node_modules" ||
          entry.name === ".git" ||
          entry.name === "dist" ||
          entry.name === "out" ||
          entry.name === "build" ||
          entry.name === ".next" ||
          entry.name === ".turbo" ||
          entry.name === ".gemini" ||
          entry.name === "coverage" ||
          entry.name === ".cache"
        ) {
          continue;
        }
        const full = path.join(dir, entry.name);
        const rel = path.relative(baseDir, full).split(path.sep).join("/");
        if (entry.isDirectory()) {
          await scan(full);
        } else if (entry.isFile()) {
          if (!filterPattern || filterPattern(rel)) {
            matched.push(rel);
          }
        }
      }
    }
    try {
      await scan(baseDir);
    } catch {
      return [];
    }
    return matched;
  }

  // GitHub
  if (parsed.targetType === "github") {
    const { owner, repo } = parsed;
    const branches = ["main", "master"];
    const headers: Record<string, string> = {
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
    };
    const token = githubToken || process.env.GITHUB_TOKEN;
    if (token) headers.Authorization = `Bearer ${token}`;

    for (const branch of branches) {
      try {
        const treeUrl = `https://api.github.com/repos/${owner}/${repo}/git/trees/${encodeURIComponent(branch)}?recursive=1`;
        const res = await fetch(treeUrl, { headers });
        if (res.ok) {
          const data: any = await res.json();
          const tree: any[] = data.tree || [];
          return tree
            .filter((item) => item.type === "blob")
            .map((item) => item.path)
            .filter((p) => !filterPattern || filterPattern(p));
        }
      } catch {
        // Try next
      }
    }
  }

  return [];
}
