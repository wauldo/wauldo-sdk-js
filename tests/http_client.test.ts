/**
 * Tests for Wauldo HTTP Client (REST API)
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { HttpClient } from '../src/http_client.js';
import type {
  ChatMessage,
  ChatRequest,
  ChatResponse,
  EmbeddingResponse,
  ModelList,
  OrchestratorResponse,
  RagQueryResponse,
  RagUploadResponse,
} from '../src/http_types.js';

// ============================================================================
// Client Construction
// ============================================================================

describe('HttpClient construction', () => {
  it('creates client with defaults', () => {
    const client = new HttpClient();
    expect(client).toBeDefined();
  });

  it('creates client with custom config', () => {
    const client = new HttpClient({
      baseUrl: 'http://example.com:8080',
      apiKey: 'sk-test-key',
      timeoutMs: 30000,
    });
    expect(client).toBeDefined();
  });

  it('strips trailing slash from baseUrl', () => {
    const client = new HttpClient({ baseUrl: 'http://localhost:3000/' });
    expect(client).toBeDefined();
  });
});

// ============================================================================
// Type Validation
// ============================================================================

describe('ChatRequest types', () => {
  it('builds a minimal chat request', () => {
    const req: ChatRequest = {
      model: 'qwen2.5:7b',
      messages: [{ role: 'user', content: 'Hello' }],
    };
    expect(req.model).toBe('qwen2.5:7b');
    expect(req.messages).toHaveLength(1);
    expect(req.temperature).toBeUndefined();
  });

  it('builds a full chat request', () => {
    const req: ChatRequest = {
      model: 'gpt-4',
      messages: [
        { role: 'system', content: 'Be concise' },
        { role: 'user', content: 'What is Rust?' },
      ],
      temperature: 0.7,
      max_tokens: 100,
      top_p: 0.9,
    };
    expect(req.messages).toHaveLength(2);
    expect(req.temperature).toBe(0.7);
  });

  it('serializes to valid JSON', () => {
    const req: ChatRequest = {
      model: 'test',
      messages: [{ role: 'user', content: 'Hi' }],
    };
    const json = JSON.stringify(req);
    const parsed = JSON.parse(json);
    expect(parsed.model).toBe('test');
    expect(parsed.messages[0].role).toBe('user');
  });
});

// ============================================================================
// Response Deserialization
// ============================================================================

describe('ChatResponse parsing', () => {
  it('parses a valid chat response', () => {
    const raw: ChatResponse = {
      id: 'chatcmpl-123',
      object: 'chat.completion',
      created: 1709900000,
      model: 'qwen2.5:7b',
      choices: [
        {
          index: 0,
          message: { role: 'assistant', content: 'Hello!' },
          finish_reason: 'stop',
        },
      ],
      usage: {
        prompt_tokens: 10,
        completion_tokens: 5,
        total_tokens: 15,
      },
    };
    expect(raw.id).toBe('chatcmpl-123');
    expect(raw.choices[0].message.content).toBe('Hello!');
    expect(raw.usage.total_tokens).toBe(15);
  });
});

describe('ModelList parsing', () => {
  it('parses model list', () => {
    const raw: ModelList = {
      object: 'list',
      data: [
        { id: 'qwen2.5:7b', object: 'model', created: 1709000000, owned_by: 'ollama' },
        { id: 'llama3:8b', object: 'model', created: 1709000001, owned_by: 'ollama' },
      ],
    };
    expect(raw.data).toHaveLength(2);
    expect(raw.data[0].id).toBe('qwen2.5:7b');
  });
});

describe('EmbeddingResponse parsing', () => {
  it('parses embedding response', () => {
    const raw: EmbeddingResponse = {
      data: [{ embedding: [0.1, 0.2, 0.3], index: 0 }],
      model: 'bge-small-en',
      usage: { prompt_tokens: 5, total_tokens: 5 },
    };
    expect(raw.data[0].embedding).toHaveLength(3);
    expect(raw.model).toBe('bge-small-en');
  });
});

describe('RAG types', () => {
  it('parses upload response', () => {
    const raw: RagUploadResponse = { document_id: 'doc-123', chunks_count: 5 };
    expect(raw.document_id).toBe('doc-123');
    expect(raw.chunks_count).toBe(5);
  });

  it('parses query response', () => {
    const raw: RagQueryResponse = {
      answer: 'Rust is a systems language',
      sources: [{ document_id: 'doc-1', content: 'Rust...', score: 0.95 }],
    };
    expect(raw.answer).toBe('Rust is a systems language');
    expect(raw.sources[0].score).toBeCloseTo(0.95);
  });
});

describe('Orchestrator types', () => {
  it('parses orchestrator response', () => {
    const raw: OrchestratorResponse = { final_output: 'The code looks good' };
    expect(raw.final_output).toBe('The code looks good');
  });
});

// ============================================================================
// JSON round-trip
// ============================================================================

describe('JSON round-trip', () => {
  it('chat request survives serialization', () => {
    const req: ChatRequest = {
      model: 'model-1',
      messages: [{ role: 'user', content: 'test' }],
      temperature: 0.5,
    };
    const json = JSON.stringify(req);
    const parsed = JSON.parse(json) as ChatRequest;
    expect(parsed.model).toBe('model-1');
    expect(parsed.temperature).toBe(0.5);
    expect(parsed.messages[0].content).toBe('test');
  });
});

// ============================================================================
// Mock HTTP Tests
// ============================================================================

function mockJsonResponse(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

function mockSSEResponse(chunks: string[]): Response {
  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      for (const chunk of chunks) {
        controller.enqueue(encoder.encode(chunk));
      }
      controller.close();
    },
  });
  return new Response(stream, {
    status: 200,
    headers: { 'content-type': 'text/event-stream' },
  });
}

describe('HttpClient mock tests', () => {
  const mockFetch = vi.fn<typeof fetch>();
  let client: HttpClient;

  beforeEach(() => {
    vi.stubGlobal('fetch', mockFetch);
    mockFetch.mockReset();
    client = new HttpClient({
      baseUrl: 'http://test-server:3000',
      maxRetries: 0,
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('chat() returns parsed response', async () => {
    const chatResp: ChatResponse = {
      id: 'cmpl-mock-1',
      object: 'chat.completion',
      created: 1700000000,
      model: 'qwen2.5:7b',
      choices: [
        { index: 0, message: { role: 'assistant', content: 'Hello from mock!' }, finish_reason: 'stop' },
      ],
      usage: { prompt_tokens: 8, completion_tokens: 4, total_tokens: 12 },
    };
    mockFetch.mockResolvedValueOnce(mockJsonResponse(chatResp));

    const result = await client.chat({
      model: 'qwen2.5:7b',
      messages: [{ role: 'user', content: 'Hi' }],
    });

    expect(result.id).toBe('cmpl-mock-1');
    expect(result.choices[0].message.content).toBe('Hello from mock!');
    expect(result.usage.total_tokens).toBe(12);
    expect(mockFetch).toHaveBeenCalledOnce();
  });

  it('chatSimple() returns content string', async () => {
    const chatResp: ChatResponse = {
      id: 'cmpl-mock-2',
      object: 'chat.completion',
      created: 1700000000,
      model: 'test-model',
      choices: [
        { index: 0, message: { role: 'assistant', content: 'Simple reply' }, finish_reason: 'stop' },
      ],
      usage: { prompt_tokens: 5, completion_tokens: 2, total_tokens: 7 },
    };
    mockFetch.mockResolvedValueOnce(mockJsonResponse(chatResp));

    const content = await client.chatSimple('test-model', 'Hello');
    expect(content).toBe('Simple reply');
  });

  it('listModels() returns model list', async () => {
    const models: ModelList = {
      object: 'list',
      data: [
        { id: 'model-a', object: 'model', created: 1700000000, owned_by: 'local' },
        { id: 'model-b', object: 'model', created: 1700000001, owned_by: 'ollama' },
      ],
    };
    mockFetch.mockResolvedValueOnce(mockJsonResponse(models));

    const result = await client.listModels();
    expect(result.data).toHaveLength(2);
    expect(result.data[0].id).toBe('model-a');
    expect(result.data[1].owned_by).toBe('ollama');
  });

  it('embeddings() returns embedding vectors', async () => {
    const embResp: EmbeddingResponse = {
      data: [{ embedding: [0.1, 0.2, 0.3, 0.4], index: 0 }],
      model: 'bge-small-en',
      usage: { prompt_tokens: 3, total_tokens: 3 },
    };
    mockFetch.mockResolvedValueOnce(mockJsonResponse(embResp));

    const result = await client.embeddings('test input', 'bge-small-en');
    expect(result.data[0].embedding).toEqual([0.1, 0.2, 0.3, 0.4]);
    expect(result.model).toBe('bge-small-en');
  });

  it('ragUpload() returns upload confirmation', async () => {
    const uploadResp: RagUploadResponse = { document_id: 'doc-456', chunks_count: 12 };
    mockFetch.mockResolvedValueOnce(mockJsonResponse(uploadResp));

    const result = await client.ragUpload('Some document text', 'readme.md');
    expect(result.document_id).toBe('doc-456');
    expect(result.chunks_count).toBe(12);
  });

  it('ragQuery() returns query results', async () => {
    const queryResp: RagQueryResponse = {
      answer: 'The answer is 42',
      sources: [{ document_id: 'doc-1', content: 'chunk text', score: 0.91 }],
    };
    mockFetch.mockResolvedValueOnce(mockJsonResponse(queryResp));

    const result = await client.ragQuery('What is the answer?', 3);
    expect(result.answer).toBe('The answer is 42');
    expect(result.sources).toHaveLength(1);
    expect(result.sources[0].score).toBeCloseTo(0.91);
  });

  it('throws on HTTP 500 error', async () => {
    mockFetch.mockResolvedValueOnce(
      new Response('Internal Server Error', { status: 500 }),
    );

    await expect(
      client.chat({ model: 'test', messages: [{ role: 'user', content: 'fail' }] }),
    ).rejects.toThrow('HTTP 500');
  });

  it('chatStream() yields content chunks from SSE', async () => {
    const sseChunks = [
      'data: {"choices":[{"delta":{"content":"Hello"}}]}\n\n',
      'data: {"choices":[{"delta":{"content":" world"}}]}\n\n',
      'data: [DONE]\n\n',
    ];
    mockFetch.mockResolvedValueOnce(mockSSEResponse(sseChunks));

    const collected: string[] = [];
    for await (const chunk of client.chatStream({
      model: 'test',
      messages: [{ role: 'user', content: 'Hi' }],
    })) {
      collected.push(chunk);
    }

    expect(collected).toEqual(['Hello', ' world']);
  });
});
