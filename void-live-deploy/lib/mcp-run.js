// mcp-run: one of Verse's proven skills run on the server for its MCP tool (lib/mcp.js skill_*). The skill's own run(), the
// same code the page calls, gets a headless page: showPage hands it an element that only keeps its innerHTML, and the last card
// it drew is read back as plain text. No model answers in its place (owner, 2026-10-30: "Only skills with real passing
// evidence, no stubs"). Read-only: a skill reaches only the public services its card already uses (Wiktionary, Wikidata,
// Wikiquote, Datamuse, Open-Meteo's geocoder, a translator, a joke service), each with no key and nothing paid. Pure but for
// that network, and tested in node (tools/mcp-run.test.mjs).
export const UA = 'Verse/1 (https://a-to-mind.com; a skill run for an MCP client)';
export const RUN_MS = 10000;

const ENT = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', ldquo: '\u201c', rdquo: '\u201d', lsquo: '\u2018', rsquo: '\u2019', hellip: '\u2026',
  ndash: '\u2013', mdash: '\u2014', middot: '\u00b7', times: '\u00d7', deg: '\u00b0', rarr: '\u2192', larr: '\u2190' };
const decode = (s) => s.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+\d*);/gi, (m, e) => {
  if (e[0] === '#') { const n = e[1] === 'x' || e[1] === 'X' ? parseInt(e.slice(2), 16) : +e.slice(1); return Number.isFinite(n) && n > 0 && n < 0x110000 ? String.fromCodePoint(n) : m; }
  return Object.prototype.hasOwnProperty.call(ENT, e.toLowerCase()) ? ENT[e.toLowerCase()] : m;
});

/** a card's HTML as plain text: one line per heading, paragraph, list item or block, list items as "- ". Pure. */
export function textOf(html) {
  const s = String(html || '')
    .replace(/<(script|style|template|svg|button|input|textarea|select)\b[\s\S]*?<\/\1>|<(input|img|br)\b[^>]*>/gi, (m, a, b) => (b && b.toLowerCase() === 'br' ? '\n' : ''))
    .replace(/<li\b[^>]*>/gi, '\n- ')
    .replace(/<\/?(h[1-6]|p|div|ul|ol|li|tr|table|section|figure|figcaption|blockquote)\b[^>]*>/gi, '\n')
    .replace(/<[^>]+>/g, '');
  return decode(s).split('\n').map((l) => l.replace(/[ \t ]+/g, ' ').trim()).filter(Boolean).join('\n');
}

/** the outside links a card cites (https, with their words): its sources. Not the in-page asks (href="#"). Pure. */
export function linksOf(html) {
  const out = [];
  for (const m of String(html || '').matchAll(/<a\b[^>]*\bhref="(https:\/\/[^"]+)"[^>]*>([\s\S]*?)<\/a>/gi)) {
    const url = decode(m[1]), title = textOf(m[2]).replace(/\n/g, ' ');
    if (title && !out.some((x) => x.url === url)) out.push({ title: title.slice(0, 120), url });
  }
  return out.slice(0, 8);
}

/** fetch with Verse's user-agent when the caller set none (Wikimedia asks every client to name itself) */
export function namedFetch(f) {
  return (url, opts = {}) => {
    const headers = new Headers(opts.headers || {});
    if (!headers.has('user-agent')) headers.set('user-agent', UA);
    return f(url, { ...opts, headers });
  };
}

// a card says a time is "13 h ahead of you", meaning the viewer's clock; run on the server, "you" is the server's clock, UTC, so the
// MCP client is told that instead of a time difference to nobody
export const serverYou = (t) => t.replace(/\b(ahead of|behind) you\b/g, '$1 UTC').replace(/\bsame time as you\b/g, 'same time as UTC');

// an element that keeps what a skill writes into it and does nothing else: no stage, no events, no layout
function headlessEl() {
  const noop = () => {};
  return { innerHTML: '', textContent: '', className: '', dataset: {}, style: {}, hidden: false, classList: { add: noop, remove: noop, toggle: noop, contains: () => false },
    querySelector: () => null, querySelectorAll: () => [], addEventListener: noop, removeEventListener: noop, setAttribute: noop, getAttribute: () => null,
    appendChild: (x) => x, insertBefore: (x) => x, remove: noop, focus: noop, scrollIntoView: noop };
}

/**
 * run one skill on one ask: { ok, text, html, links, src } when it answered, { ok: false, why, text } when it did not.
 * mod is the skill module's default export ({ name, match, run }); fetchImpl reaches the public services the skill uses.
 */
export async function runSkill(mod, ask, { fetchImpl = fetch, ms = RUN_MS } = {}) {
  const text = String(ask || '').trim().slice(0, 600), lower = text.toLowerCase();
  if (text.length < 3) return { ok: false, why: 'short', text: '' };
  let matched = false;
  try { matched = !!mod.match(lower, text); } catch (_) { matched = false; }
  if (!matched) return { ok: false, why: 'not-this-skill', text: '' };
  const pages = [];
  const api = {
    esc: (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])),
    showPage: (fn) => { const el = headlessEl(); pages.push(el); fn(el); return el; },
    _pageStill: (el) => pages[pages.length - 1] === el,
    say: () => {}, loopLog: () => {}, reportMiss: () => {},
    fetch: namedFetch(fetchImpl),
  };
  let src, timer;
  try {
    src = await Promise.race([Promise.resolve().then(() => mod.run(text, api)), new Promise((resolve) => { timer = setTimeout(() => resolve('timeout'), ms); })]);
  } catch (_) { src = 'error'; } finally { clearTimeout(timer); }
  const el = pages[pages.length - 1], html = el ? String(el.innerHTML || '') : '';
  const out = serverYou(textOf(html));
  if (src === 'timeout') return { ok: false, why: 'timeout', text: out };
  if (src === 'error' || src === 'none' || !src || !out) return { ok: false, why: src === 'error' ? 'error' : 'none', text: out };
  return { ok: true, src: String(src), text: out, html, links: linksOf(html) };
}
