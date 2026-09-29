import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

/**
 * Versão do motor lida do `package.json` do próprio pacote.
 *
 * A versão NÃO pode ficar hardcoded em nenhuma análise: `document-analyzer` e
 * `full-suite` já divergiram do manifesto (2.6.0 e 2.4.0 contra 2.7.3 real).
 * A provenance existe justamente para dizer de qual pacote o resultado veio,
 * então ela é derivada do manifesto para não poder divergir de novo.
 *
 * `lib/` e `dist/` estão ambos um nível abaixo de `packages/core`, então
 * `../../package.json` resolve nos dois casos (execução via tsx/vitest e build).
 */
function readVersion(): string {
  const candidates: string[] = [];
  try {
    candidates.push(
      path.resolve(
        path.dirname(fileURLToPath(import.meta.url)),
        "..",
        "..",
        "package.json",
      ),
    );
  } catch {
    // `import.meta.url` indisponível (bundler exotic): cai para o cwd.
  }
  candidates.push(
    path.resolve(process.cwd(), "packages", "core", "package.json"),
    path.resolve(process.cwd(), "package.json"),
  );

  for (const candidate of candidates) {
    try {
      const parsed = JSON.parse(fs.readFileSync(candidate, "utf8"));
      if (parsed && typeof parsed.version === "string" && parsed.version) {
        return parsed.version;
      }
    } catch {
      // Candidato ausente ou ilegível: tenta o próximo.
    }
  }
  // Fallback explícito: provenance vale mais que analysis quebrar.
  return "0.0.0";
}

let cached: string | null = null;

/** Versão do pacote, memoizada por processo. */
export function getEngineVersion(): string {
  if (cached === null) cached = readVersion();
  return cached;
}
