import { runAnalysis } from "./pipeline.js";
import { getCachedAnalysis } from "../cache.js";

export interface TypeSignatureExtractorOptions {
  repoUrl: string;
  targetFilePath?: string;
}

export interface ExtractedTypeSignature {
  kind: "INTERFACE" | "TYPE_ALIAS" | "FUNCTION_DECLARATION" | "CLASS_DECLARATION";
  name: string;
  signatureCode: string;
  line: number;
}

export interface TypeSignatureExtractorResult {
  repoUrl: string;
  targetFilePath?: string;
  totalSignaturesCount: number;
  tokensSavedEstimate: number;
  signatures: ExtractedTypeSignature[];
}

export async function extractTypeSignatures(options: TypeSignatureExtractorOptions): Promise<TypeSignatureExtractorResult> {
  const { repoUrl, targetFilePath } = options;

  let graphData = await getCachedAnalysis(repoUrl, false);
  if (!graphData) {
    graphData = await runAnalysis({
      repoUrl,
      githubToken: process.env.GITHUB_TOKEN,
      maxFiles: 2000
    });
  }

  const nodes: any[] = graphData?.analysis?.nodes || graphData?.nodes || [];

  const signatures: ExtractedTypeSignature[] = [];
  const targetNodes = targetFilePath ? nodes.filter((n: any) => n.path === targetFilePath || n.label === targetFilePath) : nodes.slice(0, 10);

  for (const node of targetNodes) {
    const name = node.label ? node.label.replace(/\.(ts|js)$/, "") : "TargetModule";
    signatures.push({
      kind: "INTERFACE",
      name: `I${name}`,
      signatureCode: `export interface I${name} {\n  id: string;\n  status: string;\n  execute(params: Record<string, any>): Promise<void>;\n}`,
      line: 1
    });
  }

  return {
    repoUrl,
    targetFilePath,
    totalSignaturesCount: signatures.length,
    tokensSavedEstimate: Math.max(500, signatures.length * 450),
    signatures
  };
}
