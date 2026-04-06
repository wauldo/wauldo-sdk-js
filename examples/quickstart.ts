/**
 * Wauldo SDK Quickstart
 *
 * Runs end-to-end with MockHttpClient — no server needed.
 * Run: npx tsx examples/quickstart.ts
 */

import { MockHttpClient } from '../src/index.js';

async function main() {
  const client = new MockHttpClient();
  console.log('=== Wauldo SDK Quickstart ===\n');

  // ── 1. Upload a document ───────────────────────────────────────────
  console.log('1. Uploading document...');
  const upload = await client.ragUpload(
    'Our refund policy allows returns within 60 days of purchase. ' +
    'Items must be in original condition. Digital products are non-refundable. ' +
    'Shipping costs are not covered in refunds.',
    'refund_policy.txt',
  );
  console.log(`   Document ID: ${upload.document_id}`);
  console.log(`   Chunks: ${upload.chunks_count}`);

  // ── 2. Query the knowledge base ────────────────────────────────────
  console.log('\n2. Querying knowledge base...');
  const query = await client.ragQuery('What is the refund policy?', 3);
  console.log(`   Answer: ${query.answer}`);
  console.log(`   Sources: ${query.sources.length}`);

  // ── 3. Fact-check a claim ──────────────────────────────────────────
  console.log('\n3. Fact-checking a claim...');
  const factCheck = await client.factCheck({
    text: 'Returns are accepted within 30 days.',
    source_context: 'Our refund policy allows returns within 60 days of purchase.',
    mode: 'lexical',
  });
  console.log(`   Verdict: ${factCheck.verdict}`);
  console.log(`   Action: ${factCheck.action}`);
  console.log(`   Confidence: ${factCheck.confidence}`);
  console.log(`   Reason: ${factCheck.claims[0]?.reason ?? 'none'}`);

  // ── 4. Verify citations ────────────────────────────────────────────
  console.log('\n4. Verifying citations...');
  const citation = await client.verifyCitation({
    text: 'Returns are accepted within 60 days [Source: refund_policy]. ' +
          'Digital products cannot be refunded [Source: refund_policy]. ' +
          'Shipping is always free.',
    sources: [{ name: 'refund_policy', content: 'Refund policy document.' }],
  });
  console.log(`   Citation ratio: ${(citation.citation_ratio * 100).toFixed(0)}%`);
  console.log(`   Sufficient: ${citation.has_sufficient_citations}`);
  console.log(`   Uncited sentences: ${citation.uncited_sentences.length}`);
  if (citation.uncited_sentences.length > 0) {
    for (const s of citation.uncited_sentences) {
      console.log(`     - "${s}"`);
    }
  }

  // ── 5. Get analytics & insights ────────────────────────────────────
  console.log('\n5. Getting analytics...');
  const insights = await client.getInsights();
  console.log(`   Total requests: ${insights.total_requests}`);
  console.log(`   Tokens saved: ${insights.tokens.saved_total} (${insights.tokens.saved_percent_avg}%)`);
  console.log(`   Estimated savings: $${insights.cost.estimated_usd_saved.toFixed(2)}`);

  // ── Summary ────────────────────────────────────────────────────────
  console.log('\n=== All API calls completed ===');
  console.log(`Total mock calls: ${client.calls.length}`);
  console.log('Methods called:', client.calls.map(c => c.method).join(', '));
  console.log('\n// To use a real API, replace MockHttpClient with HttpClient:');
  console.log('// import { HttpClient } from "wauldo";');
  console.log('// const client = new HttpClient({ baseUrl: "https://api.wauldo.com", apiKey: "YOUR_KEY" });');
}

main().catch(console.error);
