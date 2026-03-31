/**
 * SSE (Server-Sent Events) stream parser for chat completions.
 */

/** Parse an SSE stream body, yielding content delta strings. */
export async function* parseSSEStream(
  body: ReadableStream<Uint8Array>,
): AsyncGenerator<string> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) {
        // Flush any remaining partial multi-byte sequence
        const remaining = decoder.decode();
        if (remaining) buffer += remaining;
        break;
      }
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() ?? '';
      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed.startsWith('data: ')) continue;
        const payload = trimmed.slice(6);
        if (payload === '[DONE]') return;
        try {
          const chunk = JSON.parse(payload) as Record<string, unknown>;
          const choices = chunk['choices'] as Array<Record<string, unknown>> | undefined;
          const delta = choices?.[0]?.['delta'] as Record<string, unknown> | undefined;
          const content = delta?.['content'];
          if (typeof content === 'string') yield content;
        } catch (e) {
          console.warn('[wauldo] Malformed SSE chunk skipped:', String(e).slice(0, 100));
        }
      }
    }
  } finally {
    reader.releaseLock();
  }
}
