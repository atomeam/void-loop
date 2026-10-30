// Wider use (owner, 2026-10-28: "if we have a version of a page lets try to make it more widely usablee than the original"): a page that is
// Verse's version of a site has to work for more people than the site does. docs/WIDER-USE.md is the checklist; this scores a page on it, by
// machine where it can: axe-core (when installed), a 360 px phone, 200% zoom, a keyboard tab-through, reduced motion, an offline reload and
// whether its state survives in its link. Each point scores 0, 0.5 or 1; 11 is the most there is. tools/tower-gate.mjs scores both Verse's page
// and the rival with the same look ('wider use'), and the lap loop asks every item to raise it (lib/lap.js).
//   node tools/wider-use.mjs [--base https://a-to-mind.com] [--out file.json] /calculator/ /flip/ ...   (no paths: every floor and lane page)
//   AXE_PATH=/path/to/axe.min.js adds axe-core's serious and critical WCAG A/AA violations to point 4
import fs from 'node:fs'; import { fileURLToPath } from 'node:url';
import { insiderFlags } from './insider-flag.mjs';

export const POINTS = Object.freeze(['beginners', 'experts', 'phones', 'screen readers and keyboards', 'slow or offline', 'other languages', 'low vision (200% zoom)', 'reduced motion', 'sharing (link restores state)', 'copy and export', 'broad niche']);

// run inside the page: what a reader sees, without a browser extension or any network
export function pageFacts() {
  const vis = (e) => { const r = e.getBoundingClientRect(), cs = getComputedStyle(e); return r.width > 0 && r.height > 0 && cs.visibility !== 'hidden' && cs.display !== 'none'; };
  const ctl = [...document.querySelectorAll('button,a[href],[role=button],input[type=button],input[type=submit]')].filter(vis);
  const name = (e) => (e.innerText || e.value || e.getAttribute('aria-label') || e.title || '').replace(/\s+/g, ' ').trim();
  const names = ctl.map(name);
  const fields = [...document.querySelectorAll('input:not([type=hidden]):not([type=button]):not([type=submit]):not([type=checkbox]):not([type=radio]),textarea')].filter(vis);
  const hints = fields.map((f) => (f.placeholder || '') + ' ' + (f.labels && f.labels[0] ? f.labels[0].innerText : '') + ' ' + (f.getAttribute('aria-label') || '')).join(' | ');
  const text = (document.body ? document.body.innerText : '').replace(/\s+/g, ' ');
  const intro = [...document.querySelectorAll('main p, header p, body p, .lede, .intro, [class*=sub]')].filter(vis).some((p) => p.getBoundingClientRect().top < 900 && (p.innerText || '').trim().split(/\s+/).length >= 8);
  const css = (() => { let s = ''; for (const sh of document.styleSheets) { try { for (const r of sh.cssRules) s += r.cssText.slice(0, 400) + '\n'; } catch (_) {} } return s; })();
  return {
    rawSyntax: /\b\w+:\w+:\w+\b|\b\w+=\w+;\w+=|\w+:\d+,\w+:\d+/.test(hints) || fields.some((f) => /\w+:\d+(?::\d+)?,\s*\w+:/.test(f.value || '')),
    examples: names.filter((n) => /\b(?:example|try|sample|preset|demo|e\.g\.|start with|quick)\b/i.test(n)).length + document.querySelectorAll('[data-example],[data-preset],.chips button,.presets button,.examples button,.examples a').length,
    intro,
    shortcuts: document.querySelectorAll('[accesskey],[aria-keyshortcuts],kbd').length > 0 || /\b(?:shortcut|keyboard|press (?:space|enter|[a-z0-9])\b)/i.test(text),
    advanced: document.querySelectorAll('details').length > 0 || /\b(?:advanced|raw|expert|power user|custom)\b/i.test(names.join(' ') + ' ' + text.slice(0, 4000)),
    copyExport: names.filter((n) => /\b(?:copy|download|export|csv|json|print|save|share)\b/i.test(n)).length,
    lang: document.documentElement.lang || '',
    picker: [...document.querySelectorAll('select')].some((s) => /english|español|deutsch|français|language/i.test(s.innerText)) || names.some((n) => /^(?:language|EN|DE|ES|FR)$/i.test(n)),
    reducedCss: /prefers-reduced-motion/.test(css),
    labels: [...document.querySelectorAll('label,th,legend,button,option,[aria-label]')].filter(vis).map((e) => e.getAttribute('aria-label') || e.innerText || '').join(' | ').slice(0, 3000),
    defaults: fields.map((f) => (f.value || '') + ' ' + (f.placeholder || '')).join(' | ').slice(0, 1500),
    fields: fields.length, controls: ctl.length, textLen: text.length, head: text.slice(0, 1200),
  };
}
// run inside the page: sideways overflow and text cut off by its box (overflow hidden or ellipsis)
export function clipFacts() {
  const vis = (e) => { const r = e.getBoundingClientRect(), cs = getComputedStyle(e); return r.width > 0 && r.height > 0 && cs.visibility !== 'hidden' && cs.display !== 'none'; };
  const own = (e) => [...e.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim());
  let clipped = 0; const where = [];
  for (const e of [...document.body.querySelectorAll('*')].slice(0, 3000)) {
    if (!own(e) || !vis(e) || /^(SCRIPT|STYLE|TEXTAREA|INPUT|SELECT|OPTION|CODE|PRE)$/.test(e.tagName) || e.closest('[aria-hidden=true],canvas,svg')) continue;
    const cs = getComputedStyle(e), hid = (v) => /hidden|clip/.test(v);
    const x = hid(cs.overflowX) && e.scrollWidth > e.clientWidth + 2, y = hid(cs.overflowY) && e.scrollHeight > e.clientHeight + 2, ell = cs.textOverflow === 'ellipsis' && e.scrollWidth > e.clientWidth + 1;
    if (x || y || ell) { clipped++; if (where.length < 4) where.push((e.innerText || '').trim().slice(0, 30)); }
  }
  const small = [...document.querySelectorAll('button,a[href],input:not([type=hidden]),select,textarea,[role=button]')].filter(vis).filter((e) => { const r = e.getBoundingClientRect(); return (r.width < 24 || r.height < 24) && !(e.tagName === 'A' && e.parentElement && [...e.parentElement.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim())); }).length;
  return { overflow: Math.max(0, document.documentElement.scrollWidth - innerWidth), clipped, where, small };
}
const half = (a, b) => (a && b ? 1 : a || b ? 0.5 : 0);

/** the eleven point scores from the facts gathered. Pure. */
export function scoreOf(m) {
  const f = m.facts || {}, ins = m.insider || { flagged: false };
  const s = {
    beginners: f.rawSyntax ? (f.examples ? 0.5 : 0) : half(f.examples > 0, f.intro),
    experts: half(f.shortcuts, f.advanced || m.urlState >= 0.5),
    phones: half(m.phone && m.phone.overflow <= 1, m.phone && m.phone.small <= 3),
    'screen readers and keyboards': half(m.axe == null ? m.unnamed === 0 : m.axe === 0, m.keys >= 0.8),
    'slow or offline': m.offline ? 1 : 0,
    'other languages': m.german ? 1 : f.picker ? 0.5 : 0,
    'low vision (200% zoom)': m.zoom ? (m.zoom.overflow <= 1 && !m.zoom.clipped ? 1 : m.zoom.clipped <= 3 && m.zoom.overflow <= 1 ? 0.5 : 0) : 0,
    'reduced motion': m.motion === 0 ? 1 : f.reducedCss ? 0.5 : 0,
    'sharing (link restores state)': m.urlState,
    'copy and export': f.copyExport >= 2 ? 1 : f.copyExport ? 0.5 : 0,
    'broad niche': ins.flagged ? 0 : half(f.intro, f.examples >= 1),
  };
  return { scores: s, total: Object.values(s).reduce((a, b) => a + b, 0), missed: POINTS.filter((p) => s[p] < 1) };
}

const AXE = process.env.AXE_PATH && fs.existsSync(process.env.AXE_PATH) ? fs.readFileSync(process.env.AXE_PATH, 'utf8') : null;
const settle = (p) => p.waitForLoadState('networkidle', { timeout: 5000 }).catch(() => {});
/** one page looked at in every way the checklist asks; { facts, phone, zoom, keys, motion, offline, german, urlState, axe, unnamed, insider } */
export async function look(browser, url, { ua } = {}) {
  const m = { url };
  const open = async (opts) => { const ctx = await browser.newContext({ userAgent: ua, ...opts }); const p = await ctx.newPage(); p.setDefaultTimeout(8000); await p.goto(url, { waitUntil: 'load', timeout: 30000 }); await settle(p); return { ctx, p }; };
  // desktop: facts, axe, keyboard, the link's state, offline
  { const { ctx, p } = await open({ viewport: { width: 1280, height: 800 }, locale: 'en-US' });
    try {
      m.facts = await p.evaluate(pageFacts);
      m.unnamed = await p.evaluate(() => [...document.querySelectorAll('button,a[href],[role=button]')].filter((e) => !(e.innerText || e.getAttribute('aria-label') || e.title || e.querySelector('img[alt]')) ).length + [...document.querySelectorAll('img:not([alt])')].length);
      if (AXE) { await p.addScriptTag({ content: AXE }).catch(() => {}); const r = await p.evaluate(async () => { try { const x = await window.axe.run(document, { runOnly: ['wcag2a', 'wcag2aa'], resultTypes: ['violations'] }); return x.violations.filter((v) => /serious|critical/.test(v.impact)).map((v) => v.id + ':' + v.nodes.length); } catch (e) { return null; } }); m.axe = r ? r.length : null; m.axeRules = r || []; }
      // keyboard: Tab through, count controls reached and how many show where focus is
      const total = await p.evaluate(() => [...document.querySelectorAll('a[href],button,input:not([type=hidden]),select,textarea,[tabindex]:not([tabindex="-1"])')].filter((e) => { const r = e.getBoundingClientRect(); return r.width > 0 && r.height > 0 && !e.disabled; }).length);
      const seen = new Set(); let shown = 0; const n = Math.min(30, total);
      for (let i = 0; i < n; i++) { await p.keyboard.press('Tab'); const r = await p.evaluate(() => { const e = document.activeElement; if (!e || e === document.body) return null; const cs = getComputedStyle(e); return { k: e.outerHTML.slice(0, 120), ring: (cs.outlineStyle !== 'none' && parseFloat(cs.outlineWidth) > 0) || cs.boxShadow !== 'none' }; }).catch(() => null); if (r) { if (!seen.has(r.k)) { seen.add(r.k); if (r.ring) shown++; } } }
      m.keys = n ? Math.min(seen.size / n, seen.size ? shown / seen.size : 0) : 1;
      // state in the link: change the first field and see whether the address changes and a fresh load restores it
      const before = p.url(); let urlState = m.facts.fields ? 0 : 1;
      if (m.facts.fields) {
        const fld = p.locator('input:not([type=hidden]):not([type=button]):not([type=submit]):not([type=checkbox]):not([type=radio]):not([type=file]):visible, textarea:visible').first();
        const kind = await fld.getAttribute('type').catch(() => null), val = kind === 'number' || kind === 'range' ? '7' : kind === 'color' ? '#123456' : kind === 'date' ? '2026-01-02' : 'zebra 42';
        await fld.fill(val).catch(() => {}); await fld.dispatchEvent('change').catch(() => {}); await p.waitForTimeout(900);
        const after = p.url();
        if (after !== before) { urlState = 0.5; const q = await browser.newContext({ userAgent: ua }); try { const p2 = await q.newPage(); await p2.goto(after, { waitUntil: 'load', timeout: 30000 }); await settle(p2); const back = await p2.evaluate((v) => [...document.querySelectorAll('input,textarea')].some((e) => e.value === v), val); if (back) urlState = 1; } catch (_) {} finally { await q.close(); } }
      }
      // or a share control that puts the state in a link (calculator, colour and the like): half, as the address bar itself does not keep it
      if (urlState < 0.5 && await p.locator('button:visible, a[role=button]:visible').filter({ hasText: /copy link|share( link)?$|link to this/i }).count().catch(() => 0)) urlState = 0.5;
      m.urlState = urlState;
      await p.evaluate(() => navigator.serviceWorker && Promise.race([navigator.serviceWorker.ready, new Promise((r) => setTimeout(r, 4000))])).catch(() => {});
      await p.goto(before, { waitUntil: 'load', timeout: 15000 }).catch(() => {}); await p.waitForTimeout(500);
      await ctx.setOffline(true); m.offline = await p.reload({ waitUntil: 'load', timeout: 10000 }).then(() => p.evaluate(() => (document.body ? document.body.innerText.length : 0) > 60 && !/ERR_INTERNET_DISCONNECTED|No internet/.test(document.body.innerText))).catch(() => false);
    } finally { await ctx.close(); } }
  // phone, 200% zoom (a 1280 px window at 200% is a 640 px layout), reduced motion, a German browser
  { const { ctx, p } = await open({ viewport: { width: 360, height: 740 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 }); try { m.phone = await p.evaluate(clipFacts); } finally { await ctx.close(); } }
  { const { ctx, p } = await open({ viewport: { width: 640, height: 400 }, deviceScaleFactor: 2 }); try { m.zoom = await p.evaluate(clipFacts); } finally { await ctx.close(); } }
  { const { ctx, p } = await open({ viewport: { width: 1280, height: 800 }, reducedMotion: 'reduce' }); try { await p.waitForTimeout(600); m.motion = await p.evaluate(() => document.getAnimations().filter((a) => a.playState === 'running' && a.effect && a.effect.getTiming && a.effect.getTiming().iterations === Infinity).length); } finally { await ctx.close(); } }
  { const { ctx, p } = await open({ viewport: { width: 1280, height: 800 }, locale: 'de-DE', extraHTTPHeaders: { 'Accept-Language': 'de-DE,de;q=0.9' } }); try { const t = await p.evaluate(() => (document.documentElement.lang || '') + ' ' + document.body.innerText.slice(0, 3000)); m.german = /^de\b/i.test(t) || (t.match(/\b(?:und|der|die|das|ist|nicht|mit|für|ein|eine|heute|jetzt)\b/g) || []).length >= 4; } finally { await ctx.close(); } }
  m.insider = insiderFlags({ text: m.facts.head, labels: m.facts.labels, defaults: m.facts.defaults, examples: m.facts.examples });
  return m;
}

/** every floor and lane page of the tower, one each, with the sites it stands for. */
export async function towerPages() { const { FLOORS } = await import('../void-live-deploy/lib/tower.js'); const p = new Map(); for (const f of FLOORS) { const u = String(f.page || '').split('?')[0]; if (u) p.set(u, (p.get(u) || []).concat(f.site)); } return p; }

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const a = process.argv.slice(2), opt = (k, d) => { const i = a.indexOf(k); if (i < 0) return d; const v = a[i + 1]; a.splice(i, 2); return v; };
  const base = opt('--base', 'https://a-to-mind.com'), out = opt('--out', null);
  const pages = a.length ? a : [...(await towerPages()).keys()];
  const { chromium } = await import('playwright-core'), go = () => chromium.launch({ executablePath: process.env.VOID_TEST_BROWSER || undefined });
  let b = await go();
  const rows = [];
  for (const path of pages) {
    try { const m = await look(b, new URL(path, base).href); const s = scoreOf(m); rows.push({ path, ...s, m }); console.log(path.padEnd(28), String(s.total).padStart(4), 'missed:', s.missed.join(', ') || 'nothing'); }
    catch (e) { rows.push({ path, error: String(e.message || e).split('\n')[0] }); console.log(path.padEnd(28), 'error', String(e.message || e).split('\n')[0]); }
    if (out) fs.writeFileSync(out, JSON.stringify(rows, null, 1));
    if (!b.isConnected()) b = await go(); // a busy box can kill the browser; start a fresh one so one crash does not fail every later page
  }
  await b.close();
}
