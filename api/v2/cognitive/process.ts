import type { VercelRequest, VercelResponse } from '@vercel/node';
import { sanitizeVoiceInput, sanitizeForTTS } from '../../../src/services/phoneticFilter';
import { analyzeCognitiveContext } from '../../../src/services/semanticRouter';
import { GeminiExecutor } from '../../../src/executors/llmExecutor';
import { ProcessRequest, ProcessResponse } from '../../../src/types/cognitive';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const startTime = Date.now();

  // Tratamento de CORS para pre-flight
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método não permitido' });
  }

  // Validação de Chave de API
  const authHeader = req.headers.authorization;
  if (authHeader !== 'Bearer ' + process.env.MRCP_API_KEY) {
    return res.status(401).json({ error: 'Acesso não autorizado ao MRCP Cognitive Runtime' });
  }

  try {
    const payload: ProcessRequest = req.body;
    if (!payload?.input) {
      return res.status(400).json({ error: 'Campo "input" obrigatório' });
    }

    // 1. Limpeza fonética do áudio
    const cleanedInput = sanitizeVoiceInput(payload.input);

    // 2. Classificação de Intenção e Roteamento
    const cognitiveContext = await analyzeCognitiveContext(
      cleanedInput,
      payload.session?.timezone || 'America/Sao_Paulo'
    );

    let outputText = '';
    let outputSpeech = '';

    // 3. Execução: Fast-Path vs Slow-Path
    if (cognitiveContext.execution_route === 'fast_path' && cognitiveContext.route_confidence >= 0.85) {
      // Resposta determinística instantânea (< 300ms)
      outputText = 'CapyMind operacional. Arquitetura v2.1 em execução no terminal de voz.';
      outputSpeech = sanitizeForTTS(outputText);
    } else {
      // Slow-Path: Chamada ao executor generativo
      const executor = new GeminiExecutor(process.env.GEMINI_API_KEY || '');
      const graphSummary = cognitiveContext.graph_nodes.map(n => '- ' + n.label + ':' + n.summary).join('\n');
      
      const aiResult = await executor.generate(cleanedInput, graphSummary);
      outputText = aiResult.text;
      outputSpeech = aiResult.speech_text;
    }

    const response: ProcessResponse = {
      intent: cognitiveContext.intent,
      intent_confidence: cognitiveContext.intent_confidence,
      execution_route: cognitiveContext.execution_route,
      delivery_mode: cognitiveContext.delivery_mode,
      result: {
        text: outputText,
        speech_text: outputSpeech
      },
      metadata: {
        sanitized_input: cleanedInput,
        nodes_matched: cognitiveContext.graph_nodes.length,
        latency_ms: Date.now() - startTime
      }
    };

    return res.status(200).json(response);
  } catch (err: any) {
    console.error('[MRCP Runtime Error]:', err);
    return res.status(500).json({ error: err.message || 'Erro interno no runtime' });
  }
}