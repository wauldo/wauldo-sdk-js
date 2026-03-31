import { describe, it, expect } from 'vitest';
import {
  WauldoError,
  ConnectionError,
  ServerError,
  ValidationError,
  TimeoutError,
  ToolNotFoundError,
} from '../src/errors.js';

describe('WauldoError', () => {
  it('should create basic error', () => {
    const error = new WauldoError('Test error');
    expect(error.message).toBe('Test error');
    expect(error.code).toBeUndefined();
    expect(error.toString()).toBe('Test error');
  });

  it('should create error with code', () => {
    const error = new WauldoError('Test error', 123);
    expect(error.code).toBe(123);
    expect(error.toString()).toBe('[123] Test error');
  });

  it('should create error with data', () => {
    const error = new WauldoError('Test', undefined, { key: 'value' });
    expect(error.data).toEqual({ key: 'value' });
  });
});

describe('ConnectionError', () => {
  it('should have default message', () => {
    const error = new ConnectionError();
    expect(error.message).toContain('connect');
    expect(error.code).toBe(-32000);
  });

  it('should accept custom message', () => {
    const error = new ConnectionError('Custom message');
    expect(error.message).toBe('Custom message');
  });
});

describe('ServerError', () => {
  it('should create with message and code', () => {
    const error = new ServerError('Server failed', -32603);
    expect(error.message).toBe('Server failed');
    expect(error.code).toBe(-32603);
  });
});

describe('ValidationError', () => {
  it('should create with field', () => {
    const error = new ValidationError('Invalid value', 'name');
    expect(error.field).toBe('name');
    expect(error.code).toBe(-32602);
  });

  it('should create without field', () => {
    const error = new ValidationError('Invalid');
    expect(error.field).toBeUndefined();
  });
});

describe('TimeoutError', () => {
  it('should have default message', () => {
    const error = new TimeoutError();
    expect(error.message).toContain('timed out');
    expect(error.code).toBe(-32001);
  });

  it('should accept timeout value', () => {
    const error = new TimeoutError('Timed out', 30000);
    expect(error.timeout).toBe(30000);
  });
});

describe('ToolNotFoundError', () => {
  it('should include tool name', () => {
    const error = new ToolNotFoundError('unknown_tool');
    expect(error.toolName).toBe('unknown_tool');
    expect(error.message).toContain('unknown_tool');
    expect(error.code).toBe(-32601);
  });
});
