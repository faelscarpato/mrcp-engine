import { describe, it, expect } from "vitest";
import {
  detectLanguage,
  isSourceFile,
  isConfigFile,
  detectMonorepoConfig,
} from "./language";

describe("Language Parser", () => {
  it("should detect languages based on extension", () => {
    expect(detectLanguage("file.ts")).toBe("TypeScript");
    expect(detectLanguage("file.js")).toBe("JavaScript");
    expect(detectLanguage("file.py")).toBe("Python");
    expect(detectLanguage("file.cbl")).toBe("COBOL");
    expect(detectLanguage("unknown.xyz")).toBeUndefined();
  });

  it("should identify source files correctly", () => {
    expect(isSourceFile("main.go")).toBe(true);
    expect(isSourceFile("app.tsx")).toBe(true);
    expect(isSourceFile("script.sh")).toBe(true);
    expect(isSourceFile("image.png")).toBe(false);
  });

  it("should identify config files correctly", () => {
    expect(isConfigFile("package.json")).toBe(true);
    expect(isConfigFile("tsconfig.json")).toBe(true);
    expect(isConfigFile("tailwind.config.js")).toBe(true);
    expect(isConfigFile("index.js")).toBe(false);
  });

  it("should detect monorepo config tools", () => {
    // pnpm workspace
    const pnpmFiles = [{ path: "pnpm-workspace.yaml", content: "packages/*" }];
    expect(detectMonorepoConfig(pnpmFiles).tool).toBe("pnpm");

    // lerna
    const lernaFiles = [
      { path: "lerna.json", content: '{"packages":["packages/*"]}' },
    ];
    expect(detectMonorepoConfig(lernaFiles).tool).toBe("lerna");

    // no monorepo
    const normalFiles = [{ path: "package.json", content: "{}" }];
    expect(detectMonorepoConfig(normalFiles).tool).toBe("none");
  });
});
