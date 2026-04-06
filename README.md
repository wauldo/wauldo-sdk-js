<h1 align="center">Wauldo TypeScript SDK</h1>

<p align="center">
  <strong>Verified AI answers from your documents — or no answer at all.</strong>
</p>

<p align="center">
  Most RAG APIs guess. Wauldo verifies.
</p>

<p align="center">
  <b>0% hallucination</b> &nbsp;|&nbsp; 83% accuracy &nbsp;|&nbsp; 61 eval tasks &nbsp;|&nbsp; 14 LLMs tested
</p>

<p align="center">
  <a href="https://npmjs.com/package/wauldo"><img src="https://img.shields.io/npm/v/wauldo.svg" alt="npm" /></a>&nbsp;
  <a href="https://npmjs.com/package/wauldo"><img src="https://img.shields.io/npm/dm/wauldo.svg" alt="Downloads" /></a>&nbsp;
  <img src="https://img.shields.io/badge/TypeScript-5.0+-blue.svg" alt="TypeScript" />&nbsp;
  <img src="https://img.shields.io/badge/License-MIT-green.svg" alt="MIT" />
</p>

<p align="center">
  <a href="https://wauldo.com/demo">Demo</a> &bull;
  <a href="https://wauldo.com/docs">Docs</a> &bull;
  <a href="https://rapidapi.com/binnewzzin/api/smart-rag-api">Free API Key</a> &bull;
  <a href="https://dev.to/wauldo/how-we-achieved-0-hallucination-rate-in-our-rag-api-with-benchmarks-4g54">Benchmarks</a>
</p>

---

## Try it locally (no server needed)

```bash
npm install wauldo
```

```typescript
import { MockHttpClient } from 'wauldo';

const client = new MockHttpClient();

// Upload, query, fact-check — all offline
await client.ragUpload('Refund policy allows returns within 60 days.', 'policy.txt');
const result = await client.ragQuery('What is the refund policy?');
console.log(result.answer); // "Mock answer for: What is the refund policy?"

const check = await client.factCheck({
  text: 'Returns accepted within 30 days.',
  source_context: 'Refund policy allows returns within 60 days.',
});
console.log(check.verdict); // "rejected"
```

Run the full quickstart: `npx tsx examples/quickstart.ts`

---

## Quickstart with real API

```typescript
import { HttpClient } from 'wauldo';

const client = new HttpClient({ baseUrl: 'https://api.wauldo.com', apiKey: 'YOUR_API_KEY' });

// Upload a document
await client.ragUpload('Our refund policy allows returns within 60 days...', 'policy.txt');

// Ask a question — answer is verified against the source
const result = await client.ragQuery('What is the refund policy?');
console.log(result.answer);
console.log(result.sources);
```

```
Output:
Answer: Returns are accepted within 60 days of purchase.
Sources: policy.txt — "Our refund policy allows returns within 60 days"
Grounded: true | Confidence: 0.92
```

[Try the demo](https://wauldo.com/demo) | [Get a free API key](https://rapidapi.com/binnewzzin/api/smart-rag-api)

---

## Why Wauldo (and not standard RAG)

**Typical RAG pipeline**

```
retrieve → generate → hope it's correct
```

**Wauldo pipeline**

```
retrieve → extract facts → generate → verify → return or refuse
```

If the answer can't be verified, it returns **"insufficient evidence"** instead of guessing.

### See the difference

```
Document: "Refunds are processed within 60 days"

Typical RAG:  "Refunds are processed within 30 days"     ← wrong
Wauldo:       "Refunds are processed within 60 days"     ← verified
              or "insufficient evidence" if unclear       ← safe
```

---

## Examples

### Upload a PDF and ask questions

```typescript
// Upload — text extraction + quality scoring happens server-side
const upload = await client.uploadFile(filePath, { title: 'Q3 Contract' });
console.log(`Extracted ${upload.chunks_count} chunks, quality: ${upload.quality_label}`);

// Query
const result = await client.ragQuery('What are the payment terms?');
console.log(`Answer: ${result.answer}`);
console.log(`Confidence: ${Math.round(result.audit.confidence * 100)}%`);
console.log(`Grounded: ${result.audit.grounded}`);
```

### Fact-check any LLM output

```typescript
const result = await client.factCheck({
  text: 'Returns are accepted within 60 days.',
  sourceContext: 'Our policy allows returns within 14 days.',
  mode: 'lexical',
});
console.log(result.verdict);          // "rejected"
console.log(result.action);           // "block"
console.log(result.claims[0].reason); // "numerical_mismatch"
```

### Chat (OpenAI-compatible)

```typescript
const reply = await client.chatSimple('auto', 'Explain async/await in TypeScript');
console.log(reply);
```

### Streaming

```typescript
const stream = client.chatStream({
  model: 'auto',
  messages: [{ role: 'user', content: 'Hello!' }],
});
for await (const chunk of stream) {
  process.stdout.write(chunk);
}
```

### Conversation

```typescript
const conv = client.conversation({ system: 'You are an expert on TypeScript.', model: 'auto' });
const reply = await conv.say('What are generics?');
const followUp = await conv.say('Give me an example');
```

---

## Features

- **Pre-generation fact extraction** — numbers, dates, limits injected as constraints
- **Post-generation grounding check** — every answer verified against sources
- **Citation validation** — detects phantom references
- **Analytics & Insights** — track token savings, cache performance, cost per hour, and per-tenant traffic
- **Guard method** — one-call hallucination firewall (`client.guard(text, source)` → safe/unsafe)
- **Fact-check API** — verify any claim against any source (3 modes)
- **Native PDF/DOCX upload** — server-side extraction with quality scoring
- **Smart model routing** — auto-selects cheapest model that meets quality
- **OpenAI-compatible** — swap your `baseUrl`, keep your existing code
- **Zero dependencies** — uses Node 18+ built-in APIs (fetch, ReadableStream)

---

## Error Handling

```typescript
import { HttpClient, ServerError } from 'wauldo';

try {
  const response = await client.chat({ model: 'auto', messages: [{ role: 'user', content: 'Hello' }] });
} catch (error) {
  if (error instanceof ServerError) {
    console.error(`Server error [${error.code}]: ${error.message}`);
  }
}
```

---

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

Free tier (300 req/month): [RapidAPI](https://rapidapi.com/binnewzzin/api/smart-rag-api)

---

[Website](https://wauldo.com) | [Docs](https://wauldo.com/docs) | [Demo](https://wauldo.com/demo) | [Benchmarks](https://dev.to/wauldo/how-we-achieved-0-hallucination-rate-in-our-rag-api-with-benchmarks-4g54)

## Contributing

PRs welcome! See [CONTRIBUTING.md](./CONTRIBUTING.md) for setup instructions and guidelines.

Check the [good first issues](https://github.com/wauldo/wauldo-sdk-js/labels/good%20first%20issue) to get started.

## License

MIT — see [LICENSE](./LICENSE)
