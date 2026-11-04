// /under-the-hood/: live numbers about Verse, measured in the reader's browser. No libraries, no inline script.
// Every value is read from the browser's own performance entries, from a same-origin fetch of a static file, or
// from Mozilla's public Observatory API (which answers any origin). Nothing here calls a Pages Function, so a
// reader costs Cloudflare nothing more than the static files (STANDING: Cloudflare is not unlimited).
const $ = (id) => document.getElementById(id);
const el = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; };
const tile = (value, label, tone) => { const t = el('div', 'tile'); t.append(el('b', tone || '', value), el('span', '', label)); return t; };
const ms = (n) => n == null || !isFinite(n) ? '—' : n < 1000 ? Math.round(n) + ' ms' : (n / 1000).toFixed(2) + ' s';
const kb = (n) => n == null ? '—' : n < 1024 ? n + ' B' : (n / 1024).toFixed(n < 10240 ? 1 : 0) + ' KB';
const tone = (n, good, poor) => n == null ? '' : n <= good ? 'ok' : n <= poor ? 'warn' : 'bad';
const fill = (id, tiles) => $(id).replaceChildren(...tiles);

// 1. Web vitals of this very page load, from the browser's own observers
const v = { lcp: null, cls: 0, inp: null, fcp: null };
function vitals() {
  const nav = performance.getEntriesByType('navigation')[0] || {};
  const act = nav.activationStart || 0, pre = act > 0;
  const res = performance.getEntriesByType('resource').filter((r) => r.name.startsWith(location.origin));
  const bytes = (nav.transferSize || 0) + res.reduce((s, r) => s + (r.transferSize || 0), 0);
  const raw = (nav.decodedBodySize || 0) + res.reduce((s, r) => s + (r.decodedBodySize || 0), 0);
  const sw = navigator.serviceWorker && navigator.serviceWorker.controller;
  const from = pre ? 'prerendered before you clicked' : nav.transferSize === 0 && nav.decodedBodySize > 0 ? (sw ? 'the service worker' : 'the browser cache') : 'the network';
  const ttfb = nav.responseStart ? Math.max(0, nav.responseStart - act) : null;
  fill('vitals', [
    tile(ms(ttfb), 'time to first byte' + (pre ? ' (after activation)' : ''), tone(ttfb, 800, 1800)),
    tile(ms(v.fcp), 'first contentful paint', tone(v.fcp, 1800, 3000)),
    tile(ms(v.lcp), 'largest contentful paint', tone(v.lcp, 2500, 4000)),
    tile(v.cls.toFixed(3), 'cumulative layout shift', tone(v.cls, 0.1, 0.25)),
    tile(v.inp == null ? 'click' : ms(v.inp), v.inp == null ? 'to measure interaction' : 'slowest interaction (INP)', tone(v.inp, 200, 500)),
    tile(kb(bytes), 'sent over the wire (' + kb(raw) + ' unpacked, ' + (res.length + 1) + ' files)'),
    tile(nav.nextHopProtocol || '—', 'protocol'),
    tile(from, 'this page came from', pre || from !== 'the network' ? 'ok' : ''),
  ]);
}
const watch = (type, fn, opts) => {
  if (typeof PerformanceObserver !== 'function') return; // an older browser: that tile stays —
  try { new PerformanceObserver((l) => { l.getEntries().forEach(fn); vitals(); }).observe({ type, buffered: true, ...opts }); }
  catch (err) { if (err && (err.name === 'NotSupportedError' || err.name === 'TypeError')) return; throw err; } // only an entry type this browser does not observe
};
const act0 = () => (performance.getEntriesByType('navigation')[0] || {}).activationStart || 0;
watch('paint', (e) => { if (e.name === 'first-contentful-paint') v.fcp = Math.max(0, e.startTime - act0()); });
watch('largest-contentful-paint', (e) => { v.lcp = Math.max(0, e.startTime - act0()); });
watch('layout-shift', (e) => { if (!e.hadRecentInput) v.cls += e.value; });
watch('event', (e) => { if (e.interactionId) v.inp = Math.max(v.inp || 0, e.duration); }, { durationThreshold: 16 });
vitals();
addEventListener('load', () => setTimeout(vitals, 0));

// 2. The home page's security headers, read the way the browser enforces them
const HEADERS = [
  ['content-security-policy', 'Which scripts, styles and connections a page may use'],
  ['strict-transport-security', 'HTTPS only: the browser never asks over plain HTTP for two years'],
  ['cross-origin-opener-policy', 'Other sites cannot reach into this window'],
  ['x-content-type-options', 'Files are only run as the type they say they are'],
  ['x-frame-options', 'Other sites cannot frame this page'],
  ['referrer-policy', 'Links to other sites send only the origin'],
  ['permissions-policy', 'Camera, microphone and location are off unless a page asks'],
  ['speculation-rules', 'Which links Chrome may prerender ahead of a click'],
];
// The browser enforces every policy it gets, so a script must pass all of them. Inline script is allowed only if no
// policy carries a hash or nonce and one says 'unsafe-inline' (CSP3: a hash or nonce turns 'unsafe-inline' off).
function cspVerdict(value) {
  const policies = value.split(/,(?=\s*[a-z-]+\s)/i).map((p) => p.trim()).filter(Boolean);
  const scripts = policies.map((p) => { const d = p.split(';').map((s) => s.trim()).find((s) => /^script-src\s/i.test(s)) || p.split(';').map((s) => s.trim()).find((s) => /^default-src\s/i.test(s)) || ''; return d.split(/\s+/).slice(1); });
  const inlineOk = scripts.every((s) => s.length === 0 || (s.includes("'unsafe-inline'") && !s.some((x) => /^'(sha(256|384|512)|nonce)-/.test(x))));
  const hashes = scripts.reduce((n, s) => n + s.filter((x) => /^'sha(256|384|512)-/.test(x)).length, 0);
  const evalOk = scripts.every((s) => s.length === 0 || s.includes("'unsafe-eval'"));
  return { n: policies.length, inlineOk, evalOk, hashes };
}
fetch('/', { cache: 'no-store' }).then((r) => {
  const rows = HEADERS.map(([h, what]) => {
    const value = r.headers.get(h), tr = el('tr'), result = el('td');
    tr.append(el('td', '', h));
    if (!value) result.append(el('span', h === 'speculation-rules' ? 'warn' : 'bad', 'not sent'));
    else if (h === 'content-security-policy') {
      const c = cspVerdict(value);
      result.append(el('span', c.inlineOk ? 'warn' : 'ok', c.inlineOk ? 'sent, but inline script is allowed' : 'strict: inline script runs only if its SHA-256 is listed (' + c.hashes + ' on this page)'), el('br'), el('span', c.evalOk ? 'bad' : 'ok', c.evalOk ? 'eval allowed' : 'no eval'), el('span', '', ' · ' + c.n + (c.n === 1 ? ' policy' : ' policies, all enforced')));
    } else result.append(el('span', 'ok', 'sent'));
    if (value) { const d = el('details'); d.append(el('summary', '', 'value'), el('pre', '', value)); result.append(d); }
    tr.append(result, el('td', '', what));
    return tr;
  });
  $('hdrs').replaceChildren(...rows);
}).catch(() => { $('hdrs').replaceChildren(el('tr', '', 'Could not reach the home page. Are you offline?')); });

// 3. Mozilla's public scan of the site
fetch('https://observatory-api.mdn.mozilla.net/api/v2/analyze?host=a-to-mind.com').then((r) => r.json()).then((j) => {
  const s = j.scan || {}, tests = j.tests || {}, all = Object.values(tests), pass = all.filter((t) => t.pass).length;
  const when = s.scanned_at ? new Date(s.scanned_at) : null;
  fill('obs', [
    tile(s.grade || '—', 'Observatory grade', /^A/.test(s.grade || '') ? 'ok' : /^B/.test(s.grade || '') ? 'warn' : 'bad'),
    tile(s.score != null ? String(s.score) : '—', 'score (100 is the most without extra credit)'),
    tile(pass + ' / ' + all.length, 'tests passed', pass === all.length ? 'ok' : 'warn'),
    tile(when ? when.toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' }) : '—', 'scanned (your time)'),
  ]);
  $('obs-tests').replaceChildren(...all.map((t) => { const tr = el('tr'); tr.append(el('td', t.pass ? 'ok' : 'bad', t.pass ? 'pass' : 'fail'), el('td', '', t.title || t.name || ''), el('td', 'num', t.score_modifier > 0 ? '+' + t.score_modifier : String(t.score_modifier ?? ''))); return tr; }));
}).catch(() => fill('obs', [tile('—', 'Mozilla did not answer; try the link above')]));

// 4. Counts, from the files the site serves
const text = (u) => fetch(u).then((r) => (r.ok ? r.text() : Promise.reject(r.status)));
Promise.allSettled([text('/skills/index.json'), text('/sw.js'), text('/sitemap.xml')]).then(([skills, sw, map]) => {
  const t = [];
  if (skills.status === 'fulfilled') { const n = JSON.parse(skills.value).length; t.push(tile(n.toLocaleString(), 'skill modules the home page can route an ask to')); }
  if (sw.status === 'fulfilled') { // the worker keeps TOOLS and LATER alike (sw.js KEPT)
    const list = (k) => { const m = sw.value.match(new RegExp('const ' + k + '\\s*=\\s*\\[([^\\]]*)\\]')); return m ? (m[1].match(/'[^']*'/g) || []).length : 0; };
    t.push(tile(String(list('TOOLS') + list('LATER')), 'pages the offline worker keeps, so they open with no network', 'ok'));
  }
  if (map.status === 'fulfilled') t.push(tile(String((map.value.match(/<loc>/g) || []).length), 'pages in the sitemap'));
  t.push(tile(navigator.serviceWorker && navigator.serviceWorker.controller ? 'yes' : 'not yet', 'this tab is under the offline worker', navigator.serviceWorker && navigator.serviceWorker.controller ? 'ok' : ''));
  fill('counts', t);
});

// 5. Prerender and view transitions in this browser
const nav0 = performance.getEntriesByType('navigation')[0] || {};
const supports = typeof HTMLScriptElement !== 'undefined' && HTMLScriptElement.supports && HTMLScriptElement.supports('speculationrules');
const vt = typeof CSS !== 'undefined' && CSS.supports && CSS.supports('selector(::view-transition)');
fill('spec', [
  tile(supports ? 'yes' : 'no', 'this browser reads speculation rules', supports ? 'ok' : ''),
  tile(nav0.activationStart > 0 ? 'yes, ' + ms(nav0.activationStart) + ' early' : 'no', 'this page was prerendered', nav0.activationStart > 0 ? 'ok' : ''),
  tile(vt ? 'yes' : 'no', 'this browser fades between pages', vt ? 'ok' : ''),
  tile(matchMedia('(prefers-reduced-motion: reduce)').matches ? 'reduced' : 'full', 'motion you asked for'),
]);
text('/speculation-rules.json').then((s) => { $('rules').textContent = JSON.stringify(JSON.parse(s), null, 2); }).catch(() => { $('rules').textContent = 'not served'; });

// 6. Files for machines: each one fetched now (static files only; the API rows are links, so no Function runs)
const FILES = [
  ['/llms.txt', 'AI agents: what Verse is and where to start'],
  ['/agents.txt', 'AI agents: what they may do here and how'],
  ['/openapi.json', 'the HTTP API, as OpenAPI 3.1'],
  ['/.well-known/api-catalog', 'RFC 9727 list of the APIs'],
  ['/.well-known/security.txt', 'RFC 9116: how to report a security hole'],
  ['/.well-known/gpc.json', 'Global Privacy Control is honored'],
  ['/humans.txt', 'who made it'],
  ['/robots.txt', 'crawlers'],
  ['/sitemap.xml', 'every page, for search'],
  ['/manifest.webmanifest', 'install Verse as an app'],
  ['/speculation-rules.json', 'Chrome: which links to prerender'],
  ['/opensearch.xml', 'add Verse as a search engine'],
];
Promise.all(FILES.map(([u, what]) => fetch(u, { cache: 'no-store' }).then(async (r) => [u, what, r.status, (r.headers.get('content-type') || '').split(';')[0], (await r.arrayBuffer()).byteLength]).catch(() => [u, what, 0, '', 0]))).then((rows) => {
  const trs = rows.map(([u, what, st, type, bytes]) => { const tr = el('tr'), a = el('a', '', u); a.href = u; const td = el('td'); td.append(a); tr.append(td, el('td', st === 200 ? 'ok' : 'bad', st ? String(st) : 'offline'), el('td', '', type), el('td', 'num', bytes.toLocaleString()), el('td', '', what)); return tr; });
  for (const [u, what] of [['/api/mcp', 'MCP server: every skill as a tool (POST JSON-RPC)'], ['/api/mcp/server-card', 'MCP server card'], ['/tools.json', 'every tool, as JSON']]) { const tr = el('tr'), a = el('a', '', u); a.href = u; const td = el('td'); td.append(a); tr.append(td, el('td', '', 'link'), el('td', '', 'API'), el('td', 'num', ''), el('td', '', what)); trs.push(tr); }
  $('files').replaceChildren(...trs);
});
