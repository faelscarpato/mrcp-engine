import { sanitizeForTTS } from "../services/phoneticFilter";

export interface LLMExecutor {
  generate(
    prompt: string,
    context: string,
  ): Promise<{ text: string; speech_text: string }>;
}

export class GeminiExecutor implements LLMExecutor {
  private apiKey: string;

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  async generate(
    prompt: string,
    context: string,
  ): Promise<{ text: string; speech_text: string }> {
    const url =
      "https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=" +
      this.apiKey;

    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              {
                text:
                  "Contexto do Sistema:\n" +
                  context +
                  "\n\nInstrução: Responda de forma direta e concisa para áudio no smartwatch.\nPergunta: " +
                  prompt,
              },
            ],
          },
        ],
      }),
    });

    if (!response.ok) {
      throw new Error("Gemini API Error: " + response.statusText);
    }

    const data = await response.json();
    const rawReply =
      data?.candidates?.[0]?.content?.parts?.[0]?.text ||
      "Sem resposta disponível.";

    return {
      text: rawReply,
      speech_text: sanitizeForTTS(rawReply),
    };
  }
}
