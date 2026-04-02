/**
 * HTTP API types for OpenAI-compatible endpoints
 */

// ── Chat Completions ────────────────────────────────────────────────────

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content?: string;
  name?: string;
}

export interface ChatRequest {
  model: string;
  messages: ChatMessage[];
  temperature?: number;
  max_tokens?: number;
  stream?: boolean;
  top_p?: number;
  stop?: string[];
}

export interface ChatUsage {
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens: number;
}

export interface ChatChoice {
  index: number;
  message: ChatMessage;
  finish_reason: string | null;
}

export interface ChatResponse {
  id: string;
  object: string;
  created: number;
  model: string;
  choices: ChatChoice[];
  usage: ChatUsage;
}

/** Get the text content of the first choice, or empty string */
export function chatContent(response: ChatResponse): string {
  return response.choices[0]?.message?.content ?? '';
}

// ── Models ──────────────────────────────────────────────────────────────

export interface ModelInfo {
  id: string;
  object: string;
  created: number;
  owned_by: string;
}

export interface ModelList {
  object: string;
  data: ModelInfo[];
}

// ── Embeddings ──────────────────────────────────────────────────────────

export interface EmbeddingData {
  embedding: number[];
  index: number;
}

export interface EmbeddingUsage {
  prompt_tokens: number;
  total_tokens: number;
}

export interface EmbeddingResponse {
  data: EmbeddingData[];
  model: string;
  usage: EmbeddingUsage;
}

// ── RAG ─────────────────────────────────────────────────────────────────

export interface RagUploadResponse {
  document_id: string;
  chunks_count: number;
}

export interface RagSource {
  document_id: string;
  content: string;
  score: number;
  chunk_id?: string;
  metadata?: Record<string, unknown>;
}

/** Audit trail for RAG responses — verification and accountability */
export interface RagAuditInfo {
  confidence: number;
  retrieval_path: string;
  sources_evaluated: number;
  sources_used: number;
  best_score: number;
  grounded: boolean;
  confidence_label: string;
  model: string;
  latency_ms: number;
  /** Retrieval funnel diagnostics (v1.6.5+) */
  candidates_found?: number;
  candidates_after_tenant?: number;
  candidates_after_score?: number;
  query_type?: string;
}

export interface RagQueryResponse {
  answer: string;
  sources: RagSource[];
  /** Full audit trail — always present on v1.6.5+ servers */
  audit?: RagAuditInfo;
  // Legacy flat fields (servers < v1.6.5)
  confidence?: number;
  grounded?: boolean;
}

// ── Orchestrator ────────────────────────────────────────────────────────

export interface OrchestratorResponse {
  final_output: string;
}

// ── Fact-Check ─────────────────────────────────────────────────────────

export interface FactCheckRequest {
  text: string;
  source_context: string;
  mode?: 'lexical' | 'hybrid' | 'semantic';
}

export interface ClaimResult {
  text: string;
  claim_type: string;
  supported: boolean;
  confidence: number;
  confidence_label: string;
  verdict: string;
  action: string;
  reason?: string | null;
  evidence?: string | null;
}

export interface FactCheckResponse {
  verdict: string;
  action: string;
  hallucination_rate: number;
  mode: string;
  total_claims: number;
  supported_claims: number;
  confidence: number;
  claims: ClaimResult[];
  mode_warning?: string | null;
  processing_time_ms: number;
}

// ── Chat Client Interface ───────────────────────────────────────────────

/** Minimal interface required by Conversation — implemented by both HttpClient and MockHttpClient */
export interface ChatClientLike {
  chat(request: ChatRequest, options?: RequestOptions): Promise<ChatResponse>;
}

// ── Client Config ───────────────────────────────────────────────────────

/** Log levels emitted by HttpClient */
export type LogLevel = 'debug' | 'warn' | 'error';

export interface HttpClientConfig {
  baseUrl?: string;
  apiKey?: string;
  /** Extra headers added to every request (e.g. X-RapidAPI-Key) */
  headers?: Record<string, string>;
  timeoutMs?: number;
  maxRetries?: number;
  retryBackoffMs?: number;
  /** Optional callback invoked on request lifecycle events */
  onLog?: (level: LogLevel, message: string) => void;
  /** Called before each HTTP request is sent */
  onRequest?: (method: string, path: string) => void;
  /** Called after each successful HTTP response */
  onResponse?: (status: number, durationMs: number) => void;
  /** Called when an HTTP request fails (after all retries exhausted) */
  onError?: (error: Error) => void;
}

/** Options that can be passed per-request to override defaults */
export interface RequestOptions {
  /** Override the default timeout for this specific request (milliseconds) */
  timeoutMs?: number;
}
