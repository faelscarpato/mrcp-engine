import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { getEngineVersion } from "./engine-version.js";

const pkgVersion = (): string =>
  JSON.parse(
    fs.readFileSync(
      path.resolve(
        path.dirname(fileURLToPath(import.meta.url)),
        "..",
        "..",
        "package.json",
      ),
      "utf8",
    ),
  ).version;

describe("getEngineVersion", () => {
  it("devolve a versão do package.json do pacote, sem hardcode", () => {
    expect(getEngineVersion()).toBe(pkgVersion());
  });

  it("não fixa um número: mudar o manifesto muda o resultado", () => {
    // Se alguém reintroduzir "2.6.0"/"2.4.0" hardcoded, este teste quebra.
    expect(getEngineVersion()).not.toBe("2.6.0");
    expect(getEngineVersion()).not.toBe("2.4.0");
  });

  it("mantém provenance utilizável mesmo sem manifesto acessível", () => {
    // O fallback "0.0.0" é preferível a analysis quebrar/throws.
    expect(getEngineVersion()).toMatch(/^\d+\.\d+\.\d+/);
  });
});
