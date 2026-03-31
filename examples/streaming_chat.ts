/** SSE streaming chat example */
import { HttpClient } from '../src/index.js';

async function main() {
  const client = new HttpClient({ baseUrl: 'http://localhost:3000' });

  console.log('Streaming response...\n');

  const stream = client.chatStream({
    model: 'qwen2.5:7b',
    messages: [{ role: 'user', content: 'Write a haiku about async Rust.' }],
  });

  let fullText = '';
  for await (const chunk of stream) {
    process.stdout.write(chunk);
    fullText += chunk;
  }

  console.log(`\n\nTotal length: ${fullText.length} chars`);
}

main().catch(console.error);
