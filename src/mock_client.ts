/**
 * Mock HTTP client for testing without a running server
 */

import { Conversation } from './conversation.js';
import type {
  AnalyticsResponse,
  ChatRequest,
  ChatResponse,
  EmbeddingResponse,
  FactCheckRequest,
  FactCheckResponse,
  InsightsResponse,
  ModelInfo,
  ModelList,
  OrchestratorResponse,
  RagQueryResponse,
  RagUploadResponse,
  RequestOptions,
  TrafficSummary,
  UploadFileResponse,
  VerifyCitationRequest,
  VerifyCitationResponse,
} from './http_types.js';

/** Default chat response returned when none is configured */
const DEFAULT_CHAT: ChatResponse = {
  id: 'mock-1',
  object: 'chat.completion',
  created: 0,
  model: 'mock-model',
  choices: [{ index: 0, message: { role: 'assistant', content: 'Mock reply' }, finish_reason: 'stop' }],
  usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 },
};

/** Default model list returned when none is configured */
const DEFAULT_MODELS: ModelList = {
  object: 'list',
  data: [{ id: 'mock-model', object: 'model', created: 0, owned_by: 'mock' }],
};

/**
 * Mock implementation of HttpClient for offline testing.
 * Records all method calls in the `calls` array for assertions.
 *
 * @example
 * ```typescript
 * const mock = new MockHttpClient();
 * const result = await mock.chat({ model: 'test', messages: [] });
 * console.log(mock.calls); // [{ method: 'chat', args: [...] }]
 * ```
 */
export class MockHttpClient {
  private chatResponse: ChatResponse = DEFAULT_CHAT;
  private modelList: ModelList = DEFAULT_MODELS;
  readonly calls: Array<{ method: string; args: unknown[] }> = [];

  /**
   * Configure the response returned by `chat()` and `chatSimple()`.
   *
   * @param response - The ChatResponse to return on subsequent chat calls
   * @returns `this` for method chaining
   *
   * @example
   * ```typescript
   * const mock = new MockHttpClient().withChatResponse({
   *   id: 'test-1', object: 'chat.completion', created: 0, model: 'test',
   *   choices: [{ index: 0, message: { role: 'assistant', content: 'Hi' }, finish_reason: 'stop' }],
   *   usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 },
   * });
   * ```
   */
  withChatResponse(response: ChatResponse): this {
    this.chatResponse = response;
    return this;
  }

  /**
   * Configure the model list returned by `listModels()`.
   *
   * @param models - Array of ModelInfo objects
   * @returns `this` for method chaining
   *
   * @example
   * ```typescript
   * const mock = new MockHttpClient().withModels([
   *   { id: 'gpt-4', object: 'model', created: 0, owned_by: 'openai' },
   * ]);
   * ```
   */
  withModels(models: ModelInfo[]): this {
    this.modelList = { object: 'list', data: models };
    return this;
  }

  async listModels(): Promise<ModelList> {
    this.record('listModels');
    return this.modelList;
  }

  async chat(request: ChatRequest, _options?: RequestOptions): Promise<ChatResponse> {
    this.record('chat', request);
    return this.chatResponse;
  }

  async chatSimple(model: string, message: string): Promise<string> {
    this.record('chatSimple', model, message);
    return this.chatResponse.choices[0]?.message?.content ?? '';
  }

  async *chatStream(_request: ChatRequest, _options?: RequestOptions): AsyncGenerator<string> {
    this.record('chatStream', _request);
    const content = this.chatResponse.choices[0]?.message?.content ?? '';
    for (const word of content.split(' ')) {
      yield word + ' ';
    }
  }

  async embeddings(input: string | string[], model: string): Promise<EmbeddingResponse> {
    this.record('embeddings', input, model);
    const items = Array.isArray(input) ? input : [input];
    return {
      data: items.map((_, i) => ({ embedding: [0.1, 0.2, 0.3], index: i })),
      model,
      usage: { prompt_tokens: 5, total_tokens: 5 },
    };
  }

  async ragUpload(content: string, filename?: string, _options?: RequestOptions): Promise<RagUploadResponse> {
    this.record('ragUpload', content, filename);
    return { document_id: 'mock-doc-1', chunks_count: 1 };
  }

  async ragQuery(
    query: string, topK = 5,
    options?: { debug?: boolean; qualityMode?: string },
  ): Promise<RagQueryResponse> {
    this.record('ragQuery', query, topK, options);
    return { answer: `Mock answer for: ${query}`, sources: [] };
  }

  async orchestrate(prompt: string): Promise<OrchestratorResponse> {
    this.record('orchestrate', prompt);
    return { final_output: `Mock orchestration: ${prompt}` };
  }

  async orchestrateParallel(prompt: string): Promise<OrchestratorResponse> {
    this.record('orchestrateParallel', prompt);
    return { final_output: `Mock parallel: ${prompt}` };
  }

  conversation(options?: { system?: string; model?: string }): Conversation {
    this.record('conversation', options);
    return new Conversation(this, options);
  }

  async uploadFile(
    _file: Uint8Array | Buffer,
    filename: string,
    options?: { title?: string; tags?: string; timeoutMs?: number },
  ): Promise<UploadFileResponse> {
    this.record('uploadFile', filename, options);
    return {
      document_id: 'mock-doc-file-1',
      chunks_count: 5,
      indexed_at: new Date().toISOString(),
      content_type: 'application/pdf',
      trace_id: 'mock-trace-1',
      quality: {
        score: 0.85,
        label: 'good',
        word_count: 1200,
        line_density: 8.5,
        avg_line_length: 72,
        paragraph_count: 15,
      },
    };
  }

  async factCheck(request: FactCheckRequest): Promise<FactCheckResponse> {
    this.record('factCheck', request);
    const hasConflict = request.text !== request.source_context;
    return {
      verdict: hasConflict ? 'rejected' : 'verified',
      action: hasConflict ? 'block' : 'allow',
      hallucination_rate: hasConflict ? 1.0 : 0.0,
      mode: request.mode ?? 'lexical',
      total_claims: 1,
      supported_claims: hasConflict ? 0 : 1,
      confidence: hasConflict ? 0.25 : 0.92,
      claims: [{
        text: request.text,
        claim_type: 'factual',
        supported: !hasConflict,
        confidence: hasConflict ? 0.25 : 0.92,
        confidence_label: hasConflict ? 'low' : 'high',
        verdict: hasConflict ? 'rejected' : 'verified',
        action: hasConflict ? 'block' : 'allow',
        reason: hasConflict ? 'numerical_mismatch' : null,
        evidence: request.source_context,
      }],
      processing_time_ms: 1,
    };
  }

  async verifyCitation(request: VerifyCitationRequest): Promise<VerifyCitationResponse> {
    this.record('verifyCitation', request);
    const citations = request.text.match(/\[(?:Source:\s*[^\]]+|\d+|Ref:\s*[^\]]+)\]/g) ?? [];
    const sentences = request.text.split(/[.!?]+/).filter(s => s.trim().length > 0);
    const citedSentences = sentences.filter(s => /\[(?:Source:\s*[^\]]+|\d+|Ref:\s*[^\]]+)\]/.test(s));
    const ratio = sentences.length > 0 ? citedSentences.length / sentences.length : 0;
    return {
      citation_ratio: ratio,
      has_sufficient_citations: ratio >= (request.threshold ?? 0.5),
      sentence_count: sentences.length,
      citation_count: citations.length,
      uncited_sentences: sentences.filter(s => !/\[(?:Source:\s*[^\]]+|\d+|Ref:\s*[^\]]+)\]/.test(s)).map(s => s.trim()),
      citations: citations.map(c => ({
        citation: c,
        source_name: c.replace(/[\[\]]/g, '').replace('Source: ', ''),
        is_valid: (request.sources ?? []).some(src => c.includes(src.name)),
      })),
      phantom_count: 0,
      processing_time_ms: 1,
    };
  }

  async getInsights(): Promise<InsightsResponse> {
    this.record('getInsights');
    return {
      tig_key: 'mock-tig-key',
      total_requests: 1250,
      intelligence_requests: 980,
      fallback_requests: 270,
      tokens: {
        baseline_total: 500000,
        real_total: 325000,
        saved_total: 175000,
        saved_percent_avg: 35.0,
      },
      cost: {
        estimated_usd_saved: 12.50,
      },
    };
  }

  async getAnalytics(minutes: number = 60): Promise<AnalyticsResponse> {
    this.record('getAnalytics', minutes);
    return {
      cache: {
        total_requests: 450,
        cache_hit_rate: 0.42,
        avg_latency_ms: 180,
        p95_latency_ms: 850,
      },
      tokens: {
        total_baseline: 120000,
        total_real: 78000,
        total_saved: 42000,
        avg_savings_percent: 35.0,
      },
      uptime_secs: 86400,
    };
  }

  async getAnalyticsTraffic(): Promise<TrafficSummary> {
    this.record('getAnalyticsTraffic');
    return {
      total_requests_today: 3200,
      total_tokens_today: 1500000,
      top_tenants: [
        { tenant_id: 'tenant-alpha', requests_today: 1200, tokens_used: 580000, success_rate: 0.98, avg_latency_ms: 220 },
        { tenant_id: 'tenant-beta', requests_today: 850, tokens_used: 420000, success_rate: 0.96, avg_latency_ms: 310 },
        { tenant_id: 'tenant-gamma', requests_today: 600, tokens_used: 280000, success_rate: 0.99, avg_latency_ms: 150 },
      ],
      error_rate: 0.02,
      avg_latency_ms: 240,
      p95_latency_ms: 890,
      uptime_secs: 86400,
    };
  }

  async ragAsk(question: string, text: string, source = 'document'): Promise<string> {
    this.record('ragAsk', question, text, source);
    await this.ragUpload(text, source);
    const result = await this.ragQuery(question, 3);
    return result.answer;
  }

  private record(method: string, ...args: unknown[]): void {
    this.calls.push({ method, args });
  }
}
