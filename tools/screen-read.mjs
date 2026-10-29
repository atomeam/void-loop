// The tower gate's eyes (owner, 2026-10-24: "build something that allows Verse to measure the other sites"): a site that draws its answer
// (a clock on a canvas, a wheel's winner painted in a picture) has no text to read, so its accuracy stayed unmeasured. readScreen() takes a
// screenshot of what a person would look at (the largest canvas, image or frame on the page, else the whole screen) and reads the text in it
// with Tesseract (tesseract.js, run here, its English data from the npm package @tesseract.js-data/eng: nothing is sent anywhere).
// The answer is what the page SHOWS, read the way a person reads it, so a drawn answer is held to the same truth as a written one.
import path from 'node:path'; import os from 'node:os'; import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
let worker = null;
async function eyes() {
  if (worker) return worker;
  const { createWorker } = await import('tesseract.js');
  const langPath = path.join(path.dirname(require.resolve('@tesseract.js-data/eng/package.json')), '4.0.0_best_int');
  worker = await createWorker('eng', 1, { langPath, gzip: true, cachePath: os.tmpdir(), logger: () => {} });
  return worker;
}
/** the text in a PNG (a Buffer), as Tesseract reads it. */
export async function readImage(png) { const w = await eyes(); const { data } = await w.recognize(png); return String(data.text || ''); }
/** the region a person looks at: the largest canvas, image, video or frame in view, as a box, or null for the whole screen. */
async function focus(page) {
  return page.evaluate(() => { let best = null, area = 0;
    for (const e of document.querySelectorAll('canvas, img, video, iframe, svg')) { const r = e.getBoundingClientRect(); const a = Math.max(0, Math.min(r.right, innerWidth) - Math.max(r.left, 0)) * Math.max(0, Math.min(r.bottom, innerHeight) - Math.max(r.top, 0));
      if (a > area && r.width >= 80 && r.height >= 40) { area = a; best = { x: Math.max(0, r.left), y: Math.max(0, r.top), width: Math.min(r.width, innerWidth - Math.max(0, r.left)), height: Math.min(r.height, innerHeight - Math.max(0, r.top)) }; } }
    return best; }).catch(() => null);
}
/** what the page shows where a person looks, read off the screen; '' when nothing could be read. */
export async function readScreen(page) {
  try { const clip = await focus(page); const png = await page.screenshot(clip ? { clip } : {}); return await readImage(png); } catch (_) { return ''; }
}
export async function closeEyes() { if (worker) { const w = worker; worker = null; await w.terminate().catch(() => {}); } }
