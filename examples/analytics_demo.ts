/**
 * Analytics & Insights demo
 *
 * Shows getInsights(), getAnalytics(), and getAnalyticsTraffic() usage.
 * Runs offline with MockHttpClient — no server needed.
 * Run: npx tsx examples/analytics_demo.ts
 */

import { MockHttpClient } from '../src/index.js';

function formatUptime(secs: number): string {
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  return `${h}h ${m}m`;
}

async function main() {
  const client = new MockHttpClient();

  // ── ROI Insights ───────────────────────────────────────────────────
  console.log('=== ROI Insights ===\n');
  const insights = await client.getInsights();
  console.log(`  Total requests:        ${insights.total_requests}`);
  console.log(`  Intelligence requests: ${insights.intelligence_requests}`);
  console.log(`  Fallback requests:     ${insights.fallback_requests}`);
  console.log(`  Tokens (baseline):     ${insights.tokens.baseline_total.toLocaleString()}`);
  console.log(`  Tokens (actual):       ${insights.tokens.real_total.toLocaleString()}`);
  console.log(`  Tokens saved:          ${insights.tokens.saved_total.toLocaleString()} (${insights.tokens.saved_percent_avg}%)`);
  console.log(`  Estimated USD saved:   $${insights.cost.estimated_usd_saved.toFixed(2)}`);

  // ── Usage Analytics ────────────────────────────────────────────────
  console.log('\n=== Usage Analytics (last 60 min) ===\n');
  const analytics = await client.getAnalytics(60);
  console.log('  Cache:');
  console.log(`    Requests:   ${analytics.cache.total_requests}`);
  console.log(`    Hit rate:   ${(analytics.cache.cache_hit_rate * 100).toFixed(1)}%`);
  console.log(`    Avg latency: ${analytics.cache.avg_latency_ms}ms`);
  console.log(`    P95 latency: ${analytics.cache.p95_latency_ms}ms`);
  console.log('  Tokens:');
  console.log(`    Baseline:   ${analytics.tokens.total_baseline.toLocaleString()}`);
  console.log(`    Actual:     ${analytics.tokens.total_real.toLocaleString()}`);
  console.log(`    Saved:      ${analytics.tokens.total_saved.toLocaleString()} (${analytics.tokens.avg_savings_percent}%)`);
  console.log(`  Uptime:       ${formatUptime(analytics.uptime_secs)}`);

  // ── Traffic Summary ────────────────────────────────────────────────
  console.log('\n=== Traffic Summary ===\n');
  const traffic = await client.getAnalyticsTraffic();
  console.log(`  Requests today:  ${traffic.total_requests_today}`);
  console.log(`  Tokens today:    ${traffic.total_tokens_today.toLocaleString()}`);
  console.log(`  Error rate:      ${(traffic.error_rate * 100).toFixed(1)}%`);
  console.log(`  Avg latency:     ${traffic.avg_latency_ms}ms`);
  console.log(`  P95 latency:     ${traffic.p95_latency_ms}ms`);
  console.log(`  Uptime:          ${formatUptime(traffic.uptime_secs)}`);
  console.log('\n  Top tenants:');
  for (const t of traffic.top_tenants) {
    console.log(`    ${t.tenant_id}: ${t.requests_today} req, ${(t.success_rate * 100).toFixed(0)}% success, ${t.avg_latency_ms}ms avg`);
  }

  console.log('\n// To use a real API, replace MockHttpClient with HttpClient:');
  console.log('// import { HttpClient } from "wauldo";');
  console.log('// const client = new HttpClient({ baseUrl: "https://api.wauldo.com", apiKey: "YOUR_KEY" });');
}

main().catch(console.error);
