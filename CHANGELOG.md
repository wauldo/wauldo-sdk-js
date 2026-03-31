# Changelog

All notable changes to the Wauldo TypeScript SDK.

## [0.1.0] - 2026-03-16

### Added
- `HttpClient` — REST API client (OpenAI-compatible, zero runtime deps)
  - `chat()`, `chatSimple()`, `chatStream()`, `listModels()`, `embeddings()`
  - `ragUpload()`, `ragQuery()`, `ragAsk()`
  - `orchestrate()`, `orchestrateParallel()`
- `AgentClient` — MCP client (stdio JSON-RPC)
  - `reason()`, `extractConcepts()`, `planTask()`
  - `chunkDocument()`, `retrieveContext()`, `summarize()`
  - `searchKnowledge()`, `addToKnowledge()`
- `Conversation` — automatic chat history management
- `MockHttpClient` — offline testing with call recording
- Retry with exponential backoff (429/503/network errors)
- Configurable logging via `onLog` callback
- Event hooks: `onRequest`, `onResponse`, `onError`
- Response validation via `validateResponse<T>()`
- Per-request `timeoutMs` override on `chat()` and `ragUpload()`
- 3 examples: basic_chat, streaming_chat, rag_workflow
- 42 unit tests (Vitest)
- Zero runtime dependencies (Node 18+ built-in APIs only)
- Dual-package: ESM + CommonJS with TypeScript declarations
