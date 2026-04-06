/**
 * Streaming demo
 *
 * Shows how to use SSE streaming with MockHttpClient (offline)
 * and documents real-server streaming patterns.
 * Run: npx tsx examples/streaming_demo.ts
 */

import { MockHttpClient } from '../src/index.js';

async function main() {
  const client = new MockHttpClient();

  // ── Mock streaming ─────────────────────────────────────────────────
  // MockHttpClient.chatStream() yields words from the configured response.
  // This lets you test streaming UI logic without a server.

  console.log('=== Streaming Demo (MockHttpClient) ===\n');

  console.log('--- Chat stream ---');
  const stream = client.chatStream({
    model: 'mock-model',
    messages: [{ role: 'user', content: 'Explain zero-hallucination RAG in 3 sentences.' }],
  });

  let fullText = '';
  for await (const chunk of stream) {
    process.stdout.write(chunk);
    fullText += chunk;
  }
  console.log(`\n\nReceived ${fullText.length} chars in ${fullText.split(' ').length} chunks`);

  // ── RAG streaming pattern ──────────────────────────────────────────
  // The real /v1/query endpoint supports SSE streaming.
  // With HttpClient, RAG responses stream as:
  //   data: {"type":"sources","sources":[...]}
  //   data: {"type":"token","content":"The"}
  //   data: {"type":"token","content":" answer"}
  //   data: {"type":"audit","audit":{...}}
  //   data: [DONE]
  //
  // Example with a real server:
  //
  //   import { HttpClient } from 'wauldo';
  //   const client = new HttpClient({
  //     baseUrl: 'https://api.wauldo.com',
  //     apiKey: 'YOUR_KEY',
  //   });
  //
  //   // Chat streaming (OpenAI-compatible SSE)
  //   const stream = client.chatStream({
  //     model: 'auto',
  //     messages: [{ role: 'user', content: 'Hello!' }],
  //   });
  //   for await (const chunk of stream) {
  //     process.stdout.write(chunk);
  //   }

  // ── Custom response for testing ────────────────────────────────────
  console.log('\n--- Custom mock response ---');
  const custom = new MockHttpClient().withChatResponse({
    id: 'custom-1',
    object: 'chat.completion',
    created: Date.now(),
    model: 'test-model',
    choices: [{
      index: 0,
      message: { role: 'assistant', content: 'Wauldo verifies every answer against source documents before returning it.' },
      finish_reason: 'stop',
    }],
    usage: { prompt_tokens: 20, completion_tokens: 12, total_tokens: 32 },
  });

  const customStream = custom.chatStream({
    model: 'test-model',
    messages: [{ role: 'user', content: 'What does Wauldo do?' }],
  });

  for await (const chunk of customStream) {
    process.stdout.write(chunk);
  }
  console.log('\n');

  console.log('=== Done ===');
  console.log(`Total calls: ${client.calls.length + custom.calls.length}`);
}

main().catch(console.error);
