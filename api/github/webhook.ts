import type { VercelRequest, VercelResponse } from "@vercel/node";
import { Webhooks } from "@octokit/webhooks";
import { GitHubAppRunner } from "../../packages/core/lib/github/github-app-runner.ts";

const webhooks = new Webhooks({
  secret: process.env.GITHUB_WEBHOOK_SECRET || "",
});

webhooks.on("push", async ({ payload }) => {
  const installationId = payload.installation?.id;
  const repositoryName = payload.repository.full_name;

  if (!installationId) return;

  const runner = new GitHubAppRunner(installationId);
  await runner.analyzeRepository(repositoryName);
});

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    return res.status(405).send("Method Not Allowed");
  }

  try {
    await webhooks.verifyAndReceive({
      id: (req.headers["x-github-delivery"] as string) || "",
      name: (req.headers["x-github-event"] as string) || "",
      payload: req.body,
      signature: (req.headers["x-hub-signature-256"] as string) || "",
    });

    return res.status(200).send("OK");
  } catch (error: unknown) {
    console.error("Webhook Verification Error:", error);
    return res.status(400).send("Invalid Signature");
  }
}
