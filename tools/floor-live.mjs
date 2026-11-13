import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright-core';
import { SITES } from '../void-live-deploy/lib/versus-floor.js';
import { publicRivalHits } from './rival-public.mjs';
const ORIGIN = process.env.FLOOR_LIVE_ORIGIN || 'https://a-to-mind.com';
const exe = process.env.VOID_TEST_BROWSER || process.env.CHROME_PATH || '/usr/bin/google-chrome';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const floorFile = path.join(root, 'void-live-deploy/lib/versus-floor.js');
export function failedFloors(sites, results) {
  return (sites || []).filter((s) => s && s.works === true && !(results || []).some((r) => r.id === s.id && r.ok)).map((s) => s.id);
}
/** pages the live run owes a result: the ones named, or every checked page and every page already counting. Pure. */
export function pagesToRun(sites, ids) {
  const want = (ids || []).filter(Boolean);
  if (want.length) return (sites || []).filter((s) => s && want.includes(s.id));
  return (sites || []).filter((s) => s && s.kind === 'page' && (s.checked === true || s.works === true));
}
/** pass, fail, or pending. A page that has not been checked yet is pending when it misses, so an unrebuilt page does not fail the run. Pure. */
export function floorKind(site, ok) {
  if (ok) return 'pass';
  if (site && site.checked === true) return 'fail';
  return 'pending';
}
/** set works:true for ids that passed, and works:false for pending misses that were counted too early. An id that is absent stays as it is. Pure. */
export function markWorks(source, ids, clearIds) {
  let out = String(source || '');
  let changed = false;
  const flip = (id, from, to) => {
    if (!/^[a-z0-9-]+$/.test(id)) return;
    const re = new RegExp("(id: '" + id + "',[\\s\\S]*?\\bworks: )" + from);
    if (!re.test(out)) return;
    out = out.replace(re, '$1' + to);
    changed = true;
  };
  for (const id of ids || []) flip(id, 'false', 'true');
  for (const id of clearIds || []) flip(id, 'true', 'false');
  return changed ? out : null;
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
  patterns: async (page) => {
    await page.goto(ORIGIN + '/patterns/', { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => /2 matches/.test((document.querySelector('#count') || {}).textContent || '') && /one or more digits/.test((document.querySelector('#explain') || {}).textContent || ''), null, { timeout: 8000 });
    await page.fill('#replace', '[$&]');
    await page.waitForFunction(() => (document.querySelector('#replaced') || {}).textContent === 'call [555] or [911]', null, { timeout: 8000 });
  },
  schedules: async (page) => { await page.goto(ORIGIN + '/schedules/', { waitUntil: 'domcontentloaded' }); await page.waitForFunction(() => /09:00/.test((document.querySelector('#say') || {}).textContent || '') && document.querySelectorAll('#next li').length >= 1, null, { timeout: 8000 }); },
  letters: async (page) => { await page.goto(ORIGIN + '/rotate-letters/', { waitUntil: 'domcontentloaded' }); await page.fill('#text', 'Hello, world!'); await page.selectOption('#shift', '13'); await page.waitForFunction(() => (document.querySelector('#out') || {}).textContent === 'Uryyb, jbeyq!', null, { timeout: 8000 }); },
  qr: async (page) => { await page.goto(ORIGIN + '/qr/?text=hello', { waitUntil: 'domcontentloaded' }); await page.waitForFunction(() => !!document.querySelector('#out svg') && /Version 1/.test((document.querySelector('#meta') || {}).textContent || ''), null, { timeout: 8000 }); },
  units: async (page) => { await page.goto(ORIGIN + '/convert/', { waitUntil: 'domcontentloaded' }); await page.fill('#ask', '5 km in miles'); await page.dispatchEvent('#ask', 'input'); await page.waitForFunction(() => /mile/i.test((document.querySelector('#answer') || {}).textContent || ''), null, { timeout: 8000 }); },
  podcasts: async (page) => { await page.goto(ORIGIN + '/podcasts/?q=history', { waitUntil: 'domcontentloaded' }); await page.waitForFunction(() => { const el = document.querySelector('#results'); return el && !/Searching|did not answer/.test(el.textContent || ''); }, null, { timeout: 20000 }); },
  scores: async (page) => { await page.goto(ORIGIN + '/scores/?league=epl&tab=standings', { waitUntil: 'domcontentloaded' }); await page.waitForFunction(() => { const t = (document.querySelector('#out') || {}).textContent || ''; return t.length > 40 && !/upcoming schedules for the league/.test(t); }, null, { timeout: 20000 }); },
  tracks: async (page) => { await page.goto(ORIGIN + '/track-times/', { waitUntil: 'domcontentloaded' }); await page.waitForFunction(() => /43:53/.test(document.body.innerText) && /Schizoid/.test(document.body.innerText), null, { timeout: 8000 }); },
  readable: async (page) => { await page.goto(ORIGIN + '/our-motherfucking-version/', { waitUntil: 'domcontentloaded' }); await page.fill('#html', '<p>Hi</p><img alt="" src="a.png">'); await page.waitForFunction(() => /1 pictures/.test((document.querySelector('#out') || {}).textContent || ''), null, { timeout: 8000 }); },
  'text-diff': async (page) => { await page.goto(ORIGIN + '/text-diff/', { waitUntil: 'domcontentloaded' }); await page.fill('#original', 'one\ntwo'); await page.fill('#changed', 'one\nthree'); await page.waitForFunction(() => /1 line removed, 1 line added/.test((document.querySelector('#say') || {}).textContent || ''), null, { timeout: 8000 }); },
};
async function shoot(page, dir, id) {
  if (!dir) return '';
  const file = path.join(dir, 'floor-' + id + '.png');
  try {
    fs.mkdirSync(dir, { recursive: true });
    await page.screenshot({ path: file });
    return file;
  } catch (_) { return ''; }
}
async function gated(page) {
  return (await page.locator('meta[name="verse-gate"]').count()) > 0;
}
/** The owner pass is for this site only. Cloudflare's beacon rejects an Authorization header, and the console then reports the script as blocked. */
export function withOwner(url, origin, token, headers = {}) {
  const next = { ...headers };
  let same = false;
  try { same = new URL(url).origin === new URL(origin).origin; } catch (_) { same = false; }
  if (token && same) next.authorization = 'Bearer ' + token;
  else delete next.authorization;
  return next;
}
export async function runLive(sites = SITES, token = process.env.VOID_OWNER_TOKEN || '', shots = process.env.FLOOR_LIVE_SHOTS || '') {
  const browser = await chromium.launch({ executablePath: exe, headless: true });
  const results = [];
  try {
    for (const s of sites) {
      const page = await browser.newPage();
      if (token) await page.route('**/*', (route) => route.continue({ headers: withOwner(route.request().url(), ORIGIN, token, route.request().headers()) }));
      const problems = [];
      page.on('console', (msg) => {
        if (msg.type() === 'error' || /content security policy|refused to connect/i.test(msg.text())) problems.push(msg.text().slice(0, 160));
      });
      page.on('pageerror', (err) => problems.push(String(err).slice(0, 160)));
      let shot = '';
      try {
        await page.goto(ORIGIN + s.page, { waitUntil: 'domcontentloaded', timeout: 20000 });
        if (await gated(page)) throw new Error(token ? 'uni gate' : 'no owner pass');
        await (JOBS[s.id] || (async (p) => { await p.goto(ORIGIN + s.page, { waitUntil: 'domcontentloaded' }); await p.waitForSelector('h1'); }))(page);
        if (await gated(page)) throw new Error(token ? 'uni gate' : 'no owner pass');
        shot = await shoot(page, shots, s.id);
        await page.waitForFunction(() => { const a = document.querySelector('nav.with a'); return a && /=/.test(a.getAttribute('href') || ''); }, null, { timeout: 8000 });
        const href = await page.locator('nav.with a').first().getAttribute('href');
        const passed = [...new URL(href, page.url()).searchParams.values()].find((v) => v.trim());
        if (!passed) throw new Error('handoff has no result');
        await page.goto(new URL(href, page.url()).href, { waitUntil: 'domcontentloaded', timeout: 20000 });
        if (await gated(page)) throw new Error(token ? 'uni gate' : 'no owner pass');
        const landed = (await page.locator('body').innerText()) + (await page.locator('input, textarea').first().inputValue().catch(() => ''));
        if (!landed.includes(passed.replace(/\s+/g, ' ').trim().slice(0, 24))) throw new Error('next page missed the handoff');
        if (problems.length) throw new Error(problems[0]);
        results.push({ id: s.id, ok: true, reason: '', shot });
      } catch (e) {
        if (!shot) shot = await shoot(page, shots, s.id);
        let reason = String(e && e.message || e).slice(0, 160);
        if (await gated(page).catch(() => false)) reason = token ? 'uni gate' : 'no owner pass';
        results.push({ id: s.id, ok: false, reason, shot });
      }
      await page.close();
    }
  } finally { await browser.close(); }
  return results;
}
function arg(name) {
  const i = process.argv.indexOf(name);
  return i > 0 ? process.argv[i + 1] : '';
}
if (process.argv[1] && process.argv[1].endsWith('floor-live.mjs')) {
  const credits = publicRivalHits();
  if (credits.length) { console.error('public pages name a rival:\n' + credits.join('\n')); process.exit(1); }
  const ids = (process.env.FLOOR_LIVE_IDS || arg('--ids') || '').split(',').map((s) => s.trim()).filter(Boolean);
  const sites = pagesToRun(SITES, ids);
  const shots = process.env.FLOOR_LIVE_SHOTS || arg('--shots') || '';
  const results = await runLive(sites, process.env.VOID_OWNER_TOKEN || '', shots);
  const kindOf = (r) => floorKind(sites.find((s) => s.id === r.id), r.ok);
  for (const r of results) console.log(kindOf(r) + ' ' + r.id + (r.reason && !r.ok ? ' ' + r.reason : '') + (r.shot ? ' ' + r.shot : ''));
  const passed = results.filter((r) => r.ok).map((r) => r.id);
  const pending = results.filter((r) => kindOf(r) === 'pending').map((r) => r.id);
  if (process.argv.includes('--mark')) {
    const next = markWorks(fs.readFileSync(floorFile, 'utf8'), passed, pending);
    if (next) fs.writeFileSync(floorFile, next);
    console.log(next ? 'marked ' + passed.join(', ') : 'marked none');
  }
  const bad = results.filter((r) => kindOf(r) === 'fail').map((r) => r.id);
  if (bad.length) { console.error('counted floors failed: ' + bad.join(', ')); process.exit(1); }
}
