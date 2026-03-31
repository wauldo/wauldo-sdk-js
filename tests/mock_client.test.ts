/**
 * Tests for MockHttpClient completeness and Conversation helper
 */

import { describe, expect, it } from 'vitest';
import { MockHttpClient } from '../src/mock_client.js';

describe('MockHttpClient', () => {
  it('has conversation() method', () => {
    const mock = new MockHttpClient();
    const conv = mock.conversation({ system: 'You are helpful' });
    expect(conv).toBeDefined();
  });

  it('has ragAsk() method', async () => {
    const mock = new MockHttpClient();
    const result = await mock.ragAsk('question', 'some text');
    expect(typeof result).toBe('string');
  });

  it('ragAsk records calls', async () => {
    const mock = new MockHttpClient();
    await mock.ragAsk('q', 'text', 'source');
    const methods = mock.calls.map(c => c.method);
    expect(methods).toContain('ragAsk');
    expect(methods).toContain('ragUpload');
    expect(methods).toContain('ragQuery');
  });

  it('conversation records call', () => {
    const mock = new MockHttpClient();
    mock.conversation({ system: 'test' });
    expect(mock.calls[0]?.method).toBe('conversation');
  });

  it('all core methods exist', () => {
    const mock = new MockHttpClient();
    expect(typeof mock.listModels).toBe('function');
    expect(typeof mock.chat).toBe('function');
    expect(typeof mock.chatSimple).toBe('function');
    expect(typeof mock.chatStream).toBe('function');
    expect(typeof mock.embeddings).toBe('function');
    expect(typeof mock.ragUpload).toBe('function');
    expect(typeof mock.ragQuery).toBe('function');
    expect(typeof mock.orchestrate).toBe('function');
    expect(typeof mock.orchestrateParallel).toBe('function');
    expect(typeof mock.conversation).toBe('function');
    expect(typeof mock.ragAsk).toBe('function');
  });

  it('mock created timestamp is deterministic', async () => {
    const mock = new MockHttpClient();
    const models = await mock.listModels();
    expect(models.data[0]?.created).toBe(0);
  });

  it('conversation.say() appends user and assistant to history', async () => {
    const mock = new MockHttpClient();
    const conv = mock.conversation({ system: 'You are helpful' });
    const reply = await conv.say('Hello');
    expect(typeof reply).toBe('string');
    const history = conv.getHistory();
    expect(history).toHaveLength(3); // system + user + assistant
    expect(history[0]?.role).toBe('system');
    expect(history[1]?.role).toBe('user');
    expect(history[2]?.role).toBe('assistant');
  });

  it('conversation.clear() preserves system prompt', async () => {
    const mock = new MockHttpClient();
    const conv = mock.conversation({ system: 'Be concise' });
    await conv.say('Hello');
    expect(conv.getHistory()).toHaveLength(3);
    conv.clear();
    const history = conv.getHistory();
    expect(history).toHaveLength(1);
    expect(history[0]?.role).toBe('system');
    expect(history[0]?.content).toBe('Be concise');
  });

  it('conversation.clear() without system resets to empty', () => {
    const mock = new MockHttpClient();
    const conv = mock.conversation();
    conv.clear();
    expect(conv.getHistory()).toHaveLength(0);
  });
});
