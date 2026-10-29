// What the card art looks like, measured on pixels (the other half of tools/art-score.mjs; owner, 2026-10-19: improve the card art each time).
// The SVG-source score reads the colour values in the markup, so four of its six properties sit at 100 and it cannot show an improvement. This
// draws a fixed sample of the corpus in headless Chromium and measures what a person sees:
//
//   tonal    the spread between the dark and the light parts of the picture (5th to 95th percentile of luminance); a flat grey card scores low
//   colour   colourfulness (Hasler and Suesstrunk): how far the picture is from grey
//   detail   how much edge there is, in a band: a blank plate and a noisy one both score low
//   focus    how much of that detail sits in the middle of the card, where the subject is, instead of spread over the frame
//
// pixelStats() is pure (an RGBA array in, numbers out) so the tests feed it made-up images; the browser part only rasterises and calls it.
//   node tools/art-pixels.mjs              print the scores     --json  machine-readable
//   node tools/art-pixels.mjs --check      exit 1 when the pixel composite drops below the floor (tools/art-floor.json, "pixels"), or a property by more than the slack
//   node tools/art-pixels.mjs --write      raise the pixel floor (never lowers it)
// With no Chromium (VOID_TEST_BROWSER, or the one Playwright finds) --check says so and passes: CI has one, and the score of the source still applies.
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { artSvg, KINDS } from '../void-live-deploy/lib/card-art.js';
import { FLOOR_FILE } from './art-score.mjs';

export const PIXEL_METRICS = ['tonal', 'colour', 'detail', 'focus'], W = 520, H = 170;
export const SLACK_SAME = 4, SLACK_OTHER_BROWSER = 8; // a property may fall this far (another Chromium version rasterises filters a little differently)
export const SAMPLE_KEYS = ['alpha', 'delta'], SAMPLE_RARITIES = ['common', 'mythic'];

const clamp = (n, a = 0, b = 100) => Math.max(a, Math.min(b, n));

/** scores 0..100 for one RGBA picture. Pure; this exact function also runs inside the page (it is passed as source), so it uses nothing outside itself. */
export function pixelStats(data, w, h) {
  const clamp = (v, lo = 0, hi = 100) => Math.max(lo, Math.min(hi, v)); // inside, because the page gets this function as source text and has no outer scope
  const n = w * h, lum = new Float32Array(n);
  let sRG = 0, sYB = 0, sRG2 = 0, sYB2 = 0;
  for (let i = 0; i < n; i++) {
    const r = data[i * 4], g = data[i * 4 + 1], b = data[i * 4 + 2];
    lum[i] = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
    const rg = r - g, yb = 0.5 * (r + g) - b; sRG += rg; sYB += yb; sRG2 += rg * rg; sYB2 += yb * yb;
  }
  const sorted = Float32Array.from(lum).sort(), p = (q) => sorted[Math.min(n - 1, Math.floor(q * n))];
  const tonalRange = p(0.95) - p(0.05);
  const mRG = sRG / n, mYB = sYB / n, vRG = Math.max(0, sRG2 / n - mRG * mRG), vYB = Math.max(0, sYB2 / n - mYB * mYB);
  const colourfulness = Math.sqrt(vRG + vYB) + 0.3 * Math.sqrt(mRG * mRG + mYB * mYB);
  // Sobel on luminance; the energy in the middle half of the frame (a quarter of its area) against all of it
  let total = 0, mid = 0, count = 0;
  const x0 = Math.floor(w * 0.25), x1 = Math.ceil(w * 0.75), y0 = Math.floor(h * 0.25), y1 = Math.ceil(h * 0.75);
  for (let y = 1; y < h - 1; y++) for (let x = 1; x < w - 1; x++) {
    const i = y * w + x;
    const gx = -lum[i - w - 1] - 2 * lum[i - 1] - lum[i + w - 1] + lum[i - w + 1] + 2 * lum[i + 1] + lum[i + w + 1];
    const gy = -lum[i - w - 1] - 2 * lum[i - w] - lum[i - w + 1] + lum[i + w - 1] + 2 * lum[i + w] + lum[i + w + 1];
    const m = Math.sqrt(gx * gx + gy * gy) / 4; total += m; count++;
    if (x >= x0 && x < x1 && y >= y0 && y < y1) mid += m;
  }
  const detail = count ? total / count : 0, share = total > 0 ? mid / total : 0;
  const detailScore = detail < 0.03 ? (detail / 0.03) * 100 : detail <= 0.14 ? 100 : clamp(100 - ((detail - 0.14) / 0.14) * 100);
  return {
    tonal: clamp((tonalRange / 0.6) * 100), colour: clamp((colourfulness / 60) * 100), detail: clamp(detailScore),
    focus: clamp(((share - 0.25) / 0.3) * 100), // a frame with the detail spread evenly puts a quarter of it in the middle quarter of its area
  };
}

/** the mean of several pictures' scores, each property rounded to one place, and the composite. Pure. */
export function combine(list) {
  const metrics = Object.fromEntries(PIXEL_METRICS.map((m) => [m, Math.round((list.reduce((a, s) => a + s[m], 0) / Math.max(1, list.length)) * 10) / 10]));
  return { composite: Math.round(Object.values(metrics).reduce((a, b) => a + b, 0) / PIXEL_METRICS.length), metrics };
}

/** the floor's verdict for the pixel part: the composite may not drop, no property by more than the slack. Pure. */
export function pixelRegressions(now, floor, slack = SLACK_SAME) {
  if (!floor) return [];
  const out = [];
  if (now.composite < floor.composite - (slack > SLACK_SAME ? 3 : 0)) out.push('pixel composite ' + now.composite + ' is below the floor ' + floor.composite);
  for (const m of PIXEL_METRICS) if (floor.metrics && floor.metrics[m] != null && now.metrics[m] < floor.metrics[m] - slack) out.push(m + ' ' + now.metrics[m] + ' dropped more than ' + slack + ' below its floor ' + floor.metrics[m]);
  return out;
}
/** the pixel floor after a run: never lower. Pure. */
export function pixelRaised(now, floor) {
  const f = floor || { composite: 0, metrics: {} };
  return { composite: Math.max(f.composite || 0, now.composite), chrome: now.chrome || f.chrome || '', metrics: Object.fromEntries(PIXEL_METRICS.map((m) => [m, Math.max((f.metrics || {})[m] || 0, now.metrics[m])])) };
}

const SAMPLE = () => { const out = []; for (const kind of KINDS) for (const key of SAMPLE_KEYS) for (const rarity of SAMPLE_RARITIES) out.push({ kind, key, rarity, svg: artSvg({ key: key + ' ' + kind, name: key, kind, rarity }, { w: W, h: H }) }); return out; };

/** rasterise the sample in Chromium and score each picture. Returns { now: { composite, metrics, chrome }, perKind } or null when there is no browser. */
export async function measure() {
  let chromium; try { ({ chromium } = await import('playwright-core')); } catch (_) { return null; }
  let browser;
  const exe = [process.env.VOID_TEST_BROWSER, '/usr/bin/google-chrome', '/opt/pw-browsers/chromium'].find((p) => p && existsSync(p)); // the same candidates tools/test_void.mjs tries
  if (!exe) return null;
  try { browser = await chromium.launch({ executablePath: exe, headless: true, args: ['--no-sandbox'] }); } catch (_) { return null; }
  try {
    const page = await browser.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: 1 }), cards = SAMPLE();
    await page.addScriptTag({ content: 'window.__pixelStats = ' + pixelStats.toString() + ';' }); // this file's own function, handed to the page as a script
    const scores = await page.evaluate(async ({ svgs, w, h }) => {
      const stats = window.__pixelStats;
      const out = [];
      for (const svg of svgs) {
        const img = new Image(); await new Promise((ok, no) => { img.onload = ok; img.onerror = () => no(new Error('svg did not load')); img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg); });
        const c = document.createElement('canvas'); c.width = w; c.height = h; const g = c.getContext('2d'); g.drawImage(img, 0, 0, w, h);
        out.push(stats(g.getImageData(0, 0, w, h).data, w, h));
      }
      return out;
    }, { svgs: cards.map((c) => c.svg), w: W, h: H });
    const perKind = {}; cards.forEach((c, i) => { (perKind[c.kind] = perKind[c.kind] || []).push(scores[i]); });
    const now = combine(scores); now.chrome = String(browser.version()).split('.')[0];
    return { now, perKind: Object.fromEntries(Object.entries(perKind).map(([k, l]) => [k, combine(l).composite])) };
  } finally { await browser.close(); }
}

const readFloor = () => { try { return JSON.parse(readFileSync(FLOOR_FILE, 'utf8')); } catch (_) { return null; } };

async function main(argv) {
  const res = await measure();
  if (!res) { console.log('art pixels: no browser here (set VOID_TEST_BROWSER); the source score still applies'); return 0; }
  const { now, perKind } = res, file = readFloor() || {}, floor = file.pixels || null;
  if (argv.includes('--json')) { console.log(JSON.stringify({ now, floor, perKind }, null, 1)); return 0; }
  if (argv.includes('--write')) {
    const next = pixelRaised(now, floor), same = floor && JSON.stringify(floor) === JSON.stringify(next);
    if (!same) writeFileSync(FLOOR_FILE, JSON.stringify({ ...file, pixels: next }, null, 1) + '\n');
    console.log(same ? 'art pixel floor unchanged: ' + next.composite : 'art pixel floor raised to ' + next.composite + (floor ? ' (was ' + floor.composite + ')' : '')); return 0;
  }
  console.log('card art pixels ' + now.composite + (floor ? ' (floor ' + floor.composite + ', Chromium ' + (floor.chrome || '?') + ')' : ' (no floor yet: run --write)') + '  ' + PIXEL_METRICS.map((m) => m + ' ' + now.metrics[m]).join('  ') + '  [Chromium ' + now.chrome + ']');
  const weak = Object.entries(perKind).sort((a, b) => a[1] - b[1]).slice(0, 3).map(([k, v]) => k + ' ' + v).join(', ');
  console.log('  weakest kinds on screen: ' + weak);
  if (argv.includes('--check')) {
    if (!floor) { console.error('art-floor.json has no pixel floor: run node tools/art-pixels.mjs --write'); return 1; }
    const other = floor.chrome && floor.chrome !== now.chrome, bad = pixelRegressions(now, floor, other ? SLACK_OTHER_BROWSER : SLACK_SAME);
    if (other) console.log('  the floor was set on Chromium ' + floor.chrome + ', this is ' + now.chrome + ': a wider slack applies');
    if (bad.length) { console.error('the card art looks worse: ' + bad.join('; ')); return 1; }
    if (JSON.stringify(pixelRaised(now, floor).metrics) !== JSON.stringify(floor.metrics) && !other) console.log('  the art improved: node tools/art-pixels.mjs --write raises the floor');
  }
  return 0;
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main(process.argv.slice(2)).then((c) => process.exit(c)).catch((e) => { console.error('art-pixels: ' + e.message); process.exit(1); });
