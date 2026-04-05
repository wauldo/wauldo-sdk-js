/**
 * HTTP client for Wauldo REST API (OpenAI-compatible)
 *
 * Uses Node 18+ built-in fetch — zero external dependencies.
 */

import { Conversation } from './conversation.js';
import { ServerError } from './errors.js';
import type {
  ChatRequest,
  ChatResponse,
  EmbeddingResponse,
  HttpClientConfig,
  ModelList,
  FactCheckRequest,
  FactCheckResponse,
  VerifyCitationRequest,
  VerifyCitationResponse,
  OrchestratorResponse,
  RagQueryResponse,
  RagUploadResponse,
  UploadFileResponse,
  RequestOptions,
  InsightsResponse,
  AnalyticsResponse,
  TrafficSummary,
} from './http_types.js';
import { fetchWithRetry, type RetryConfig } from './retry_fetch.js';
import { parseSSEStream } from './sse_parser.js';

/** Concatenate multiple Uint8Array into one */
function concatUint8Arrays(arrays: Uint8Array[]): Uint8Array {
  const total = arrays.reduce((n, a) => n + a.length, 0);
  const result = new Uint8Array(total);
  let offset = 0;
  for (const a of arrays) { result.set(a, offset); offset += a.length; }
  return result;
}

/** Validate that a parsed response is non-null before returning it. */
function validateResponse<T>(data: unknown, typeName: string): T {
  if (data === null || data === undefined) {
    throw new ServerError(`Invalid ${typeName}: response is null`, 0);
  }
  return data as T;
}

export class HttpClient {
  private retryConfig: RetryConfig;

  constructor(config: HttpClientConfig = {}) {
    const baseUrl = (config.baseUrl ?? 'http://localhost:3000').replace(/\/$/, '');
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (config.apiKey) {
      headers['Authorization'] = `Bearer ${config.apiKey}`;
    }
    if (config.headers) {
      Object.assign(headers, config.headers);
    }
    this.retryConfig = {
      baseUrl,
      headers,
      timeoutMs: config.timeoutMs ?? 120_000,
      maxRetries: config.maxRetries ?? 3,
      retryBackoffMs: config.retryBackoffMs ?? 1_000,
      onLog: config.onLog,
      onRequest: config.onRequest,
      onResponse: config.onResponse,
      onError: config.onError,
    };
  }

  // ── OpenAI-compatible endpoints ──────────────────────────────────────

  /** GET /v1/models — List available LLM models */
  async listModels(): Promise<ModelList> {
    const data = await fetchWithRetry<ModelList>(this.retryConfig, 'GET', '/v1/models');
    return validateResponse<ModelList>(data, 'ModelList');
  }

  /**
   * POST /v1/chat/completions — Chat completion (non-streaming).
   *
   * @param request - The chat request (model, messages, temperature, etc.)
   * @param options - Optional per-request overrides (e.g. timeoutMs)
   * @returns The full chat completion response
   *
   * @example
   * ```typescript
   * const resp = await client.chat({
   *   model: 'qwen2.5:7b',
   *   messages: [{ role: 'user', content: 'Hello' }],
   * });
   * console.log(resp.choices[0]?.message?.content);
   * ```
   */
  async chat(request: ChatRequest, options?: RequestOptions): Promise<ChatResponse> {
    const data = await fetchWithRetry<ChatResponse>(
      this.retryConfig,
      'POST',
      '/v1/chat/completions',
      { ...request, stream: false },
      options?.timeoutMs,
    );
    return validateResponse<ChatResponse>(data, 'ChatResponse');
  }

  /** Convenience: single message chat, returns content string */
  async chatSimple(model: string, message: string): Promise<string> {
    const resp = await this.chat({
      model,
      messages: [{ role: 'user', content: message }],
    });
    return resp.choices[0]?.message?.content ?? '';
  }

  /** POST /v1/chat/completions — SSE streaming, yields content chunks */
  async *chatStream(request: ChatRequest, options?: RequestOptions): AsyncGenerator<string> {
    const cfg = this.retryConfig;
    const effectiveTimeout = options?.timeoutMs ?? cfg.timeoutMs;
    cfg.onRequest?.('POST', '/v1/chat/completions');
    const start = Date.now();
    let resp: Response;
    try {
      resp = await fetch(`${cfg.baseUrl}/v1/chat/completions`, {
        method: 'POST',
        headers: { ...cfg.headers },
        body: JSON.stringify({ ...request, stream: true }),
        signal: AbortSignal.timeout(effectiveTimeout),
      });
    } catch (err) {
      if (err instanceof Error) cfg.onError?.(err);
      throw err;
    }
    if (!resp.ok) {
      const body = await resp.text();
      let message = body;
      try { const j = JSON.parse(body); if (j?.error?.message) message = j.error.message; } catch {}
      const err = new ServerError(`HTTP ${resp.status}: ${message}`, resp.status);
      cfg.onError?.(err);
      throw err;
    }
    cfg.onResponse?.(resp.status, Date.now() - start);
    if (!resp.body) throw new ServerError('No response body for streaming', 0);
    yield* parseSSEStream(resp.body);
  }

  /** POST /v1/embeddings — Generate text embeddings */
  async embeddings(input: string | string[], model: string): Promise<EmbeddingResponse> {
    const data = await fetchWithRetry<EmbeddingResponse>(
      this.retryConfig, 'POST', '/v1/embeddings', { input, model },
    );
    return validateResponse<EmbeddingResponse>(data, 'EmbeddingResponse');
  }

  // ── RAG endpoints ────────────────────────────────────────────────────

  /**
   * POST /v1/upload — Upload document for RAG indexing.
   *
   * @param content - The document text to index
   * @param filename - Optional filename for the document
   * @param options - Optional per-request overrides (e.g. timeoutMs)
   * @returns Upload confirmation with document_id and chunks_count
   */
  async ragUpload(
    content: string, filename?: string, options?: RequestOptions,
  ): Promise<RagUploadResponse> {
    const body: Record<string, unknown> = { content };
    if (filename) body['filename'] = filename;
    const data = await fetchWithRetry<RagUploadResponse>(
      this.retryConfig, 'POST', '/v1/upload', body, options?.timeoutMs,
    );
    return validateResponse<RagUploadResponse>(data, 'RagUploadResponse');
  }

  /**
   * POST /v1/upload-file — Upload a file (PDF, DOCX, text, image) for RAG indexing.
   *
   * @param file - File content as Buffer/Uint8Array
   * @param filename - The filename (determines content type detection)
   * @param options - Optional title, tags, timeoutMs
   * @returns Upload confirmation with quality scoring
   */
  async uploadFile(
    file: Uint8Array | Buffer,
    filename: string,
    options?: { title?: string; tags?: string; timeoutMs?: number },
  ): Promise<UploadFileResponse> {
    const boundary = '----WauldoSDKBoundary';
    const parts: Uint8Array[] = [];
    const enc = new TextEncoder();

    // File part
    parts.push(enc.encode(`--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="${filename}"\r\nContent-Type: application/octet-stream\r\n\r\n`));
    parts.push(file instanceof Uint8Array ? file : new Uint8Array(file));
    parts.push(enc.encode('\r\n'));

    // Optional fields
    if (options?.title) {
      parts.push(enc.encode(`--${boundary}\r\nContent-Disposition: form-data; name="title"\r\n\r\n${options.title}\r\n`));
    }
    if (options?.tags) {
      parts.push(enc.encode(`--${boundary}\r\nContent-Disposition: form-data; name="tags"\r\n\r\n${options.tags}\r\n`));
    }
    parts.push(enc.encode(`--${boundary}--\r\n`));

    const body = concatUint8Arrays(parts);
    const data = await fetchWithRetry<UploadFileResponse>(
      { ...this.retryConfig, headers: { ...this.retryConfig.headers, 'Content-Type': `multipart/form-data; boundary=${boundary}` } },
      'POST', '/v1/upload-file', body as unknown as Record<string, unknown>, options?.timeoutMs,
    );
    return validateResponse<UploadFileResponse>(data, 'UploadFileResponse');
  }

  /** POST /v1/query — Query RAG knowledge base */
  async ragQuery(
    query: string,
    topK = 5,
    options?: { debug?: boolean; qualityMode?: string },
  ): Promise<RagQueryResponse> {
    const body: Record<string, unknown> = { query, top_k: topK };
    if (options?.debug) body.debug = true;
    if (options?.qualityMode) body.quality_mode = options.qualityMode;
    const data = await fetchWithRetry<RagQueryResponse>(
      this.retryConfig, 'POST', '/v1/query', body,
    );
    return validateResponse<RagQueryResponse>(data, 'RagQueryResponse');
  }

  // ── Conversation & RAG helpers ────────────────────────────────────────

  /**
   * Create a stateful conversation that tracks message history automatically.
   *
   * @param options - Optional system prompt and model name
   * @returns A Conversation instance bound to this client
   *
   * @example
   * ```typescript
   * const conv = client.conversation({ system: 'You are a TypeScript expert' });
   * const reply = await conv.say('What are generics?');
   * ```
   */
  conversation(options?: { system?: string; model?: string }): Conversation {
    return new Conversation(this, options);
  }

  /**
   * Upload text to RAG, then query it — one-shot Q&A over a document.
   *
   * @param question - The question to ask about the document
   * @param text - The document text to index and query
   * @param source - Optional source name (defaults to 'document')
   * @returns The answer string
   */
  async ragAsk(question: string, text: string, source = 'document'): Promise<string> {
    await this.ragUpload(text, source);
    const result = await this.ragQuery(question, 3);
    return result.answer ?? JSON.stringify(result.sources);
  }

  // ── Orchestrator endpoints ───────────────────────────────────────────

  /** POST /v1/orchestrator/execute — Route to best specialist agent */
  async orchestrate(prompt: string): Promise<OrchestratorResponse> {
    const data = await fetchWithRetry<OrchestratorResponse>(
      this.retryConfig, 'POST', '/v1/orchestrator/execute', { prompt },
    );
    return validateResponse<OrchestratorResponse>(data, 'OrchestratorResponse');
  }

  /** POST /v1/orchestrator/parallel — Run all 4 specialists in parallel */
  async orchestrateParallel(prompt: string): Promise<OrchestratorResponse> {
    const data = await fetchWithRetry<OrchestratorResponse>(
      this.retryConfig, 'POST', '/v1/orchestrator/parallel', { prompt },
    );
    return validateResponse<OrchestratorResponse>(data, 'OrchestratorResponse');
  }

  // ── Fact-Check endpoints ──────────────────────────────────────────────

  /**
   * POST /v1/fact-check — Verify claims against source context.
   *
   * @param request - Text and source context to verify
   * @returns FactCheckResponse with verdict, action, and per-claim results
   *
   * @example
   * ```typescript
   * const result = await client.factCheck({
   *   text: 'Returns accepted within 60 days.',
   *   source_context: 'Our policy allows returns within 14 days.',
   *   mode: 'lexical',
   * });
   * console.log(result.verdict); // "rejected"
   * ```
   */
  async factCheck(request: FactCheckRequest): Promise<FactCheckResponse> {
    const data = await fetchWithRetry<FactCheckResponse>(
      this.retryConfig, 'POST', '/v1/fact-check', request,
    );
    return validateResponse<FactCheckResponse>(data, 'FactCheckResponse');
  }

  /**
   * POST /v1/verify — Verify citations in AI-generated text.
   *
   * @example
   * ```ts
   * const result = await client.verifyCitation({
   *   text: 'Rust was released in 2010 [Source: rust_book].',
   *   sources: [{ name: 'rust_book', content: 'Rust was first released in 2010.' }],
   * });
   * console.log(result.phantom_count); // 0
   * ```
   */
  async verifyCitation(request: VerifyCitationRequest): Promise<VerifyCitationResponse> {
    const data = await fetchWithRetry<VerifyCitationResponse>(
      this.retryConfig, 'POST', '/v1/verify', request,
    );
    return validateResponse<VerifyCitationResponse>(data, 'VerifyCitationResponse');
  }

  // ── Analytics & Insights endpoints ───────────────────────────────────

  /**
   * GET /v1/insights — ROI metrics for your API key
   */
  async getInsights(): Promise<InsightsResponse> {
    const data = await fetchWithRetry<InsightsResponse>(
      this.retryConfig, 'GET', '/v1/insights',
    );
    return validateResponse<InsightsResponse>(data, 'InsightsResponse');
  }

  /**
   * GET /v1/analytics — Usage analytics and cache performance
   */
  async getAnalytics(minutes: number = 60): Promise<AnalyticsResponse> {
    const data = await fetchWithRetry<AnalyticsResponse>(
      this.retryConfig, 'GET', `/v1/analytics?minutes=${minutes}`,
    );
    return validateResponse<AnalyticsResponse>(data, 'AnalyticsResponse');
  }

  /**
   * GET /v1/analytics/traffic — Per-tenant traffic monitoring
   */
  async getAnalyticsTraffic(): Promise<TrafficSummary> {
    const data = await fetchWithRetry<TrafficSummary>(
      this.retryConfig, 'GET', '/v1/analytics/traffic',
    );
    return validateResponse<TrafficSummary>(data, 'TrafficSummary');
  }
}
