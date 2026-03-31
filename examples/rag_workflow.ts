/** RAG upload + query workflow example */
import { HttpClient } from '../src/index.js';

async function main() {
  const client = new HttpClient({ baseUrl: 'http://localhost:3000' });

  console.log('Uploading document...');
  const doc = await client.ragUpload(
    'Rust uses ownership with borrowing rules to guarantee memory safety without a GC.',
    'rust_overview.txt',
  );
  console.log(`Uploaded: ${doc.document_id} (${doc.chunks_count} chunks)`);

  console.log('\nQuerying knowledge base...');
  const result = await client.ragQuery('How does Rust manage memory?', 3);
  console.log(`Answer: ${result.answer}`);

  for (const src of result.sources) {
    console.log(`  Source ${src.document_id}: score=${src.score.toFixed(3)}`);
  }
}

main().catch(console.error);
