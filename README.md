# Wauldo TypeScript SDK

[![npm](https://img.shields.io/npm/v/wauldo.svg)](https://npmjs.com/package/wauldo)
[![Downloads](https://img.shields.io/npm/dm/wauldo.svg)](https://npmjs.com/package/wauldo)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0+-blue.svg)](https://www.typescriptlang.org/)
[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](./LICENSE)

> **Verified AI answers from your documents.** Every response includes source citations, confidence scores, and an audit trail — or we don't answer at all.

Official TypeScript SDK for the [Wauldo API](https://wauldo.com) — the AI inference layer with smart model routing, zero hallucinations, and standalone fact-checking.

## Why Wauldo?

- **Native PDF & DOCX Upload** — upload files directly, server-side text extraction with document quality scoring
- **Citation Verify API** — detect uncited sentences, phantom citations, and measure coverage ratio. No LLM needed
- **Fact-Check API** — verify any claim against source with 3 modes (lexical, hybrid, semantic). Get verdict, action, and structured reason
- **Zero hallucinations** — every answer is verified against source documents
- **Smart model routing** — auto-selects the cheapest model that meets quality (save 40-80% on AI costs)
- **One API, 7+ providers** — OpenAI, Anthropic, Google, Qwen, Meta, Mistral, DeepSeek with automatic fallback
- **OpenAI-compatible** — swap your `baseUrl`, keep your existing code
- **Full audit trail** — confidence score, grounded status, model used, latency on every response
- **Zero dependencies** — uses Node 18+ built-in APIs (fetch, ReadableStream)

## Quick Start

```typescript
import { HttpClient } from 'wauldo';

const client = new HttpClient({ baseUrl: 'https://api.wauldo.com', apiKey: 'YOUR_API_KEY' });

const reply = await client.chatSimple('auto', 'What is TypeScript?');
console.log(reply);
```

## Installation

```bash
npm install wauldo
```

**Requirements:** Node.js 18+, TypeScript 5.0+

## Features

### Chat Completions

```typescript
import { HttpClient } from 'wauldo';

const client = new HttpClient({ baseUrl: 'https://api.wauldo.com', apiKey: 'YOUR_API_KEY' });

const response = await client.chat({
  model: 'auto',
  messages: [
    { role: 'system', content: 'You are a helpful assistant.' },
    { role: 'user', content: 'Explain async/await in TypeScript' },
  ],
});
console.log(response.choices[0]?.message?.content);
```

### RAG — Upload & Query

```typescript
// Upload a document
const upload = await client.ragUpload('Contract text here...', 'contract.txt');
console.log(`Indexed ${upload.chunks_count} chunks`);

// Query with verified answer
const result = await client.ragQuery('What are the payment terms?');
console.log(`Answer: ${result.answer}`);
console.log(`Confidence: ${Math.round(result.audit.confidence * 100)}%`);
console.log(`Grounded: ${result.audit.grounded}`);
for (const source of result.sources) {
  console.log(`  Source (${Math.round(source.score * 100)}%): ${source.content}`);
}
```

### Streaming (SSE)

```typescript
const stream = client.chatStream({
  model: 'auto',
  messages: [{ role: 'user', content: 'Hello!' }],
});
for await (const chunk of stream) {
  process.stdout.write(chunk);
}
```

### Conversation Helper

```typescript
const conv = client.conversation({ system: 'You are an expert on TypeScript.', model: 'auto' });
const reply = await conv.say('What are generics?');
const followUp = await conv.say('Give me an example');
```

### Fact-Check — Verify Claims

```typescript
const result = await client.factCheck({
  text: 'Returns are accepted within 60 days.',
  source_context: 'Our policy allows returns within 14 days.',
  mode: 'lexical',
});
console.log(result.verdict); // "rejected"
console.log(result.action);  // "block"
result.claims.forEach(c => console.log(`${c.text} → ${c.verdict} (${c.reason})`));
```

## Error Handling

```typescript
import { HttpClient, ServerError } from 'wauldo';

try {
  const response = await client.chat({
    model: 'auto',
    messages: [{ role: 'user', content: 'Hello' }],
  });
} catch (error) {
  if (error instanceof ServerError) {
    console.error(`Server error [${error.code}]: ${error.message}`);
  } else {
    console.error('Unknown error:', error);
  }
}
```

## RapidAPI

```typescript
const client = new HttpClient({
  baseUrl: 'https://api.wauldo.com',
  headers: {
    'X-RapidAPI-Key': 'YOUR_RAPIDAPI_KEY',
    'X-RapidAPI-Host': 'smart-rag-api.p.rapidapi.com',
  },
});
```

Get your free API key (300 req/month): [RapidAPI](https://rapidapi.com/binnewzzin/api/smart-rag-api)

## Links

- [Website](https://wauldo.com)
- [Documentation](https://wauldo.com/docs)
- [Live Demo](https://api.wauldo.com/demo)
- [Cost Calculator](https://wauldo.com/calculator)
- [Status](https://wauldo.com/status)

## Contributing

Found a bug? Have a feature request? [Open an issue](https://github.com/wauldo/wauldo-sdk-js/issues).

## License

MIT — see [LICENSE](./LICENSE)
