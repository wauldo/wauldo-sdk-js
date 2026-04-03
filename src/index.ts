/**
 * Wauldo TypeScript SDK
 *
 * Two client interfaces:
 * - AgentClient — MCP server (stdio JSON-RPC) for reasoning, planning, tools
 * - HttpClient — REST API (OpenAI-compatible) for chat, embeddings, RAG, orchestrator
 *
 * @packageDocumentation
 */

// MCP Client
export { AgentClient } from './client.js';

// HTTP Client
export { HttpClient } from './http_client.js';

// Conversation helper
export { Conversation } from './conversation.js';

// Mock Client (for testing)
export { MockHttpClient } from './mock_client.js';

// Errors
export {
  WauldoError,
  ConnectionError,
  ServerError,
  ValidationError,
  TimeoutError,
  ToolNotFoundError,
} from './errors.js';

// MCP Types
export type {
  ClientOptions,
  ReasoningOptions,
  ReasoningResult,
  SourceType,
  Concept,
  ConceptResult,
  Chunk,
  ChunkResult,
  RetrievalResult,
  GraphNode,
  KnowledgeGraphResult,
  DetailLevel,
  PlanStep,
  PlanResult,
  PlanOptions,
  ToolDefinition,
  CallToolResponse,
  ToolContent,
} from './types.js';

// HTTP API Helpers
export { chatContent } from './http_types.js';

// HTTP API Types
export type {
  ChatMessage,
  ChatRequest,
  ChatResponse,
  ChatUsage,
  ChatChoice,
  ModelInfo,
  ModelList,
  EmbeddingData,
  EmbeddingUsage,
  EmbeddingResponse,
  RagUploadResponse,
  RagSource,
  RagAuditInfo,
  RagQueryResponse,
  OrchestratorResponse,
  FactCheckRequest,
  FactCheckResponse,
  ClaimResult,
  VerifyCitationRequest,
  VerifyCitationResponse,
  SourceChunk,
  CitationDetail,
  HttpClientConfig,
  LogLevel,
  RequestOptions,
  ChatClientLike,
} from './http_types.js';
