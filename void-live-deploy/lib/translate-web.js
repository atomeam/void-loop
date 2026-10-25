// A web page's words for the translate page (/translate/, "Translate a website", as Google, Yandex, Papago and Bing do): the server fetches
// one public page and hands back its title, its headings and paragraphs and its links as plain text; the page translates them in chunks
// through /api/translate and shows them. No HTML, script, style, picture or cookie of the fetched site ever reaches the visitor.
//
// What a stranger could make this do, and what stops it (docs/RULES.md: an open endpoint is designed against its worst caller):
//  - Reach inside: fetch localhost, a private or link-local address (169.254.169.254, the cloud metadata host), an .internal/.local name,
//    or Verse itself (a loop through its own API). checkUrl refuses any host that is an IP literal, a single label, a private suffix or
//    a-to-mind.com, any scheme but http(s), any port but 80/443, and a user:password in the URL; every redirect is checked again (at most 3).
//  - Use Verse as an open proxy or a downloader: only text/html or text/plain is read, at most MAX_BYTES, and only extracted words come
//    back (capped at MAX_BLOCKS blocks, MAX_TEXT characters), never the bytes; nothing is stored but a ten-minute edge copy of those words.
//  - Hammer a third-party site through Verse: one fetch per call, a short timeout, the per-client cap in functions/api/translate.js
//    (PAGE_RL a minute) and the ten-minute edge copy, so a page asked a thousand times is fetched once.
//  - Spend Verse's model: this file reads no model at all; the words are translated by the page through /api/translate, under its own cap.
//  - Inject into the visitor's page: everything returned is plain text the page puts in with textContent; links are http(s) URLs only.
export const MAX_BYTES = 1500000, MAX_BLOCKS = 400, MAX_TEXT = 60000, MAX_LINKS = 60, TIMEOUT_MS = 8000, MAX_HOPS = 3;

/** the URL to fetch, or throws why not. Pure. */
export function checkUrl(raw) {
  let s = String(raw || '').trim(); if (!s) throw new Error('a web address, like example.com');
  if (!/^[a-z][a-z0-9+.-]*:/i.test(s)) s = 'https://' + s;
  let u; try { u = new URL(s); } catch (_) { throw new Error('that is not a web address'); }
  if (!/^https?:$/.test(u.protocol)) throw new Error('only http and https pages');
  if (u.username || u.password) throw new Error('no user names or passwords in the address');
  if (u.port && !['80', '443'].includes(u.port)) throw new Error('only the usual web ports');
  const h = u.hostname.toLowerCase().replace(/\.$/, '');
  if (/^\[|^[\d.]+$|^0x|:/.test(h)) throw new Error('a name, not a number address');
  if (!h.includes('.') || /(?:^|\.)(?:localhost|local|internal|intranet|lan|home|corp|private|test|invalid|example|onion|arpa)$/.test(h)) throw new Error('only public sites');
  if (/(?:^|\.)a-to-mind\.com$/.test(h)) throw new Error('this is Verse itself: open it in another tab instead');
  u.hash = '';
  return u;
}

const ENT = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', mdash: '—', ndash: '–', hellip: '…', rsquo: '’', lsquo: '‘', rdquo: '”', ldquo: '“', copy: '©', reg: '®', laquo: '«', raquo: '»', middot: '·', bull: '•' };
const unent = (s) => s.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, e) => { try { return e[0] === '#' ? String.fromCodePoint(e[1] === 'x' || e[1] === 'X' ? parseInt(e.slice(2), 16) : +e.slice(1)) : ENT[e.toLowerCase()] ?? m; } catch (_) { return m; } });
const flat = (s) => unent(String(s).replace(/<[^>]*>/g, ' ')).replace(/\s+/g, ' ').trim();
const BLOCK = 'p|div|li|ul|ol|dl|dt|dd|tr|td|th|table|thead|tbody|section|article|aside|header|footer|main|nav|form|blockquote|figure|figcaption|pre|br|hr|h[1-6]|address|details|summary|caption|label|button|option';

/** a page's HTML -> { title, lang, blocks: [{ h: 0|1..6, text }], links: [{ text, url }] }: the words in reading order, headings marked,
 *  scripts, styles, menus' code and comments gone. Pure, no DOM (it runs in the Worker and in node). */
export function extract(html, base) {
  let s = String(html || '');
  const title = flat((s.match(/<title\b[^>]*>([\s\S]*?)<\/title>/i) || [])[1] || '');
  const lang = ((s.match(/<html\b[^>]*\blang=["']?([a-zA-Z-]+)/i) || [])[1] || '').toLowerCase();
  s = s.replace(/<!--[\s\S]*?-->/g, ' ').replace(/<(script|style|noscript|template|svg|math|iframe|object|canvas|select|textarea|head|title)\b[\s\S]*?<\/\1\s*>/gi, ' ');
  const links = [], seen = new Set();
  for (const m of s.matchAll(/<a\b[^>]*\bhref\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))[^>]*>([\s\S]*?)<\/a>/gi)) {
    if (links.length >= MAX_LINKS) break;
    const text = flat(m[4]); if (!text || text.length > 120) continue;
    let u; try { u = new URL(unent(m[1] ?? m[2] ?? m[3] ?? ''), base); } catch (_) { continue; }
    if (!/^https?:$/.test(u.protocol)) continue; u.hash = '';
    if (seen.has(u.href)) continue; seen.add(u.href); links.push({ text, url: u.href });
  }
  s = s.replace(new RegExp('<(h[1-6])\\b[^>]*>', 'gi'), (m, h) => '\n\u0001' + h[1] + '\u0002').replace(new RegExp('</?(?:' + BLOCK + ')\\b[^>]*>', 'gi'), '\n');
  const blocks = []; let total = 0;
  for (const raw of s.split('\n')) {
    const hm = raw.match(/\u0001(\d)\u0002/), text = flat(raw.replace(/[\u0001\u0002]\d?/g, ' '));
    if (!text || !/\p{L}{2}/u.test(text)) continue;
    if (blocks.length >= MAX_BLOCKS || total + text.length > MAX_TEXT) return { title, lang, blocks, links, truncated: true };
    const prev = blocks[blocks.length - 1]; if (prev && prev.text === text) continue;
    blocks.push({ h: hm ? +hm[1] : 0, text }); total += text.length;
  }
  return { title, lang, blocks, links, truncated: false };
}

/** the page fetched under the limits above: { url (after redirects), html }, or throws a reason a person can read. */
export async function fetchPage(raw, fetchFn = fetch) {
  let u = checkUrl(raw);
  for (let hop = 0; ; hop++) {
    const ctl = new AbortController(), timer = setTimeout(() => ctl.abort(), TIMEOUT_MS);
    let r;
    try { r = await fetchFn(u.href, { redirect: 'manual', signal: ctl.signal, headers: { accept: 'text/html,text/plain;q=0.9', 'user-agent': 'Mozilla/5.0 (compatible; VerseTranslate/1.0; +https://a-to-mind.com/translate/)' } }); }
    catch (e) { clearTimeout(timer); throw new Error(ctl.signal.aborted ? 'the site took too long to answer' : 'the site could not be reached'); }
    if (r.status >= 300 && r.status < 400 && r.headers.get('location')) {
      clearTimeout(timer); if (hop >= MAX_HOPS) throw new Error('the site sent Verse round too many redirects');
      u = checkUrl(new URL(r.headers.get('location'), u).href); continue;
    }
    try {
      if (!r.ok) throw new Error('the site answered ' + r.status);
      const type = (r.headers.get('content-type') || '').toLowerCase();
      if (type && !/^text\/(?:html|plain)|application\/xhtml/.test(type)) throw new Error('that address is not a web page (' + type.split(';')[0] + ')');
      const len = +r.headers.get('content-length') || 0; if (len > MAX_BYTES * 4) throw new Error('the page is too big to translate here');
      const reader = r.body && r.body.getReader ? r.body.getReader() : null; let bytes;
      if (reader) {
        const chunks = []; let n = 0;
        for (;;) { const { done, value } = await reader.read(); if (done) break; chunks.push(value); n += value.length; if (n >= MAX_BYTES) { try { await reader.cancel(); } catch (_) {} break; } }
        bytes = new Uint8Array(Math.min(n, MAX_BYTES)); let p = 0; for (const c of chunks) { const take = Math.min(c.length, bytes.length - p); bytes.set(c.subarray(0, take), p); p += take; if (p >= bytes.length) break; }
      } else bytes = new Uint8Array(await r.arrayBuffer()).subarray(0, MAX_BYTES);
      const cs = (type.match(/charset=([\w-]+)/) || [])[1] || 'utf-8';
      let html; try { html = new TextDecoder(cs).decode(bytes); } catch (_) { html = new TextDecoder().decode(bytes); }
      if (/^text\/plain/.test(type)) html = '<pre>' + html.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/\n{2,}/g, '</pre><pre>') + '</pre>';
      return { url: u.href, html };
    } finally { clearTimeout(timer); }
  }
}
