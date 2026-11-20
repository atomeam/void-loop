// The performance budget (owner, 2026-11-20: "phone load under 3s on key pages"). Opens each key page of the live site the way a visitor on
// a phone meets it: a 390 px touch screen at 3x, a 1.6 Mbit/s link with 150 ms latency and a 4x slower CPU (the --slow profile of
// tools/page-perf.mjs). It takes the median of 3 loads (navigation start to the load event). A page over BUDGET_MS is over budget. With --post
// and VOID_OWNER_TOKEN, each page over budget becomes one fix job (auto:perf <path>, at most 5). The run fails while a page is over, so the
// owner's loop list shows it. Runs from .github/workflows/perf-budget.yml, kept on time by the conductor's catch-up clock.
//   node tools/perf-budget.mjs [--only /a/,/b/] [--runs 3] [--post] [--json out.json]
import { appendFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

export const BUDGET_MS = 3000, FIX_MAX = 5;
export const KEY_PAGES = ['/', '/arcade/', '/studio/', '/emojis/', '/store/', '/progress/'];
export const PHONE = { viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true };
export const SLOW = { offline: false, latency: 150, downloadThroughput: (1.6 * 1024 * 1024) / 8, uploadThroughput: (750 * 1024) / 8 };
const UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 VerseBudget/1';

export const median = (xs) => { const s = xs.filter(Number.isFinite).sort((a, b) => a - b); return s.length ? s[Math.floor((s.length - 1) / 2)] : null; };

/** the verdict for measured rows ({ path, ms }): which pages are over, in plain words. Pure. */
export function verdictOf(rows, budget = BUDGET_MS) {
  const over = rows.filter((r) => r.ms == null || r.ms > budget);
  const say = (r) => r.path + ' ' + (r.ms == null ? 'did not load' : (r.ms / 1000).toFixed(1) + ' s');
  return { budget, over: over.map((r) => r.path), ok: !over.length, line: over.length ? over.length + ' of ' + rows.length + ' key pages are over ' + budget / 1000 + ' s on a phone: ' + over.map(say).join(', ') : 'All ' + rows.length + ' key pages load under ' + budget / 1000 + ' s on a phone (slowest ' + say(rows.slice().sort((a, b) => (b.ms || 0) - (a.ms || 0))[0] || { path: '-', ms: 0 }) + ').' };
}

/** at most FIX_MAX queue jobs, one per page over budget. Pure. */
export const fixJobsOf = (rows, budget = BUDGET_MS, max = FIX_MAX) => rows.filter((r) => r.ms == null || r.ms > budget).slice(0, max)
  .map((r) => ({ target: ('auto:perf ' + r.path).slice(0, 40), ask: ('Make ' + r.path + ' load under ' + budget / 1000 + ' s on a phone (perf budget: ' + (r.ms == null ? 'it did not load' : (r.ms / 1000).toFixed(1) + ' s') + ' on a 1.6 Mbit/s link, 4x slower CPU). Measure with node tools/page-perf.mjs --phone --slow before and after.').slice(0, 200) }));

async function measure(browser, url, runs) {
  const times = [];
  for (let i = 0; i < runs; i++) {
    const ctx = await browser.newContext({ ...PHONE, userAgent: UA }), page = await ctx.newPage();
    try {
      const cdp = await ctx.newCDPSession(page);
      await cdp.send('Network.enable'); await cdp.send('Network.emulateNetworkConditions', SLOW); await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
      await page.goto(url, { waitUntil: 'load', timeout: 30000 });
      times.push(await page.evaluate(() => { const n = performance.getEntriesByType('navigation')[0]; return n ? Math.round(n.loadEventEnd || n.duration) : null; }));
    } catch (_) { times.push(null); }
    await ctx.close();
  }
  return times.every((t) => t == null) ? null : median(times);
}

async function main() {
  const arg = (f) => { const i = process.argv.indexOf(f); return i > 0 ? process.argv[i + 1] : null; };
  const site = (process.env.VOID_SITE || 'https://a-to-mind.com').replace(/\/+$/, ''), runs = Math.max(1, +arg('--runs') || 3);
  const paths = arg('--only') ? arg('--only').split(',').map((s) => s.trim()).filter(Boolean) : KEY_PAGES;
  const { chromium } = await import('playwright-core');
  const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH || undefined, headless: true });
  const rows = [];
  for (const p of paths) rows.push({ path: p, ms: await measure(browser, site + p, runs) }); // one page at a time: two loads at once would share the link and the CPU // void-review: ok
  await browser.close();
  const v = verdictOf(rows), text = '### Performance budget\n\n' + v.line + '\n\n' + rows.map((r) => '- ' + r.path + ': ' + (r.ms == null ? 'did not load' : r.ms + ' ms')).join('\n') + '\n';
  process.stdout.write(text); if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, text);
  const out = arg('--json'); if (out) writeFileSync(out, JSON.stringify({ at: new Date().toISOString(), site, rows, ...v }, null, 1));
  if (process.argv.includes('--post') && !v.ok) {
    const key = process.env.VOID_OWNER_TOKEN;
    if (!key) console.log('no VOID_OWNER_TOKEN: no fix jobs filed');
    else {
      const filed = await Promise.all(fixJobsOf(rows).map((job) => fetch(site + '/api/queue', { method: 'POST', headers: { authorization: 'Bearer ' + key, 'content-type': 'application/json', origin: site, 'user-agent': UA }, body: JSON.stringify(job) })
        .then((q) => job.target + ': ' + q.status, (e) => job.target + ' not filed: ' + String(e.message || e).slice(0, 80))));
      for (const line of filed) console.log('fix job ' + line);
    }
  }
  if (!v.ok) process.exitCode = 1;
}
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) main().catch((e) => { console.error(e); process.exit(1); });
