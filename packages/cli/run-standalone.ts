import { runAnalysis } from "../core/lib/analysis/pipeline.js";
import path from "path";
import fs from "fs";

const args = process.argv.slice(2);
const repoUrl = args[0];

async function main() {
  console.log(`[MRCP-Engine] Iniciando análise stand-alone para: ${repoUrl}\n`);
  try {
    const result = await runAnalysis({
      repoUrl: repoUrl,
      githubToken: process.env.GITHUB_TOKEN,
      maxFiles: 2000,
    });

    const outFile = path.join(process.cwd(), "mrcp-analysis.json");
    fs.writeFileSync(outFile, JSON.stringify(result, null, 2), "utf-8");
    console.log(
      `[MRCP-Engine] ✅ Análise concluída e salva localmente em: ${outFile}\n`,
    );

    console.log(JSON.stringify(result, null, 2));
    process.exit(0);
  } catch (e: any) {
    console.error("Erro na análise:", e.message);
    process.exit(1);
  }
}

main();
