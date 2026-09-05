export type Intent =
  | "project_status"
  | "code_review"
  | "memory_lookup"
  | "system_command"
  | "general_query";
export type ExecutionRoute = "fast_path" | "llm_synthesis";
export type DeliveryMode = "voice_brief" | "screen_detailed";

export interface ProcessRequest {
  input: string;
  session?: {
    id: string;
    locale?: string;
    timezone?: string;
  };
  device?: {
    id: string;
  };
  capabilities?: {
    tts: boolean;
    display: boolean;
  };
}

export interface Entity {
  type: "project" | "file" | "person" | "date";
  value: string;
  resolved_id?: string;
}

export interface GraphNode {
  id: string;
  label: string;
  relevance_score: number;
  summary: string;
}

export interface CognitiveContext {
  intent: Intent;
  intent_confidence: number;
  entities: Entity[];
  temporal_anchor?: {
    reference: string;
    resolved_iso: string;
  };
  graph_nodes: GraphNode[];
  delivery_mode: DeliveryMode;
  execution_route: ExecutionRoute;
  route_confidence: number;
}

export interface ProcessResponse {
  intent: Intent;
  intent_confidence: number;
  execution_route: ExecutionRoute;
  delivery_mode: DeliveryMode;
  result: {
    text: string;
    speech_text: string;
  };
  metadata: {
    sanitized_input: string;
    nodes_matched: number;
    latency_ms: number;
  };
}
