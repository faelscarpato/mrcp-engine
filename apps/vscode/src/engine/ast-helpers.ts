export const CODE_EXTENSIONS = new Set([
  ".ts",
  ".tsx",
  ".js",
  ".jsx",
  ".mjs",
  ".cjs",
  ".py",
  ".go",
  ".rs",
  ".java",
  ".c",
  ".cpp",
  ".php",
  ".rb",
  ".cs",
  ".cds",
  ".abap",
  ".clas",
  ".intf",
  ".prog",
  ".sql",
  ".pls",
  ".pks",
  ".pkb",
  ".pck",
  ".plb",
  ".trg",
  ".fnc",
  ".prc",
  ".pas",
  ".pp",
  ".inc",
  ".cbl",
  ".cob",
  ".cpy",
]);

export const DOC_EXTENSIONS = new Set([
  ".md",
  ".txt",
  ".csv",
  ".json",
  ".yaml",
  ".yml",
  ".docx",
  ".pdf",
  ".xlsx",
  ".log",
]);

export const SECRET_RULES = [
  {
    rule: "AWS Key",
    regex: /(?:AKIA|ASIA)[0-9A-Z]{16}/,
    severity: "critical" as const,
    msg: "Hardcoded AWS Access Key detected.",
  },
  {
    rule: "Generic Private Key",
    regex: /-----BEGIN (?:RSA|OPENSSH|EC|DSA) PRIVATE KEY-----/,
    severity: "critical" as const,
    msg: "Private cryptographic key exposed in source.",
  },
  {
    rule: "GitHub Token",
    regex: /gh[pousr]_[0-9a-zA-Z]{36}/,
    severity: "critical" as const,
    msg: "GitHub Personal/OAuth Token detected.",
  },
  {
    rule: "Hardcoded JWT",
    regex: /eyJ[a-zA-Z0-9_-]{10,}\.eyJ[a-zA-Z0-9_-]{10,}\.[a-zA-Z0-9_-]{10,}/,
    severity: "high" as const,
    msg: "Hardcoded JSON Web Token (JWT) detected.",
  },
  {
    rule: "Dangerous Eval",
    regex: /(?<![\/\*a-zA-Z0-9_])eval\s*\([^)]+\)/,
    severity: "high" as const,
    msg: "Arbitrary code execution risk with eval().",
  },
  {
    rule: "Hardcoded Password/Secret",
    regex:
      /(?:password|secret|apiKey|api_key|authToken)\s*[:=]\s*["'][a-zA-Z0-9_\-!@#$%^&*]{16,}["']/i,
    severity: "medium" as const,
    msg: "Possible hardcoded credential or secret.",
  },
];

export function getLanguageName(ext: string): string {
  switch (ext) {
    case ".ts":
    case ".tsx":
      return "TypeScript";
    case ".js":
    case ".jsx":
    case ".mjs":
    case ".cjs":
      return "JavaScript";
    case ".py":
      return "Python";
    case ".go":
      return "Go";
    case ".rs":
      return "Rust";
    case ".java":
      return "Java";
    case ".c":
    case ".cpp":
      return "C/C++";
    case ".php":
      return "PHP";
    case ".rb":
      return "Ruby";
    case ".cs":
      return "C#";
    case ".cds":
      return "SAP CDS";
    case ".abap":
    case ".clas":
    case ".intf":
    case ".prog":
      return "SAP ABAP";
    case ".sql":
    case ".pls":
    case ".pks":
    case ".pkb":
    case ".pck":
    case ".plb":
    case ".trg":
    case ".fnc":
    case ".prc":
      return "Oracle PL/SQL";
    case ".pas":
    case ".pp":
    case ".inc":
      return "Pascal";
    case ".cbl":
    case ".cob":
    case ".cpy":
      return "COBOL";
    default:
      return "Other";
  }
}

export function parseTypedParameters(
  raw: string,
): Array<{ name: string; type?: string; optional?: boolean }> {
  if (!raw.trim()) return [];
  const parts: string[] = [];
  let current = "";
  let depth = 0;

  for (let i = 0; i < raw.length; i++) {
    const char = raw[i];
    if (char === "<" || char === "{" || char === "(") depth++;
    else if (char === ">" || char === "}" || char === ")") depth--;

    if (char === "," && depth === 0) {
      parts.push(current.trim());
      current = "";
    } else {
      current += char;
    }
  }
  if (current.trim()) parts.push(current.trim());

  return parts.map((p) => {
    const isOpt = p.includes("?");
    const [namePart, ...typeParts] = p.split(":");
    const cleanName = namePart.replace(/[?=].*$/, "").trim();
    const type = typeParts.length > 0 ? typeParts.join(":").trim() : undefined;
    return { name: cleanName, type, optional: isOpt };
  });
}

export function calculateFunctionBodyComplexity(
  content: string,
  startIndex: number,
): number {
  let openBraces = 1;
  let endIndex = startIndex;

  for (let i = startIndex; i < content.length; i++) {
    if (content[i] === "{") openBraces++;
    else if (content[i] === "}") {
      openBraces--;
      if (openBraces === 0) {
        endIndex = i;
        break;
      }
    }
  }

  const body = content.substring(startIndex, endIndex);
  const branches = body.match(
    /\b(if|else\s+if|for|while|case|catch)\b|\?|&&|\|\||\?\?/g,
  );
  return (branches ? branches.length : 0) + 1;
}
