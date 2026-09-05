import type { ExtractedFunction } from "./functions.js";

export const FUNCTION_PATTERNS: Record<
  string,
  Array<{
    regex: RegExp;
    extract: (match: RegExpMatchArray) => ExtractedFunction | null;
  }>
> = {
  ts: [
    {
      regex: /function\s+([a-zA-Z_$][\w$]*)\s*\(([^)]*)\)\s*\{/g,
      extract: (m) => ({
        name: m[1],
        path: "",
        line: 0,
        language: "TypeScript",
        parameters: m[2]
          .split(",")
          .map((p) => p.trim())
          .filter(Boolean),
        isMethod: false,
      }),
    },
    {
      regex: /(?:const|let|var)\s+([a-zA-Z_$][\w$]*)\s*=\s*\(([^)]*)\)\s*=>/g,
      extract: (m) => ({
        name: m[1],
        path: "",
        line: 0,
        language: "TypeScript",
        parameters: m[2]
          .split(",")
          .map((p) => p.trim())
          .filter(Boolean),
        isMethod: false,
      }),
    },
    {
      regex: /([a-zA-Z_$][\w$]*)\s*\(([^)]*)\)\s*\{(?:\s*\/\/|\s*\/\*|\s*\*)?/g,
      extract: (m) => ({
        name: m[1],
        path: "",
        line: 0,
        language: "TypeScript",
        parameters: m[2]
          .split(",")
          .map((p) => p.trim())
          .filter(Boolean),
        isMethod: false,
      }),
    },
    {
      regex: /([a-zA-Z_$][\w$]*)\s*\(([^)]*)\)\s*\{/g,
      extract: (m) => ({
        name: m[1],
        path: "",
        line: 0,
        language: "TypeScript",
        parameters: m[2]
          .split(",")
          .map((p) => p.trim())
          .filter(Boolean),
        isMethod: false,
      }),
    },
  ],
  js: [
    {
      regex: /function\s+([a-zA-Z_$][\w$]*)\s*\(([^)]*)\)\s*\{/g,
      extract: (m) => ({
        name: m[1],
        path: "",
        line: 0,
        language: "JavaScript",
        parameters: m[2]
          .split(",")
          .map((p) => p.trim())
          .filter(Boolean),
        isMethod: false,
      }),
    },
    {
      regex: /(?:const|let|var)\s+([a-zA-Z_$][\w$]*)\s*=\s*\(([^)]*)\)\s*=>/g,
      extract: (m) => ({
        name: m[1],
        path: "",
        line: 0,
        language: "JavaScript",
        parameters: m[2]
          .split(",")
          .map((p) => p.trim())
          .filter(Boolean),
        isMethod: false,
      }),
    },
  ],
  py: [
    {
      regex: /def\s+([a-zA-Z_][\w]*)\s*\(([^)]*)\)\s*:/g,
      extract: (m) => ({
        name: m[1],
        path: "",
        line: 0,
        language: "Python",
        parameters: m[2]
          .split(",")
          .map((p) => p.trim())
          .filter(Boolean),
        isMethod: false,
      }),
    },
    {
      regex: /def\s+([a-zA-Z_][\w]*)\s*\(self[^)]*\)\s*:/g,
      extract: (m) => ({
        name: m[1],
        path: "",
        line: 0,
        language: "Python",
        parameters: [],
        isMethod: true,
      }),
    },
    {
      regex: /async\s+def\s+([a-zA-Z_][\w]*)\s*\(([^)]*)\)\s*:/g,
      extract: (m) => ({
        name: m[1],
        path: "",
        line: 0,
        language: "Python",
        parameters: m[2]
          .split(",")
          .map((p) => p.trim())
          .filter(Boolean),
        isMethod: false,
      }),
    },
  ],
  go: [
    {
      regex: /func\s+([a-zA-Z_][\w]*)\s*\(([^)]*)\)\s*[^{]*\{/g,
      extract: (m) => ({
        name: m[1],
        path: "",
        line: 0,
        language: "Go",
        parameters: m[2]
          .split(",")
          .map((p) => p.trim())
          .filter(Boolean),
        isMethod: false,
      }),
    },
    {
      regex: /func\s*\([^)]+\)\s+([a-zA-Z_][\w]*)\s*\(([^)]*)\)\s*[^{]*\{/g,
      extract: (m) => ({
        name: m[1],
        path: "",
        line: 0,
        language: "Go",
        parameters: m[2]
          .split(",")
          .map((p) => p.trim())
          .filter(Boolean),
        isMethod: true,
      }),
    },
  ],
  rs: [
    {
      regex: /fn\s+([a-zA-Z_][\w]*)\s*\(([^)]*)\)\s*(?:->\s*[^{]+)?\s*\{/g,
      extract: (m) => ({
        name: m[1],
        path: "",
        line: 0,
        language: "Rust",
        parameters: m[2]
          .split(",")
          .map((p) => p.trim())
          .filter(Boolean),
        isMethod: false,
      }),
    },
    {
      regex: /fn\s+([a-zA-Z_][\w]*)\s*\((&?[^)]*)\)\s*(?:->\s*[^{]+)?\s*\{/g,
      extract: (m) => ({
        name: m[1],
        path: "",
        line: 0,
        language: "Rust",
        parameters: m[2]
          .split(",")
          .map((p) => p.trim())
          .filter(Boolean),
        isMethod: true,
      }),
    },
  ],
  java: [
    {
      regex:
        /(?:public|private|protected|static|final|native|synchronized|\s)\s*[\w<>[]\s]+\s+([a-zA-Z_][\w]*)\s*\(([^)]*)\)\s*\{/g,
      extract: (m) => ({
        name: m[1],
        path: "",
        line: 0,
        language: "Java",
        parameters: m[2]
          .split(",")
          .map((p) => p.trim())
          .filter(Boolean),
        isMethod: false,
      }),
    },
  ],
  c: [
    {
      regex: /[\w\s*]+\s+([a-zA-Z_][\w]*)\s*\(([^)]*)\)\s*\{/g,
      extract: (m) => ({
        name: m[1],
        path: "",
        line: 0,
        language: "C",
        parameters: m[2]
          .split(",")
          .map((p) => p.trim())
          .filter(Boolean),
        isMethod: false,
      }),
    },
  ],
  cpp: [
    {
      regex:
        /(?:[\w:\s<>]+\s+)+([a-zA-Z_][\w]*)\s*\(([^)]*)\)\s*(?:const)?\s*\{/g,
      extract: (m) => ({
        name: m[1],
        path: "",
        line: 0,
        language: "C++",
        parameters: m[2]
          .split(",")
          .map((p) => p.trim())
          .filter(Boolean),
        isMethod: false,
      }),
    },
  ],
  php: [
    {
      regex: /function\s+([a-zA-Z_][\w]*)\s*\(([^)]*)\)\s*\{/g,
      extract: (m) => ({
        name: m[1],
        path: "",
        line: 0,
        language: "PHP",
        parameters: m[2]
          .split(",")
          .map((p) => p.trim())
          .filter(Boolean),
        isMethod: false,
      }),
    },
    {
      regex:
        /(?:public|private|protected|static|final|abstract|\s)\s+function\s+([a-zA-Z_][\w]*)\s*\(([^)]*)\)\s*\{/g,
      extract: (m) => ({
        name: m[1],
        path: "",
        line: 0,
        language: "PHP",
        parameters: m[2]
          .split(",")
          .map((p) => p.trim())
          .filter(Boolean),
        isMethod: true,
      }),
    },
  ],
  rb: [
    {
      regex: /def\s+([a-zA-Z_][\w?]*)\s*\(?([^)]*)\)?/g,
      extract: (m) => ({
        name: m[1],
        path: "",
        line: 0,
        language: "Ruby",
        parameters: m[2]
          ? m[2]
              .split(",")
              .map((p) => p.trim())
              .filter(Boolean)
          : [],
        isMethod: false,
      }),
    },
  ],
  swift: [
    {
      regex: /func\s+([a-zA-Z_][\w]*)\s*\(([^)]*)\)\s*(?:->\s*[^{]+)?\s*\{/g,
      extract: (m) => ({
        name: m[1],
        path: "",
        line: 0,
        language: "Swift",
        parameters: m[2]
          .split(",")
          .map((p) => p.trim())
          .filter(Boolean),
        isMethod: false,
      }),
    },
  ],
  kt: [
    {
      regex: /fun\s+([a-zA-Z_][\w]*)\s*\(([^)]*)\)\s*(?::\s*[^{]+)?\s*\{/g,
      extract: (m) => ({
        name: m[1],
        path: "",
        line: 0,
        language: "Kotlin",
        parameters: m[2]
          .split(",")
          .map((p) => p.trim())
          .filter(Boolean),
        isMethod: false,
      }),
    },
  ],
  scala: [
    {
      regex: /def\s+([a-zA-Z_][\w]*)\s*\(([^)]*)\)\s*(?::\s*[^=]+)?\s*=/g,
      extract: (m) => ({
        name: m[1],
        path: "",
        line: 0,
        language: "Scala",
        parameters: m[2]
          .split(",")
          .map((p) => p.trim())
          .filter(Boolean),
        isMethod: false,
      }),
    },
  ],
};
