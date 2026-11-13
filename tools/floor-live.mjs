import { chromium } from 'playwright-core';
import { SITES } from '../void-live-deploy/lib/versus-floor.js';
const ORIGIN = process.env.FLOOR_LIVE_ORIGIN || 'https://a-to-mind.com';
const exe = process.env.VOID_TEST_BROWSER || process.env.CHROME_PATH || '/usr/bin/google-chrome';
export function failedFloors(sites, results) {
  return (sites || []).filter((s) => s && s.works === true && !(results || []).some((r) => r.id === s.id && r.ok)).map((s) => s.id);
}
const JOBS = {
  meanings: async (page) => {
    await page.goto(ORIGIN + '/meanings/', { waitUntil: 'domcontentloaded' });
    for (const [word, re] of [['hello', 'greeting'], ['run', 'verb'], ['zzqxnotaword', 'not in the dictionary']]) {
      await page.fill('#word', word);
      await page.click('button[type="submit"]');
      await page.waitForFunction((needle) => { const t = ((document.querySelector('#out') || {}).textContent || '') + ((document.querySelector('#err') || {}).textContent || ''); return t.toLowerCase().includes(String(needle).toLowerCase()) && !((document.querySelector('#err') || {}).textContent || '').includes('Looking'); }, re, { timeout: 20000 });
    }
  },
  patterns: async (page) => { await page.goto(ORIGIN + '/patterns/', { waitUntil: 'domcontentloaded' }); await page.waitForFunction(() => /2 matches/.test((document.querySelector('#count') || {}).textContent || ''), null, { timeout: 8000 }); },
  schedules: async (page) => { await page.goto(ORIGIN + '/schedules/', { waitUntil: 'domcontentloaded' }); await page.waitForFunction(() => /09:00/.test((document.querySelector('#say') || {}).textContent || '') && document.querySelectorAll('#next li').length >= 1, null, { timeout: 8000 }); },
  letters: async (page) => { await page.goto(ORIGIN + '/rotate-letters/', { waitUntil: 'domcontentloaded' }); await page.fill('#text', 'Hello, world!'); await page.selectOption('#shift', '13'); await page.waitForFunction(() => (document.querySelector('#out') || {}).textContent === 'Uryyb, jbeyq!', null, { timeout: 8000 }); },
  qr: async (page) => { await page.goto(ORIGIN + '/qr/?text=hello', { waitUntil: 'domcontentloaded' }); await page.waitForFunction(() => !!document.querySelector('#out svg'), null, { timeout: 8000 }); },
  units: async (page) => { await page.goto(ORIGIN + '/convert/', { waitUntil: 'domcontentloaded' }); await page.fill('#ask', '5 km in miles'); await page.dispatchEvent('#ask', 'input'); await page.waitForFunction(() => /mile/i.test((document.querySelector('#answer') || {}).textContent || ''), null, { timeout: 8000 }); },
  podcasts: async (page) => { await page.goto(ORIGIN + '/podcasts/?q=history', { waitUntil: 'domcontentloaded' }); await page.waitForFunction(() => { const el = document.querySelector('#results'); return el && !/Searching|did not answer/.test(el.textContent || ''); }, null, { timeout: 20000 }); },
  scores: async (page) => { await page.goto(ORIGIN + '/scores/?league=epl&tab=standings', { waitUntil: 'domcontentloaded' }); await page.waitForFunction(() => { const t = (document.querySelector('#out') || {}).textContent || ''; return t.length > 40 && !/upcoming schedules for the league/.test(t); }, null, { timeout: 20000 }); },
  tracks: async (page) => { await page.goto(ORIGIN + '/track-times/', { waitUntil: 'domcontentloaded' }); await page.waitForFunction(() => /43:53/.test(document.body.innerText) && /Schizoid/.test(document.body.innerText), null, { timeout: 8000 }); },
};
export async function runLive(sites = SITES, token = process.env.VOID_OWNER_TOKEN || '') {
  if (!token && ORIGIN === 'https://a-to-mind.com') return sites.map((s) => ({ id: s.id, ok: false, reason: 'no owner pass' }));
  const browser = await chromium.launch({ executablePath: exe, headless: true });
  const results = [];
  try {
    for (const s of sites) {
      const page = await browser.newPage({ extraHTTPHeaders: token ? { authorization: 'Bearer ' + token } : {} });
      const problems = [];
      page.on('console', (msg) => { if (msg.type() === 'error' || /content security policy|refused to connect/i.test(msg.text())) problems.push(msg.text().slice(0, 160)); });
      page.on('pageerror', (err) => problems.push(String(err).slice(0, 160)));
      try {
        await (JOBS[s.id] || (async (p) => { await p.goto(ORIGIN + s.page, { waitUntil: 'domcontentloaded' }); await p.waitForSelector('h1'); }))(page);
        if (await page.locator('meta[name="verse-gate"]').count()) throw new Error('uni gate');
        await page.waitForFunction(() => { const a = document.querySelector('nav.with a'); return a && /=/.test(a.getAttribute('href') || ''); }, null, { timeout: 8000 });
        const href = await page.locator('nav.with a').first().getAttribute('href');
        const passed = [...new URL(href, page.url()).searchParams.values()].find((v) => v.trim());
        if (!passed) throw new Error('handoff has no result');
        await page.locator('nav.with a').first().click();
        await page.waitForLoadState('domcontentloaded');
        const landed = (await page.locator('body').innerText()) + (await page.locator('input, textarea').first().inputValue().catch(() => ''));
        if (!landed.includes(passed.replace(/\s+/g, ' ').trim().slice(0, 24))) throw new Error('next page missed the handoff');
        if (problems.length) throw new Error(problems[0]);
        results.push({ id: s.id, ok: true, reason: '' });
      } catch (e) { results.push({ id: s.id, ok: false, reason: String(e && e.message || e).slice(0, 160) }); }
      await page.close();
    }
  } finally { await browser.close(); }
  return results;
}
if (process.argv[1] && process.argv[1].endsWith('floor-live.mjs')) {
  const results = await runLive();
  for (const r of results) console.log((r.ok ? 'pass' : 'fail') + ' ' + r.id + (r.reason ? ' ' + r.reason : ''));
  const bad = failedFloors(SITES, results);
  if (bad.length) { console.error('counted floors failed: ' + bad.join(', ')); process.exit(1); }
}
