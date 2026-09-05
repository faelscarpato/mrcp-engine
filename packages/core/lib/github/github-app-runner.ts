import { Octokit } from "@octokit/rest";
import { createAppAuth } from "@octokit/auth-app";

export class GitHubAppRunner {
  private octokit: Octokit;

  constructor(installationId: number) {
    this.octokit = new Octokit({
      authStrategy: createAppAuth,
      auth: {
        appId: process.env.GITHUB_APP_ID,
        privateKey: process.env.GITHUB_PRIVATE_KEY?.replace(/\\n/g, "\n"),
        installationId,
      },
    });
  }

  async analyzeRepository(fullName: string) {
    const [owner, repo] = fullName.split("/");
    try {
      const { data: contents } = await this.octokit.repos.getContent({
        owner,
        repo,
        path: "",
      });
      return contents;
    } catch (error: unknown) {
      console.error(`Erro ao acessar repositório ${fullName}:`, error);
      throw error;
    }
  }
}
