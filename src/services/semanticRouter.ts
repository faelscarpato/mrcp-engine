import { CognitiveContext, Intent, ExecutionRoute } from '../types/cognitive';
import { searchAstGraph } from './graphEngine';

export async function analyzeCognitiveContext(cleanedInput: string, timezone: string = 'America/Sao_Paulo'): Promise<CognitiveContext> {
  const lower = cleanedInput.toLowerCase();
  
  // Detecção de Âncoras Temporais em São Paulo
  const today = new Date().toLocaleDateString('pt-BR', { timeZone: timezone });
  let temporalAnchor = undefined;
  if (lower.includes('hoje')) {
    temporalAnchor = { reference: 'hoje', resolved_iso: today };
  } else if (lower.includes('ontem')) {
    temporalAnchor = { reference: 'ontem', resolved_iso: 'D-1' };
  }

  // 1. Fast-Path Determinístico (Status / Saúde / Comandos Rápidos)
  if (lower.includes('status') || lower.includes('como tá') || lower.includes('como esta')) {
    return {
      intent: 'project_status',
      intent_confidence: 0.96,
      entities: [{ type: 'project', value: 'CapyMind' }],
      temporal_anchor: temporalAnchor,
      graph_nodes: await searchAstGraph(cleanedInput),
      delivery_mode: 'voice_brief',
      execution_route: 'fast_path',
      route_confidence: 0.95
    };
  }

  // 2. Slow-Path (Síntese e Raciocínio com LLM)
  const nodes = await searchAstGraph(cleanedInput);
  return {
    intent: 'general_query',
    intent_confidence: 0.88,
    entities: [],
    temporal_anchor: temporalAnchor,
    graph_nodes: nodes,
    delivery_mode: 'voice_brief',
    execution_route: 'llm_synthesis',
    route_confidence: 0.89
  };
}