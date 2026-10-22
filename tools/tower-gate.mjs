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
export function verdict(verse, best, higherBetter = false) {
  if (!Number.isFinite(verse) || !Number.isFinite(best)) return 'unverified';
  if (verse === best) return 'equal';
  return (higherBetter ? verse > best : verse < best) ? 'better' : 'worse';
}
/** the stored row, keeping what a pass was when it is now worse (a regression un-beats the floor). Pure. */
export function record(prev, v, verse, best, evidence, at) {
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
  const id = process.argv.slice(2).join(' '), f = FLOORS.find((x) => x.id === id);
  if (!f) { console.error('no floor ' + id + '; floors: ' + FLOORS.map((x) => x.id).join(', ')); process.exit(2); }
  const { chromium } = await import('playwright-core');
  const b = await chromium.launch({ executablePath: process.env.CHROME_PATH || '/usr/bin/google-chrome', args: ['--no-sandbox'] });
  const slug = f.id.replace(/\W+/g, '-'), at = new Date().toISOString();
  const v = await measure(b, VERSE + '?q=' + encodeURIComponent(f.ask), slug + '-verse'), s = await measure(b, f.url, slug + '-site');
  await b.close();
  const data = JSON.parse(fs.readFileSync(FILE, 'utf8')), ev = (data.floors[f.id] = data.floors[f.id] || {});
  const put = (aspect, a, c, hi, unit) => { ev[aspect] = record(ev[aspect], verdict(a, c, hi), a, c, 'Verse ' + a + unit + ' vs ' + f.site + ' ' + c + unit, at); };
  put('speed', v.speed, s.speed, false, ' ms to network idle (median of 3, phone width)');
  put('reliability', v.reliability, s.reliability, true, ' of 3 loads answered');
  put('mobile', v.mobile, s.mobile, false, ' px sideways overflow at 390 px');
  put('accessibility', v.a11y, s.a11y, false, ' unnamed controls or images');
  fs.writeFileSync(FILE, JSON.stringify(data, null, 1) + '\n');
  for (const [k, r] of Object.entries(ev)) console.log(k.padEnd(14) + r.verdict.padEnd(11) + r.evidence);
}
