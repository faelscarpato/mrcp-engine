import { VercelRequest, VercelResponse } from "@vercel/node";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  const { repo, file } = req.query;

  if (!repo || !file || typeof repo !== "string" || typeof file !== "string") {
    return res.status(400).json({
      error: "Parâmetros inválidos. Use ?repo=URL_DO_REPO & file=CAMINHO_EXATO",
    });
  }

  try {
    const urlParts = repo.replace("https://github.com/", "").split("/");
    const owner = urlParts[0];
    const repoName = urlParts[1];

    const githubApiUrl = `https://api.github.com/repos/${owner}/${repoName}/contents/${file}`;
    const response = await fetch(githubApiUrl, {
      headers: {
        "User-Agent": "MRCP-Engine-Agent",
        // 'Authorization': `Bearer ${process.env.GITHUB_TOKEN}` // Descomente e configure se tomar Rate Limit do GitHub
      },
    });

    if (!response.ok) {
      return res
        .status(response.status)
        .json({ error: "Arquivo não encontrado ou repositório privado." });
    }

    const data = await response.json();
    const decodedContent = Buffer.from(data.content, "base64").toString(
      "utf-8",
    );
    const lines = decodedContent.split("\n").length;

    return res.status(200).json({
      file: data.path,
      lines: lines,
      size_bytes: data.size,
      content: decodedContent,
    });
  } catch (error) {
    return res
      .status(500)
      .json({ error: "Erro interno ao processar a leitura do arquivo." });
  }
}
