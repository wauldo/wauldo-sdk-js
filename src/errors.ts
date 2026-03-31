/**
 * Custom errors for Wauldo SDK
 */

/**
 * Base error class for all Wauldo errors
 */
export class WauldoError extends Error {
  readonly code: number | undefined;
  readonly data: unknown;

  constructor(message: string, code?: number, data?: unknown) {
    super(message);
    this.name = 'WauldoError';
    this.code = code;
    this.data = data;
    Object.setPrototypeOf(this, WauldoError.prototype);
  }

  override toString(): string {
    if (this.code !== undefined) {
      return `[${this.code}] ${this.message}`;
    }
    return this.message;
  }
}

/**
 * Thrown when connection to MCP server fails
 */
export class ConnectionError extends WauldoError {
  constructor(message = 'Failed to connect to MCP server') {
    super(message, -32000);
    this.name = 'ConnectionError';
    Object.setPrototypeOf(this, ConnectionError.prototype);
  }
}

/**
 * Thrown when server returns an error response
 */
export class ServerError extends WauldoError {
  constructor(message: string, code?: number, data?: unknown) {
    super(message, code, data);
    this.name = 'ServerError';
    Object.setPrototypeOf(this, ServerError.prototype);
  }
}

/**
 * Thrown when input validation fails
 */
export class ValidationError extends WauldoError {
  readonly field: string | undefined;

  constructor(message: string, field?: string) {
    super(message, -32602);
    this.name = 'ValidationError';
    this.field = field;
    Object.setPrototypeOf(this, ValidationError.prototype);
  }
}

/**
 * Thrown when operation times out
 */
export class TimeoutError extends WauldoError {
  readonly timeout: number | undefined;

  constructor(message = 'Operation timed out', timeout?: number) {
    super(message, -32001);
    this.name = 'TimeoutError';
    this.timeout = timeout;
    Object.setPrototypeOf(this, TimeoutError.prototype);
  }
}

/**
 * Thrown when requested tool is not available
 */
export class ToolNotFoundError extends WauldoError {
  readonly toolName: string;

  constructor(toolName: string) {
    super(`Tool not found: ${toolName}`, -32601);
    this.name = 'ToolNotFoundError';
    this.toolName = toolName;
    Object.setPrototypeOf(this, ToolNotFoundError.prototype);
  }
}
