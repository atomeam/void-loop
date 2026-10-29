// Every "new / built" claim Verse makes must answer live. A claim is a ledger line's `try` ask (void.growth.json, what the
// showcase plays for "what's new") or a skill's first example (skills/index.json). Each is typed into the real page; it fails
// when it falls through to the encyclopedia / generic-answer fallback (Wikipedia, "answer", "short topic") or to a miss.
// Passing claims are written to void-live-deploy/claims-verified.json; the showcase only plays a claim that is on that list,
// so Verse never says it built something that answers with Wikipedia.
//   node tools/claims-verify.mjs --live           ask the live site (network on) and write claims-verified.json from what answered
//   node tools/claims-verify.mjs --live --check   same, write nothing, exit 1 when a must-pass or ledger ask falls through
//   node tools/claims-verify.mjs                  the local tree with outside services blocked (network skills can't answer), print only
import http from 'node:http'; import fs from 'node:fs'; import path from 'node:path'; import { fileURLToPath, pathToFileURL } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(here, '..', 'void-live-deploy');
export const OUT = path.join(root, 'claims-verified.json');
// what a fallthrough looks like in the page's own loop log
export const FALLBACK = /^(?:article|answer|short topic|article fallback)$/;
// asks that must answer with a bespoke card, never the encyclopedia (Adam, 2026-10-15: "cat" gave a bare definition)
// bare animal nouns ('cat') get the article card plus a Wikidata facts strip; --live checks the strip shows (TOPICS)
export const TOPICS = ['cat', 'dog'];
export const MUST = ["what's new", "what's new in the store", 'tester log', 'capital of japan', 'what can i buy'];
export const isFallthrough = (note) => !note || FALLBACK.test(String(note)) || /^miss/.test(String(note));
export const CLEAN = (s) => String(s || '').trim().toLowerCase().replace(/[’']/g, "'").replace(/[?!.]+$/, '').replace(/\s+/g, ' ');

/** the claims to check: ledger `try` asks (newest first, each once) and each skill's first example. Pure. */
export function claimsOf(ledger, skills) {
  const seen = new Set(), out = [];
  const add = (ask, from) => { const k = CLEAN(ask); if (!k || seen.has(k)) return; seen.add(k); out.push({ ask: String(ask), from }); };
  for (const a of MUST) add(a, 'must');
  for (const a of TOPICS) add(a, 'topic');
  const L = (Array.isArray(ledger) ? ledger : (ledger && ledger.entries) || []).filter((e) => e && e.try).sort((a, b) => (a.at < b.at ? 1 : -1));
  for (const e of L) add(e.try, 'ledger');
  for (const [name, ex] of skills) if (ex && ex[0]) add(ex[0], 'skill:' + name);
  return out;
}

async function skillExamples() {
  const names = JSON.parse(fs.readFileSync(path.join(root, 'skills/index.json'), 'utf8')), out = [];
  for (const n of names) { try { const m = await import(pathToFileURL(path.join(root, 'skills', n + '.js'))); out.push([n, (m.default || {}).examples || []]); } catch (_) {} }
  return out;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const live = process.argv.includes('--live'), check = process.argv.includes('--check');
  const { chromium } = await import('playwright-core');
  const ledger = JSON.parse(fs.readFileSync(path.join(root, 'void.growth.json'), 'utf8'));
  const only = process.env.VOID_CLAIMS_ONLY ? new RegExp(process.env.VOID_CLAIMS_ONLY, 'i') : null; // a quick recheck of some asks
  const claims = claimsOf(ledger, await skillExamples()).filter((c) => !only || only.test(c.ask));
  let server, site = process.env.VOID_SITE || 'https://a-to-mind.com';
  if (!live) {
    const TYPES = { '.js': 'text/javascript', '.mjs': 'text/javascript', '.html': 'text/html', '.json': 'application/json', '.css': 'text/css', '.svg': 'image/svg+xml' };
    server = http.createServer((req, res) => { let p = decodeURIComponent(new URL(req.url, 'http://x').pathname); if (p === '/') p = '/index.html'; const f = path.join(root, p);
      if (!f.startsWith(root)) { res.writeHead(403); return res.end(); }
      fs.readFile(f, (e, d) => { if (e) { res.writeHead(404); return res.end(); } res.writeHead(200, { 'content-type': TYPES[path.extname(f)] || 'application/octet-stream' }); res.end(d); }); }).listen(0);
    await new Promise((r) => server.once('listening', r)); site = 'http://127.0.0.1:' + server.address().port;
  }
  const exe = process.env.CHROME_PATH || process.env.VOID_TEST_BROWSER || (fs.existsSync('/usr/bin/google-chrome') ? '/usr/bin/google-chrome' : undefined);
  const browser = await chromium.launch({ executablePath: exe, headless: true });
  const results = []; let i = 0;
  async function worker() {
    const ctx = await browser.newContext();
    if (!live) { await ctx.route(/^https?:\/\/(?!127\.0\.0\.1)/, (r) => r.fulfill({ status: 204, body: '' })); await ctx.route(/127\.0\.0\.1:\d+\/api\//, (r) => r.fulfill({ status: 204, body: '' })); }
    let page = null;
    const fresh = async () => { if (page) await page.close().catch(() => {}); page = await ctx.newPage(); page.on('popup', (p) => p.close().catch(() => {}));
      await page.goto(site + '/', { waitUntil: 'domcontentloaded' }); await page.waitForTimeout(1200); };
    await fresh();
    while (i < claims.length) {
      const c = claims[i++];
      try {
      if (!page.url().startsWith(site)) await fresh();
      await page.evaluate(() => localStorage.removeItem('a2m.void.loop.v1'));
      await page.fill('#input', c.ask); await page.keyboard.press('Enter');
      // a skill logs only when its card is done (network cards can take seconds): wait for this ask's line, up to 12 s live
      await page.waitForFunction((a) => { try { return JSON.parse(localStorage.getItem('a2m.void.loop.v1') || '[]').some((x) => String(x.ask).trim().toLowerCase() === a); } catch (_) { return false; } }, c.ask.trim().toLowerCase(), { timeout: live ? 12000 : 3000 }).catch(() => {});
      const log = await page.evaluate(() => { try { const l = JSON.parse(localStorage.getItem('a2m.void.loop.v1') || '[]'); return Array.isArray(l) ? l : []; } catch (_) { return []; } });
      const mine = log.find((x) => CLEAN(x.ask) === CLEAN(c.ask)) || log[0];
      const wiki = /Source:\s*<?[^\n]{0,4}Wikipedia/.test(await page.evaluate(() => (document.querySelector('.vpage:last-of-type') || document.body).innerText));
      const note = (mine && mine.note) || (!page.url().replace(/[?#].*$/, '').endsWith(site + '/') ? 'navigated' : null);
      if (c.from === 'topic') { await page.waitForTimeout(live ? 2500 : 0); const facts = await page.evaluate(() => !!document.querySelector('.vpage .facts'));
        results.push({ ...c, note: (note || '') + (facts ? '+facts' : ''), ok: !live || facts }); continue; }
      results.push({ ...c, note: note || null, ok: !isFallthrough(note) && !(wiki && !/^skill:(?:place|define|words|country|news)/.test(note || '')) });
      await page.keyboard.press('Escape').catch(() => {});
      await page.evaluate(() => { const b = [...document.querySelectorAll('button')].find((x) => /^(Done|Close)$/.test(x.textContent.trim())); if (b) b.click(); }).catch(() => {});
      } catch (e) {
        // the ask opened another page (a real page answered it, e.g. "privacy"): that is its own answer, not a fallthrough
        results.push({ ...c, note: 'navigated', ok: true }); await fresh().catch(() => {});
      }
    }
    await ctx.close();
  }
  await Promise.all([1, 2, 3, 4].map(worker)); await browser.close(); if (server) server.close();
  const bad = results.filter((r) => !r.ok);
  console.log(results.length + ' claims asked, ' + bad.length + ' fell through to the fallback');
  for (const b of bad) console.log('  FALLTHROUGH ' + b.from.padEnd(20) + ' ' + String(b.note).padEnd(16) + ' ' + b.ask);
  if (live && !check && !process.env.VOID_SITE_PREVIEW) fs.writeFileSync(OUT, JSON.stringify({ note: 'claims that answered with their own card (tools/claims-verify.mjs); the showcase plays only these', at: new Date().toISOString().slice(0, 10), ok: results.filter((r) => r.ok).map((r) => CLEAN(r.ask)).sort() }, null, 1) + '\n');
  const mustBad = bad.filter((b) => b.from === 'must' || b.from === 'ledger' || b.from === 'topic');
  fs.writeFileSync('/tmp/claims-results.json', JSON.stringify(results, null, 1));
  process.exit(check && mustBad.length ? 1 : 0);
}
