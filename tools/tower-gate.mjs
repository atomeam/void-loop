// The tower's head-to-head gate (lib/tower.js): Verse against the real, live site of one floor, aspect by aspect, with evidence.
// Measured automatically today: speed (load to network idle, median of 3), mobile (sideways overflow at phone width), accessibility
// (buttons and links with no name, images with no text), reliability (3 loads, how many answered). Every other aspect stays unverified
// until its head-to-head check exists, so it never counts as beaten. Screenshots go to a private folder outside the repo (TOWER_PRIVATE,
// default /workspace/tower-private); the public file keeps verdicts and numbers only. A verdict that was a pass and is now worse keeps
// `was`, so the floor un-beats and says it regressed. Passive: page loads only, no sign-in, no forms, no posting.
//   node tools/tower-gate.mjs <floor id>     e.g. calculator; writes void-live-deploy/tower.evidence.json
import fs from 'node:fs'; import path from 'node:path'; import { fileURLToPath } from 'node:url';
import { FLOORS } from '../void-live-deploy/lib/tower.js';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const FILE = path.join(root, 'void-live-deploy', 'tower.evidence.json'), PRIV = process.env.TOWER_PRIVATE || '/workspace/tower-private';
const VERSE = process.env.VERSE_URL || 'https://a-to-mind.com/';

/** a verdict from two numbers: lower is better unless higher is. Pure. */
// ideal: the best score that exists (0 px overflow, every load answered, no unnamed control). When both sites sit at it there is
// nothing left to beat, so the tie passes as 'equal-and-better' (lib/tower.js); any other tie stays 'equal' and does not pass.
export function verdict(verse, best, higherBetter = false, ideal) {
  if (!Number.isFinite(verse) || !Number.isFinite(best)) return 'unverified';
  if (verse === best) return ideal !== undefined && verse === ideal ? 'equal-and-better' : 'equal';
  return (higherBetter ? verse > best : verse < best) ? 'better' : 'worse';
}
/** what each measured aspect is: whether higher is better and its ideal score (none for speed: faster is always possible) */
export const MEASURES = Object.freeze({ speed: { hi: false }, reliability: { hi: true, ideal: 3 }, mobile: { hi: false, ideal: 0 }, accessibility: { hi: false, ideal: 0 } });
/** stored measured rows scored again by today's rule, numbers unchanged (no site is loaded). Pure. */
export function rescore(rows = {}) {
  const out = { ...rows };
  for (const [a, m] of Object.entries(MEASURES)) { const r = rows[a]; if (r && Number.isFinite(r.verse) && Number.isFinite(r.best)) out[a] = { ...r, verdict: verdict(r.verse, r.best, m.hi, m.ideal) }; }
  return out;
}
/** the stored row, keeping what a pass was when it is now worse (a regression un-beats the floor). Pure. */
export function record(prev, v, verse, best, evidence, at) {
  if (prev && prev.called) return prev; // the scout called this floor beaten (tools/tower-verdict.mjs --beaten): a measurement never overturns the call
  const ok = (x) => x === 'better' || x === 'equal-and-better';
  return { verdict: v, verse, best, evidence, at, ...(v === 'worse' && prev && (ok(prev.verdict) || prev.was) ? { was: prev.was || prev.verdict } : {}) };
}

async function measure(browser, url, tag) {
  const times = [], ok = []; let mobile = null, a11y = null;
  for (let i = 0; i < 3; i++) {
    const p = await browser.newPage({ viewport: { width: 390, height: 800 } }); const t0 = Date.now();
    try { const r = await p.goto(url, { waitUntil: 'networkidle', timeout: 45000 }); ok.push(r && r.ok() ? 1 : 0); times.push(Date.now() - t0); } catch (_) { ok.push(0); }
    if (i === 0) {
      try {
        mobile = await p.evaluate(() => Math.max(0, document.documentElement.scrollWidth - innerWidth));
        a11y = await p.evaluate(() => [...document.querySelectorAll('button,a[href]')].filter((e) => e.offsetParent && !(e.getAttribute('aria-label') || e.textContent.trim() || e.title)).length + [...document.querySelectorAll('img')].filter((e) => e.offsetParent && !e.hasAttribute('alt')).length);
        fs.mkdirSync(PRIV, { recursive: true }); await p.screenshot({ path: path.join(PRIV, tag + '.png') });
      } catch (_) { /* measured what it could */ }
    }
    await p.close();
  }
  times.sort((a, b) => a - b);
  return { speed: times.length ? times[Math.floor(times.length / 2)] : NaN, reliability: ok.reduce((a, b) => a + b, 0), mobile, a11y };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const argv = process.argv.slice(2), only = argv.includes('--rescore'), id = argv.filter((a) => a !== '--rescore').join(' '), f = FLOORS.find((x) => x.id === id);
  if (!f) { console.error('no floor ' + id + '; floors: ' + FLOORS.map((x) => x.id).join(', ')); process.exit(2); }
  if (only) { // --rescore: today's rule on the stored numbers, no site loaded (a rule change, not a new measurement)
    const data = JSON.parse(fs.readFileSync(FILE, 'utf8')); data.floors[f.id] = rescore(data.floors[f.id]);
    fs.writeFileSync(FILE, JSON.stringify(data, null, 1) + '\n');
    for (const [k, r] of Object.entries(data.floors[f.id])) console.log(k.padEnd(26) + r.verdict);
    process.exit(0);
  }
  const { chromium } = await import('playwright-core');
  const b = await chromium.launch({ executablePath: process.env.CHROME_PATH || '/usr/bin/google-chrome', args: ['--no-sandbox'] });
  const slug = f.id.replace(/\W+/g, '-'), at = new Date().toISOString();
  const v = await measure(b, VERSE + '?q=' + encodeURIComponent(f.ask), slug + '-verse'), s = await measure(b, f.url, slug + '-site');
  await b.close();
  const data = JSON.parse(fs.readFileSync(FILE, 'utf8')), ev = (data.floors[f.id] = data.floors[f.id] || {});
  const put = (aspect, a, c, unit) => { const m = MEASURES[aspect]; ev[aspect] = record(ev[aspect], verdict(a, c, m.hi, m.ideal), a, c, 'Verse ' + a + unit + ' vs ' + f.site + ' ' + c + unit, at); };
  put('speed', v.speed, s.speed, ' ms to network idle (median of 3, phone width)');
  put('reliability', v.reliability, s.reliability, ' of 3 loads answered');
  put('mobile', v.mobile, s.mobile, ' px sideways overflow at 390 px');
  put('accessibility', v.a11y, s.a11y, ' unnamed controls or images');
  fs.writeFileSync(FILE, JSON.stringify(data, null, 1) + '\n');
  for (const [k, r] of Object.entries(ev)) console.log(k.padEnd(14) + r.verdict.padEnd(11) + r.evidence);
}
