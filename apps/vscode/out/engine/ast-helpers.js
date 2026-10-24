"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SECRET_RULES = exports.DOC_EXTENSIONS = exports.CODE_EXTENSIONS = void 0;
exports.getLanguageName = getLanguageName;
exports.parseTypedParameters = parseTypedParameters;
exports.calculateFunctionBodyComplexity = calculateFunctionBodyComplexity;
exports.CODE_EXTENSIONS = new Set([
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
    // Swift & Kotlin
    ".swift",
    ".kt",
    ".kts",
    // ActionScript
    ".as",
    ".mxml",
    // AppleScript
    ".applescript",
    ".scpt",
    ".scptd",
    ".jxa",
    // AutoHotkey
    ".ahk",
    ".ah2",
    // AutoIt
    ".au3",
    // Bicep
    ".bicep",
    ".bicepparam",
    // Pipeline
    ".jenkinsfile",
    // CFML
    ".cfm",
    ".cfc",
    ".cfs",
    // Verse
    ".verse",
    // Q / KDB+
    ".q",
    ".k",
    // Modelica
    ".mo",
    // InterSystems ObjectScript
    ".mac",
    ".int",
    // Software AG Natural
    ".nsp",
    ".nsn",
    ".nss",
    ".nsa",
    ".nsg",
    ".nspda",
    ".nsl",
    ".nsc",
    ".nsf",
    // Pascal extras
    ".dpr",
    ".dpk",
    ".lpr",
    // OpenSCAD
    ".scad",
    // Pawn
    ".pwn",
    ".sma",
    // Salesforce Apex
    ".cls",
    ".trigger",
    // SAS
    ".sas",
    ".sash",
    // Siemens SCL / STEP 7
    ".scl",
    ".awl",
    ".udt",
    ".db",
    // Structured Text
    ".st",
    ".pou",
    ".exp",
    // MQL5
    ".mq5",
    ".mqh",
    // RPGLE
    ".rpgle",
    ".rpg",
    ".sqlrpgle",
    // Pine Script
    ".pine",
    // JCL
    ".jcl",
    ".job",
    // Power Query M
    ".pq",
    // DAX
    ".dax",
    // T-SQL
    ".tsql",
    // VBA
    ".bas",
    ".frm",
    ".ctl",
    ".vbp",
    // VHDL
    ".vhd",
    ".vhdl",
    // Web3 (Vyper & Move)
    ".vy",
    ".move",
    // OpenEdge ABL
    ".p",
    ".w",
    ".i",
]);
exports.DOC_EXTENSIONS = new Set([
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
exports.SECRET_RULES = [
    {
        rule: "AWS Key",
        regex: /(?:AKIA|ASIA)[0-9A-Z]{16}/,
        severity: "critical",
        msg: "Hardcoded AWS Access Key detected.",
    },
    {
        rule: "Generic Private Key",
        regex: /-----BEGIN (?:RSA|OPENSSH|EC|DSA) PRIVATE KEY-----/,
        severity: "critical",
        msg: "Private cryptographic key exposed in source.",
    },
    {
        rule: "GitHub Token",
        regex: /gh[pousr]_[0-9a-zA-Z]{36}/,
        severity: "critical",
        msg: "GitHub Personal/OAuth Token detected.",
    },
    {
        rule: "Hardcoded JWT",
        regex: /eyJ[a-zA-Z0-9_-]{10,}\.eyJ[a-zA-Z0-9_-]{10,}\.[a-zA-Z0-9_-]{10,}/,
        severity: "high",
        msg: "Hardcoded JSON Web Token (JWT) detected.",
    },
    {
        rule: "Dangerous Eval",
        regex: /(?<![/*a-zA-Z0-9_])eval\s*\([^)]+\)/,
        severity: "high",
        msg: "Arbitrary code execution risk with eval().",
    },
    {
        rule: "Hardcoded Password/Secret",
        regex: /(?:password|secret|apiKey|api_key|authToken)\s*[:=]\s*["'][a-zA-Z0-9_\-!@#$%^&*]{16,}["']/i,
        severity: "medium",
        msg: "Possible hardcoded credential or secret.",
    },
];
function getLanguageName(ext) {
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
        case ".swift":
            return "Swift";
        case ".kt":
        case ".kts":
            return "Kotlin";
        case ".as":
        case ".mxml":
            return "ActionScript";
        case ".applescript":
        case ".scpt":
        case ".scptd":
        case ".jxa":
            return "AppleScript";
        case ".ahk":
        case ".ah2":
            return "AutoHotkey";
        case ".au3":
            return "AutoIt";
        case ".bicep":
        case ".bicepparam":
            return "Bicep";
        case ".jenkinsfile":
            return "JenkinsPipeline";
        case ".cfm":
        case ".cfc":
        case ".cfs":
            return "CFML";
        case ".verse":
            return "Verse";
        case ".q":
        case ".k":
            return "Q";
        case ".mo":
            return "Modelica";
        case ".mac":
        case ".int":
            return "ObjectScript";
        case ".nsp":
        case ".nsn":
        case ".nss":
        case ".nsa":
        case ".nsg":
        case ".nspda":
        case ".nsl":
        case ".nsc":
        case ".nsf":
            return "Natural";
        case ".scad":
            return "OpenSCAD";
        case ".pwn":
        case ".sma":
            return "Pawn";
        case ".cls":
        case ".trigger":
            return "Apex";
        case ".sas":
        case ".sash":
            return "SAS";
        case ".scl":
        case ".awl":
        case ".udt":
        case ".db":
            return "SCL";
        case ".st":
        case ".pou":
        case ".exp":
            return "Structured Text";
        case ".mq5":
        case ".mqh":
            return "MQL5";
        case ".rpgle":
        case ".rpg":
        case ".sqlrpgle":
            return "RPGLE";
        case ".pine":
            return "PineScript";
        case ".jcl":
        case ".job":
            return "JCL";
        case ".pq":
            return "PowerQuery";
        case ".dax":
            return "DAX";
        case ".tsql":
            return "TSQL";
        case ".bas":
        case ".frm":
        case ".ctl":
        case ".vbp":
            return "VBA";
        case ".vhd":
        case ".vhdl":
            return "VHDL";
        case ".vy":
            return "Vyper";
        case ".move":
            return "Move";
        case ".p":
        case ".w":
        case ".i":
            return "OpenEdge ABL";
        default:
            return "Other";
    }
}
function parseTypedParameters(raw) {
    if (!raw.trim())
        return [];
    const parts = [];
    let current = "";
    let depth = 0;
    for (let i = 0; i < raw.length; i++) {
        const char = raw[i];
        if (char === "<" || char === "{" || char === "(")
            depth++;
        else if (char === ">" || char === "}" || char === ")")
            depth--;
        if (char === "," && depth === 0) {
            parts.push(current.trim());
            current = "";
        }
        else {
            current += char;
        }
    }
    if (current.trim())
        parts.push(current.trim());
    return parts.map((p) => {
        const isOpt = p.includes("?");
        const [namePart, ...typeParts] = p.split(":");
        const cleanName = namePart.replace(/[?=].*$/, "").trim();
        const type = typeParts.length > 0 ? typeParts.join(":").trim() : undefined;
        return { name: cleanName, type, optional: isOpt };
    });
}
function calculateFunctionBodyComplexity(content, startIndex) {
    let openBraces = 1;
    let endIndex = startIndex;
    for (let i = startIndex; i < content.length; i++) {
        if (content[i] === "{")
            openBraces++;
        else if (content[i] === "}") {
            openBraces--;
            if (openBraces === 0) {
                endIndex = i;
                break;
            }
        }
    }
    const body = content.substring(startIndex, endIndex);
    const branches = body.match(/\b(if|else\s+if|for|while|case|catch)\b|\?|&&|\|\||\?\?/g);
    return (branches ? branches.length : 0) + 1;
}
//# sourceMappingURL=ast-helpers.js.map