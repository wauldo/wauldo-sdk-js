/**
 * Retry-aware fetch wrapper with exponential backoff.
 */

import type { LogLevel } from './http_types.js';

/** HTTP status codes eligible for automatic retry */
const RETRYABLE_STATUSES = new Set([429, 500, 502, 503, 504]);

/** Configuration for the retry fetch wrapper */
export interface RetryConfig {
  baseUrl: string;
  headers: Record<string, string>;
  timeoutMs: number;
  maxRetries: number;
  retryBackoffMs: number;
  onLog: ((level: LogLevel, message: string) => void) | undefined;
  onRequest: ((method: string, path: string) => void) | undefined;
  onResponse: ((status: number, durationMs: number) => void) | undefined;
  onError: ((error: Error) => void) | undefined;
}

/** Execute an HTTP request with retry and exponential backoff. */
export async function fetchWithRetry<T>(
  config: RetryConfig,
  method: string,
  path: string,
  body?: unknown,
  overrideTimeoutMs?: number,
): Promise<T> {
  const effectiveTimeout = overrideTimeoutMs ?? config.timeoutMs;
  let lastError: Error | undefined;

  for (let attempt = 0; attempt <= config.maxRetries; attempt++) {
    try {
      config.onLog?.('debug', `${method} ${path} (attempt ${attempt + 1})`);
      config.onRequest?.(method, path);
      const start = Date.now();
      const options: RequestInit = {
        method,
        headers: config.headers,
        signal: AbortSignal.timeout(effectiveTimeout),
      };
      if (body !== undefined && method !== 'GET' && method !== 'HEAD') {
        options.body = JSON.stringify(body);
      }
      const resp = await fetch(`${config.baseUrl}${path}`, options);
      const durationMs = Date.now() - start;
      if (resp.ok) {
        config.onLog?.('debug', `${method} ${path} -> ${resp.status}`);
        config.onResponse?.(resp.status, durationMs);
        return resp.json() as Promise<T>;
      }
      config.onResponse?.(resp.status, durationMs);
      if (RETRYABLE_STATUSES.has(resp.status) && attempt < config.maxRetries) {
        const waitMs = computeBackoff(config.retryBackoffMs, attempt, resp);
        config.onLog?.('warn', `${method} ${path} -> ${resp.status}, retrying in ${waitMs}ms`);
        await sleep(waitMs);
        lastError = new Error(`HTTP ${resp.status}: ${await resp.text()}`);
        continue;
      }
      const text = await resp.text();
      let message = text;
      try { const j = JSON.parse(text); if (j?.error?.message) message = j.error.message; } catch {}
      config.onLog?.('error', `${method} ${path} -> ${resp.status}: ${message}`);
      const err = new Error(`HTTP ${resp.status}: ${message}`);
      config.onError?.(err);
      throw err;
    } catch (err) {
      if (err instanceof TypeError && attempt < config.maxRetries) {
        const waitMs = config.retryBackoffMs * Math.pow(2, attempt);
        config.onLog?.('warn', `${method} ${path} network error, retrying in ${waitMs}ms`);
        await sleep(waitMs);
        lastError = err;
        continue;
      }
      if (err instanceof Error) {
        config.onError?.(err);
      }
      throw err;
    }
  }
  const finalErr = lastError ?? new Error('Request failed after retries');
  config.onError?.(finalErr);
  throw finalErr;
}

function computeBackoff(retryBackoffMs: number, attempt: number, resp: Response): number {
  const retryAfter = resp.headers.get('Retry-After');
  if (retryAfter) {
    const seconds = Number(retryAfter);
    if (!Number.isNaN(seconds) && seconds > 0) {
      return seconds * 1_000;
    }
  }
  return retryBackoffMs * Math.pow(2, attempt);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
