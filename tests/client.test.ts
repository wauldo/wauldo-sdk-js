import { describe, it, expect } from 'vitest';
import { AgentClient } from '../src/client.js';
import { ValidationError } from '../src/errors.js';

describe('AgentClient validation', () => {
  const client = new AgentClient({ autoConnect: false });

  describe('reason', () => {
    it('should reject empty problem', async () => {
      await expect(client.reason('')).rejects.toThrow(ValidationError);
      await expect(client.reason('  ')).rejects.toThrow(ValidationError);
    });

    it('should reject invalid depth', async () => {
      await expect(client.reason('test', { depth: 0 })).rejects.toThrow(ValidationError);
      await expect(client.reason('test', { depth: 11 })).rejects.toThrow(ValidationError);
    });

    it('should reject invalid branches', async () => {
      await expect(client.reason('test', { branches: 0 })).rejects.toThrow(ValidationError);
      await expect(client.reason('test', { branches: 11 })).rejects.toThrow(ValidationError);
    });
  });

  describe('extractConcepts', () => {
    it('should reject empty text', async () => {
      await expect(client.extractConcepts('')).rejects.toThrow(ValidationError);
    });
  });

  describe('chunkDocument', () => {
    it('should reject empty content', async () => {
      await expect(client.chunkDocument('')).rejects.toThrow(ValidationError);
    });
  });

  describe('retrieveContext', () => {
    it('should reject empty query', async () => {
      await expect(client.retrieveContext('')).rejects.toThrow(ValidationError);
    });
  });

  describe('summarize', () => {
    it('should reject empty content', async () => {
      await expect(client.summarize('')).rejects.toThrow(ValidationError);
    });
  });

  describe('searchKnowledge', () => {
    it('should reject empty query', async () => {
      await expect(client.searchKnowledge('')).rejects.toThrow(ValidationError);
    });
  });

  describe('addToKnowledge', () => {
    it('should reject empty text', async () => {
      await expect(client.addToKnowledge('')).rejects.toThrow(ValidationError);
    });
  });

  describe('planTask', () => {
    it('should reject empty task', async () => {
      await expect(client.planTask('')).rejects.toThrow(ValidationError);
    });

    it('should reject invalid maxSteps', async () => {
      await expect(client.planTask('test', { maxSteps: 0 })).rejects.toThrow(ValidationError);
      await expect(client.planTask('test', { maxSteps: 21 })).rejects.toThrow(ValidationError);
    });
  });
});

describe('AgentClient initialization', () => {
  it('should create with default options', () => {
    const client = new AgentClient({ autoConnect: false });
    expect(client).toBeDefined();
  });

  it('should accept custom timeout', () => {
    const client = new AgentClient({ timeout: 60000, autoConnect: false });
    expect(client).toBeDefined();
  });

  it('should accept server path', () => {
    const client = new AgentClient({
      serverPath: '/custom/path',
      autoConnect: false,
    });
    expect(client).toBeDefined();
  });
});
