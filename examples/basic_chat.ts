/** Basic chat completion example */
import { HttpClient } from '../src/index.js';

async function main() {
  const client = new HttpClient({ baseUrl: 'http://localhost:3000' });

  console.log('Listing models...');
  const models = await client.listModels();
  console.log(`Available models: ${models.data.map((m) => m.id).join(', ')}`);

  const model = models.data[0]?.id ?? 'qwen2.5:7b';
  console.log(`\nChatting with ${model}...`);

  const reply = await client.chatSimple(model, 'Explain Rust ownership in 2 sentences.');
  console.log(`Reply: ${reply}`);
}

main().catch(console.error);
