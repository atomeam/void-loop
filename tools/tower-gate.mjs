// The tower's head-to-head gate (lib/tower.js): Verse against the real, live site of one floor, aspect by aspect, with evidence.
// Measured automatically: speed (time to the page's load event, median of 3), mobile (sideways overflow at phone width), accessibility
// (buttons and links with no name, images with no text), reliability (3 loads, how many answered), offline (the page reloaded with the
// network cut still shows itself), sharing (link-preview tags and a share or copy-link control), local language (the page opened by a German
// browser speaks German), big answer (the largest text on the first screen), and, where tools/tower-probes.mjs has a probe, accuracy (the
// same question to both, against an answer worked out independently), completeness (what the best sites in the category show) and a floor's
// own named aspects (PARTS: the colour models, the shades and palettes), and design polish (designLook below). Anything without a check
// stays unverified, so it never counts as beaten. A site the gate cannot load is a fault in the
// gate, not a win for the site (owner, 2026-10-24: "fix the gate/runner to measure it properly"): the browser presents as an ordinary
// Chrome, speed is the load event (an ad-filled page may never go quiet on the network), and a site that still answers none of the loads
// is reported as unmeasured. Screenshots go to a private folder outside the repo (TOWER_PRIVATE, default /workspace/tower-private); the
// public file keeps verdicts and numbers only. A verdict that was a pass and is now worse keeps `was`, so the floor un-beats and says it
// regressed. Passive: page loads only, no sign-in, no forms, no posting.
//   node tools/tower-gate.mjs <floor id>     e.g. calculator; writes void-live-deploy/tower.evidence.json
//   node tools/tower-gate.mjs --floors a,b   several floors in turn, each in its own browser, written after each
//   node tools/tower-gate.mjs --shard 2/6    the sweep across machines (tools/tower-merge.mjs): slice 2 of 6 of the floors, written to a slice file
//                                            (tower.evidence.2.json, or --out <file>; never committed); --list prints the slice and loads nothing
//   node tools/tower-gate.mjs --merge <slice files>   folds the slices into tower.evidence.json, a newer row over an older one only
import fs from 'node:fs'; import path from 'node:path'; import { fileURLToPath } from 'node:url';
import { FLOORS, LANE_PAGES, aspectsOf, tower , hostOf, noShotOf, noRivalOf, noRivalUrl } from '../void-live-deploy/lib/tower.js';
import { wallOf } from '../void-live-deploy/lib/tower-controls.js';
import { probeFor as probeOf, withFeatureFacts, score, scoreOf, SPUN, TIMED, FLIPPED, clockReadings } from './tower-probes.mjs';
// a floor's probe as the gate uses it: with the features its features file says Verse has added to completeness (domains/features/, tools/feature-scan.mjs)
const probeFor = (id) => withFeatureFacts(probeOf(id), id);
// the floors the gate measures: FLOORS, and each frontier site that LANE_PAGES gives a page by its bare host (sycophanthex.com: /fanfic/, 2026-10-29),
// as the tower builds that floor. Without it the tower target linked its page and its 12 aspects were never measured ("no floor sycophanthex.com").
export const GATE_FLOORS = FLOORS.concat(Object.entries(LANE_PAGES).filter(([k]) => hostOf(k) === k && !FLOORS.some((f) => (hostOf(f.url) || hostOf(f.site)) === k))
  .map(([h, page]) => ({ id: h, site: h, url: 'https://' + h + '/', label: h, page, extra: [] })));
import { shard, parseShard, merge, selfCalled } from './tower-merge.mjs';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const FILE = path.join(root, 'void-live-deploy', 'tower.evidence.json'), PRIV = process.env.TOWER_PRIVATE || '/workspace/tower-private';
const VERSE = process.env.VERSE_URL || 'https://a-to-mind.com/';
// an ordinary phone Chrome, not "HeadlessChrome": many sites turn the headless name away, and a person never sends it
export const UA = 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Mobile Safari/537.36';
// German words common enough that any German page shows several and an English one almost none
const GERMAN = /\b(?:und|der|die|das|ist|nicht|mit|f\u00fcr|ein|eine|heute|jetzt|Weihnachten|Ja|Nein|M\u00fcnze|Zahl|Farbe)\b/g;
/** whether a page's text is German: { lang, words } to 1 or 0. Pure. */
export const germanScore = (lang, text) => (/^de\b/i.test(String(lang || '')) || (String(text || '').match(GERMAN) || []).length >= 4 ? 1 : 0);
/** link-preview tags and a share control, 0 to 4: og:title, og:image, a description (og or twitter), a share or copy-link control. Pure. */
export const sharingScore = (s) => (s.ogTitle ? 1 : 0) + (s.ogImage ? 1 : 0) + (s.desc ? 1 : 0) + (s.control ? 1 : 0);

// design polish, measured (owner, 2026-10-24: "add a structural CSS/layout quality check in tower-gate.mjs"): what a design review fails first,
// counted the same way on both pages. Text below WCAG 2 contrast (4.5:1, 3:1 for large text) against the first solid background behind it
// (text over a picture or a gradient is skipped, it cannot be known here; text marked aria-hidden is skipped, as WCAG 1.4.3 exempts incidental
// text such as a contrast sample), tap targets under 24 by 24 px (WCAG 2.5.8, a link inside a line of text excepted), and a layout that shifts
// more than 0.1 while the page loads (Core Web Vitals CLS, from the first paint). Lower is better; 0 is the best there is.
export const CLS_INIT = 'window.__towerCls=0;try{new PerformanceObserver(function(l){l.getEntries().forEach(function(e){if(!e.hadRecentInput)window.__towerCls+=e.value})}).observe({type:"layout-shift",buffered:true})}catch(e){}';
/** run inside the page: { contrast, targets, cls }. */
export function designLook() {
  const vis = (e) => { const r = e.getBoundingClientRect(), cs = getComputedStyle(e); return r.width > 0 && r.height > 0 && cs.visibility !== 'hidden' && cs.display !== 'none' && +cs.opacity !== 0; };
  const own = (e) => [...e.childNodes].filter((n) => n.nodeType === 3).map((n) => n.textContent).join(' ').replace(/\s+/g, ' ').trim();
  const rgb = (c) => { const m = String(c).match(/rgba?\(([^)]+)\)/); if (!m) return null; const p = m[1].split(/[,\s/]+/).filter(Boolean).map(Number); return { r: p[0], g: p[1], b: p[2], a: p.length > 3 ? p[3] : 1 }; };
  const lum = ({ r, g, b }) => { const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }; return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b); };
  const behind = (e) => { for (let x = e; x; x = x.parentElement) { const cs = getComputedStyle(x); if (cs.backgroundImage && cs.backgroundImage !== 'none') return null; const c = rgb(cs.backgroundColor); if (c && c.a >= 0.99) return c; } return { r: 255, g: 255, b: 255, a: 1 }; };
  let contrast = 0;
  const texts = [...document.body.querySelectorAll('*')].filter((e) => !/^(SCRIPT|STYLE|NOSCRIPT|TEMPLATE|SVG)$/i.test(e.tagName) && !e.closest('[aria-hidden="true"]') && own(e) && vis(e));
  for (const e of texts.slice(0, 400)) {
    const cs = getComputedStyle(e), fg = rgb(cs.color), bg = behind(e); if (!fg || !bg || fg.a < 0.99) continue;
    const L1 = lum(fg), L2 = lum(bg), ratio = (Math.max(L1, L2) + 0.05) / (Math.min(L1, L2) + 0.05), px = parseFloat(cs.fontSize) || 16, large = px >= 24 || (px >= 18.66 && +cs.fontWeight >= 700);
    if (ratio < (large ? 3 : 4.5)) contrast++;
  }
  const targets = [...document.querySelectorAll('button,a[href],input:not([type=hidden]),select,textarea,[role=button]')].filter(vis).filter((e) => {
    const r = e.getBoundingClientRect(); if (r.width >= 24 && r.height >= 24) return false;
    return !(e.tagName === 'A' && e.parentElement && own(e.parentElement));
  }).length;
  return { contrast, targets, cls: Number(window.__towerCls || 0) };
}
/** design defects from one look: contrast failures, small tap targets, and one for a layout that shifts more than 0.1; NaN for no look. Pure. */
export const defects = (l) => (l ? l.contrast + l.targets + (l.cls > 0.1 ? 1 : 0) : NaN);

/** a verdict from two numbers: lower is better unless higher is. Pure. */
// ideal: the best score that exists (0 px overflow, every load answered, no unnamed control). When both sites sit at it there is
// nothing left to beat, so the tie passes as 'equal-and-better' (lib/tower.js); any other tie stays 'equal' and does not pass.
export function verdict(verse, best, higherBetter = false, ideal) {
  if (!Number.isFinite(verse) || !Number.isFinite(best)) return 'unverified';
  if (verse === best) return ideal !== undefined && verse === ideal ? 'equal-and-better' : 'equal';
  return (higherBetter ? verse > best : verse < best) ? 'better' : 'worse';
}
/** what each measured aspect is: whether higher is better and its ideal score (none for speed: faster is always possible) */
export const MEASURES = Object.freeze({ speed: { hi: false }, reliability: { hi: true, ideal: 3 }, mobile: { hi: false, ideal: 0 }, accessibility: { hi: false, ideal: 0 },
  offline: { hi: true, ideal: 1 }, sharing: { hi: true, ideal: 4 }, 'local language': { hi: true, ideal: 1 }, 'big answer': { hi: true }, accuracy: { hi: true }, completeness: { hi: true },
  'design polish': { hi: false, ideal: 0 }, 'wider use': { hi: true, ideal: 11 } });
// a floor's own named aspects scored from a list (tools/tower-probes.mjs PARTS): more of the list is better, the whole list is the best there is
const PART = Object.freeze({ hi: true });
export const SPEED_BAR = 200; // ms to the load event at phone width: Verse's own bar for speed (owner, 2026-10-25)
/** stored measured rows scored again by today's rule, numbers unchanged (no site is loaded). Pure. */
export function rescore(rows = {}) {
  const out = { ...rows };
  for (const [a, r] of Object.entries(rows)) { const m = MEASURES[a] || (r && r.part ? PART : null); if (m && r && Number.isFinite(r.verse) && Number.isFinite(r.best)) out[a] = { ...r, verdict: verdict(r.verse, r.best, m.hi, m.ideal !== undefined ? m.ideal : r.of) }; }
  return out;
}
/** the stored row, keeping what a pass was when it is now worse (a regression un-beats the floor). Pure. */
export function record(prev, v, verse, best, evidence, at) {
  const ok = (x) => x === 'better' || x === 'equal-and-better';
  return { verdict: v, verse, best, evidence, at, ...(v === 'worse' && prev && (ok(prev.verdict) || prev.was) ? { was: prev.was || prev.verdict } : {}) };
}

// a coin page's own flip control, as a person finds it: a button named flip or toss (its text, label or value), else a tap at the centre of
// the largest picture or canvas on the first screen (a coin you tap); a function that presses it once, or null when the page has neither
export async function flipControl(p) {
  // the ways a person flips a coin on a page, tried in turn until one changes what the page shows (its text or its picture): a button named for
  // flipping in any frame; anything whose class or id says coin; the largest picture on the first screen; the Space key (justflipacoin.com
  // was not found by the first and third alone). The trial press is one flip; the found way is returned to press again, or null
  const shot = () => p.screenshot().catch(() => null), text = async () => (await Promise.all(p.frames().map((f) => f.evaluate(() => (document.body ? document.body.innerText : '')).catch(() => '')))).join('\n');
  const biggest = async (f, sel) => { const els = f.locator(sel), k = Math.min(40, await els.count().catch(() => 0)); let bb = null, area = 0; for (let i = 0; i < k; i++) { const x = await els.nth(i).boundingBox().catch(() => null); if (x && x.y < 800 && x.width * x.height > area) { area = x.width * x.height; bb = x; } } return bb && area >= 48 * 48 ? bb : null; };
  const ways = [];
  for (const f of p.frames()) { const btn = f.getByRole('button', { name: /\b(?:flip|toss|again|coin)\b/i }).filter({ visible: true }).first(); ways.push(async () => ((await btn.count().catch(() => 0)) ? () => btn.click({ timeout: 3000 }) : null)); }
  for (const sel of ['[class*=coin i]:visible, [id*=coin i]:visible', 'canvas:visible, img:visible, svg:visible, video:visible']) for (const f of p.frames()) ways.push(async () => { const bb = await biggest(f, sel); return bb ? () => p.mouse.click(bb.x + bb.width / 2, bb.y + bb.height / 2) : null; });
  ways.push(async () => () => p.keyboard.press('Space'));
  for (const way of ways) {
    const press = await way().catch(() => null); if (!press) continue;
    const t = await text(), pic = await shot(); await press().catch(() => {}); await p.waitForTimeout(1500);
    if ((await text()) !== t || !(pic && pic.equals((await shot()) || Buffer.alloc(0)))) return press;
  }
  return null;
}
/** what a page offers to press, for the evidence when the gate finds no way to flip it: frames, button labels, coin-like elements. */
export async function seenOn(p) {
  return (await Promise.all(p.frames().map(async (f) => f.url().slice(0, 70) + ' [' + (await f.locator('button:visible, [role=button]:visible').allInnerTexts().catch(() => [])).map((x) => x.trim().slice(0, 20)).filter(Boolean).slice(0, 8).join(' | ') + '] coin-like ' + (await f.locator('[class*=coin i], [id*=coin i]').count().catch(() => 0)) + ', canvas ' + (await f.locator('canvas').count().catch(() => 0))))).join('; ');
}
/** the flip, seen (tower-probes.mjs `motion`): the screen the browser paints (Chrome's screencast sends a frame only when the picture changes),
 *  counted for `ms` at rest and then for `ms` after one press of the page's flip control: { rest, frames }, or null when the page has no flip
 *  control or never rests (an ad that moves all the time leaves the coin's own motion unknowable: not measured, never a loss) */
export async function motionOf(p, ms = 1500) {
  const press = await flipControl(p); if (!press) return null;
  const cdp = await p.context().newCDPSession(p); let n = 0;
  cdp.on('Page.screencastFrame', (f) => { n++; cdp.send('Page.screencastFrameAck', { sessionId: f.sessionId }).catch(() => {}); });
  try {
    await cdp.send('Page.startScreencast', { format: 'jpeg', quality: 10, maxWidth: 390, maxHeight: 800 });
    await p.waitForTimeout(800); n = 0; await p.waitForTimeout(ms); const rest = n; // the first frame is the screen as it is; then the page at rest
    n = 0; await press(); await p.waitForTimeout(ms); const frames = n;
    return rest > 3 ? null : { rest, frames };
  } finally { await cdp.send('Page.stopScreencast').catch(() => {}); await cdp.detach().catch(() => {}); }
}

/** whether the gate may keep a picture of a page it measured: never of a rival on a noShot floor (lib/tower.js: the image boards, whose front
 *  pages can carry explicit or illegal pictures, in a public repository); Verse's own page is not published either way. Pure. */
export const keepShot = (tag, noShot) => /-site$/.test(tag) && !noShot;
export async function measure(browser, url, tag, ask, probe, { noShot = false } = {}) {
  if (noRivalUrl(url)) throw new Error('the gate never opens ' + hostOf(url) + ': its robots.txt asks robots to stay away');
  const times = [], ok = []; const out = { mobile: null, a11y: null, skill: null, offline: null, sharing: null, big: null, text: '' };
  const ctx = await browser.newContext({ viewport: { width: 390, height: 800 }, userAgent: UA, locale: 'en-US', extraHTTPHeaders: { 'accept-language': 'en-US,en;q=0.9' } });
  await ctx.addInitScript(CLS_INIT);
  for (let i = 0; i < 3; i++) {
    const p = await ctx.newPage(); const t0 = Date.now();
    try { const r = await p.goto(url, { waitUntil: 'load', timeout: 30000 }); ok.push(r && r.status() < 400 ? 1 : 0); times.push(Date.now() - t0); } catch (_) { ok.push(0); }
    if (i === 0) {
      try {
        await p.waitForLoadState('networkidle', { timeout: 6000 }).catch(() => {}); // a page that builds its answer after load gets a moment, never forever
        out.mobile = await p.evaluate(() => Math.max(0, document.documentElement.scrollWidth - innerWidth));
        out.a11y = await p.evaluate(() => [...document.querySelectorAll('button,a[href]')].filter((e) => e.offsetParent && !(e.getAttribute('aria-label') || e.textContent.trim() || e.title)).length + [...document.querySelectorAll('img')].filter((e) => e.offsetParent && !e.hasAttribute('alt')).length);
        // the largest visible text on the first screen, in px: how big the answer is
        out.big = await p.evaluate(() => { let m = 0; const w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT); for (let n; (n = w.nextNode());) { if (!n.textContent.trim()) continue; const e = n.parentElement, r = e && e.getBoundingClientRect(); if (!r || !r.width || r.top > innerHeight || r.bottom < 0) continue; const cs = getComputedStyle(e); if (cs.visibility === 'hidden' || cs.display === 'none' || +cs.opacity === 0) continue; m = Math.max(m, parseFloat(cs.fontSize) || 0); } return Math.round(m); });
        const sh = await p.evaluate(() => { const meta = (k) => !!document.querySelector('meta[property="' + k + '"],meta[name="' + k + '"]'); return { ogTitle: meta('og:title'), ogImage: meta('og:image'), desc: meta('og:description') || meta('twitter:description') || meta('description'), control: [...document.querySelectorAll('button,a,[role=button]')].some((e) => /\b(?:share|copy (?:the )?link|copy url|permalink)\b/i.test((e.textContent || '') + ' ' + (e.getAttribute('aria-label') || '') + ' ' + (e.title || ''))) }; });
        out.sharing = sharingScore(sh); out.shared = sh;
        out.text = await p.evaluate(() => (document.body ? document.body.innerText + '\n' + [...document.querySelectorAll('input:not([type=hidden]), textarea, output')].map((e) => e.value || e.textContent || '').join('\n') : '')); // an answer in a box counts as shown
        out.design = await p.evaluate(designLook).catch(() => null);
        // which of Verse's own skills answered the ask (the page logs 'skill:<name>'; nothing logged, or the model, is not a skill)
        if (ask) for (let w = 0; w < 20 && !out.skill; w++) { out.skill = await p.evaluate((q) => { try { const l = JSON.parse(localStorage.getItem('a2m.void.loop.v1') || '[]'); const e = l.reverse().find((x) => x && String(x.ask).trim().toLowerCase() === q && /^(skill:|calc$|chance$)/.test(x.note || '')); return e ? e.note.replace(/^skill:/, '') : null; } catch (_) { return null; } }, ask.trim().toLowerCase()); if (!out.skill) await p.waitForTimeout(500); }
        if (!(noShot && /-site$/.test(tag))) { fs.mkdirSync(PRIV, { recursive: true }); await p.screenshot({ path: path.join(PRIV, tag + '.png') }); } // a noShot rival is not pictured even privately
        // the site as the gate saw it, published beside Verse's page on /compare/ (owner, 2026-10-25: every site refuses to be framed): one small
        // JPEG a floor at phone width, written at most once a day so the history stays light; Verse's own page is live there and needs none
        if (keepShot(tag, noShot)) { try { const dir = path.join(root, 'void-live-deploy', 'tower.shots'), file = path.join(dir, tag.replace(/-site$/, '') + '.jpg');
          const fresh = fs.existsSync(file) && Date.now() - fs.statSync(file).mtimeMs < 86400000; if (!fresh) { fs.mkdirSync(dir, { recursive: true }); await p.screenshot({ path: file, type: 'jpeg', quality: 55 }); } } catch (_) {} }
        if (/-site$/.test(tag)) out.icon = await iconOf(p).catch(() => null); // the site's own small icon is kept on every floor, noShot too
        if (probe && probe.motion && Object.keys(probe.motion).length) out.motion = await motionOf(p).catch(() => null);
        // offline: the same page reloaded with the network cut; it counts when it still shows itself (some words, not the browser's error page)
        // as for a returning visitor: a page that installs a service worker gets up to 10 s for it to be ready (the same wait for both sites; 5 s was
        // short of Verse's own install on the runner once it had 21 tool pages to keep, 2026-10-25)
        await p.evaluate(() => (navigator.serviceWorker ? Promise.race([navigator.serviceWorker.ready.then(() => 1), new Promise((r) => setTimeout(() => r(0), 10000))]) : 0)).catch(() => 0);
        await ctx.setOffline(true);
        try { await p.reload({ waitUntil: 'load', timeout: 12000 }); } catch (_) { /* the browser's own error page, or nothing */ }
        out.offline = await p.evaluate(() => (location.protocol.startsWith('http') && document.body && document.body.innerText.trim().length > 40 ? 1 : 0)).catch(() => 0);
        await ctx.setOffline(false);
      } catch (_) { /* measured what it could */ }
    }
    await p.close();
  }
  await ctx.close();
  // local language: the same page opened by a German browser
  const de = await browser.newContext({ viewport: { width: 390, height: 800 }, userAgent: UA, locale: 'de-DE', extraHTTPHeaders: { 'accept-language': 'de-DE,de;q=0.9' } });
  try { const p = await de.newPage(); await p.goto(url, { waitUntil: 'load', timeout: 30000 }); await p.waitForLoadState('networkidle', { timeout: 6000 }).catch(() => {}); const r = await p.evaluate(() => ({ lang: document.documentElement.lang, text: document.body ? document.body.innerText.slice(0, 4000) : '' })); out.german = germanScore(r.lang, r.text); } catch (_) { out.german = null; }
  await de.close();
  times.sort((a, b) => a - b);
  const reliability = ok.reduce((a, b) => a + b, 0);
  const parts = Object.fromEntries(Object.entries((probe && probe.parts) || {}).map(([a, list]) => [a, score(out.text, list)]));
  for (const [a, list] of Object.entries((probe && probe.motion) || {})) if (out.motion) parts[a] = scoreOf(out.motion, list); // no motion read: not measured
  return { speed: times.length ? times[Math.floor(times.length / 2)] : NaN, reliability, ...out, truth: probe && probe.truth ? score(out.text, probe.truth) : null, facts: probe && probe.facts && probe.facts.length ? score(out.text, probe.facts) : null, parts };
}

// which floors a run measures (owner, 2026-10-24: "Target the current fight by default ... Keep --all for scheduled cron sweeps only"): a run
// after a deploy measures the fight Verse is in now, any floor whose page the deploy changed, and floors whose evidence lacks an aspect the gate
// can now measure (a check added since it was last measured), at most `max`, so one fix is verified in about a minute and not in a 20-minute sweep
/** the aspects the gate can measure on a floor today: the measured ones on its checklist, its PARTS, and accuracy and completeness only with a probe. Pure. */
/** a page's answer to a question in its address, or typed into its own box (`type`) as a person would; the text it shows and its boxes hold,
 *  or null when it could not be read. Exported for tools/tower-gate.test.mjs, which runs it against local pages. */
/** the picture the gate puts into a page that answers once a photo is chosen (a one-pixel PNG: the size a page makes of it is what is read) */
export const PIXEL = { name: 'photo.png', mimeType: 'image/png', buffer: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64') };
export async function answer(b, url, type, spin = false, inBox = false, timed = 0, presses = 0, file = null) { if (noRivalUrl(url)) throw new Error('the gate never opens ' + hostOf(url) + ': its robots.txt asks robots to stay away'); const ctx = await b.newContext({ userAgent: UA, locale: 'en-US' }); try { const p = await ctx.newPage(); await p.goto(url, { waitUntil: 'load', timeout: 30000 }); await p.waitForLoadState('networkidle', { timeout: 6000 }).catch(() => {});
      if (/[?&]q=/.test(url)) await p.waitForTimeout(3000); // Verse answering an ask in the address: the card lands a moment after load
      const read = () => p.evaluate(() => ({ text: document.body ? document.body.innerText : '', boxes: [...document.querySelectorAll('input:not([type=hidden]), textarea, output')].map((e) => e.value || e.textContent || '').join('\n') }));
      if (file) { // a page that answers once a picture is put in (the photo resizer): the gate chooses a small picture of its own, as a person
        // chooses a file, and reads what the page then says of it (the lines it added), up to 8 s; nothing added is not measured
        const before = await read(), inp = p.locator('input[type=file]').first(); if (!(await inp.count().catch(() => 0))) { answer.lastSeen = 'no file box on the page'; return null; }
        await inp.setInputFiles(file); const had = new Set(before.text.split('\n').map((l) => l.trim())); let r = before;
        for (let w = 0; w < 27; w++) { await p.waitForTimeout(300); r = await read().catch(() => r); if (r.text !== before.text) { await p.waitForTimeout(700); r = await read().catch(() => r); break; } }
        const changed = r.text.split('\n').filter((l) => l.trim() && !had.has(l.trim())).join('\n');
        if (!changed) answer.lastSeen = 'the page said nothing new 8 s after the picture was put in';
        return changed ? changed + '\n' + r.boxes : null;
      }
      if (spin) { // a wheel: spin it once (a tap at the centre of its largest canvas, where both wheels put their spin), then read what the spin
        // showed: the lines it added, and the entries the page had before it, after a marker, so a check can tell a winner from the wheel's own list
        const before = await read(), cv = p.locator('canvas:visible'), k = await cv.count(); let bb = null, area = 0;
        for (let i = 0; i < k; i++) { const x = await cv.nth(i).boundingBox().catch(() => null); if (x && x.width * x.height > area) { area = x.width * x.height; bb = x; } }
        if (!bb) return null;
        await p.mouse.click(bb.x + bb.width / 2, bb.y + bb.height / 2);
        // a line is new when the page shows it more times than before: the winner's name was already on the page, in the list of names
        const count = (txt) => { const m = new Map(); for (const l of txt.split('\n').map((x) => x.trim()).filter(Boolean)) m.set(l, (m.get(l) || 0) + 1); return m; };
        const had = count(before.text), added = (txt) => { const now = count(txt), out = []; for (const [l, n] of now) for (let i = had.get(l) || 0; i < n; i++) out.push(l); return out.join('\n'); };
        let changed = '';
        for (let w = 0; w < 30; w++) { await p.waitForTimeout(1000); changed = added((await read()).text); if (/winner/i.test(changed) && w >= 2) { await p.waitForTimeout(1500); changed = added((await read()).text); break; } }
        if (!/winner/i.test(changed)) return null; // the gate could not make it spin: not measured, never a loss for the site
        return changed + '\n' + SPUN + '\n' + before.text + '\n' + before.boxes;
      }
      if (timed) { // a stopwatch: started, run for `timed` ms by the gate's own clock, stopped, and read; then read again a moment later, stopped
        // (its Start and Stop buttons, as a person presses them, in the page or any frame in it: online-stopwatch.com keeps its clock in an
        // iframe; else the Space key); what it shows is scored against the gate's own measure of the run, written after a marker (TIMED)
        const all = async () => (await Promise.all(p.frames().map((f) => f.evaluate(() => (document.body ? document.body.innerText : '')).catch(() => '')))).join('\n');
        const before = await all(), had = new Set(before.split('\n').map((l) => l.trim())), fresh0 = (t) => t.split('\n').filter((l) => l.trim() && !had.has(l.trim())).join('\n');
        const find = async (re) => { for (const f of p.frames()) { const b = f.locator('button:visible, input[type=button]:visible, [role=button]:visible, a:visible').filter({ hasText: re }).first(); if (await b.count().catch(() => 0)) return b; } return null; };
        // how it is started: its Start button in any frame; else the Space key; else, for a clock drawn on a canvas that neither moves, a tap
        // where it is drawn. Started means the text or the picture changed; the way that started it stops it
        const shot = () => p.screenshot().catch(() => null), same = (x, y) => !!x && !!y && x.equals(y);
        const centre = async () => { for (const f of p.frames()) { const cv = f.locator('canvas:visible'), k = await cv.count().catch(() => 0); let bb = null, area = 0; for (let i = 0; i < k; i++) { const x = await cv.nth(i).boundingBox().catch(() => null); if (x && x.width * x.height > area) { area = x.width * x.height; bb = x; } } if (bb) return bb; } return null; };
        const ways = [async () => { const btn = await find(/^\s*start\b/i); if (!btn) return null; await btn.click({ timeout: 3000 }); return async () => { const s2 = await find(/^\s*(?:stop|pause)\b/i); if (s2) await s2.click({ timeout: 3000 }); else await btn.click({ timeout: 3000 }); }; },
          async () => { await p.keyboard.press('Space'); return () => p.keyboard.press('Space'); },
          async () => { const bb = await centre(); if (!bb) return null; const at = [bb.x + bb.width / 2, bb.y + bb.height / 2]; await p.mouse.click(...at); return () => p.mouse.click(...at); }];
        answer.lastSeen = await Promise.all(p.frames().map(async (f) => f.url().slice(0, 80) + ' (' + (await f.locator('canvas').count().catch(() => 0)) + ' canvas, ' + (await f.locator('button, [role=button]').count().catch(() => 0)) + ' buttons)')).then((l) => l.join('; '));
        let stop = null, started = 0;
        for (const way of ways) {
          const t = await all(), pic = await shot(), t0 = Date.now(); const st = await way().catch(() => null); if (!st) continue; const t1 = Date.now();
          await p.waitForTimeout(700); if ((await all()) !== t || !same(pic, await shot())) { stop = st; started = (t0 + t1) / 2; break; }
        }
        if (!stop) return null; // nothing the gate did started it: not measured
        await p.waitForTimeout(Math.max(0, timed - (Date.now() - started))); const s0 = Date.now(); await stop(); const stopped = (s0 + Date.now()) / 2;
        await p.waitForTimeout(300); let a = fresh0(await all()); await p.waitForTimeout(1500); let c = fresh0(await all());
        // a clock drawn where text cannot be read: read off the screen (tools/screen-read.mjs), the way a person reads it
        if (!a.trim()) { const { readScreen } = await import('./screen-read.mjs'); a = await readScreen(p); await p.waitForTimeout(800); c = await readScreen(p); answer.read = 'read off the screen'; }
        if (!clockReadings(a).some((r) => r.s > 0)) return null; // no clock that ran: the gate did not start it or cannot read it, never a wrong answer
        return a + '\n' + TIMED + Math.round(stopped - started) + TIMED + '\n' + c;
      }
      if (presses) { // a coin: its own flip control pressed `presses` times, as a person would, and the page read each time it settles (it
        // changed, then held still 0.6 s; at most 4 s, for a page that shows the same side again unchanged); the readings go after a marker
        // each (FLIPPED). No control, or a page whose text never changed, is not measured (a result drawn where text cannot be read): never a loss
        // what it shows: the text of every frame; a coin whose side is only drawn is read off the screen (tools/screen-read.mjs)
        const all = async () => (await Promise.all(p.frames().map((f) => f.evaluate(() => (document.body ? document.body.innerText : '')).catch(() => '')))).join('\n');
        let drawn = false; const look = async () => (drawn ? (await import('./screen-read.mjs')).readScreen(p) : all());
        let last = await look(), moved = 0; const out = [last];
        // finding the control flips the coin once: that press is the first flip, read like the rest
        const press = await flipControl(p); if (!press) { answer.lastSeen = await seenOn(p); return null; }
        for (let i = 0; i < presses; i++) {
          if (i > 0 || drawn) await press(); const t0 = Date.now(); let now = last, quiet = t0;
          for (;;) { await p.waitForTimeout(drawn ? 700 : 150); const x = await look(); if (x !== now) { now = x; quiet = Date.now(); } if ((now !== last && Date.now() - quiet >= 600) || Date.now() - t0 > 4000) break; }
          if (now !== last) moved++; last = now; out.push(now);
          if (i === 1 && !moved) { if (drawn) { answer.lastSeen = 'its side could not be read off the screen either; ' + await seenOn(p); return null; } drawn = true; last = await look(); out.length = 0; out.push(last); i = -1; } // the text never changed: read the screen instead, from the start
        }
        return moved ? out.join('\n' + FLIPPED + '\n') : null;
      }
      if (!type) { // a page that answers after a network call (the weather, a translation): read once its text has stopped changing, up to 12 s more
        // (weather was read at 3 s with "Looking…" on it and scored 1 of 5 for an answer that landed a moment later)
        // a page that says it is busy (aria-busy="true" while it waits on a network call, as /weather/ does) is given up to 20 s to finish: a
        // page waiting with the same words on it reads as settled otherwise
        await p.waitForFunction(() => !document.querySelector('[aria-busy="true"]'), null, { timeout: 20000 }).catch(() => {});
        let r = await read(), t0 = Date.now();
        for (;;) { await p.waitForTimeout(800); const n = await read().catch(() => r); const same = n.text === r.text; r = n; if (same || Date.now() - t0 > 12000) break; }
        return r.text + '\n' + r.boxes; }
      // a cookie or consent wall in front of the page is accepted first, as a person does, so the typing and the press below land on the page
      const wall = p.locator('button:visible, [role=button]:visible, a:visible').filter({ hasText: /^\s*(?:accept(?: all)?(?: cookies)?|i agree|agree(?: and continue)?|allow all|got it|ok(?:ay)?|consent|continue)\s*[!.]?\s*$/i }).first();
      if (await wall.count().catch(() => 0)) { await wall.click({ timeout: 2000 }).catch(() => {}); await p.waitForTimeout(500); }
      // what the page offers, for the evidence when the gate gets no answer out of it: its boxes (a text area that cannot be typed into is
      // marked), what the gate pressed and what came of it
      const boxesSeen = () => p.evaluate(() => [...document.querySelectorAll('textarea, input:not([type=hidden])')].filter((e) => e.offsetParent).map((e) => e.tagName.toLowerCase() + (e.id ? '#' + e.id : e.name ? '[name=' + e.name + ']' : '') + (e.readOnly || e.disabled ? ' (read only)' : '') + (e.value ? ' holding ' + e.value.length + ' chars' : ' empty')).slice(0, 8).join(', ')).catch(() => 'no boxes read');
      let pressed = 'nothing pressed'; answer.lastSeen = 'loaded ' + p.url().slice(0, 60) + '; boxes: ' + await boxesSeen();
      // the box a person types into: the page's largest visible text area that takes typing (an encoder's output box is read only, whatever its
      // size), else its first visible text input (unitconverters.net's "From")
      const areas = p.locator('textarea:visible:not([readonly]):not([disabled])'), n = await areas.count(); let box = null, best = -1;
      for (let i = 0; i < n; i++) { const bb = await areas.nth(i).boundingBox().catch(() => null); const a = bb ? bb.width * bb.height : 0; if (a > best) { best = a; box = areas.nth(i); } }
      if (!box) box = p.locator('input:visible:not([type]), input:visible[type=text], input:visible[type=search], input:visible[type=number], input:visible[type=password]').first();
      const before0 = await read(), before = before0.text;
      try { await box.fill(type, { timeout: 8000 }); } catch (e) { answer.lastSeen += '; no box took the typing (' + String(e && e.message || e).split('\n')[0].slice(0, 80) + ')'; return null; }
      if (best < 0) await box.press('Enter').catch(() => {}); // Enter in a text area would add a line to what is counted
      // the control a person presses, named for the job: a button first (a submit's value counts as its name), a link only when no button is
      // (base64encode.org's header links to its decoder, which must not be the press), else the first submit
      const named = /convert|calculate|encode|count|submit|go\b/i, btns = p.locator('button:visible, input[type=submit]:visible, input[type=button]:visible, [role=button]:visible');
      let go = btns.filter({ hasText: named }).first();
      if (!(await go.count().catch(() => 0))) go = p.locator('input[type=submit]:visible[value*="convert" i], input[type=submit]:visible[value*="encode" i], input[type=button]:visible[value*="convert" i], input[type=button]:visible[value*="encode" i]').first();
      // never a link, whatever it says: one leads to another page (Verse's own "Count the words of the text" hand-off under the encoder, a
      // "#" link that sets its address when pressed, carried the gate to the word counter), and a site whose only control is a link is reported
      // as nothing pressed, for the next skill to be made from what the gate saw
      if (!(await go.count().catch(() => 0))) go = p.locator('input[type=submit]:visible').first();
      if (await go.count().catch(() => 0)) { const label = (await go.evaluate((e) => (e.value || e.textContent || e.getAttribute('aria-label') || '').trim().slice(0, 30)).catch(() => '?'));
        const why = (e) => { const ls = String(e && e.message || e).split('\n').map((l) => l.trim()); return (ls.find((l) => /intercepts pointer|not visible|detached|outside of the viewport|not enabled|not stable/i.test(l)) || ls.find((l) => /timeout/i.test(l)) || 'it did not take the press').slice(0, 120); };
        // a button the pointer cannot reach within 3 s (a banner or an ad over it: base64encode.org's ENCODE, 2026-10-25) is pressed the way a
        // person on a keyboard presses it, focused and Enter, which reaches it under anything
        try { await go.click({ timeout: 3000 }); pressed = 'pressed "' + label + '"'; } catch (e) {
          try { await go.focus({ timeout: 2000 }); await p.keyboard.press('Enter'); pressed = 'pressed "' + label + '" with Enter after the pointer could not (' + why(e) + ')'; } catch (e2) { pressed = 'could not press "' + label + '" (' + why(e) + ')'; } } }
      // the answer lands when the site has done the work: a script at once, a round trip to its server, or a whole new page (a form posted). A
      // boxed answer is read as soon as its box fills, up to 8 s; an answer in the text gets 2 s, as before (a read during a page change fails,
      // and the last reading stands until the next)
      const filled = (x) => x.boxes.split(type).join('').trim() !== before0.boxes.trim();
      const t0 = Date.now(); let r = await read().catch(() => before0);
      for (;;) { const dt = Date.now() - t0; if ((inBox ? filled(r) : dt >= 2000) || dt >= 8000) break; await p.waitForTimeout(300); r = await read().catch(() => r); }
      if (inBox && filled(r)) { await p.waitForTimeout(500); r = await read().catch(() => r); } // a moment more, for a box still being written
      // scored on what typing changed and what the boxes hold, never on text the page had before (unitconverters.net's definitions mention 212°F);
      // what was typed is taken out, so the question never counts as its own answer
      const had = new Set(before.split('\n').map((l) => l.trim()));
      // a site whose answer goes in a box (an encoder's output): a box that never filled means the gate got no answer out of it, which is
      // not measured, never a loss for the site (base64encode.org was once scored 0 that way); what the gate saw goes in the evidence
      if (inBox && !filled(r)) { answer.lastSeen = 'typed into the largest text area, ' + pressed + ', waited 8 s; now at ' + p.url().slice(0, 60) + '; boxes: ' + await boxesSeen(); return null; }
      const changed = r.text.split('\n').filter((l) => l.trim() && !had.has(l.trim())).join('\n');
      return (changed + '\n' + r.boxes).split(type).join(' '); } catch (e) { answer.lastSeen = (answer.lastSeen || 'the page did not load') + '; then: ' + String(e && e.message || e).split('\n')[0].slice(0, 80); return null; } finally { await ctx.close(); } }

/** a generated picture on a page (tower-probes.mjs pageParts with img: the floor's 'image generation'): the gate opens the address as a phone
 *  does and waits up to `within` ms for a real picture the page made, an <img> whose source is a data:, blob: or r2 address (or this site's own
 *  /api/ or /r2/ path) and that has really loaded (naturalWidth > 0). A picture button, a placeholder or a "resting" message is not one.
 *  Returns a score ({ n, of: 1, has, missing }) whose missing label says what the page showed instead. Exported for tools/tower-gate.test.mjs. */
export const MADE_SRC = /^(?:data:image\/|blob:|https:\/\/[^/]*r2\.(?:dev|cloudflarestorage\.com)\/|\/(?:api|r2)\/)/;
export async function pictureOf(b, url, within = 60000, sel = 'img') { // sel: where the made picture must appear (a page's results, never its gallery)
  if (noRivalUrl(url)) throw new Error('the gate never opens ' + hostOf(url) + ': its robots.txt asks robots to stay away');
  const ctx = await b.newContext({ viewport: { width: 390, height: 800 }, userAgent: UA, locale: 'en-US' });
  try {
    const p = await ctx.newPage(); await p.goto(url, { waitUntil: 'load', timeout: 30000 });
    const ok = await p.waitForFunction(([src, q]) => [...document.querySelectorAll(q)].some((im) => im.tagName === 'IMG' && new RegExp(src).test(im.getAttribute('src') || '') && im.complete && im.naturalWidth > 0), [MADE_SRC.source, sel], { timeout: within, polling: 500 }).then(() => true).catch(() => false);
    if (ok) return { n: 1, of: 1, has: ['a generated picture within ' + Math.round(within / 1000) + ' s'], missing: [] };
    const said = await p.evaluate(() => { const live = [...document.querySelectorAll('[role=status], [role=alert], [aria-live]')].map((e) => e.innerText.trim()).filter(Boolean).join(' · '); return (live || (document.querySelector('main') || document.body).innerText).replace(/\s+/g, ' ').slice(0, 160); }).catch(() => ''); // what the page says about it (its status lines first)
    return { n: 0, of: 1, has: [], missing: ['a generated picture within ' + Math.round(within / 1000) + ' s (the page showed: "' + said + '")'] };
  } catch (e) { return { n: 0, of: 1, has: [], missing: ['a generated picture (the page did not load: ' + String(e && e.message || e).split('\n')[0].slice(0, 60) + ')'] }; } finally { await ctx.close(); }
}

export function measurable(f) {
  const p = probeFor(f.id), want = aspectsOf(f);
  return want.filter((a) => (MEASURES[a] && !['accuracy', 'completeness'].includes(a)) || (a === 'accuracy' && p && p.truth) || (a === 'completeness' && p && p.facts && p.facts.length) || (p && p.parts && p.parts[a]) || (p && p.askParts && p.askParts[a]) || (p && p.pageParts && p.pageParts[a]) || (p && p.motion && p.motion[a]));
}
/** the ids to measure: { current, changed, stale } in that order, no repeats, only floors in GATE_FLOORS (a frontier site with no page in LANE_PAGES has no Verse page yet), at most max. Pure. */
export function pick(evidence = {}, frontier = null, changed = [], max = 3, rank = null, size = null, target = null) {
  const t = tower([], evidence, frontier, null, rank, size, target), ids = new Set(GATE_FLOORS.map((f) => f.id)), out = [];
  const add = (id) => { if (id && ids.has(id) && !out.includes(id) && out.length < max) out.push(id); };
  add((t.floors.find((f) => f.state === 'current' && ids.has(f.id)) || t.floors.find((f) => !f.beaten && ids.has(f.id)) || {}).id);
  // a floor whose own page the deploy changed: /color/ for void-live-deploy/color/index.html; its probe's page counts too
  const dir = (u) => { const m = String(u || '').match(/^\/([\w-]+)\//); return m ? m[1] : ''; };
  // every floor that stands on a changed page, not only the current fight (2026-10-25: a /color/ offline fix re-measured one colour floor and left
  // hexcolor16.com, on the same page, with a reading from before it), the unbeaten first, at most 10; and when the service worker changed, every
  // unbeaten floor whose last offline reading is not a win
  const OKV = new Set(['better', 'equal-and-better']), room = Math.max(max, 10), addMore = (id) => { if (id && ids.has(id) && !out.includes(id) && out.length < room) out.push(id); };
  const onPage = GATE_FLOORS.filter((f) => { const d = dir((probeFor(f.id) || {}).verse) || dir(f.page); return d && changed.some((c) => c.startsWith('void-live-deploy/' + d + '/')); });
  const beatenOf = (id) => { const g = t.floors.find((x) => x.id === id); return !!(g && g.beaten); };
  for (const f of onPage.filter((f) => !beatenOf(f.id)).concat(onPage.filter((f) => beatenOf(f.id)))) addMore(f.id);
  if (changed.includes('void-live-deploy/sw.js')) for (const f of t.floors) if (ids.has(f.id) && !f.beaten && !OKV.has(((evidence[f.id] || {}).offline || {}).verdict)) addMore(f.id);
  for (const f of t.floors) if (ids.has(f.id) && !f.beaten) { const rows = evidence[f.id] || {}; if (measurable(GATE_FLOORS.find((x) => x.id === f.id)).some((a) => !rows[a])) add(f.id); }
  return out;
}

/** the file extension for an icon's content type, '' for anything that is not a small web image. Pure. */
export const iconExt = (type) => { const t = String(type || '').toLowerCase().split(';')[0].trim(); return ({ 'image/png': 'png', 'image/jpeg': 'jpg', 'image/webp': 'webp', 'image/gif': 'gif', 'image/svg+xml': 'svg', 'image/x-icon': 'ico', 'image/vnd.microsoft.icon': 'ico', 'image/avif': 'avif' })[t] || ''; };
/** the site's own icon (owner, 2026-10-25: "should be the sites logos not whatever this is"): the largest icon the page links, else /favicon.ico,
 *  fetched once by the gate from the page's own origin; { ext, bytes } or null when the site has none or it is not a small image (under 80 KB). */
async function iconOf(p) {
  const href = await p.evaluate(() => { const n = (l) => { const m = String(l.getAttribute('sizes') || '').match(/(\d+)x/); return m ? +m[1] : (/apple-touch/.test(l.rel) ? 180 : 16); };
    const ls = [...document.querySelectorAll('link[rel~="icon"], link[rel="apple-touch-icon"], link[rel="apple-touch-icon-precomposed"]')].filter((l) => l.href && !/\.svg(?:$|\?)/i.test(l.href)).sort((a, b) => n(b) - n(a));
    return (ls[0] && ls[0].href) || new URL('/favicon.ico', location.href).href; }).catch(() => null);
  if (!href) return null;
  const r = await p.request.get(href, { timeout: 8000, maxRedirects: 3 }).catch(() => null); if (!r || !r.ok()) return null;
  const ext = iconExt(r.headers()['content-type']); if (!ext || ext === 'svg') return null;
  const bytes = await r.body().catch(() => null); if (!bytes || bytes.length < 60 || bytes.length > 80000) return null;
  return { ext, bytes };
}
/** the live page a floor is measured against: a lane site is measured at its own address (its lane's probe carries the LEADER's site, so a lane
 *  site read through probe.site was every rival measured as the leader's page: notes lane, 2026-10-25, eleven identical screenshots); any other floor takes its probe's site. Pure. */
export const siteOf = (f, probe) => (f.lane ? f.url : probe && probe.site ? probe.site : f.url);
/** one floor measured against its live site in its own browser, its rows written into data.floors[f.id] (the stored rows are read for `was`) */
const FLOOR_MS = Number(process.env.TOWER_FLOOR_MS) || 6 * 60000;
async function measureFloor(f, data) {
  const { chromium } = await import('playwright-core');
  const b = await chromium.launch({ executablePath: process.env.CHROME_PATH || '/usr/bin/google-chrome', args: ['--no-sandbox'] });
  const slug = f.id.replace(/\W+/g, '-'), at = new Date().toISOString(), probe = probeFor(f.id), want = new Set(aspectsOf(f));
  // a floor with Verse's own page for the job (/is-it/christmas, /flip/) is measured there, as a person would open it; others through the ask
  const versePage = probe && probe.verse ? probe.verse : f.page, siteUrl = siteOf(f, probe);
  // a site whose robots.txt asks robots to stay away (noRival, owner 2026-10-28) is never opened: no loads, no icon, no wider-use look
  const noRival = noRivalOf(f);
  const v = await measure(b, versePage ? new URL(versePage, VERSE).href : VERSE + '?q=' + encodeURIComponent(f.ask), slug + '-verse', versePage ? null : f.ask, probe), s = noRival ? { reliability: 0, notOpened: true } : await measure(b, siteUrl, slug + '-site', null, probe, { noShot: noShotOf(f) });
  // the site's icon, kept beside its screenshot and named in the evidence file's icons map (a sweep slice keeps the file but not the map entry: the next fight run restores it)
  // a rival page that is a bot wall or a sign-in wall (owner's standards, 2026-10-28: Amazon read as "0 of 23" behind one) was never read: the
  // gate treats it as unreachable, so nothing is won against what was behind it
  const walled = !!(s && s.reliability && wallOf(s.text));
  if (walled) s.reliability = 0;
  const siteRead = !!(s && s.reliability);
  if (s && s.icon) { try { const host = hostOf(f.url) || hostOf(f.site), dir = path.join(root, 'void-live-deploy', 'tower.icons'), name = host + '.' + s.icon.ext; fs.mkdirSync(dir, { recursive: true }); fs.writeFileSync(path.join(dir, name), s.icon.bytes); data.icons = { ...(data.icons || {}), [host]: 'tower.icons/' + name }; } catch (_) {} }
  // the same question put to both at addresses made for it (tower-probes.mjs `ask`: random.org answers on another page than its form): accuracy is
  // scored on those answers instead of the pages above; an answer written into a box (a converter's output field) counts as shown
  let shown = ''; // what Verse's page showed for the question, for the evidence when a case is missed
  if (probe && probe.ask && probe.truth) {
    // `type`: a site whose address cannot carry the question gets it typed into its first visible text box, as a person would (then Enter and
    // its Convert button, if it has one); the box keeps what was typed, so the typed text is taken out of what is read before scoring
    // accuracy is Verse against the truth worked out in tower-probes.mjs, never a race with the site (owner, 2026-10-25: "we dont have to test rival";
    // "each site should only take minutes to surpass"): the site's own answer is not fetched, so a site the gate cannot drive never holds a floor open
    // `verseType`: a question Verse's page takes typed into its box, never in its address (a password: /password-strength/ keeps it out of every link)
    // `verseFile`: a page that answers once a picture is put in gets the gate's own one-pixel PNG (PIXEL), as a person chooses a photo
    const vt = await answer(b, new URL(probe.ask.verse, VERSE).href, probe.ask.verseType || null, probe.ask.spin, false, probe.ask.time, probe.ask.presses, probe.ask.verseFile ? PIXEL : null), st = null;
    v.truth = vt === null ? null : score(vt, probe.truth); shown = vt == null ? 'nothing (the page could not be read)' : String(vt).replace(/\s+/g, ' ').trim().slice(0, 200);
    // a floor's own aspects asked as a question (tower-probes.mjs askParts: 'huge numbers', 'crack time') are read off the same answer and judged on
    // Verse alone, like accuracy
    for (const [a, items] of Object.entries(probe.askParts || {})) if (vt !== null) { v.parts = { ...(v.parts || {}), [a]: score(vt, items) }; if (st !== null) s.parts = { ...(s.parts || {}), [a]: score(st, items) }; }
  }
  // a floor's aspects asked at addresses of their own (tower-probes.mjs pageParts: the list language at the editor with a generator in its link,
  // a generated picture on the image page): judged on Verse alone, like askParts
  for (const [a, pp] of Object.entries((probe && probe.pageParts) || {})) {
    if (!want.has(a)) continue;
    const url = new URL(pp.verse, VERSE).href;
    if (pp.img) v.parts = { ...(v.parts || {}), [a]: await pictureOf(b, url, pp.within || 60000, pp.sel || 'img') };
    else { const got = await answer(b, url, null); if (got !== null) v.parts = { ...(v.parts || {}), [a]: score(got, pp.items) }; }
  }
  // wider use (owner, 2026-10-28: a Verse version of a page should be usable by more people than the original): the 11 points of
  // docs/WIDER-USE.md, scored by tools/wider-use.mjs on both pages; a site the gate cannot read is held to the full 11
  if (want.has('wider use')) { const { look, scoreOf } = await import('./wider-use.mjs'), wide = (u) => look(b, u).then((m) => scoreOf(m).total).catch(() => null);
    v.wide = await wide(versePage ? new URL(versePage, VERSE).href : VERSE + '?q=' + encodeURIComponent(f.ask)); s.wide = s.reliability ? await wide(siteUrl) : null; }
  await b.close(); await (await import('./screen-read.mjs')).closeEyes(); // the OCR worker holds the process open until it is closed
  const ev = (data.floors[f.id] = data.floors[f.id] || {});
  const where = 'Verse' + (versePage ? ' (' + versePage + ')' : '');
  // speed has a bar of its own (owner, 2026-10-25: Verse's own bar, the site's number is context): a page at its load event under SPEED_BAR ms is as
  // fast as a page needs to be, so it passes whatever the site's time; above the bar the two are compared as before
  const put = (aspect, a, c, unit, extra = {}) => { if (!want.has(aspect)) return; const m = MEASURES[aspect] || PART, ideal = m.ideal !== undefined ? m.ideal : extra.of;
    const v = aspect === 'speed' && Number.isFinite(a) && a <= SPEED_BAR ? 'equal-and-better' : verdict(a, c, m.hi, ideal), note = aspect === 'speed' && v === 'equal-and-better' && a > c ? ' (under the ' + SPEED_BAR + ' ms bar: as fast as a page needs to be; the site\'s time is context)' : '';
    ev[aspect] = { ...record(ev[aspect], v, a, c, where + ' ' + a + unit + ' vs ' + f.site + ' ' + c + unit + (extra.note || '') + note, at), ...(extra.of ? { of: extra.of } : {}), ...(MEASURES[aspect] ? {} : { part: true }), ...(siteRead ? { siteRead: true } : {}) };
    if (!siteRead && ev[aspect]) delete ev[aspect].siteRead; };
  // a site that answered none of the loads turned the gate away. That no longer holds a floor (owner, 2026-10-25: "we shouldnt be stopped by our
  // own standards"; "no need to test the competition"): Verse is judged against the best score there is for each aspect (MEASURES ideal) and a
  // 200 ms bar for speed (the owner's own bar, 2026-10-25), the evidence saying so; the site's reliability row keeps what the gate saw
  if (!s.reliability) {
    // a site that answers none of its loads is behind on reliability, by the numbers (3 of 3 against 0 of 3): the row is a verdict, not a blank
    // a site never opened (noRival) is not called down: Verse's own loads are held to all 3 of 3, the bar, and the evidence says the site was not opened and why
    if (noRival) ev.reliability = { ...record(ev.reliability, verdict(v.reliability, 3, true, 3), v.reliability, 3, where + ' ' + v.reliability + ' of 3 loads answered vs the bar 3 of 3 (' + f.site + ' not opened: ' + noRival + '; judged on internal metrics)', at) };
    // the standards (owner, 2026-10-28): a blocked check is INCOMPLETE, never a pass, so the site's reliability is not "won" against a wall
    else ev.reliability = { verdict: 'incomplete', incomplete: true, verse: v.reliability, best: null, evidence: where + ' ' + v.reliability + ' of 3 loads answered; ' + f.site + (walled ? ' showed a bot or sign-in wall' : ' turned the gate away or did not answer') + ', so its reliability was never measured (INCOMPLETE, not a pass); the other aspects are judged against the best score there is', at };
    const bar = { speed: 200, mobile: 0, a11y: 0, offline: 1, sharing: 4, german: 1 }, site = f.site;
    f = { ...f, site: 'the bar (' + site + (noRival ? ' not opened: ' + noRival : ' unreachable') + ')' };
    put('speed', v.speed, bar.speed, ' ms to the load event (median of 3, phone width)');
    put('mobile', v.mobile, bar.mobile, ' px sideways overflow at 390 px');
    put('accessibility', v.a11y, bar.a11y, ' unnamed controls or images');
    put('offline', v.offline, bar.offline, ' (1: the page shows itself again with the network cut)');
    put('sharing', v.sharing, bar.sharing, ' of 4 (link-preview title, image, description; a share or copy-link control)');
    put('local language', v.german, bar.german, ' (1: a German browser gets German)');
    if (v.design) put('design polish', defects(v.design), 0, ' design defects');
    if (Number.isFinite(v.wide)) put('wider use', v.wide, 11, ' of 11 wider-use points (docs/WIDER-USE.md)');
    if (want.has('accuracy') && v.truth) ev.accuracy = { ...record(ev.accuracy, v.truth.n === v.truth.of ? 'equal-and-better' : 'worse', v.truth.n, v.truth.of, where + ' ' + v.truth.n + ' of ' + v.truth.of + ' right against the worked-out answer; judged against the standard', at), of: v.truth.of };
    if (v.facts) put('completeness', v.facts.n, v.facts.of, ' of ' + v.facts.of + ' things a full answer shows', { of: v.facts.of, note: ' (Verse lacks: ' + (v.facts.missing.join(', ') || 'none') + ')' });
    for (const [a, sv] of Object.entries(v.parts || {})) put(a, sv.n, sv.of, ' of ' + sv.of + ' shown', { of: sv.of, note: ' (Verse lacks: ' + (sv.missing.join(', ') || 'none') + ')' });
  } else {
    put('speed', v.speed, s.speed, ' ms to the load event (median of 3, phone width)');
    put('reliability', v.reliability, s.reliability, ' of 3 loads answered');
    put('mobile', v.mobile, s.mobile, ' px sideways overflow at 390 px');
    put('accessibility', v.a11y, s.a11y, ' unnamed controls or images');
    put('offline', v.offline, s.offline, ' (1: the page shows itself again with the network cut)');
    put('sharing', v.sharing, s.sharing, ' of 4 (link-preview title, image, description; a share or copy-link control)');
    put('local language', v.german, s.german, ' (1: a German browser gets German)');
    put('big answer', v.big, s.big, ' px, the largest text on the first screen');
    if (Number.isFinite(v.wide)) put('wider use', v.wide, Number.isFinite(s.wide) ? s.wide : 11, ' of 11 wider-use points (docs/WIDER-USE.md)', Number.isFinite(s.wide) ? {} : { note: ' (the site could not be read: held to the full 11)' });
    // every case right against the truth is the most any page can score: equal-and-better; a case missed is worse
    if (want.has('accuracy') && v.truth) ev.accuracy = { ...record(ev.accuracy, v.truth.n === v.truth.of ? 'equal-and-better' : 'worse', v.truth.n, v.truth.of, where + ' ' + v.truth.n + ' of ' + v.truth.of + ' right against the worked-out answer' + (v.truth.missing.length ? ' (missed: ' + v.truth.missing.join(', ') + ')' : '') + '; judged against the standard, not ' + f.site + ' (the site is not asked)' + (v.truth.n < v.truth.of ? '. The page showed: "' + shown + '"' : ''), at), of: v.truth.of };
    const dd = (l) => (l ? ' (' + l.contrast + ' low-contrast texts, ' + l.targets + ' small tap targets, layout shift ' + l.cls.toFixed(2) + ')' : '');
    if (v.design && s.design) put('design polish', defects(v.design), defects(s.design), ' design defects', { note: ': Verse' + dd(v.design) + ', ' + f.site + dd(s.design) });
    // a moving part the gate cannot see on the site is judged on Verse alone, like accuracy: every frame seen is the most a page can show
    for (const a of Object.keys((probe && probe.motion) || {})) if (want.has(a) && v.parts && v.parts[a] && !(s.parts && s.parts[a])) ev[a] = { ...record(ev[a], v.parts[a].n === v.parts[a].of ? 'equal-and-better' : 'worse', v.parts[a].n, v.parts[a].of, where + ' ' + v.parts[a].n + ' of ' + v.parts[a].of + ' seen; judged on Verse alone, the site is not driven', at), part: true };
    for (const [a, sv] of Object.entries(v.parts || {})) { const ss = s.parts && s.parts[a]; if (ss) put(a, sv.n, ss.n, ' of ' + sv.of + ' shown', { of: sv.of, note: ' (Verse lacks: ' + (sv.missing.join(', ') || 'none') + '; site lacks: ' + (ss.missing.join(', ') || 'none') + ')' });
      // an aspect read off the typed answer (askParts) with the site not asked: judged on Verse alone, every item shown is the most a page can show
      else if (want.has(a) && probe && ((probe.askParts && probe.askParts[a]) || (probe.pageParts && probe.pageParts[a]))) ev[a] = { ...record(ev[a], sv.n === sv.of ? 'equal-and-better' : 'worse', sv.n, sv.of, where + ' ' + sv.n + ' of ' + sv.of + ' shown for the question' + (sv.missing.length ? ' (Verse lacks: ' + sv.missing.join(', ') + ')' : '') + '; judged on Verse alone, the site is not asked', at), of: sv.of, part: true }; }
    if (v.facts && s.facts) put('completeness', v.facts.n, s.facts.n, ' of ' + v.facts.of + ' things a full answer shows', { of: v.facts.of, note: ' (Verse lacks: ' + (v.facts.missing.join(', ') || 'none') + '; site lacks: ' + (s.facts.missing.join(', ') || 'none') + ')' });
  }
  // no automatic calls (owner, 2026-10-24): a floor falls only when a person judges Verse really better than the site, never because an answer came back.
  // Rows the old gate called by itself ("called beaten by verse") are dropped on every run, in every floor: runs in flight when that was taken back
  // pushed them in again, and a later run only re-measures four aspects (the sweep's merge drops them too, tools/tower-merge.mjs)
  for (const rows of Object.values(data.floors)) for (const [k, r] of Object.entries(rows || {})) if (selfCalled(r)) delete rows[k];
  for (const [k, r] of Object.entries(ev)) console.log(k.padEnd(14) + r.verdict.padEnd(11) + r.evidence);
  return ev;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const argv = process.argv.slice(2), read = () => JSON.parse(fs.readFileSync(FILE, 'utf8')), write = (file, data) => fs.writeFileSync(file, JSON.stringify(data, null, 1) + '\n');
  // --which [changed file ...]: print the floors a post-deploy run measures, one per line (.github/workflows/tower-gate.yml)
  if (argv[0] === '--which') {
    const data = read(), fr = (() => { try { return JSON.parse(fs.readFileSync(path.join(root, 'void-live-deploy', 'tower.frontier.json'), 'utf8')); } catch (_) { return null; } })();
    for (const id of pick(data.floors || {}, fr, argv.slice(1), 3, (() => { try { return JSON.parse(fs.readFileSync(path.join(root, 'void-live-deploy', 'tower.rank.json'), 'utf8')); } catch (_) { return null; } })(), (() => { try { return JSON.parse(fs.readFileSync(path.join(root, 'void-live-deploy', 'tower.size.json'), 'utf8')); } catch (_) { return null; } })(), (() => { try { return JSON.parse(fs.readFileSync(path.join(root, 'void-live-deploy', 'tower.target.json'), 'utf8')).id || null; } catch (_) { return null; } })())) console.log(id);
    process.exit(0);
  }
  // --merge <slice file ...>: the sweep's slices folded into the evidence file, a newer row over an older one only (tools/tower-merge.mjs); no site loaded
  if (argv[0] === '--merge') {
    const slices = argv.slice(1).map((p) => { try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch (e) { console.log('::warning::' + p + ' not read: ' + e.message); return null; } }).filter(Boolean);
    const { data, taken } = merge(read(), slices);
    write(FILE, data);
    console.log(slices.length + ' slice' + (slices.length === 1 ? '' : 's') + ' (' + slices.map((s) => s.shard || '?').join(', ') + '), ' + taken.length + ' rows taken' + (taken.length ? ': ' + taken.join(', ') : ''));
    process.exit(0);
  }
  // the floors: one id (the words after the flags), --floors a,b,c, or --shard i/N (slice i of N of every floor, in FLOORS order)
  const opt = {}, words = [];
  for (let i = 0; i < argv.length; i++) { const a = argv[i]; if (['--shard', '--floors', '--out'].includes(a)) opt[a.slice(2)] = argv[++i] || ''; else if (['--rescore', '--list'].includes(a)) opt[a.slice(2)] = true; else words.push(a); }
  const sh = opt.shard !== undefined ? parseShard(opt.shard) : null;
  if (opt.shard !== undefined && !(sh && sh.i >= 1 && sh.i <= sh.n)) { console.error('--shard wants i/N with 1 <= i <= N, e.g. --shard 2/6; got ' + opt.shard); process.exit(2); }
  const ids = sh ? shard(GATE_FLOORS.map((x) => x.id), sh.i, sh.n) : opt.floors !== undefined ? opt.floors.split(',').map((s) => s.trim()).filter(Boolean) : [words.join(' ')];
  const floors = ids.map((id) => GATE_FLOORS.find((x) => x.id === id) || id), unknown = floors.filter((x) => typeof x === 'string');
  if (unknown.length || !floors.length) { console.error('no floor ' + (unknown.join(', ') || '(none given)') + '; floors: ' + GATE_FLOORS.map((x) => x.id).join(', ')); process.exit(2); }
  if (opt.list) { for (const f of floors) console.log(f.id); process.exit(0); } // the selection alone, nothing loaded
  if (opt.rescore) { // --rescore: today's rule on the stored numbers, no site loaded (a rule change, not a new measurement)
    const data = read(); for (const f of floors) { data.floors[f.id] = rescore(data.floors[f.id]); for (const [k, r] of Object.entries(data.floors[f.id])) console.log((floors.length > 1 ? f.id + ': ' : '') + k.padEnd(26) + r.verdict); }
    write(FILE, data);
    process.exit(0);
  }
  // a slice (--shard, or --out) goes to its own file holding only the floors it measured, for the sweep's merge job; anything else is written
  // into the evidence file after every floor, so a run cut short keeps what it had. Either way the stored rows are read first, for `was`
  const out = opt.out || (sh ? path.join(root, 'void-live-deploy', 'tower.evidence.' + sh.i + '.json') : null), data = read(), done = {};
  let failed = 0;
  for (const f of floors) {
    console.log((out ? 'slice ' + (sh ? sh.i + '/' + sh.n : path.basename(out)) + ', ' : '') + 'measuring ' + f.id + (floors.length > 1 ? ' (' + (floors.indexOf(f) + 1) + ' of ' + floors.length + ')' : ''));
    // a floor gets FLOOR_MS at most: one page that never answers an evaluate once held a fight run for 50 minutes until the next deploy
    // cancelled it, and the verdicts it had already measured (coin flip, 2026-10-25 01:30) were never committed
    let timer; const stop = new Promise((_, no) => { timer = setTimeout(() => no(new Error('took more than ' + Math.round(FLOOR_MS / 1000) + ' s: stopped')), FLOOR_MS); });
    try { done[f.id] = await Promise.race([measureFloor(f, data), stop]); } catch (e) { failed++; console.log('::warning::' + f.id + ' not measured: ' + (e && e.message || e)); continue; } finally { clearTimeout(timer); }
    if (!out) write(FILE, data);
  }
  if (out) write(out, { note: 'one slice of the tower gate\'s sweep (tools/tower-merge.mjs): folded into tower.evidence.json by the merge job, never committed itself', shard: sh ? sh.i + '/' + sh.n : 'floors', at: new Date().toISOString(), floors: done });
  if (failed) console.log(failed + ' of ' + floors.length + ' floors not measured');
  process.exit(failed && failed === floors.length ? 1 : 0);
}
