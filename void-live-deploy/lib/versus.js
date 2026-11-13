// Versus tools: letter shift, a timed track list, and a weigh-up of a page's markup. Pure.
const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const clock = (sec) => { const s = Math.max(0, Math.round(sec)), h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), r = s % 60; const mm = String(m).padStart(h ? 2 : 1, '0'), ss = String(r).padStart(2, '0'); return h ? h + ':' + String(m).padStart(2, '0') + ':' + ss : mm + ':' + ss; };
const secs = (t) => { const p = String(t || '').split(':').map((n) => Number(n)); if (p.some((n) => !Number.isFinite(n) || n < 0) || p.length < 2 || p.length > 3) return null; return p.length === 3 ? p[0] * 3600 + p[1] * 60 + p[2] : p[0] * 60 + p[1]; };

/** letters move by `places`. 0 and 26 leave letters where they are. Anything that is not a letter stays. 13 undoes 13. */
export function rotateLetters(text, places) {
  let n = Math.trunc(Number(places));
  if (!Number.isFinite(n)) n = 13;
  n = ((n % 26) + 26) % 26;
  return String(text || '').replace(/[A-Za-z]/g, (ch) => {
    const base = ch <= 'Z' ? 65 : 97;
    return String.fromCharCode(base + ((ch.charCodeAt(0) - base + n) % 26));
  });
}

/** the menu on the page: 1 through 25. A missing amount, 0, or anything past 25 becomes 13 or 25. */
export function shiftPlaces(places) {
  let n = Math.trunc(Number(places));
  if (!Number.isFinite(n) || n === 0) return 13;
  if (n < 1) return 13;
  if (n > 25) return 25;
  return n;
}

/** the shift that reads a result back. 13 stays 13. 5 becomes 21. */
export function reverseShift(places) {
  return 26 - shiftPlaces(places);
}

function selectShift(html, shift) {
  return String(html).replace(/<select\b[^>]*\bid="shift"[\s\S]*?<\/select>/i, (block) => {
    const cleared = block.replace(/\sselected(?:="selected"|='selected')?/gi, '');
    return cleared.replace(new RegExp('(<option\\b[^>]*\\bvalue="' + shift + '")', 'i'), '$1 selected');
  });
}

function handoffHref(html, base, param, value) {
  const href = base + '?' + param + '=' + encodeURIComponent(value);
  const needle = base.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return String(html).replace(new RegExp('<a\\b[^>]*\\bdata-base="' + needle + '"[^>]*>', 'i'), (tag) => {
    if (/\bhref="/.test(tag)) return tag.replace(/\bhref="[^"]*"/, 'href="' + href + '"');
    return tag.replace('<a', '<a href="' + href + '"');
  });
}

/** lines of "start title" or "start title length" or "title length". Start times fill in when only lengths are given. */
export function parseTracks(raw) {
  const rows = [];
  for (const line of String(raw || '').split(/\r?\n/)) {
    const t = line.trim(); if (!t || t.startsWith('#')) continue;
    const start = t.match(/^(\d{1,2}:\d{2}(?::\d{2})?)\s+(.+)$/);
    if (start && secs(start[1]) != null) {
      let title = start[2].trim(), len = null;
      const tail = title.match(/^(.*\S)\s+(\d{1,2}:\d{2}(?::\d{2})?)$/);
      if (tail && secs(tail[2]) != null) { title = tail[1].trim(); len = secs(tail[2]); }
      rows.push({ start: secs(start[1]), title, len }); continue;
    }
    const only = t.match(/^(.+?)\s+(\d{1,2}:\d{2}(?::\d{2})?)$/);
    if (only && secs(only[2]) != null) rows.push({ start: null, title: only[1].trim(), len: secs(only[2]) });
  }
  let cursor = 0, known = rows.every((r) => r.start != null);
  if (!known) for (const r of rows) { if (r.start == null) r.start = cursor; if (r.len != null) cursor = r.start + r.len; }
  for (let i = 0; i < rows.length; i++) if (rows[i].len == null && rows[i + 1] && rows[i + 1].start != null) rows[i].len = Math.max(0, rows[i + 1].start - rows[i].start);
  const last = rows[rows.length - 1];
  const total = last ? last.start + (last.len || 0) : 0;
  return { rows, total, text: rows.map((r) => clock(r.start) + '\t' + r.title + (r.len != null ? '\t' + clock(r.len) : '')).join('\n'), clock };
}

/** how heavy a chunk of markup is: bytes, pictures, custom font requests, scripts. */
export function weigh(html) {
  const s = String(html || '');
  return { bytes: new TextEncoder().encode(s).length, images: (s.match(/<img\b/gi) || []).length, fonts: (s.match(/@font-face|fonts\.googleapis|fonts\.gstatic|use\.typekit/gi) || []).length, scripts: (s.match(/<script\b/gi) || []).length };
}

export function putText(html, id, text) {
  const re = new RegExp('(<[^>\\s]*\\sid="' + id + '"[^>]*>)[\\s\\S]*?(</)', 'i');
  return String(html).replace(re, '$1' + esc(text) + '$2');
}

/** fill a Versus page from its query string, or pass the static page through. */
export async function fillVersus(context, kind) {
  const url = new URL(context.request.url);
  const hit = kind === 'rotate' ? url.searchParams.has('text') : kind === 'tracks' ? url.searchParams.has('list') : url.searchParams.has('html');
  if (!hit) return context.next();
  const asset = await context.next();
  let html = await asset.text();
  if (kind === 'rotate') {
    const text = url.searchParams.get('text') || '';
    const shift = shiftPlaces(url.searchParams.get('shift'));
    const result = rotateLetters(text, shift);
    const alphabet = rotateLetters('ABCDEFGHIJKLMNOPQRSTUVWXYZ', shift);
    const word = (result.match(/[A-Za-z]+/) || [])[0] || '';
    html = putText(html, 'text', text);
    html = selectShift(html, String(shift));
    html = putText(html, 'out', result);
    html = putText(html, 'map', 'A goes to ' + alphabet[0] + ', and Z goes to ' + alphabet[25] + '.');
    if (word) html = putText(html, 'wordbit', word);
    if (result.trim()) html = handoffHref(html, '/text-diff/', 'changed', result);
    if (word) html = handoffHref(html, '/meanings/', 'word', word);
  } else if (kind === 'tracks') {
    const list = url.searchParams.get('list') || '';
    const p = parseTracks(list);
    html = putText(html, 'list', list);
    html = putText(html, 'out', p.text);
    html = putText(html, 'total', p.rows.length ? p.rows.length + ' tracks, ' + clock(p.total) + ' in all' : '');
    const share = '/track-times/?list=' + encodeURIComponent(list);
    html = html.replace(/(<a\b[^>]*\bid="share"[^>]*\bhref=")[^"]*/i, '$1' + share);
    html = putText(html, 'share', share);
  } else {
    const raw = url.searchParams.get('html') || '';
    const w = weigh(raw);
    const line = raw ? w.bytes + ' bytes · ' + w.images + ' pictures · ' + w.fonts + ' font requests · ' + w.scripts + ' scripts' : '';
    html = putText(html, 'html', raw);
    html = putText(html, 'out', line);
    if (line) {
      const href = '/text-diff/?changed=' + encodeURIComponent(line);
      html = html.replace(/<a\b[^>]*\bdata-base="\/text-diff\/"[^>]*>/i, (tag) => tag.replace(/\bhref="[^"]*"/, 'href="' + href + '"'));
    }
  }
  return new Response(html, { headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' } });
}
export { esc, clock };
