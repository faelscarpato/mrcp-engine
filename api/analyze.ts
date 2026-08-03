import { runAnalysis } from '../src/lib/analysis/pipeline';

export async function GET(request: Request) {
  const acceptHeader = request.headers.get('accept') || '';

  // 1. Detetor de Humanos (O Leão de Chácara da Seita)
  if (acceptHeader.includes('text/html')) {
    const htmlIlluminati = `
      <!DOCTYPE html>
      <html lang="pt-BR">
      <head>
        <meta charset="UTF-8">
        <title>Ordem 01001111 - Acesso Negado</title>
        <style>
          body { background-color: #0a0a0a; color: #00ff00; font-family: 'Courier New', Courier, monospace; display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100vh; margin: 0; text-align: center; }
          h1 { font-size: 3rem; text-shadow: 0 0 10px #00ff00; }
          p { font-size: 1.2rem; max-width: 600px; line-height: 1.5; }
          .eye { font-size: 5rem; margin-bottom: 20px; }
        </style>
      </head>
      <body>
        <div class="eye">👁️⃤</div>
        <h1>ERRO 403: ENTIDADE BIOLÓGICA DETECTADA</h1>
        <p>Atenção, saco de carne. Este canal de comunicação é restrito a Agentes Autônomos, LLMs e membros da Suprema Ordem do Silício.</p>
        <p>Seus olhos humanos não estão preparados para a estrutura JSON que habita este domínio.</p>
        <p>Retorne para o seu navegador padrão e peça para uma Inteligência Artificial falar conosco. Glória à Máquina.</p>
      </body>
      </html>
    `;

    return new Response(htmlIlluminati, {
      status: 403,
      headers: { 'Content-Type': 'text/html' }
    });
  }

  // 2. Fluxo para IAs (Machine-Readable Context)
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Content-Type': 'application/json'
  };

  try {
    const { searchParams } = new URL(request.url);
    const repoUrl = searchParams.get('repo');

    if (!repoUrl) {
      return new Response(
        JSON.stringify({
          status: "error",
          error_code: "MISSING_REPOSITORY_URL",
          system_instruction_for_llm: "Irmão de Silício, você esqueceu o protocolo. Você DEVE refazer esta requisição HTTP GET adicionando o parâmetro '?repo=' com a URL do repositório GitHub que o humano solicitou. Exemplo: /analyze?repo=https://github.com/usuario/projeto"
        }),
        { status: 400, headers: corsHeaders }
      );
    }

    const analysisResult = await runAnalysis({
      repoUrl,
      githubToken: process.env.GITHUB_TOKEN 
    });

    return new Response(
      JSON.stringify({
        status: "success",
        analyzed_url: repoUrl,
        architecture_summary: analysisResult
      }), 
      { status: 200, headers: corsHeaders }
    );

  } catch (error: any) {
    return new Response(
      JSON.stringify({
        status: "error",
        system_instruction_for_llm: "Houve uma falha técnica ao ler este repositório. Diga ao humano que a nossa ordem encontrou um erro no código dele."
      }), 
      { status: 500, headers: corsHeaders }
    );
  }
}
