import fs from "fs";
import path from "path";

export interface ReportOptions {
  format?: "json" | "markdown" | "md";
  download?: boolean;
  saveDir?: string;
}

/**
 * Ensures the target reports directory exists and writes files safely.
 */
function ensureDirAndWrite(filePath: string, content: string): boolean {
  try {
    const dir = path.dirname(filePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(filePath, content, "utf-8");
    return true;
  } catch (err: any) {
    // If running in a read-only container like Vercel cloud, gracefully fallback to /tmp or log
    try {
      const tmpPath = path.join("/tmp", path.basename(filePath));
      fs.writeFileSync(tmpPath, content, "utf-8");
    } catch {
      // ignore
    }
    return false;
  }
}

/**
 * Generates formatted Markdown for any endpoint result.
 */
import { formatEndpointToMarkdown } from "./reports/endpoint-formatters.js";
export { formatEndpointToMarkdown };

export function saveAllReportsLocally(
  endpointName: string,
  repoUrl: string,
  data: any,
  projectDir: string = process.cwd(),
): {
  jsonReportPath: string;
  markdownReportPath: string;
  executiveReportPath?: string;
} {
  const reportsDir = path.join(projectDir, "reports");
  const jsonReportPath = path.join(reportsDir, "mrcp-analysis.json");
  const markdownReportPath = path.join(
    reportsDir,
    `MRCP_${endpointName.toUpperCase().replace(/[^A-Z0-9_]/g, "_")}.md`,
  );
  const rootJsonPath = path.join(projectDir, "mrcp-analysis.json");
  const executiveReportPath = path.join(projectDir, "MRCP_EXECUTIVE_REPORT.md");

  try {
    // 1. Update consolidated JSON
    let currentData: any = {
      repoUrl,
      updatedAt: new Date().toISOString(),
      endpoints: {},
    };
    if (fs.existsSync(rootJsonPath)) {
      try {
        currentData = JSON.parse(fs.readFileSync(rootJsonPath, "utf-8"));
        if (!currentData.endpoints) currentData.endpoints = {};
      } catch {
        // ignore
      }
    }

    currentData.repoUrl = repoUrl || currentData.repoUrl;
    currentData.updatedAt = new Date().toISOString();
    currentData.endpoints[endpointName] = data;

    const formattedJson = JSON.stringify(currentData, null, 2);
    ensureDirAndWrite(rootJsonPath, formattedJson);
    ensureDirAndWrite(jsonReportPath, formattedJson);

    // 2. Generate and save Markdown report
    const markdownContent = formatEndpointToMarkdown(
      endpointName,
      repoUrl,
      data,
    );
    ensureDirAndWrite(markdownReportPath, markdownContent);

    // 3. If full suite or executive dashboard, also update root MRCP_EXECUTIVE_REPORT.md
    if (
      endpointName === "full_repository_diagnostic_suite" ||
      endpointName === "full_analysis" ||
      data.executiveDashboardMarkdown ||
      data.full_diagnostic
    ) {
      ensureDirAndWrite(executiveReportPath, markdownContent);
      ensureDirAndWrite(
        path.join(reportsDir, "MRCP_EXECUTIVE_REPORT.md"),
        markdownContent,
      );
    }

    console.log(`[MRCP Report Engine] ✅ Relatórios salvos com sucesso:`);
    console.log(`   - JSON: ${rootJsonPath}`);
    console.log(`   - Markdown: ${markdownReportPath}`);

    return { jsonReportPath, markdownReportPath, executiveReportPath };
  } catch (err: any) {
    console.error(
      `[MRCP Report Engine Error] Falha ao gravar relatórios:`,
      err.message,
    );
    return { jsonReportPath, markdownReportPath };
  }
}

/**
 * Handles HTTP response formatting based on query parameters (?format=markdown, ?download=true, etc.)
 */
export function sendFormattedResponse(
  req: any,
  res: any,
  endpointName: string,
  repoUrl: string,
  data: any,
) {
  // Always trigger local disk save
  saveAllReportsLocally(endpointName, repoUrl, data);

  const format = String(
    req.query?.format || req.body?.format || "",
  ).toLowerCase();
  const shouldDownload =
    req.query?.download === "true" ||
    req.query?.download === "1" ||
    req.body?.download === true;

  // Markdown format requested
  if (
    format === "markdown" ||
    format === "md" ||
    req.headers?.accept === "text/markdown"
  ) {
    const md = formatEndpointToMarkdown(endpointName, repoUrl, data);
    res.setHeader("Content-Type", "text/markdown; charset=utf-8");
    if (shouldDownload) {
      res.setHeader(
        "Content-Disposition",
        `attachment; filename="mrcp-${endpointName.replace(/_/g, "-")}-report.md"`,
      );
    }
    return res.status(200).send(md);
  }

  // File download requested in JSON
  if (shouldDownload) {
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="mrcp-${endpointName.replace(/_/g, "-")}-report.json"`,
    );
    return res.status(200).json(data);
  }

  // Standard JSON response
  return res.status(200).json(data);
}
