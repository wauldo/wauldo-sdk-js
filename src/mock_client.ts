/**
 * Mock HTTP client for testing without a running server
 */

import { Conversation } from './conversation.js';
import type {
  ChatRequest,
  ChatResponse,
  EmbeddingResponse,
  GuardMode,
  GuardResponse,
  ModelInfo,
  ModelList,
  OrchestratorResponse,
  RagQueryResponse,
  RagUploadResponse,
  RequestOptions,
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

  async guard(
    text: string,
    sourceContext: string,
    mode: GuardMode = 'lexical',
    _options?: RequestOptions,
  ): Promise<GuardResponse> {
    this.record('guard', text, sourceContext, mode);
    const textNums = new Set(text.match(/\b\d+(?:\.\d+)?\b/g) ?? []);
    const srcNums = new Set(sourceContext.match(/\b\d+(?:\.\d+)?\b/g) ?? []);
    const mismatch = textNums.size > 0 && srcNums.size > 0
      && [...textNums].some(n => !srcNums.has(n));
    if (mismatch) {
      return {
        verdict: 'rejected', action: 'block', hallucination_rate: 1, mode,
        total_claims: 1, supported_claims: 0, confidence: 0,
        claims: [{ text, supported: false, confidence: 0.3, verdict: 'rejected', action: 'block', reason: 'numerical_mismatch' }],
      };
    }
    return {
      verdict: 'verified', action: 'allow', hallucination_rate: 0, mode,
      total_claims: 1, supported_claims: 1, confidence: 0.95,
      claims: [{ text, supported: true, confidence: 0.95, verdict: 'verified', action: 'allow' }],
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
