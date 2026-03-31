/**
 * Conversation helper — manages chat history automatically.
 */

import type { ChatClientLike, ChatMessage } from './http_types.js';

export class Conversation {
  private client: ChatClientLike;
  private history: ChatMessage[] = [];
  private model: string;

  constructor(client: ChatClientLike, options?: { system?: string; model?: string }) {
    this.client = client;
    this.model = options?.model ?? 'default';
    if (options?.system) {
      this.history.push({ role: 'system', content: options.system });
    }
  }

  /**
   * Send a user message and get the assistant reply.
   * Both the user message and the assistant reply are appended to history.
   *
   * @param message - The user message to send
   * @returns The assistant's reply content string
   *
   * @example
   * ```typescript
   * const conv = client.conversation({ system: 'You are helpful' });
   * const reply = await conv.say('What is TypeScript?');
   * const followUp = await conv.say('Show me an example'); // includes prior context
   * ```
   */
  async say(message: string): Promise<string> {
    this.history.push({ role: 'user', content: message });
    let response;
    try {
      response = await this.client.chat({
        model: this.model,
        messages: [...this.history],
      });
    } catch (err) {
      this.history.pop(); // rollback user message on error
      throw err;
    }
    const reply = response.choices[0]?.message?.content ?? '';
    this.history.push({ role: 'assistant', content: reply });
    return reply;
  }

  /**
   * Return a copy of the full conversation history.
   *
   * @returns An array of ChatMessage objects (system, user, assistant turns)
   *
   * @example
   * ```typescript
   * const history = conv.getHistory();
   * console.log(`${history.length} messages in conversation`);
   * ```
   */
  getHistory(): ChatMessage[] {
    return [...this.history];
  }

  /**
   * Clear user and assistant messages, preserving the system prompt (if any).
   *
   * @example
   * ```typescript
   * conv.clear();
   * // System prompt is preserved; user/assistant messages are removed.
   * ```
   */
  clear(): void {
    const systemMsg = this.history.find(m => m.role === 'system');
    this.history = systemMsg ? [systemMsg] : [];
  }
}
