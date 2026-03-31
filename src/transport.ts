/**
 * Transport layer for MCP communication
 */

import { spawn, ChildProcess } from 'node:child_process';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';
import { createInterface, Interface } from 'node:readline';

import { ConnectionError, ServerError, TimeoutError } from './errors.js';
import type { JsonRpcRequest, JsonRpcResponse } from './types.js';

/**
 * Stdio transport for MCP server communication
 */
export class StdioTransport {
  private serverPath: string | null;
  private readonly timeout: number;
  private process: ChildProcess | null = null;
  private requestId = 0;
  private readline: Interface | null = null;
  private connectingPromise: Promise<void> | null = null;
  private disconnected = false;
  private responseQueue: Map<number, {
    resolve: (value: unknown) => void;
    reject: (error: Error) => void;
    timer: NodeJS.Timeout;
  }> = new Map();

  constructor(serverPath?: string, timeout = 30000) {
    this.serverPath = serverPath ?? null;
    this.timeout = timeout;
  }

  /**
   * Find MCP server binary in common locations
   */
  private findServer(): string {
    const searchPaths = [
      join(process.cwd(), 'target', 'release', 'wauldo-mcp'),
      join(process.cwd(), 'target', 'debug', 'wauldo-mcp'),
      join(process.cwd(), '..', 'target', 'release', 'wauldo-mcp'),
      join(homedir(), '.cargo', 'bin', 'wauldo-mcp'),
    ];

    for (const path of searchPaths) {
      if (existsSync(path)) {
        return path;
      }
    }

    throw new ConnectionError(
      'MCP server binary not found. Please provide serverPath or install with "cargo install".'
    );
  }

  /**
   * Get server path, finding it lazily if needed
   */
  private getServerPath(): string {
    if (this.serverPath === null) {
      this.serverPath = this.findServer();
    }
    return this.serverPath;
  }

  /**
   * Connect to MCP server
   */
  async connect(): Promise<void> {
    if (this.process !== null) {
      return;
    }
    // Prevent concurrent connect() calls from spawning multiple processes
    if (this.connectingPromise !== null) {
      return this.connectingPromise;
    }
    this.connectingPromise = this.doConnect();
    try {
      await this.connectingPromise;
    } finally {
      this.connectingPromise = null;
    }
  }

  private async doConnect(): Promise<void> {
    const serverPath = this.getServerPath();

    try {
      this.process = spawn(serverPath, [], {
        stdio: ['pipe', 'pipe', 'pipe'],
      });
    } catch (error) {
      throw new ConnectionError(`Failed to start server: ${error}`);
    }

    if (!this.process.stdout || !this.process.stdin) {
      throw new ConnectionError('Failed to get stdio handles');
    }

    // Set up readline for response parsing
    this.readline = createInterface({
      input: this.process.stdout,
      crlfDelay: Infinity,
    });

    this.disconnected = false;

    this.readline.on('line', (line) => {
      if (!this.disconnected) this.handleResponse(line);
    });

    this.process.on('error', (error) => {
      if (!this.disconnected) this.handleError(new ConnectionError(`Server error: ${error.message}`));
    });

    this.process.on('close', (code) => {
      if (!this.disconnected && code !== 0) {
        this.handleError(new ConnectionError(`Server exited with code ${code}`));
      }
    });

    // Initialize MCP connection — cleanup process on failure
    try {
      await this.initialize();
    } catch (err) {
      this.disconnect();
      throw err;
    }
  }

  /**
   * Disconnect from MCP server
   */
  disconnect(): void {
    this.disconnected = true;

    if (this.readline) {
      this.readline.close();
      this.readline = null;
    }

    if (this.process) {
      this.process.kill();
      this.process = null;
    }

    // Reject any pending requests
    for (const [, pending] of this.responseQueue) {
      clearTimeout(pending.timer);
      pending.reject(new ConnectionError('Connection closed'));
    }
    this.responseQueue.clear();
  }

  /**
   * Handle incoming response
   */
  private handleResponse(line: string): void {
    try {
      const response = JSON.parse(line) as JsonRpcResponse;
      const pending = this.responseQueue.get(response.id);

      if (pending) {
        clearTimeout(pending.timer);
        this.responseQueue.delete(response.id);

        if (response.error) {
          pending.reject(
            new ServerError(
              response.error.message,
              response.error.code,
              response.error.data
            )
          );
        } else {
          pending.resolve(response.result);
        }
      }
    } catch {
      // Ignore malformed responses
    }
  }

  /**
   * Handle transport error
   */
  private handleError(error: Error): void {
    for (const [, pending] of this.responseQueue) {
      clearTimeout(pending.timer);
      pending.reject(error);
    }
    this.responseQueue.clear();
  }

  /**
   * Send MCP initialize request
   */
  private async initialize(): Promise<void> {
    await this.request('initialize', {
      protocolVersion: '2024-11-05',
      capabilities: {},
      clientInfo: { name: 'wauldo-typescript', version: '0.1.0' },
    });
  }

  /**
   * Send JSON-RPC request and wait for response
   */
  async request(
    method: string,
    params?: Record<string, unknown>,
    timeout?: number
  ): Promise<unknown> {
    if (!this.process || !this.process.stdin) {
      throw new ConnectionError('Not connected. Call connect() first.');
    }

    this.requestId++;
    const id = this.requestId;

    const request: JsonRpcRequest = {
      jsonrpc: '2.0',
      id,
      method,
    };

    if (params) {
      request.params = params;
    }

    const requestData = JSON.stringify(request) + '\n';

    return new Promise((resolve, reject) => {
      const timeoutMs = timeout ?? this.timeout;
      let settled = false;

      const safeReject = (err: Error) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        this.responseQueue.delete(id);
        reject(err);
      };

      const timer = setTimeout(() => {
        safeReject(new TimeoutError(`Request timed out after ${timeoutMs}ms`, timeoutMs));
      }, timeoutMs);

      this.responseQueue.set(id, {
        resolve: (value) => { if (!settled) { settled = true; clearTimeout(timer); resolve(value); } },
        reject: safeReject,
        timer,
      });

      this.process!.stdin!.write(requestData, (error) => {
        if (error) {
          safeReject(new ConnectionError(`Failed to send request: ${error.message}`));
        }
      });
    });
  }
}
