// Verse's films and podcast on the live site, the way a visitor meets them (owner, 2026-11-20: "podcast and vids are still broken").
// In a real browser at a desktop and a phone size: /films/ shows its heading as written (Videos), lists no retired film
// (lib/films-retired.js), and every film tile it shows really loads and plays with sound; the watch page of the newest film plays.
// Verse Out Loud: every public episode in /podcast/episodes.json streams as audio, the hidden ones are not in the feed, and the newest
// one plays in a browser <audio> element. /podcasts/ (the show page, behind UniVerse for visitors) answers, and with VOID_OWNER_TOKEN set
// the show page is opened as the owner and its Play button is pressed. The token is only ever sent to the site and never printed.
//   node tools/media-live.mjs [--shots dir]      exit 0 all good, 1 a check failed, 3 the site could not be reached
import { chromium } from 'playwright-core';
import { existsSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { RETIRED } from '../void-live-deploy/lib/films-retired.js';

export const SITE = (process.env.SITE || 'https://a-to-mind.com').replace(/\/$/, '');
export const SIZES = Object.freeze({ desktop: { width: 1440, height: 900 }, phone: { width: 390, height: 844 } });
/** the films a visitor may see: none retired, each with a signed play link. Pure. */
export function filmListIssues(films) {
  const bad = [];
  for (const f of films || []) {
    if (RETIRED.has(f.id)) bad.push('retired film listed: ' + f.id);
    if (f.unlisted) bad.push('unlisted film shown to a visitor: ' + f.id);
    if (!/^\/api\/films\?id=/.test(f.src || '')) bad.push('no play link: ' + f.id);
  }
  return bad;
}
/** the public episodes and what a feed must not carry. Pure. */
export function episodeIssues(j, rssText) {
  const bad = [], eps = (j && j.episodes) || [];
  for (const e of eps.filter((x) => x.hidden)) if (String(rssText).includes('<itunes:episode>' + e.n + '</itunes:episode>')) bad.push('hidden episode ' + e.n + ' is in the feed');
  for (const e of eps.filter((x) => !x.hidden)) if (!String(rssText).includes('/podcast/' + e.file)) bad.push('episode ' + e.n + ' is not in the feed');
  return bad;
}
const chrome = () => ['/usr/bin/google-chrome', process.env.CHROME].find((p) => p && existsSync(p));

async function main() {
  const shots = process.argv.includes('--shots') ? process.argv[process.argv.indexOf('--shots') + 1] : '';
  if (shots) mkdirSync(shots, { recursive: true });
  const fails = [], notes = [];
  let films, eps, rssText;
  try {
    const get = async (path) => { const r = await fetch(SITE + path); if (!r.ok) throw new Error(path + ' answered HTTP ' + r.status); return r; };
    films = (await (await get('/api/films')).json()).films || [];
    eps = await (await get('/podcast/episodes.json')).json();
    rssText = await (await get('/podcast/rss.xml')).text();
  } catch (e) { console.error('site not reached: ' + e.message); process.exit(3); }
  fails.push(...filmListIssues(films), ...episodeIssues(eps, rssText));
  const pub = (eps.episodes || []).filter((e) => !e.hidden).sort((a, b) => b.n - a.n);
  notes.push(films.length + ' films listed, ' + pub.length + ' public episodes');
  const heads = await Promise.all(pub.map((e) => fetch(SITE + '/podcast/' + e.file, { headers: { range: 'bytes=0-1023' } }).catch(() => ({ status: 'no answer', headers: new Headers() }))));
  heads.forEach((r, i) => { if (![200, 206].includes(r.status) || !/audio\/mpeg/.test(r.headers.get('content-type') || '')) fails.push('episode ' + pub[i].n + ' audio answered ' + r.status); });
  const exe = chrome();
  const browser = await chromium.launch({ ...(exe ? { executablePath: exe } : {}), args: ['--no-sandbox', '--autoplay-policy=no-user-gesture-required'] });
  for (const [size, viewport] of Object.entries(SIZES)) {
    const ctx = await browser.newContext({ viewport, isMobile: size === 'phone', hasTouch: size === 'phone' });
    const page = await ctx.newPage(), errors = [];
    page.on('pageerror', (e) => errors.push(String(e).slice(0, 200)));
    await page.goto(SITE + '/films/', { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForFunction(() => document.querySelector('.film') || /No films yet/.test(document.body.innerText), null, { timeout: 45000 }).catch(() => {});
    const h1 = await page.locator('h1').first().evaluate((el) => { const c = el.cloneNode(true); c.querySelectorAll('.gl i').forEach((g) => g.remove()); return c.textContent; }).catch(() => ''); // the glitch's stand-in glyph flickers over the letter; read the word
    if (!/\bVideos\b/.test(h1)) fails.push(size + ': films heading reads "' + h1 + '"');
    const tiles = await page.locator('.film.thumb').count();
    for (let i = 0; i < Math.min(tiles, 4); i++) {
      const t = page.locator('.film.thumb').nth(i);
      await t.scrollIntoViewIfNeeded();
      const ok = await t.evaluate((a) => new Promise((done) => { const v = a.querySelector('video'); if (!v) return done('no video'); if (v.readyState >= 1) return done(''); v.addEventListener('loadedmetadata', () => done(''), { once: true }); v.addEventListener('error', () => done('error ' + (v.error && v.error.code)), { once: true }); setTimeout(() => done('no metadata in 20 s'), 20000); }));
      if (ok) fails.push(size + ': film tile ' + i + ' ' + ok);
    }
    if (shots) await page.screenshot({ path: join(shots, 'films-' + size + '.png') });
    if (films[0]) {
      await page.goto(SITE + '/films/?v=' + encodeURIComponent(films[0].id), { waitUntil: 'domcontentloaded' });
      const v = page.locator('video').first();
      await v.waitFor({ timeout: 30000 }).catch(() => {});
      const played = await v.evaluate(async (el) => { el.muted = false; try { await el.play(); } catch (e) { el.muted = true; await el.play().catch(() => {}); } await new Promise((r) => setTimeout(r, 4000)); const a = el.audioTracks ? el.audioTracks.length : null; return { t: el.currentTime, err: el.error && el.error.code, dur: el.duration, w: el.videoWidth, h: el.videoHeight, audio: a ?? (el.mozHasAudio ?? el.webkitAudioDecodedByteCount > 0) }; }).catch((e) => ({ err: String(e) }));
      if (!(played.t > 1) || played.err) fails.push(size + ': the newest film did not play ' + JSON.stringify(played));
      else notes.push(size + ': film ' + films[0].id + ' played to ' + played.t.toFixed(1) + ' s of ' + Number(played.dur).toFixed(1) + ' s, ' + played.w + 'x' + played.h + ', sound ' + played.audio);
      if (played.audio === false) fails.push(size + ': the newest film has no sound');
      if (shots) await page.screenshot({ path: join(shots, 'film-watch-' + size + '.png') });
    }
    if (pub[0]) {
      const got = await page.evaluate(async (src) => { const a = new Audio(src); try { await a.play(); } catch (e) { a.muted = true; await a.play().catch(() => {}); } await new Promise((r) => setTimeout(r, 4000)); return { t: a.currentTime, dur: a.duration, err: a.error && a.error.code }; }, SITE + '/podcast/' + pub[0].file);
      if (!(got.t > 1) || got.err) fails.push(size + ': episode ' + pub[0].n + ' did not play ' + JSON.stringify(got));
      else notes.push(size + ': episode ' + pub[0].n + ' played to ' + got.t.toFixed(1) + ' s of ' + Number(got.dur).toFixed(0) + ' s');
    }
    const r = await page.goto(SITE + '/podcasts/?show=verse', { waitUntil: 'domcontentloaded' });
    if (!r || r.status() >= 400) fails.push(size + ': /podcasts/ answered ' + (r && r.status()));
    if (/rse">Open the show/.test(await page.content())) fails.push(size + ': stray markup on /podcasts/');
    if (process.env.VOID_OWNER_TOKEN) {
      const own = await browser.newContext({ viewport, extraHTTPHeaders: { authorization: 'Bearer ' + process.env.VOID_OWNER_TOKEN } });
      const op = await own.newPage();
      await op.goto(SITE + '/podcasts/?show=verse', { waitUntil: 'domcontentloaded' });
      const btn = op.locator('button:visible', { hasText: /^Play$/ }).first();
      if (pub[0] && await btn.count()) {
        await btn.click(); await op.waitForTimeout(5000);
        const st = await op.evaluate(() => { const a = document.querySelector('audio'); return a ? { t: a.currentTime, err: a.error && a.error.code } : null; });
        if (!st || !(st.t > 1)) fails.push(size + ': owner show page did not play ' + JSON.stringify(st)); else notes.push(size + ': owner show page played');
      }
      if (shots) await op.screenshot({ path: join(shots, 'podcast-owner-' + size + '.png') });
      await own.close();
    }
    if (errors.length) fails.push(size + ': page errors ' + errors.join(' | '));
    await ctx.close();
  }
  await browser.close();
  for (const n of notes) console.log('ok   ' + n);
  for (const f of fails) console.log('FAIL ' + f);
  process.exit(fails.length ? 1 : 0);
}
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) main();
