// Verse improves its own design, without end (owner, 2026-11-06: "its never complete verse is meant to constantly improve its design").
// .github/workflows/design-loop.yml runs this every 2 hours. It takes the next slice of Verse's own pages, smallest first (the fewest
// controls, then the fewest bytes: the same order as the rival sites), and measures each one at phone width with the tower gate's own
// design check (tools/tower-gate.mjs designLook: text under WCAG 2 contrast, tap targets under 24 by 24 px, a layout that shifts more than
// 0.1). For each text that fails contrast it computes the nearest colour of the same hue that passes, and for each small tap target the
// size that passes. It writes those as CSS rules in one marked <style> block at the end of the page, measures the page again, and keeps the
// block only when the defects went down and nothing else got worse: no new sideways scroll, no new layout shift, the first screen changed
// by at most a quarter of its pixels beyond what the page moves by itself. A shift it cannot fix by a rule is listed, not hidden. Everything it kept goes in --out as one patch
// with void-live-deploy/design-loop.json (what it measured, before and after); the workflow's write job moves only those bytes onto main.
//   node tools/design-loop.mjs [--run N] [--size 30] [--pages /a/,/b/] [--out dir] [--site https://a-to-mind.com] [--write]
// Without --write it measures and prints, and changes no file.
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { designLook, defects, UA, CLS_INIT } from './tower-gate.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SITE_DIR = path.join(root, 'void-live-deploy');
export const START = '/* verse design loop: kept by tools/design-loop.mjs, measured before and after */';
export const END = '/* end verse design loop */';

/** how many controls a page's HTML has (buttons, links, fields): the "smallest" measure. Pure. */
export const controlsIn = (html) => (String(html).match(/<(?:button|a\s[^>]*href|input(?![^>]*type=["']?hidden)|select|textarea)\b/gi) || []).length;
/** pages smallest first: fewest controls, then fewest bytes, then by path. Pure. */
export function rank(pages) {
  return [...pages].sort((x, y) => x.controls - y.controls || x.bytes - y.bytes || (x.url < y.url ? -1 : x.url > y.url ? 1 : 0));
}
/** the run's slice: run 0 takes the first `size`, run 1 the next, round and round, so every page comes back. Pure. */
export function sliceFor(ranked, run, size) {
  if (!ranked.length) return [];
  const n = Math.ceil(ranked.length / size), k = ((run % n) + n) % n;
  return ranked.slice(k * size, k * size + size);
}

// colour arithmetic (WCAG 2 relative luminance), all pure
const hex2 = (v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0');
export const toHex = ({ r, g, b }) => '#' + hex2(r) + hex2(g) + hex2(b);
export const lum = ({ r, g, b }) => { const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }; return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b); };
export const ratio = (a, b) => { const x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };
/** the nearest colour to `fg` (the same hue, mixed toward white or black, whichever side gives more room) that reaches `need`
 *  against every background in `bgs`; null when no mix does. Pure. */
export function passColor(fg, bgs, need) {
  const ok = (c) => bgs.every((b) => ratio(c, b) >= need + 0.05); // a small margin over the bar, so rounding never lands under it
  if (ok(fg)) return toHex(fg);
  const darkBg = bgs.reduce((s, b) => s + lum(b), 0) / bgs.length < 0.18, to = darkBg ? 255 : 0;
  for (let t = 0.02; t <= 1.0001; t += 0.02) { const c = { r: fg.r + (to - fg.r) * t, g: fg.g + (to - fg.g) * t, b: fg.b + (to - fg.b) * t }; if (ok(c)) return toHex(c); }
  return null;
}
/** the CSS rule that makes a small target 24 by 24 px at least, by its display. Pure. */
export function targetRule(display) {
  const d = String(display || 'inline');
  const box = 'min-width:24px;min-height:24px;box-sizing:border-box';
  if (d === 'inline' || d === 'inline-block') return 'display:inline-flex;align-items:center;justify-content:center;' + box;
  if (d === 'block' || d === 'list-item') return 'display:flex;align-items:center;' + box;
  return box;
}

/** the rules a page's marked block holds now: selector to declarations. Pure. */
export function blockRules(html) {
  const s = String(html), a = s.indexOf(START), b = s.indexOf(END);
  const out = {}; if (a < 0 || b < a) return out;
  for (const m of s.slice(a + START.length, b).matchAll(/([^{}]+)\{([^{}]*)\}/g)) out[m[1].trim()] = m[2].trim();
  return out;
}
/** the page with its marked block set to `rules` (earlier rules kept unless a new one replaces them), in its own <style> just before
 *  </body>: after every stylesheet in the head, so a rule of equal weight wins. Only the block changes. Pure. */
export function withBlock(html, rules) {
  const s = String(html), merged = { ...blockRules(s), ...rules };
  const css = START + '\n' + Object.entries(merged).map(([k, v]) => k + ' { ' + v + ' }').join('\n') + '\n' + END;
  const a = s.indexOf(START), b = s.indexOf(END);
  if (a >= 0 && b > a) return s.slice(0, a) + css + s.slice(b + END.length);
  let at = s.search(/<\/body>/i); if (at < 0) at = s.search(/<\/html>/i); if (at < 0) at = s.length; // a page may leave out </body>
  return s.slice(0, at) + (at && s[at - 1] !== '\n' ? '\n' : '') + '<style>\n' + css + '\n</style>\n' + s.slice(at);
}
/** whether `next` is exactly `before` plus the marked block, and the block holds only plain rules (a selector and declarations with no
 *  markup, no nested block, no import and no url). The write job checks every page of a patch with this before it commits. Pure. */
export function onlyBlock(before, next) {
  const rules = blockRules(next);
  for (const [k, v] of Object.entries(rules)) if (!/^[\w\s#.:()\-\[\]="'>+~*,\\]+$/.test(k) || !/^[\w\s#:;.%-]+$/.test(v)) return false;
  return Object.keys(rules).length > 0 && withBlock(before, rules) === next;
}
/** whether a page's second look keeps the change: fewer defects, and nothing else worse. Pure. */
export function keeps(before, after, moved) {
  if (!before || !after) return false;
  return after.defects < before.defects && after.overflow <= before.overflow && !(after.cls > 0.1 && before.cls <= 0.1) && moved <= 0.25;
}

// in the page: each failing element with a selector that names it (its id; else its tag and classes when every element they match
// fails the same way; else that under the nearest ancestor with an id; else a path of nth-of-type steps), the same tests as designLook
export function failing() {
  const vis = (e) => { const r = e.getBoundingClientRect(), cs = getComputedStyle(e); return r.width > 0 && r.height > 0 && cs.visibility !== 'hidden' && cs.display !== 'none' && +cs.opacity !== 0; };
  const own = (e) => [...e.childNodes].filter((n) => n.nodeType === 3).map((n) => n.textContent).join(' ').replace(/\s+/g, ' ').trim();
  const rgb = (c) => { const m = String(c).match(/rgba?\(([^)]+)\)/); if (!m) return null; const p = m[1].split(/[,\s/]+/).filter(Boolean).map(Number); return { r: p[0], g: p[1], b: p[2], a: p.length > 3 ? p[3] : 1 }; };
  const lum = ({ r, g, b }) => { const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }; return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b); };
  const behind = (e) => { for (let x = e; x; x = x.parentElement) { const cs = getComputedStyle(x); if (cs.backgroundImage && cs.backgroundImage !== 'none') return null; const c = rgb(cs.backgroundColor); if (c && c.a >= 0.99) return c; } return { r: 255, g: 255, b: 255, a: 1 }; };
  const esc = (x) => CSS.escape(x);
  const path = (e) => { const steps = []; for (let x = e; x && x !== document.body; x = x.parentElement) { if (x.id) { steps.unshift('#' + esc(x.id)); return steps.join(' > '); } const k = [...x.parentElement.children].filter((y) => y.tagName === x.tagName).indexOf(x) + 1; steps.unshift(x.tagName.toLowerCase() + ':nth-of-type(' + k + ')'); } return 'body > ' + steps.join(' > '); };
  const name = (e, set) => {
    if (e.id) return '#' + esc(e.id);
    const cls = [...e.classList].filter((c) => /^[A-Za-z_-][\w-]*$/.test(c)).map((c) => '.' + esc(c)).join('');
    const all = (sel) => { try { const m = [...document.querySelectorAll(sel)]; return m.length > 0 && m.every((y) => set.has(y)); } catch (_) { return false; } };
    const t = e.tagName.toLowerCase() + cls;
    if (cls && all(t)) return t;
    const up = e.parentElement && e.parentElement.closest('[id]'); if (cls && up && all('#' + esc(up.id) + ' ' + t)) return '#' + esc(up.id) + ' ' + t;
    // the nearest ancestor with a class names a family: ".bar a" holds for every link in every bar, also ones the page adds later
    const fam = e.parentElement && e.parentElement.closest('[class]'), fc = fam && [...fam.classList].find((c) => /^[A-Za-z_-][\w-]*$/.test(c));
    if (fc && all('.' + esc(fc) + ' ' + t)) return '.' + esc(fc) + ' ' + t;
    return path(e);
  };
  const low = [], seen = new Set();
  const texts = [...document.body.querySelectorAll('*')].filter((e) => !/^(SCRIPT|STYLE|NOSCRIPT|TEMPLATE|SVG)$/i.test(e.tagName) && !e.closest('[aria-hidden="true"]') && own(e) && vis(e));
  for (const e of texts.slice(0, 400)) {
    const cs = getComputedStyle(e), fg = rgb(cs.color), bg = behind(e); if (!fg || !bg || fg.a < 0.99) continue;
    const L1 = lum(fg), L2 = lum(bg), r = (Math.max(L1, L2) + 0.05) / (Math.min(L1, L2) + 0.05), px = parseFloat(cs.fontSize) || 16, large = px >= 24 || (px >= 18.66 && +cs.fontWeight >= 700);
    if (r < (large ? 3 : 4.5)) { low.push({ e, fg, bg, need: large ? 3 : 4.5 }); seen.add(e); }
  }
  const small = [...document.querySelectorAll('button,a[href],input:not([type=hidden]),select,textarea,[role=button]')].filter(vis).filter((e) => {
    const r = e.getBoundingClientRect(); if (r.width >= 24 && r.height >= 24) return false;
    return !(e.tagName === 'A' && e.parentElement && own(e.parentElement));
  });
  const smallSet = new Set(small);
  return {
    contrast: low.map(({ e, fg, bg, need }) => ({ sel: name(e, seen), fg, bg, need, text: own(e).slice(0, 30) })),
    targets: small.map((e) => { const r = e.getBoundingClientRect(); return { sel: name(e, smallSet), display: getComputedStyle(e).display, w: Math.round(r.width), h: Math.round(r.height), text: (e.textContent || e.getAttribute('aria-label') || '').trim().slice(0, 30) }; }),
  };
}

/** the rules that answer one page's failures: one rule per selector. Pure. */
export function rulesFor(fail) {
  const rules = {}, bySel = {};
  for (const c of fail.contrast || []) (bySel[c.sel] ||= { bgs: [], fg: c.fg, need: 0 }), bySel[c.sel].bgs.push(c.bg), (bySel[c.sel].need = Math.max(bySel[c.sel].need, c.need));
  for (const [sel, x] of Object.entries(bySel)) { const c = passColor(x.fg, x.bgs, x.need); if (c) rules[sel] = 'color:' + c; }
  for (const t of fail.targets || []) rules[t.sel] = (rules[t.sel] ? rules[t.sel] + ';' : '') + targetRule(t.display);
  return rules;
}

/** Verse's own pages: every index.html under void-live-deploy (not the tower's pictures), with its URL, controls and bytes. */
export function sitePages(dir = SITE_DIR) {
  const out = [];
  const walk = (d) => { for (const n of fs.readdirSync(d, { withFileTypes: true })) { if (n.name.startsWith('.') || n.name === 'node_modules' || n.name === 'tower.shots') continue;
    const f = path.join(d, n.name); if (n.isDirectory()) walk(f); else if (n.name === 'index.html') { const html = fs.readFileSync(f, 'utf8'); out.push({ file: f, url: '/' + path.relative(dir, path.dirname(f)).split(path.sep).filter(Boolean).map((x) => x + '/').join(''), controls: controlsIn(html), bytes: Buffer.byteLength(html) }); } } };
  walk(dir);
  return out;
}

// the page served from the checkout, as the live site serves it: a file from void-live-deploy, anything else (the API, the KV pages)
// fetched from the live site, so a page that builds itself from the API looks the same here as there
function serve(site) {
  const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.ico': 'image/x-icon', '.woff2': 'font/woff2', '.webmanifest': 'application/manifest+json', '.txt': 'text/plain' };
  const server = http.createServer(async (q, r) => {
    const u = new URL(q.url, 'http://x'); let f = path.join(SITE_DIR, decodeURIComponent(u.pathname));
    if (!f.startsWith(SITE_DIR)) { r.writeHead(403); return r.end(); }
    if (fs.existsSync(f) && fs.statSync(f).isDirectory()) f = path.join(f, 'index.html');
    if (fs.existsSync(f) && fs.statSync(f).isFile()) { r.writeHead(200, { 'content-type': types[path.extname(f)] || 'application/octet-stream' }); return fs.createReadStream(f).pipe(r); }
    if (!site || q.method !== 'GET') { r.writeHead(404); return r.end(); }
    try { const x = await fetch(site + u.pathname + u.search, { headers: { 'user-agent': UA } }); r.writeHead(x.status, { 'content-type': x.headers.get('content-type') || 'application/octet-stream' }); r.end(Buffer.from(await x.arrayBuffer())); } catch (_) { r.writeHead(502); r.end(); }
  }).listen(0, '127.0.0.1');
  return new Promise((ok) => server.once('listening', () => ok(server)));
}

async function look(browser, base, url) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, userAgent: UA, reducedMotion: 'reduce' });
  await ctx.addInitScript(CLS_INIT);
  const p = await ctx.newPage();
  try {
    await p.goto(base + url, { waitUntil: 'load', timeout: 30000 });
    await p.waitForLoadState('networkidle', { timeout: 6000 }).catch(() => {});
    await p.waitForTimeout(800);
    const l = await p.evaluate(designLook);
    const overflow = await p.evaluate(() => Math.max(0, document.documentElement.scrollWidth - innerWidth));
    const fail = await p.evaluate(failing);
    const shot = (await p.screenshot()).toString('base64');
    await p.waitForTimeout(400); const shot2 = (await p.screenshot()).toString('base64'); // a page that moves by itself (a canvas, a clock)
    return { contrast: l.contrast, targets: l.targets, cls: Math.round(l.cls * 1000) / 1000, defects: defects(l), overflow, fail, shot, shot2 };
  } catch (e) { return null; } finally { await ctx.close(); }
}
// the share of the first screen's pixels that changed between two pictures, measured in the browser (the way tools/visual.mjs does)
async function moved(browser, a, b) {
  const ctx = await browser.newContext(), p = await ctx.newPage();
  try {
    return await p.evaluate(async ([x, y]) => {
      const load = (s) => new Promise((r) => { const i = new Image(); i.onload = () => r(i); i.src = 'data:image/png;base64,' + s; });
      const [i1, i2] = await Promise.all([load(x), load(y)]); if (i1.width !== i2.width || i1.height !== i2.height) return 1;
      const px = (i) => { const c = new OffscreenCanvas(i.width, i.height), g = c.getContext('2d'); g.drawImage(i, 0, 0); return g.getImageData(0, 0, i.width, i.height).data; };
      const d1 = px(i1), d2 = px(i2); let n = 0;
      for (let k = 0; k < d1.length; k += 4) if (Math.abs(d1[k] - d2[k]) + Math.abs(d1[k + 1] - d2[k + 1]) + Math.abs(d1[k + 2] - d2[k + 2]) > 48) n++;
      return n / (d1.length / 4);
    }, [a, b]);
  } finally { await ctx.close(); }
}

// --check: every page the work tree changed against HEAD must be HEAD's page plus the marked block (the write job, after git apply)
function check() {
  const files = execFileSync('git', ['diff', '--name-only', 'HEAD', '--', 'void-live-deploy'], { cwd: root, encoding: 'utf8' }).split('\n').filter(Boolean);
  const bad = [];
  for (const f of files) {
    if (f === 'void-live-deploy/design-loop.json') { try { JSON.parse(fs.readFileSync(path.join(root, f), 'utf8')); } catch (_) { bad.push(f + ' (not JSON)'); } continue; }
    if (!/^void-live-deploy\/(?:[\w.-]+\/)*index\.html$/.test(f)) { bad.push(f + ' (not a page)'); continue; }
    const before = execFileSync('git', ['show', 'HEAD:' + f], { cwd: root, encoding: 'utf8', maxBuffer: 64 << 20 });
    if (!onlyBlock(before, fs.readFileSync(path.join(root, f), 'utf8'))) bad.push(f + ' (changed outside the marked block)');
  }
  console.log(bad.length ? 'not committed: ' + bad.join('; ') : files.length + ' files: each page is its old self plus the marked block');
  return bad.length ? 1 : 0;
}

async function main() {
  const a = process.argv.slice(2), opt = (k, d) => (a.includes(k) ? a[a.indexOf(k) + 1] : d);
  if (a.includes('--check')) process.exit(check());
  const write = a.includes('--write'), out = opt('--out', ''), size = +opt('--size', 30), site = opt('--site', 'https://a-to-mind.com');
  const run = +opt('--run', process.env.GITHUB_RUN_NUMBER || Math.floor(Date.now() / 7200000));
  const all = rank(sitePages()), only = opt('--pages', '');
  const pages = only ? all.filter((p) => only.split(',').includes(p.url)) : sliceFor(all, run, size);
  const { chromium } = await import('playwright-core');
  const exe = process.env.VOID_TEST_BROWSER || process.env.CHROME_PATH || ['/usr/bin/google-chrome', '/usr/bin/chromium-browser', '/usr/bin/chromium'].find((x) => fs.existsSync(x));
  const browser = await chromium.launch({ ...(exe ? { executablePath: exe } : {}), args: ['--no-sandbox'] });
  const server = await serve(site), base = 'http://127.0.0.1:' + server.address().port;
  const report = { at: new Date().toISOString(), run, of: all.length, pages: [] };
  console.log(`design loop run ${run}: ${pages.length} of ${all.length} pages, smallest first (${pages[0] ? pages[0].url : 'none'} to ${pages.length ? pages[pages.length - 1].url : 'none'})`);
  try {
    for (const pg of pages) {
      const html = fs.readFileSync(pg.file, 'utf8');
      const before = await look(browser, base, pg.url);
      if (!before) { report.pages.push({ url: pg.url, state: 'not measured' }); console.log(`${pg.url}: not measured (it did not load)`); continue; }
      const row = { url: pg.url, before: { defects: before.defects, contrast: before.contrast, targets: before.targets, cls: before.cls, overflow: before.overflow } };
      if (!before.defects) { report.pages.push({ ...row, state: 'clean' }); console.log(`${pg.url}: 0 defects`); continue; }
      const rules = rulesFor(before.fail), next = Object.keys(rules).length ? withBlock(html, rules) : null;
      const shift = before.cls > 0.1 ? ' (a layout shift of ' + before.cls + ' that no rule fixes: listed for a builder)' : '';
      if (!next || next === html) { report.pages.push({ ...row, state: 'listed', why: 'no rule fixes it' + shift }); console.log(`${pg.url}: ${before.defects} defects, no rule fixes them${shift}`); continue; }
      fs.writeFileSync(pg.file, next);
      const after = await look(browser, base, pg.url);
      // what the change moved: the share that changed, less the share the page moves by itself in the same time
      const share = after ? Math.max(0, (await moved(browser, before.shot, after.shot)) - (await moved(browser, before.shot, before.shot2))) : 1;
      if (keeps(before, after, share)) {
        report.pages.push({ ...row, state: 'fixed', after: { defects: after.defects, contrast: after.contrast, targets: after.targets, cls: after.cls, overflow: after.overflow }, rules: Object.keys(rules).length, moved: Math.round(share * 1000) / 1000, ...(shift ? { why: shift.trim() } : {}) });
        console.log(`${pg.url}: ${before.defects} -> ${after.defects} defects (${Object.keys(rules).length} rules, ${(share * 100).toFixed(1)}% of the first screen changed)${shift}`);
        if (!write) fs.writeFileSync(pg.file, html);
      } else {
        fs.writeFileSync(pg.file, html);
        const why = !after ? 'the page did not load after the change' : after.defects >= before.defects ? 'the defects did not go down (' + before.defects + ' -> ' + after.defects + ')' : after.overflow > before.overflow ? 'it made the page scroll sideways' : share > 0.25 ? 'it changed ' + Math.round(share * 100) + '% of the first screen' : 'it added a layout shift';
        report.pages.push({ ...row, state: 'listed', why: why + shift }); console.log(`${pg.url}: ${before.defects} defects, the rules were undone: ${why}${shift}`);
      }
    }
  } finally { await browser.close(); server.close(); }
  const fixed = report.pages.filter((p) => p.state === 'fixed');
  report.summary = { measured: report.pages.filter((p) => p.state !== 'not measured').length, clean: report.pages.filter((p) => p.state === 'clean').length, fixed: fixed.length, listed: report.pages.filter((p) => p.state === 'listed').length,
    defectsBefore: fixed.reduce((s, p) => s + p.before.defects, 0), defectsAfter: fixed.reduce((s, p) => s + p.after.defects, 0) };
  console.log(`${report.summary.measured} measured, ${report.summary.clean} clean, ${report.summary.fixed} fixed (${report.summary.defectsBefore} -> ${report.summary.defectsAfter} defects), ${report.summary.listed} listed`);
  if (write) {
    // the record the site keeps: every run's summary (the last 200) and each page's latest row, so the next run and a reader see the trend
    const recFile = path.join(SITE_DIR, 'design-loop.json');
    const rec = fs.existsSync(recFile) ? JSON.parse(fs.readFileSync(recFile, 'utf8')) : { runs: [], pages: {} };
    rec.runs = [...(rec.runs || []), { at: report.at, run, ...report.summary }].slice(-200);
    rec.pages = { ...(rec.pages || {}) }; for (const p of report.pages) { const { url, ...rest } = p; rec.pages[url] = { at: report.at, ...rest }; }
    fs.writeFileSync(recFile, JSON.stringify(rec, null, 1) + '\n');
  }
  if (out) {
    fs.mkdirSync(out, { recursive: true });
    fs.writeFileSync(path.join(out, 'design-loop.report.json'), JSON.stringify(report, null, 1) + '\n');
    if (write) {
      // a new record file is untracked, and git diff shows only tracked files: mark it as intended first
      execFileSync('git', ['add', '-N', '--', path.relative(root, path.join(SITE_DIR, 'design-loop.json'))], { cwd: root });
      fs.writeFileSync(path.join(out, 'design-loop.patch'), execFileSync('git', ['diff', '--binary', '--', 'void-live-deploy'], { cwd: root, maxBuffer: 64 << 20 }));
    }
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await main();
