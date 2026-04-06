# Contributing to Wauldo TypeScript SDK

Thanks for your interest in contributing! This guide will get you up and running in under 5 minutes.

## Setup

```bash
git clone https://github.com/wauldo/wauldo-sdk-js.git
cd wauldo-sdk-js
npm install
npm test
```

That's it. No server, no API key, no Docker.

## Testing without a server

Use `MockHttpClient` for all development and testing. It records every call and returns realistic mock data:

```typescript
import { MockHttpClient } from '../src/index.js';

const client = new MockHttpClient();
const result = await client.ragQuery('What is the refund policy?');
console.log(result.answer); // "Mock answer for: What is the refund policy?"
console.log(client.calls);  // [{ method: 'ragQuery', args: [...] }]
```

MockHttpClient supports all SDK methods: `ragUpload`, `ragQuery`, `factCheck`, `verifyCitation`, `getInsights`, `getAnalytics`, `getAnalyticsTraffic`, `chat`, `chatStream`, `uploadFile`, and more.

Run the quickstart to verify everything works:

```bash
npx tsx examples/quickstart.ts
```

## Project structure

```
src/
  http_client.ts    # Real HTTP client (fetch-based)
  mock_client.ts    # Mock client for testing
  http_types.ts     # API type definitions
  index.ts          # Public exports
  sse_parser.ts     # SSE stream parser
  errors.ts         # Error types
  conversation.ts   # Stateful conversation helper
examples/
  quickstart.ts     # End-to-end demo with MockHttpClient
  analytics_demo.ts # Analytics & insights demo
  streaming_demo.ts # Streaming patterns
```

## Code style

- TypeScript strict mode
- No external runtime dependencies (Node 18+ built-in fetch)
- Every exported function/class needs JSDoc comments
- Use `async/await` over raw promises

## Running tests

```bash
npm test              # Run all tests once
npm run test:watch    # Watch mode
npm run typecheck     # Type-check without emitting
npm run build         # Build for distribution
```

## Making a PR

1. **One PR per feature** -- keep changes focused
2. **Add tests** for new methods or behavior changes
3. **Update MockHttpClient** if you add new API methods
4. **Run `npm test` and `npm run typecheck`** before submitting
5. **Update README.md** if your change affects the public API

## Adding a new API method

1. Add the request/response types in `src/http_types.ts`
2. Add the method in `src/http_client.ts`
3. Add a mock implementation in `src/mock_client.ts`
4. Export new types from `src/index.ts`
5. Add a test in the appropriate test file
6. Add an example in `examples/` if it demonstrates a new workflow

## Commit messages

Follow conventional commits: `feat:`, `fix:`, `docs:`, `chore:`, `test:`.

```
feat: add uploadFile() method + types
fix: handle empty response body in streaming
docs: add analytics example
```

## Questions?

Open an issue on [GitHub](https://github.com/wauldo/wauldo-sdk-js/issues) or check the [documentation](https://wauldo.com/docs).
