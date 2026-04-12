/**
 * Tests for HttpClient.guard() — hallucination firewall
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { HttpClient } from '../src/http_client.js';
import { guardIsSafe, guardIsBlocked } from '../src/http_types.js';
import type { GuardResponse } from '../src/http_types.js';

// ============================================================================
// Mock setup
// ============================================================================

function mockFetchResponse(body: unknown, status = 200) {
  return vi.fn().mockResolvedValue({
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.resolve(body),
    text: () => Promise.resolve(JSON.stringify(body)),
  });
}

const VERIFIED_BODY: GuardResponse = {
  verdict: 'verified',
  action: 'allow',
  hallucination_rate: 0,
  mode: 'lexical',
  total_claims: 1,
  supported_claims: 1,
  confidence: 1.0,
  claims: [
    {
      text: 'Paris is in France',
      supported: true,
      confidence: 1.0,
      verdict: 'verified',
      action: 'allow',
    },
  ],
};

const REJECTED_BODY: GuardResponse = {
  verdict: 'rejected',
  action: 'block',
  hallucination_rate: 1.0,
  mode: 'lexical',
  total_claims: 1,
  supported_claims: 0,
  confidence: 0.0,
  claims: [
    {
      text: 'Returns within 60 days',
      supported: false,
      confidence: 0.3,
      verdict: 'rejected',
      action: 'block',
      reason: 'numerical_mismatch',
    },
  ],
};

const WEAK_BODY: GuardResponse = {
  verdict: 'weak',
  action: 'review',
  hallucination_rate: 0.5,
  mode: 'lexical',
  total_claims: 2,
  supported_claims: 1,
  confidence: 0.5,
  claims: [
    { text: 'A', supported: true, confidence: 0.8, verdict: 'verified', action: 'allow' },
    { text: 'B', supported: false, confidence: 0.2, verdict: 'rejected', action: 'block', reason: 'insufficient_evidence' },
  ],
};

// ============================================================================
// Tests
// ============================================================================

describe('HttpClient.guard()', () => {
  let originalFetch: typeof globalThis.fetch;

  beforeEach(() => {
    originalFetch = globalThis.fetch;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it('returns verified when claim matches source', async () => {
    globalThis.fetch = mockFetchResponse(VERIFIED_BODY);
    const client = new HttpClient({ baseUrl: 'http://localhost:3000', apiKey: 'test' });
    const result = await client.guard('Paris is in France', 'Paris is the capital of France.');
    expect(result.verdict).toBe('verified');
    expect(result.confidence).toBe(1.0);
    expect(guardIsSafe(result)).toBe(true);
    expect(guardIsBlocked(result)).toBe(false);
    expect(result.claims).toHaveLength(1);
    expect(result.claims[0].supported).toBe(true);
  });

  it('returns rejected when claim contradicts source', async () => {
    globalThis.fetch = mockFetchResponse(REJECTED_BODY);
    const client = new HttpClient({ baseUrl: 'http://localhost:3000', apiKey: 'test' });
    const result = await client.guard('Returns within 60 days', '14-day return policy.');
    expect(result.verdict).toBe('rejected');
    expect(guardIsSafe(result)).toBe(false);
    expect(guardIsBlocked(result)).toBe(true);
    expect(result.claims[0].reason).toBe('numerical_mismatch');
  });

  it('returns weak/review for mixed claims', async () => {
    globalThis.fetch = mockFetchResponse(WEAK_BODY);
    const client = new HttpClient({ baseUrl: 'http://localhost:3000', apiKey: 'test' });
    const result = await client.guard('mixed', 'source');
    expect(result.verdict).toBe('weak');
    expect(result.action).toBe('review');
    expect(guardIsSafe(result)).toBe(false);
    expect(guardIsBlocked(result)).toBe(false);
    expect(result.total_claims).toBe(2);
    expect(result.supported_claims).toBe(1);
  });

  it('throws on HTTP error', async () => {
    globalThis.fetch = mockFetchResponse({ error: 'Unauthorized' }, 401);
    const client = new HttpClient({ baseUrl: 'http://localhost:3000', apiKey: 'bad' });
    await expect(client.guard('test', 'test')).rejects.toThrow();
  });

  it('passes mode parameter correctly', async () => {
    const mockFetch = mockFetchResponse({ ...VERIFIED_BODY, mode: 'hybrid' });
    globalThis.fetch = mockFetch;
    const client = new HttpClient({ baseUrl: 'http://localhost:3000', apiKey: 'test' });
    const result = await client.guard('t', 't', 'hybrid');
    expect(result.mode).toBe('hybrid');
    // Verify the request body includes mode
    const [, init] = mockFetch.mock.calls[0];
    const body = JSON.parse(init.body);
    expect(body.mode).toBe('hybrid');
  });
});
