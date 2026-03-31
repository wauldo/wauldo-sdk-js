/**
 * Wauldo client implementation
 */

import { ConnectionError, ValidationError } from './errors.js';
import { StdioTransport } from './transport.js';
import type {
  ClientOptions,
  ReasoningOptions,
  ReasoningResult,
  SourceType,
  ConceptResult,
  Concept,
  Chunk,
  ChunkResult,
  RetrievalResult,
  KnowledgeGraphResult,
  PlanOptions,
  PlanResult,
  PlanStep,
  ToolDefinition,
  CallToolResponse,
} from './types.js';

/** Parse chunk/result items from JSON, trying primaryKey first then fallback */
function parseChunkList(raw: string, primaryKey: string, fallbackKey: string): Chunk[] {
  try {
    const data = JSON.parse(raw);
    const items = data?.[primaryKey] ?? data?.[fallbackKey] ?? [];
    if (!Array.isArray(items)) return [];
    return items
      .filter((c: unknown): c is Record<string, unknown> => typeof c === 'object' && c !== null)
      .map((c, i) => ({
        id: String(c.id ?? ''),
        content: String(c.content ?? ''),
        position: Number(c.position ?? i),
        priority: String(c.priority ?? 'medium'),
      }));
  } catch {
    return [];
  }
}

function parseChunks(raw: string): Chunk[] {
  return parseChunkList(raw, 'chunks', 'results');
}

function parseRetrievalResults(raw: string): Chunk[] {
  return parseChunkList(raw, 'results', 'chunks');
}

/**
 * Client for Wauldo MCP Server
 *
 * @example
 * ```typescript
 * const client = new AgentClient();
 * await client.connect();
 *
 * const result = await client.reason("How to optimize this algorithm?");
 * console.log(result.solution);
 *
 * client.disconnect();
 * ```
 */
export class AgentClient {
  private readonly transport: StdioTransport;
  private readonly autoConnect: boolean;
  private connected = false;

  constructor(options: ClientOptions = {}) {
    this.transport = new StdioTransport(
      options.serverPath,
      options.timeout ?? 30000
    );
    this.autoConnect = options.autoConnect ?? true;
  }

  /**
   * Connect to MCP server
   */
  async connect(): Promise<this> {
    await this.transport.connect();
    this.connected = true;
    return this;
  }

  /**
   * Disconnect from MCP server
   */
  disconnect(): void {
    this.transport.disconnect();
    this.connected = false;
  }

  /**
   * Ensure client is connected
   */
  private async ensureConnected(): Promise<void> {
    if (!this.connected) {
      if (this.autoConnect) {
        await this.connect();
      } else {
        throw new ConnectionError('Not connected. Call connect() first.');
      }
    }
  }

  // Tool discovery

  /**
   * List all available tools
   */
  async listTools(): Promise<ToolDefinition[]> {
    await this.ensureConnected();
    const result = await this.transport.request('tools/list') as { tools: ToolDefinition[] };
    return result.tools ?? [];
  }

  /**
   * Call a tool by name
   */
  async callTool(name: string, args: Record<string, unknown>): Promise<string> {
    await this.ensureConnected();
    const result = await this.transport.request('tools/call', {
      name,
      arguments: args,
    }) as CallToolResponse;

    const content = result.content;
    if (content && content.length > 0 && content[0]) {
      return content[0].text ?? '';
    }
    return '';
  }

  // Reasoning

  /**
   * Perform Tree-of-Thought reasoning on a problem
   *
   * @example
   * ```typescript
   * const result = await client.reason(
   *   "What's the best sorting algorithm for nearly sorted data?",
   *   { depth: 4, branches: 3 }
   * );
   * console.log(result.solution);
   * ```
   */
  async reason(
    problem: string,
    options: ReasoningOptions = {}
  ): Promise<ReasoningResult> {
    const { depth = 3, branches = 3 } = options;

    if (!problem.trim()) {
      throw new ValidationError('Problem cannot be empty', 'problem');
    }
    if (depth < 1 || depth > 10) {
      throw new ValidationError('Depth must be between 1 and 10', 'depth');
    }
    if (branches < 1 || branches > 10) {
      throw new ValidationError('Branches must be between 1 and 10', 'branches');
    }

    const content = await this.callTool('reason_tree_of_thought', {
      problem,
      depth,
      branches,
    });

    return this.parseReasoningResult(content, problem, depth, branches);
  }

  private parseReasoningResult(
    content: string,
    problem: string,
    depth: number,
    branches: number
  ): ReasoningResult {
    // Try JSON first (structured output from server v0.2+)
    try {
      const data = JSON.parse(content);
      if (data.solution !== undefined) {
        return {
          problem: data.problem ?? problem,
          solution: data.solution,
          thoughtTree: data.thought_tree ?? content,
          depth: data.depth ?? depth,
          branches: data.branches ?? branches,
          rawContent: content,
        };
      }
    } catch { /* fallback below */ }

    // Fallback: markdown heuristic parser
    const lines = content.split('\n');
    let solution = '';
    let inSolution = false;

    for (const line of lines) {
      if (line.includes('Solution:') || line.includes('Best path:')) {
        inSolution = true;
        continue;
      }
      if (inSolution && line.trim()) {
        solution = line.trim();
        break;
      }
    }

    return {
      problem,
      solution: solution || 'See thought tree for analysis',
      thoughtTree: content,
      depth,
      branches,
      rawContent: content,
    };
  }

  // Concept extraction

  /**
   * Extract concepts from text or code
   *
   * @example
   * ```typescript
   * const result = await client.extractConcepts(code, 'code');
   * for (const concept of result.concepts) {
   *   console.log(`${concept.name}: ${concept.weight}`);
   * }
   * ```
   */
  async extractConcepts(
    text: string,
    sourceType: SourceType = 'text'
  ): Promise<ConceptResult> {
    if (!text.trim()) {
      throw new ValidationError('Text cannot be empty', 'text');
    }

    const content = await this.callTool('extract_concepts', {
      text,
      source_type: sourceType,
    });

    return this.parseConceptResult(content, sourceType);
  }

  private parseConceptResult(content: string, sourceType: SourceType): ConceptResult {
    // Try JSON first (structured output from server v0.2+)
    try {
      const data = JSON.parse(content);
      if (Array.isArray(data.concepts)) {
        return {
          concepts: data.concepts.map((c: Record<string, unknown>) => ({
            name: String(c.name ?? ''),
            conceptType: String(c.concept_type ?? 'Entity'),
            weight: Number(c.weight ?? 0.8),
          })),
          sourceType: (['text', 'code'].includes(String(data.source_type)) ? String(data.source_type) : sourceType) as SourceType,
          rawContent: content,
        };
      }
    } catch { /* fallback below */ }

    // Fallback: markdown heuristic parser
    const concepts: Concept[] = [];
    const lines = content.split('\n');

    for (const line of lines) {
      if (line.trim().startsWith('- ')) {
        const name = line.trim().slice(2).split(':')[0]?.trim();
        if (name) {
          concepts.push({
            name,
            conceptType: 'Entity',
            weight: 0.8,
          });
        }
      }
    }

    return {
      concepts,
      sourceType,
      rawContent: content,
    };
  }

  // Long context management

  /**
   * Split a document into manageable chunks
   */
  async chunkDocument(
    content: string,
    chunkSize = 512
  ): Promise<ChunkResult> {
    if (!content.trim()) {
      throw new ValidationError('Content cannot be empty', 'content');
    }

    const result = await this.callTool('manage_long_context', {
      operation: 'chunk',
      content,
      chunk_size: chunkSize,
    });

    const chunks = parseChunks(result);
    return {
      chunks,
      totalChunks: chunks.length,
      rawContent: result,
    };
  }

  /**
   * Retrieve relevant context for a query
   */
  async retrieveContext(
    query: string,
    topK = 5
  ): Promise<RetrievalResult> {
    if (!query.trim()) {
      throw new ValidationError('Query cannot be empty', 'query');
    }

    const result = await this.callTool('manage_long_context', {
      operation: 'retrieve',
      query,
      top_k: topK,
    });

    return {
      query,
      results: parseRetrievalResults(result),
      rawContent: result,
    };
  }

  /**
   * Summarize document content
   */
  async summarize(content: string): Promise<string> {
    if (!content.trim()) {
      throw new ValidationError('Content cannot be empty', 'content');
    }

    return this.callTool('manage_long_context', {
      operation: 'summarize',
      content,
    });
  }

  // Knowledge graph

  /**
   * Search the knowledge graph
   */
  async searchKnowledge(
    query: string,
    limit = 10
  ): Promise<KnowledgeGraphResult> {
    if (!query.trim()) {
      throw new ValidationError('Query cannot be empty', 'query');
    }

    const result = await this.callTool('query_knowledge_graph', {
      operation: 'search',
      query,
      limit,
    });

    return {
      operation: 'search',
      nodes: [],
      rawContent: result,
    };
  }

  /**
   * Add concepts from text to knowledge graph
   */
  async addToKnowledge(text: string): Promise<KnowledgeGraphResult> {
    if (!text.trim()) {
      throw new ValidationError('Text cannot be empty', 'text');
    }

    const result = await this.callTool('query_knowledge_graph', {
      operation: 'add',
      text,
    });

    return {
      operation: 'add',
      nodes: [],
      rawContent: result,
    };
  }

  /**
   * Get knowledge graph statistics
   */
  async knowledgeStats(): Promise<KnowledgeGraphResult> {
    const result = await this.callTool('query_knowledge_graph', {
      operation: 'stats',
    });

    return {
      operation: 'stats',
      nodes: [],
      rawContent: result,
    };
  }

  // Task planning

  /**
   * Break down a task into actionable steps
   *
   * @example
   * ```typescript
   * const plan = await client.planTask(
   *   "Implement user authentication",
   *   { context: "Using JWT tokens", detailLevel: "detailed" }
   * );
   * for (const step of plan.steps) {
   *   console.log(`${step.number}. ${step.title}`);
   * }
   * ```
   */
  async planTask(
    task: string,
    options: PlanOptions = {}
  ): Promise<PlanResult> {
    const {
      context = '',
      maxSteps = 10,
      detailLevel = 'normal',
    } = options;

    if (!task.trim()) {
      throw new ValidationError('Task cannot be empty', 'task');
    }
    if (maxSteps < 1 || maxSteps > 20) {
      throw new ValidationError('maxSteps must be between 1 and 20', 'maxSteps');
    }

    const content = await this.callTool('plan_task', {
      task,
      context,
      max_steps: maxSteps,
      detail_level: detailLevel,
    });

    return this.parsePlanResult(content, task);
  }

  private parsePlanResult(content: string, task: string): PlanResult {
    // Try JSON first (structured output from server v0.2+)
    try {
      const data = JSON.parse(content);
      if (Array.isArray(data.steps)) {
        return {
          task: data.task ?? task,
          category: data.category ?? 'General',
          steps: data.steps.map((s: Record<string, unknown>, i: number) => ({
            number: Number(s.number ?? i + 1),
            title: String(s.title ?? ''),
            description: String(s.description ?? ''),
            priority: String(s.priority ?? 'Medium'),
            effort: String(s.effort ?? ''),
            dependencies: Array.isArray(s.dependencies) ? s.dependencies.map(String) : [],
          })),
          totalEffort: String(data.total_effort ?? ''),
          rawContent: content,
        };
      }
    } catch { /* fallback below */ }

    // Fallback: markdown heuristic parser
    const steps: PlanStep[] = [];
    let category = 'General';
    let totalEffort = '';
    let currentStep = 0;
    const stepPattern = /^(\d+)\.\s+(.+)$/;

    const lines = content.split('\n');

    for (const line of lines) {
      const trimmed = line.trim();

      // Extract category: "**Category**: X" — split on first colon only
      if (trimmed.startsWith('**Category**:')) {
        category = trimmed.slice('**Category**:'.length).trim() || 'General';
        continue;
      }

      // Extract steps strictly: "1. Title" (digits + dot + space + text)
      const match = stepPattern.exec(trimmed);
      if (match) {
        currentStep++;
        const title = match[2]?.trim() ?? '';
        if (title) {
          steps.push({
            number: currentStep,
            title,
            description: '',
            priority: 'Medium',
            effort: '',
            dependencies: [],
          });
        }
        continue;
      }

      // Extract total effort — split on first colon only
      if (trimmed.startsWith('**Estimated total effort**:')) {
        totalEffort = trimmed.slice('**Estimated total effort**:'.length).trim();
      }
    }

    return {
      task,
      category,
      steps,
      totalEffort,
      rawContent: content,
    };
  }
}
