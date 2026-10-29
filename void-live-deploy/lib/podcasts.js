// The podcasts page's pure half (void-live-deploy/podcasts/, functions/api/podcasts.js): reading a podcast feed into rows, the address check
// that keeps the server's fetch off private networks, durations, chapters, transcripts, OPML in and out, and the words a share carries.
// Everything here is pure (no network, no DOM) so the server, the page and the tests all use the same code.
export const MAX_EPISODES = 300, MAX_NOTES = 1500, MAX_SHOW_NOTES = 2000;

// ---- addresses: what the server may fetch for a stranger ------------------------------------------------------------------------------
const BAD_SUFFIX = /\.(?:local|localhost|internal|intranet|lan|home|corp|private|test|invalid|example|onion|arpa)$/i;
/** why an address may not be fetched, or '' when it may: https only, no sign-in in it, port 443, a real public name (no IP address in any
 *  spelling, no localhost, no internal suffix, no single-label host). Pure. */
export function whyNot(raw) {
  let u; try { u = new URL(String(raw || '').trim()); } catch (_) { return 'not an address'; }
  if (u.protocol !== 'https:') return 'only https addresses';
  if (u.username || u.password) return 'no sign-in in the address';
  if (u.port && u.port !== '443') return 'only the standard port';
  if (String(raw).length > 2000) return 'too long';
  const h = u.hostname.toLowerCase().replace(/\.$/, '');
  if (!h || h.includes(':') || h.startsWith('[')) return 'no IP addresses'; // IPv6 literal
  if (/^[\d.]+$/.test(h) || /^0x[0-9a-f]+$/i.test(h) || /^\d+$/.test(h)) return 'no IP addresses'; // dotted, hex and whole-number IPv4 spellings
  if (!h.includes('.') || h === 'localhost' || BAD_SUFFIX.test(h)) return 'not a public name';
  if (!/^[a-z0-9.-]+$/.test(h) && !/^[a-z0-9.\-¡-￿]+$/i.test(h)) return 'not a public name';
  return '';
}
export const okUrl = (raw) => !whyNot(raw);
/** an http:// audio or picture address upgraded to https (the page is https; a mixed address would be blocked), '' when it is not a web address. Pure. */
export function secure(u) { const s = String(u || '').trim(); if (/^https:\/\//i.test(s)) return s; if (/^http:\/\//i.test(s)) return 'https://' + s.slice(7); return ''; }

// ---- reading XML without a DOM (the server has none) ------------------------------------------------------------------------------------
const ENT = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', rsquo: '’', lsquo: '‘', rdquo: '”', ldquo: '“', ndash: '–', mdash: '—', hellip: '…' };
/** XML/HTML entities decoded (named few, numeric all). Pure. */
export const decode = (s) => String(s == null ? '' : s).replace(/&(?:#(\d{1,7})|#x([0-9a-f]{1,6})|([a-z]{2,6}));/gi, (m, d, x, n) => {
  if (n) return ENT[n.toLowerCase()] !== undefined ? ENT[n.toLowerCase()] : m;
  const c = d ? +d : parseInt(x, 16); try { return c > 0 && c < 0x110000 ? String.fromCodePoint(c) : m; } catch (_) { return m; } });
const unCdata = (s) => String(s).replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, (m, c) => c);
/** text held to `max` characters at the end of a sentence (or a line), else at a word: whole sentences only, no ellipsis. Pure. */
export function cutAt(text, max) {
  const t = String(text || ''); if (t.length <= max) return t;
  const head = t.slice(0, max), ends = [...head.matchAll(/[.!?\u3002](?:["')\]]*)(?=\s|$)|\n/g)].map((m) => m.index + m[0].length), end = ends.length ? ends[ends.length - 1] : 0;
  return (end > max * 0.4 ? head.slice(0, end) : head.replace(/\s+\S*$/, '')).trim();
}
/** HTML show notes as plain words: tags dropped, paragraphs and list items kept as line breaks, entities decoded, capped. Pure. */
export function plain(html, max = MAX_NOTES) {
  let t = decode(unCdata(html)).replace(/<(script|style)[\s\S]*?<\/\1>/gi, ' ').replace(/<\s*(?:br|\/p|\/div|\/li|\/h[1-6]|\/ul|\/ol)\s*\/?>/gi, '\n').replace(/<li[^>]*>/gi, '• ').replace(/<[^>]*>/g, '');
  t = decode(t).replace(/[ \t ]+/g, ' ').replace(/ *\n */g, '\n').replace(/\n{3,}/g, '\n\n').trim();
  return cutAt(t, max);
}
const esc = (n) => n.replace(/[.*+?^${}()|[\]\\:]/g, '\\$&');
/** the text inside the first <name>…</name> of a block ('' when none), CDATA opened. */
export function inner(block, name) { const m = new RegExp('<' + esc(name) + '(?:\\s[^>]*)?>([\\s\\S]*?)</' + esc(name) + '>', 'i').exec(block); return m ? decode(unCdata(m[1])).trim() : ''; }
/** the raw (still tagged) inside of the first <name>…</name>, CDATA opened. */
export function rawInner(block, name) { const m = new RegExp('<' + esc(name) + '(?:\\s[^>]*)?>([\\s\\S]*?)</' + esc(name) + '>', 'i').exec(block); return m ? unCdata(m[1]) : ''; }
/** every <name …> tag's attributes as objects, self-closing or not. */
export function tags(block, name) {
  const out = [], re = new RegExp('<' + esc(name) + '(\\s[^>]*?)?/?>', 'gi'); let m;
  while ((m = re.exec(block))) { const a = {}; String(m[1] || '').replace(/([\w:.-]+)\s*=\s*(?:"([^"]*)"|'([^']*)')/g, (x, k, v1, v2) => { a[k.toLowerCase()] = decode(v1 !== undefined ? v1 : v2); return ''; }); out.push(a); }
  return out;
}

// ---- time ----------------------------------------------------------------------------------------------------------------------------------
/** a feed's duration ("1:02:03", "62:10", "3723", "3723.5") as whole seconds, 0 when unreadable. Pure. */
export function seconds(d) {
  const s = String(d == null ? '' : d).trim(); if (!s) return 0;
  if (/^\d+(?:\.\d+)?$/.test(s)) return Math.round(+s);
  const p = s.split(':'); if (p.length > 3 || p.some((x) => !/^\d+(?:\.\d+)?$/.test(x))) return 0;
  return Math.round(p.reduce((a, x) => a * 60 + +x, 0));
}
/** seconds as 3:25 or 1:02:03 (a clock), '' for nothing. Pure. */
export function clock(s) { s = Math.floor(+s); if (!Number.isFinite(s) || s < 0) return ''; const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), r = s % 60; return h ? h + ':' + String(m).padStart(2, '0') + ':' + String(r).padStart(2, '0') : m + ':' + String(r).padStart(2, '0'); }
/** a length in words for a list row: "3 min", "1 h 5 min". Pure. */
export function lengthWords(s) { s = Math.round(+s || 0); if (s <= 0) return ''; if (s < 60) return s + ' s'; const m = Math.round(s / 60); return m < 60 ? m + ' min' : Math.floor(m / 60) + ' h' + (m % 60 ? ' ' + (m % 60) + ' min' : ''); }
export const SPEEDS = Object.freeze([0.5, 0.75, 1, 1.25, 1.5, 1.75, 2, 2.5, 3]);
/** a playback speed held to what players can do: 0.5 to 3, in steps of 0.05. Pure. */
export const clampSpeed = (v) => { const n = +v; return Number.isFinite(n) ? Math.min(3, Math.max(0.5, Math.round(n * 20) / 20)) : 1; };
export const SLEEPS = Object.freeze([['off', 'Off'], [5, '5 minutes'], [10, '10 minutes'], [15, '15 minutes'], [30, '30 minutes'], [45, '45 minutes'], [60, '1 hour'], ['end', 'End of episode']]);
/** a feed date as a sortable ISO day-time ('' when unreadable). Pure. */
export function isoDate(d) { const t = Date.parse(String(d || '')); return Number.isFinite(t) ? new Date(t).toISOString() : ''; }
/** where a played episode stands: 'played', 'started' (more than 10 s in) or 'new'. Pure. */
export function stateOf(pos) { if (!pos) return 'new'; if (pos.p) return 'played'; return pos.t > 10 ? 'started' : 'new'; }
/** the place to resume from: the saved second, unless it is the first seconds or the last 15 seconds (then from the start). Pure. */
export function resumeAt(pos, duration) { const t = pos && +pos.t; if (!t || t < 10) return 0; const d = +duration || (pos && +pos.d) || 0; return d && t > d - 15 ? 0 : t; }

// ---- a feed into rows ----------------------------------------------------------------------------------------------------------------------
/** a stable short id for an episode from its guid (or its audio address), the same on every device. Pure. */
export function hash(s) { let h = 5381; const t = String(s); for (let i = 0; i < t.length; i++) h = ((h << 5) + h + t.charCodeAt(i)) | 0; return (h >>> 0).toString(36); }
const kindOf = (type, url) => { const t = String(type || '').toLowerCase(), u = String(url || '').toLowerCase().split('?')[0]; return /vtt/.test(t) || u.endsWith('.vtt') ? 'vtt' : /srt|subrip/.test(t) || u.endsWith('.srt') ? 'srt' : /json/.test(t) || u.endsWith('.json') ? 'json' : /html/.test(t) || /\.html?$/.test(u) ? 'html' : 'text'; };
/** inline chapters of an item (Podlove simple chapters: <psc:chapter start="0:00" title="…"/>), as [{ t, title }]. Pure. */
export function inlineChapters(block) { return tags(block, 'psc:chapter').map((a) => ({ t: seconds(a.start), title: String(a.title || '').slice(0, 200) })).filter((c) => c.title).slice(0, 200); }
/** one <item> as an episode row, or null when it has no audio. Pure. */
export function episodeOf(block) {
  const enc = tags(block, 'enclosure')[0]; const audio = enc ? secure(enc.url) : '';
  if (!audio) { const m = tags(block, 'media:content').find((a) => /audio/i.test(a.type || a.medium || '')); if (!m || !secure(m.url)) return null; return finish(block, secure(m.url), m.type, +m.filesize || 0); }
  return finish(block, audio, enc.type, +enc.length || 0);
}
function finish(block, audio, type, bytes) {
  const guid = inner(block, 'guid'), title = plain(rawInner(block, 'title'), 300) || 'Untitled episode', img = tags(block, 'itunes:image')[0];
  const notes = plain(rawInner(block, 'content:encoded') || rawInner(block, 'itunes:summary') || rawInner(block, 'description'), MAX_NOTES);
  const chap = tags(block, 'podcast:chapters')[0], tr = tags(block, 'podcast:transcript').filter((a) => a.url && okUrl(secure(a.url))).map((a) => ({ url: secure(a.url), kind: kindOf(a.type, a.url) }));
  const ep = { id: hash(guid || audio), title, audio, type: String(type || 'audio/mpeg').slice(0, 40), bytes: bytes > 0 ? bytes : 0, dur: seconds(inner(block, 'itunes:duration')), pub: isoDate(inner(block, 'pubDate') || inner(block, 'dc:date')),
    notes, image: img ? secure(img.href) : '' };
  const ex = inner(block, 'itunes:explicit'); if (/^(?:true|yes)$/i.test(ex)) ep.explicit = true;
  const season = inner(block, 'itunes:season'), n = inner(block, 'itunes:episode'); if (/^\d{1,4}$/.test(season)) ep.season = +season; if (/^\d{1,5}$/.test(n)) ep.n = +n;
  if (chap && okUrl(secure(chap.url))) ep.chaptersUrl = secure(chap.url);
  const inl = inlineChapters(block); if (inl.length) ep.chapters = inl;
  if (tr.length) ep.transcripts = tr.slice(0, 4);
  if (/video\//i.test(ep.type)) ep.video = true;
  return ep;
}
/** a whole feed as { title, author, description, image, link, language, feed, episodes, total, truncated }, or null when it is not a podcast feed
 *  (no channel, or no episode with audio). `xml` may be cut short (the server stops reading at its cap): complete items are used. Pure. */
export function parseFeed(xml, feedUrl = '', truncated = false) {
  const x = String(xml || ''); if (!/<(?:channel|feed)[\s>]/i.test(x)) return null;
  const firstItem = x.search(/<item[\s>]/i), head = firstItem < 0 ? x : x.slice(0, firstItem);
  const items = []; const re = /<item(?:\s[^>]*)?>([\s\S]*?)<\/item>/gi; let m, total = 0;
  while ((m = re.exec(x))) { total++; if (items.length < MAX_EPISODES) { const e = episodeOf(m[1]); if (e) items.push(e); } }
  if (!items.length) return null;
  const img = tags(head, 'itunes:image')[0], urlImg = rawInner(head.replace(/^[\s\S]*?<image[\s>]/i, '<image>'), 'url');
  const seen = new Set(); const episodes = items.filter((e) => (seen.has(e.id) ? false : seen.add(e.id)));
  const type = inner(head, 'itunes:type');
  if (/serial/i.test(type) && episodes.every((e) => e.n)) episodes.sort((a, b) => (b.season || 0) - (a.season || 0) || b.n - a.n); else episodes.sort((a, b) => (b.pub || '').localeCompare(a.pub || '') || 0);
  const author = inner(head, 'itunes:author') || inner(head, 'author') || inner(head, 'managingEditor');
  return { title: plain(rawInner(head, 'title'), 200) || 'Untitled show', author: plain(author, 200), description: plain(rawInner(head, 'itunes:summary') || rawInner(head, 'description'), MAX_SHOW_NOTES),
    image: secure(img ? img.href : decode(urlImg).trim()), link: secure(inner(head, 'link')), language: inner(head, 'language').slice(0, 12), feed: feedUrl, episodes, total, truncated: !!truncated || total > MAX_EPISODES, ...(type ? { type: type.toLowerCase() } : {}) };
}

// ---- chapters and transcripts --------------------------------------------------------------------------------------------------------------
/** a chapters file (Podcast Namespace JSON: { chapters: [{ startTime, title, img }] }) as [{ t, title, img }]. Pure. */
export function parseChapters(text) {
  let j; try { j = JSON.parse(String(text || '')); } catch (_) { return []; }
  const list = Array.isArray(j) ? j : j && Array.isArray(j.chapters) ? j.chapters : [];
  return list.map((c) => ({ t: Math.max(0, Math.round(+(c.startTime != null ? c.startTime : c.start) || 0)), title: String(c.title || '').slice(0, 200), img: secure(c.img || c.image || '') })).filter((c) => c.title).slice(0, 300);
}
const stamp = (s) => { const m = /^(?:(\d+):)?(\d{1,2}):(\d{2})(?:[.,](\d{1,3}))?$/.exec(String(s).trim()); return m ? (+(m[1] || 0)) * 3600 + +m[2] * 60 + +m[3] + (m[4] ? +m[4] / 10 ** m[4].length : 0) : null; };
/** a transcript file (WebVTT, SubRip, Podcast Namespace JSON, HTML or plain text) as [{ t, text }] (t is null in plain text). Pure. */
export function parseTranscript(text, kind = 'text') {
  const raw = String(text || '').replace(/^﻿/, ''); let out = [];
  if (kind === 'json' || /^\s*[{[]/.test(raw)) { try { const j = JSON.parse(raw), segs = Array.isArray(j) ? j : j.segments || []; out = segs.map((s) => ({ t: s.startTime != null ? Math.round(+s.startTime * 10) / 10 : null, text: String(s.body || s.text || '').trim() })).filter((l) => l.text); if (out.length) return out.slice(0, 4000); } catch (_) {} }
  if (kind === 'vtt' || kind === 'srt' || /-->/.test(raw)) {
    for (const cue of raw.split(/\r?\n\r?\n+/)) { const lines = cue.split(/\r?\n/), i = lines.findIndex((l) => l.includes('-->')); if (i < 0) continue;
      const t = stamp(lines[i].split('-->')[0].trim().split(/\s/)[0]); const body = plain(lines.slice(i + 1).join(' '), 600).replace(/\s+/g, ' '); if (body) out.push({ t: t === null ? null : Math.round(t * 10) / 10, text: body }); }
    return out.slice(0, 4000);
  }
  const body = kind === 'html' ? plain(raw, 200000) : raw.replace(/\r/g, '');
  return body.split(/\n{2,}|\n/).map((l) => l.replace(/\s+/g, ' ').trim()).filter(Boolean).slice(0, 4000).map((text) => ({ t: null, text: text.slice(0, 800) }));
}

// ---- OPML: follows in and out --------------------------------------------------------------------------------------------------------------
/** the feeds in an OPML file as [{ feed, title }]: every outline with an xmlUrl, nested folders too, https only, no duplicates. Pure. */
export function parseOpml(text) {
  const seen = new Set(), out = [];
  for (const a of tags(String(text || ''), 'outline')) { const u = secure(a.xmlurl || ''); if (!u || !okUrl(u) || seen.has(u)) continue; seen.add(u); out.push({ feed: u, title: String(a.title || a.text || '').slice(0, 200) }); }
  return out.slice(0, 500);
}
const x = (s) => String(s == null ? '' : s).replace(/[<>&"']/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;', "'": '&apos;' }[c]));
/** follows as an OPML 2.0 file any podcast app reads. Pure. */
export function buildOpml(follows, when = new Date()) {
  const rows = (follows || []).filter((f) => f && f.feed).map((f) => '    <outline type="rss" text="' + x(f.title || f.feed) + '" title="' + x(f.title || f.feed) + '" xmlUrl="' + x(f.feed) + '"' + (f.link ? ' htmlUrl="' + x(f.link) + '"' : '') + '/>').join('\n');
  return '<?xml version="1.0" encoding="UTF-8"?>\n<opml version="2.0">\n  <head><title>Verse podcasts</title><dateCreated>' + when.toUTCString() + '</dateCreated></head>\n  <body>\n' + rows + '\n  </body>\n</opml>\n';
}

// ---- the directory (iTunes Search, Apple's free public API, no key) -----------------------------------------------------------------------------
/** one iTunes search/lookup result as a show row { id, title, author, image, feed, genre, count }, or null. Pure. */
export function fromItunes(r) {
  if (!r || !r.collectionId) return null;
  return { id: String(r.collectionId), title: String(r.collectionName || r.trackName || '').slice(0, 200), author: String(r.artistName || '').slice(0, 200), image: secure(r.artworkUrl600 || r.artworkUrl100 || r.artworkUrl60), feed: okUrl(secure(r.feedUrl || '')) ? secure(r.feedUrl) : '', genre: String(r.primaryGenreName || '').slice(0, 60), count: +r.trackCount || 0 };
}
/** fyyd's directory answer (api.fyyd.de, free, no key: a search or its "hot" list) as show rows; it has no Apple id, so a row opens by its feed. Pure. */
export function fromFyyd(j) {
  const out = [];
  for (const r of Array.isArray(j && j.data) ? j.data : []) {
    const feed = secure(String(r && r.xmlURL || '')); if (!r || !r.title || !okUrl(feed)) continue;
    out.push({ id: '', title: String(r.title).slice(0, 200), author: String(r.author || '').slice(0, 200), image: secure(r.imgURL || r.smallImageURL || ''), feed, genre: '', count: +r.episode_count || 0 });
  }
  return out.slice(0, 50);
}
/** the top-podcasts chart in either of Apple's shapes (the iTunes RSS "feed.entry" list, or the marketing-tools "feed.results" list) as show rows. Pure. */
export function fromChart(j) {
  const f = (j && j.feed) || {}, out = [];
  for (const e of Array.isArray(f.entry) ? f.entry : f.entry ? [f.entry] : []) {
    const id = e.id && e.id.attributes && e.id.attributes['im:id']; if (!id) continue;
    const imgs = Array.isArray(e['im:image']) ? e['im:image'] : []; out.push({ id: String(id), title: String((e['im:name'] && e['im:name'].label) || '').slice(0, 200), author: String((e['im:artist'] && e['im:artist'].label) || '').slice(0, 200), image: secure((imgs[imgs.length - 1] || {}).label || ''), genre: String((e.category && e.category.attributes && e.category.attributes.label) || '').slice(0, 60) });
  }
  for (const r of Array.isArray(f.results) ? f.results : []) { if (!r.id) continue; out.push({ id: String(r.id), title: String(r.name || '').slice(0, 200), author: String(r.artistName || '').slice(0, 200), image: secure(String(r.artworkUrl100 || '').replace(/\/\d+x\d+bb\./, '/600x600bb.')), genre: String((r.genres && r.genres[0] && r.genres[0].name) || '').slice(0, 60) }); }
  return out.filter((s) => s.title).slice(0, 50);
}
/** Apple's category ids for the charts. */
export const GENRES = Object.freeze([[0, 'All categories'], [1301, 'Arts'], [1321, 'Business'], [1303, 'Comedy'], [1304, 'Education'], [1483, 'Fiction'], [1511, 'Government'], [1512, 'Health & Fitness'], [1487, 'History'], [1305, 'Kids & Family'], [1502, 'Leisure'], [1310, 'Music'], [1489, 'News'], [1314, 'Religion & Spirituality'], [1533, 'Science'], [1324, 'Society & Culture'], [1545, 'Sports'], [1318, 'Technology'], [1488, 'True Crime'], [1309, 'TV & Film']]);
export const COUNTRIES = Object.freeze([['us', 'United States'], ['gb', 'United Kingdom'], ['ca', 'Canada'], ['au', 'Australia'], ['ie', 'Ireland'], ['nz', 'New Zealand'], ['de', 'Germany'], ['fr', 'France'], ['es', 'Spain'], ['it', 'Italy'], ['nl', 'Netherlands'], ['se', 'Sweden'], ['br', 'Brazil'], ['mx', 'Mexico'], ['jp', 'Japan'], ['kr', 'South Korea'], ['in', 'India'], ['za', 'South Africa']]);

// ---- sharing, in words ---------------------------------------------------------------------------------------------------------------------
/** the words a share carries: the episode (or show) and where it comes from, then a short line of its notes. No picture, no tracking. Pure. */
export function shareText(show, ep) {
  const sh = show && show.title ? show.title : '', t = ep && ep.title ? ep.title : '', first = String((ep && ep.notes) || (show && show.description) || '').replace(/\s+/g, ' ').trim();
  const line = cutAt(first, 140);
  return [t ? t + (sh ? ' · ' + sh : '') : sh, line].filter(Boolean).join('\n');
}
/** the page address that opens a show (and an episode, and a second): Verse's own show is ?show=verse, an iTunes show ?show=<id>, any other a feed. Pure. */
export function shareLink(origin, show, ep, at = 0) {
  const q = new URLSearchParams(); if (show && show.verse) q.set('show', 'verse'); else if (show && show.id) q.set('show', show.id); else if (show && show.feed) q.set('feed', show.feed);
  if (ep && ep.id) q.set('ep', ep.id); if (at >= 5) q.set('t', String(Math.floor(at)));
  return String(origin || '').replace(/\/$/, '') + '/podcasts/' + (q.toString() ? '?' + q : '');
}
/** Verse's own show (public/podcast/episodes.json) in the same shape as any feed's rows, newest first. Pure. */
export function verseShow(j) {
  const eps = ((j && j.episodes) || []).map((e) => ({ id: 'ep' + e.n, title: e.title, audio: '/podcast/' + e.file, type: 'audio/mpeg', bytes: e.bytes || 0, dur: e.seconds || 0, pub: isoDate(e.pub), notes: String(e.summary || ''), image: '/podcast/cover-256.jpg', n: e.n,
    transcriptLines: (e.lines || []).map((l) => ({ t: l.t == null ? null : l.t, text: (l.who ? l.who + ': ' : '') + l.text })) })).sort((a, b) => b.n - a.n);
  return { verse: true, id: 'verse', title: 'Verse Out Loud', author: 'A-to-Mind', description: 'Verse, the blank stage at a-to-mind.com, reads its own week out loud: what it built, what it missed and fixed, and what it asked for next. Every line comes from its public ledger. Free to download and repost.', image: '/podcast/cover-256.jpg', link: 'https://a-to-mind.com/podcast/', language: 'en-us', feed: 'https://a-to-mind.com/podcast/rss.xml', episodes: eps, total: eps.length };
}
/** the ask bar's text as what the page should do: a feed address, or a search. Pure. */
export function kindOfInput(text) { const t = String(text || '').trim(); if (/^https?:\/\//i.test(t) || /^(?:feed|itpc|pcast):\/\//i.test(t)) return { feed: t.replace(/^(?:feed|itpc|pcast):\/\//i, 'https://').replace(/^http:\/\//i, 'https://') }; if (/^[\w-]+(?:\.[\w-]+)+\/\S+$/.test(t) && !/\s/.test(t)) return { feed: 'https://' + t }; return t ? { q: t.slice(0, 100) } : {}; }
