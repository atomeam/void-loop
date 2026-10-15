// Visual regression of the live site (.github/workflows/visual.yml): screenshots at desktop and phone size, compared with a
// previous set pixel by pixel in the browser itself (no image library). Prints a warning per page that moved more than 2%.
//   node tools/visual.mjs --out shots [--prev prev/shots] [--site https://a-to-mind.com]
import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright-core';

const a = process.argv.slice(2), opt = (k, d) => (a.includes(k) ? a[a.indexOf(k) + 1] : d);
const out = opt('--out', 'shots'), prev = opt('--prev', ''), site = opt('--site', 'https://a-to-mind.com');
const PAGES = [['home', '/'], ['calc', '/?q=what%20is%202%2B2'], ['weather', '/?q=weather%20in%20Tokyo'], ['films', '/films/']];
fs.mkdirSync(out, { recursive: true });
const exe = process.env.VOID_TEST_BROWSER || ['/usr/bin/google-chrome', '/usr/bin/chromium-browser', '/usr/bin/chromium'].find((p) => fs.existsSync(p));
const b = await chromium.launch({ executablePath: exe, args: ['--no-sandbox'] });
const shots = [];
for (const [dev, vp, mob] of [['desktop', { width: 1440, height: 900 }, false], ['phone', { width: 390, height: 844 }, true]]) {
  const c = await b.newContext({ viewport: vp, isMobile: mob, hasTouch: mob, reducedMotion: 'reduce' });
  const p = await c.newPage();
  for (const [name, url] of PAGES) {
    try { await p.goto(site + url, { waitUntil: 'networkidle', timeout: 30000 }); } catch (_) {}
    await p.waitForTimeout(2500); const f = `${name}-${dev}.png`; await p.screenshot({ path: path.join(out, f) }); shots.push(f);
  }
  await c.close();
}
let moved = 0;
if (prev && fs.existsSync(prev)) {
  const p = await (await b.newContext()).newPage();
  for (const f of shots) {
    const old = path.join(prev, f); if (!fs.existsSync(old)) continue;
    const share = await p.evaluate(async ([x, y]) => {
      const load = (s) => new Promise((r) => { const i = new Image(); i.onload = () => r(i); i.src = 'data:image/png;base64,' + s; });
      const [i1, i2] = await Promise.all([load(x), load(y)]); if (i1.width !== i2.width || i1.height !== i2.height) return 1;
      const px = (i) => { const c = new OffscreenCanvas(i.width, i.height), g = c.getContext('2d'); g.drawImage(i, 0, 0); return g.getImageData(0, 0, i.width, i.height).data; };
      const d1 = px(i1), d2 = px(i2); let n = 0;
      for (let k = 0; k < d1.length; k += 4) if (Math.abs(d1[k] - d2[k]) + Math.abs(d1[k + 1] - d2[k + 1]) + Math.abs(d1[k + 2] - d2[k + 2]) > 48) n++;
      return n / (d1.length / 4);
    }, [fs.readFileSync(old, 'base64'), fs.readFileSync(path.join(out, f), 'base64')]);
    console.log(`${f}: ${(share * 100).toFixed(2)}% of pixels changed`);
    if (share > 0.02) { moved++; fs.copyFileSync(old, path.join(out, 'before-' + f)); console.log(`::warning title=Visual change::${f} changed ${(share * 100).toFixed(1)}% since last week (before-${f} in the artifact)`); }
  }
}
await b.close();
console.log(`${shots.length} screenshots, ${moved} changed`);
