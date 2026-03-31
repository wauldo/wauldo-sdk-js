/**
 * Type definitions for Wauldo SDK
 */

// Client options
export interface ClientOptions {
  /** Path to MCP server binary */
  serverPath?: string;
  /** Default timeout in milliseconds */
  timeout?: number;
  /** Automatically connect on first operation */
  autoConnect?: boolean;
}

// Reasoning
export interface ReasoningOptions {
  /** Depth of the thought tree (1-10) */
  depth?: number;
  /** Number of branches at each level (1-10) */
  branches?: number;
}

export interface ReasoningResult {
  problem: string;
  solution: string;
  thoughtTree: string;
  depth: number;
  branches: number;
  rawContent: string;
}

// Concepts
export type SourceType = 'text' | 'code';

export interface Concept {
  name: string;
  conceptType: string;
  weight: number;
  description?: string;
}

export interface ConceptResult {
  concepts: Concept[];
  sourceType: SourceType;
  rawContent: string;
}

// Long context
export interface Chunk {
  id: string;
  content: string;
  position: number;
  priority: string;
}

export interface ChunkResult {
  chunks: Chunk[];
  totalChunks: number;
  rawContent: string;
}

export interface RetrievalResult {
  query: string;
  results: Chunk[];
  rawContent: string;
}

// Knowledge graph
export interface GraphNode {
  id: string;
  name: string;
  nodeType: string;
  weight: number;
}

export interface KnowledgeGraphResult {
  operation: string;
  nodes: GraphNode[];
  stats?: Record<string, unknown>;
  rawContent: string;
}

// Planning
export type DetailLevel = 'brief' | 'normal' | 'detailed';

export interface PlanStep {
  number: number;
  title: string;
  description: string;
  priority: string;
  effort: string;
  dependencies: string[];
}

export interface PlanResult {
  task: string;
  category: string;
  steps: PlanStep[];
  totalEffort: string;
  rawContent: string;
}

export interface PlanOptions {
  /** Additional context or constraints */
  context?: string;
  /** Maximum number of steps (1-20) */
  maxSteps?: number;
  /** Level of detail for each step */
  detailLevel?: DetailLevel;
}

// Tool definitions
export interface ToolDefinition {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
}

// JSON-RPC
export interface JsonRpcRequest {
  jsonrpc: '2.0';
  id: number;
  method: string;
  params?: Record<string, unknown>;
}

export interface JsonRpcResponse {
  jsonrpc: '2.0';
  id: number;
  result?: unknown;
  error?: {
    code: number;
    message: string;
    data?: unknown;
  };
}

export interface ToolContent {
  type: 'text';
  text: string;
}

export interface CallToolResponse {
  content: ToolContent[];
  isError?: boolean;
}
