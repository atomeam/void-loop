// The tower's head-to-head gate (lib/tower.js): Verse against the real, live site of one floor, aspect by aspect, with evidence.
// Measured automatically: speed (time to the page's load event, median of 3), mobile (sideways overflow at phone width), accessibility
// (buttons and links with no name, images with no text), reliability (3 loads, how many answered), offline (the page reloaded with the
// network cut still shows itself), sharing (link-preview tags and a share or copy-link control), local language (the page opened by a German
// browser speaks German), big answer (the largest text on the first screen), and, where tools/tower-probes.mjs has a probe, accuracy (the
// same question to both, against an answer worked out independently) and completeness (what the best sites in the category show).
// design polish and anything without a check stay unverified, so they never count as beaten. A site the gate cannot load is a fault in the
// gate, not a win for the site (owner, 2026-10-24: "fix the gate/runner to measure it properly"): the browser presents as an ordinary
// Chrome, speed is the load event (an ad-filled page may never go quiet on the network), and a site that still answers none of the loads
// is reported as unmeasured. Screenshots go to a private folder outside the repo (TOWER_PRIVATE, default /workspace/tower-private); the
// public file keeps verdicts and numbers only. A verdict that was a pass and is now worse keeps `was`, so the floor un-beats and says it
// regressed. Passive: page loads only, no sign-in, no forms, no posting.
//   node tools/tower-gate.mjs <floor id>     e.g. calculator; writes void-live-deploy/tower.evidence.json
import fs from 'node:fs'; import path from 'node:path'; import { fileURLToPath } from 'node:url';
import { FLOORS, aspectsOf } from '../void-live-deploy/lib/tower.js';
import { probeFor, score } from './tower-probes.mjs';
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
  offline: { hi: true, ideal: 1 }, sharing: { hi: true, ideal: 4 }, 'local language': { hi: true, ideal: 1 }, 'big answer': { hi: true }, accuracy: { hi: true }, completeness: { hi: true } });
/** stored measured rows scored again by today's rule, numbers unchanged (no site is loaded). Pure. */
export function rescore(rows = {}) {
  const out = { ...rows };
  for (const [a, m] of Object.entries(MEASURES)) { const r = rows[a]; if (r && Number.isFinite(r.verse) && Number.isFinite(r.best)) out[a] = { ...r, verdict: verdict(r.verse, r.best, m.hi, m.ideal !== undefined ? m.ideal : r.of) }; }
  return out;
}
/** the stored row, keeping what a pass was when it is now worse (a regression un-beats the floor). Pure. */
export function record(prev, v, verse, best, evidence, at) {
  const ok = (x) => x === 'better' || x === 'equal-and-better';
  return { verdict: v, verse, best, evidence, at, ...(v === 'worse' && prev && (ok(prev.verdict) || prev.was) ? { was: prev.was || prev.verdict } : {}) };
}

export async function measure(browser, url, tag, ask, probe) {
  const times = [], ok = []; const out = { mobile: null, a11y: null, skill: null, offline: null, sharing: null, big: null, text: '' };
  const ctx = await browser.newContext({ viewport: { width: 390, height: 800 }, userAgent: UA, locale: 'en-US', extraHTTPHeaders: { 'accept-language': 'en-US,en;q=0.9' } });
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
        out.text = await p.evaluate(() => document.body ? document.body.innerText : '');
        // which of Verse's own skills answered the ask (the page logs 'skill:<name>'; nothing logged, or the model, is not a skill)
        if (ask) for (let w = 0; w < 20 && !out.skill; w++) { out.skill = await p.evaluate((q) => { try { const l = JSON.parse(localStorage.getItem('a2m.void.loop.v1') || '[]'); const e = l.reverse().find((x) => x && String(x.ask).trim().toLowerCase() === q && /^(skill:|calc$|chance$)/.test(x.note || '')); return e ? e.note.replace(/^skill:/, '') : null; } catch (_) { return null; } }, ask.trim().toLowerCase()); if (!out.skill) await p.waitForTimeout(500); }
        fs.mkdirSync(PRIV, { recursive: true }); await p.screenshot({ path: path.join(PRIV, tag + '.png') });
        // offline: the same page reloaded with the network cut; it counts when it still shows itself (some words, not the browser's error page)
        // as for a returning visitor: a page that installs a service worker gets up to 5 s for it to be ready (the same wait for both sites)
        await p.evaluate(() => (navigator.serviceWorker ? Promise.race([navigator.serviceWorker.ready.then(() => 1), new Promise((r) => setTimeout(() => r(0), 5000))]) : 0)).catch(() => 0);
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
  return { speed: times.length ? times[Math.floor(times.length / 2)] : NaN, reliability, ...out, truth: probe && probe.truth ? score(out.text, probe.truth) : null, facts: probe && probe.facts && probe.facts.length ? score(out.text, probe.facts) : null };
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
  const slug = f.id.replace(/\W+/g, '-'), at = new Date().toISOString(), probe = probeFor(f.id), want = new Set(aspectsOf(f));
  // a floor with Verse's own page for the job (/is-it/christmas, /flip/) is measured there, as a person would open it; others through the ask
  const versePage = probe && probe.verse ? probe.verse : f.page, siteUrl = probe && probe.site ? probe.site : f.url;
  const v = await measure(b, versePage ? new URL(versePage, VERSE).href : VERSE + '?q=' + encodeURIComponent(f.ask), slug + '-verse', versePage ? null : f.ask, probe), s = await measure(b, siteUrl, slug + '-site', null, probe);
  await b.close();
  const data = JSON.parse(fs.readFileSync(FILE, 'utf8')), ev = (data.floors[f.id] = data.floors[f.id] || {});
  const where = 'Verse' + (versePage ? ' (' + versePage + ')' : '');
  const put = (aspect, a, c, unit, extra = {}) => { if (!want.has(aspect)) return; const m = MEASURES[aspect], ideal = m.ideal !== undefined ? m.ideal : extra.of; ev[aspect] = { ...record(ev[aspect], verdict(a, c, m.hi, ideal), a, c, where + ' ' + a + unit + ' vs ' + f.site + ' ' + c + unit + (extra.note || ''), at), ...(extra.of ? { of: extra.of } : {}) }; };
  // a site that answered none of the loads turned the gate away: nothing about it is a measurement, so nothing is written but that
  if (!s.reliability) {
    ev.reliability = { verdict: 'unverified', verse: v.reliability, best: 0, evidence: f.site + ' answered none of 3 loads from an ordinary phone browser: the gate could not measure it (a fault to fix in the gate, not a win)', at };
  } else {
    put('speed', v.speed, s.speed, ' ms to the load event (median of 3, phone width)');
    put('reliability', v.reliability, s.reliability, ' of 3 loads answered');
    put('mobile', v.mobile, s.mobile, ' px sideways overflow at 390 px');
    put('accessibility', v.a11y, s.a11y, ' unnamed controls or images');
    put('offline', v.offline, s.offline, ' (1: the page shows itself again with the network cut)');
    put('sharing', v.sharing, s.sharing, ' of 4 (link-preview title, image, description; a share or copy-link control)');
    put('local language', v.german, s.german, ' (1: a German browser gets German)');
    put('big answer', v.big, s.big, ' px, the largest text on the first screen');
    if (v.truth && s.truth) put('accuracy', v.truth.n, s.truth.n, ' of ' + v.truth.of + ' checked facts right for the same question', { of: v.truth.of, note: v.truth.missing.length || s.truth.missing.length ? ' (Verse missed: ' + (v.truth.missing.join(', ') || 'none') + '; site missed: ' + (s.truth.missing.join(', ') || 'none') + ')' : '' });
    if (v.facts && s.facts) put('completeness', v.facts.n, s.facts.n, ' of ' + v.facts.of + ' things a full answer shows', { of: v.facts.of, note: ' (Verse lacks: ' + (v.facts.missing.join(', ') || 'none') + '; site lacks: ' + (s.facts.missing.join(', ') || 'none') + ')' });
  }
  // no automatic calls (owner, 2026-10-24): a floor falls only when a person judges Verse really better than the site, never because an answer came back.
  // Rows the old gate called by itself ("called beaten by verse") are dropped on every run, in every floor: runs in flight when that was taken back
  // pushed them in again, and a later run only re-measures four aspects
  for (const rows of Object.values(data.floors)) for (const [k, r] of Object.entries(rows || {})) if (r && r.called && /^called beaten by verse\b/.test(String(r.evidence || ''))) delete rows[k];
  fs.writeFileSync(FILE, JSON.stringify(data, null, 1) + '\n');
  for (const [k, r] of Object.entries(data.floors[f.id])) console.log(k.padEnd(14) + r.verdict.padEnd(11) + r.evidence);
}
