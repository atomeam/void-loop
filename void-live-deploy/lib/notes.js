// Notes (Versus' Google Docs floor and its lane, /notes/): the pure half, shared by the page and its tests. Everything on the device: documents live in
// localStorage (KEY). A note is a title and a body of a few safe tags (clean: pasted foreign styles, scripts and attributes are dropped), many notes
// make a list, search runs across all of them (search, mark), every note keeps versions (snapshot every 30 s of change or on demand, snapshotsFor lists
// them newest first, restore brings one back and keeps what it replaced), export goes out as .md, .html and .txt, .md and .txt come in (importText), one
// note travels as a link (shareLink: /notes/?n=<base64url json>), and a line of plain words becomes a note (quickNote: "note: Shopping list - milk, eggs,
// bread"). Pure throughout. Tests: tools/notes.test.mjs.

export const KEY = 'a2m.void.notes.v1';
export const EVERY = 30000; // ms of change between two automatic snapshots
export const KEEP = 100; // snapshots kept per note

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const ENT = { '&amp;': '&', '&lt;': '<', '&gt;': '>', '&quot;': '"', '&#39;': "'", '&nbsp;': ' ' };
const unent = (s) => String(s).replace(/&(?:amp|lt|gt|quot|#39|nbsp);/g, (m) => ENT[m]);

// ---- cleaning pasted or imported html: a whitelist, rebuilt attributes ----
const KEEP_TAGS = new Set(['b', 'i', 'u', 's', 'h1', 'h2', 'h3', 'ul', 'ol', 'li', 'p', 'div', 'br', 'code', 'pre', 'blockquote', 'a', 'hr', 'table', 'thead', 'tbody', 'tr', 'th', 'td', 'img', 'mark']);
/** a picture kept in a note: a data URL of a png, jpeg, gif or webp, at most 3 MB (the page shrinks photos before they go in) */
export const IMG_SRC = /^data:image\/(?:png|jpeg|gif|webp);base64,[A-Za-z0-9+/]+={0,2}$/;
const IMG_MAX = 3e6;
const ALIAS = { strong: 'b', em: 'i', strike: 's', del: 's', h4: 'h3', h5: 'h3', h6: 'h3' };
const TAG_RE = /<(\/?)([a-zA-Z][a-zA-Z0-9]*)((?:"[^"]*"|'[^']*'|[^>"'])*)>/g;
/** html reduced to b i u s h1-h3 ul ol li p div br code pre blockquote a (http, https, mailto only), img (data: pictures only, with alt) and mark (a comment's
 * anchor: class cm and its id); li/ul keep the checkbox classes. Pure. */
export function clean(html) {
  let h = String(html == null ? '' : html).replace(/<!--[\s\S]*?-->/g, '').replace(/<(script|style|head|title|iframe|object|svg|template)\b[\s\S]*?<\/\1\s*>/gi, '');
  let out = '', last = 0, m; const as = [];
  TAG_RE.lastIndex = 0;
  while ((m = TAG_RE.exec(h))) {
    out += h.slice(last, m.index).replace(/</g, '&lt;'); last = m.index + m[0].length;
    let tag = m[2].toLowerCase(); tag = ALIAS[tag] || tag;
    if (!KEEP_TAGS.has(tag)) continue;
    if (tag === 'img') { if (m[1]) continue; const sr = /\bsrc\s*=\s*(?:"([^"]*)"|'([^']*)')/i.exec(m[3]), u = sr ? (sr[1] ?? sr[2]).trim() : ''; if (u.length > IMG_MAX || !IMG_SRC.test(u)) continue; const al = /\balt\s*=\s*(?:"([^"]*)"|'([^']*)')/i.exec(m[3]); out += '<img src="' + u + '" alt="' + esc(unent(al ? (al[1] ?? al[2]) : '').slice(0, 300)) + '">'; continue; }
    if (tag === 'mark' && !m[1]) { const c = /\bdata-c\s*=\s*["']?([a-z0-9]{1,16})\b/i.exec(m[3]); out += c ? '<mark class="cm" data-c="' + c[1].toLowerCase() + '">' : '<mark>'; continue; }
    if (m[1]) { if (tag === 'a') { if (as.pop()) out += '</a>'; continue; } if (tag !== 'br' && tag !== 'hr') out += '</' + tag + '>'; continue; }
    const attrs = m[3]; let extra = '';
    if (tag === 'a') { const hr = /\bhref\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/i.exec(attrs); const u = hr ? unent(hr[1] ?? hr[2] ?? hr[3]).trim() : ''; if (!/^(?:https?:|mailto:)/i.test(u)) { as.push(false); continue; } as.push(true); extra = ' href="' + esc(u) + '" rel="noopener noreferrer" target="_blank"'; }
    if (tag === 'ul' && /\bclass\s*=\s*["']?[^"'>]*\btodo\b/i.test(attrs)) extra = ' class="todo"';
    if (tag === 'li') { const c = /\bclass\s*=\s*["']?([^"'>]*)/i.exec(attrs); const cs = c ? c[1] : ''; if (/\bchk\b/.test(cs)) extra = ' class="chk' + (/\bdone\b/.test(cs) ? ' done' : '') + '"'; }
    out += '<' + tag + extra + '>';
  }
  out += h.slice(last).replace(/</g, '&lt;');
  return out;
}

// ---- text, markdown, html out ----
/** plain text of a body: blocks on lines, list items with "- " (checkboxes "[ ]" and "[x]"), entities decoded. */
export function toText(html) {
  const s = clean(html).replace(/<li class="chk done">/g, '\n[x] ').replace(/<li class="chk">/g, '\n[ ] ').replace(/<li>/g, '\n- ')
    .replace(/<br>|<hr>/g, '\n').replace(/<\/t[dh]>(?=<t[dh])/g, ' | ').replace(/<\/(?:p|div|h[1-3]|ul|ol|pre|blockquote|li|tr)>/g, '\n').replace(/<(?:p|div|h[1-3]|pre|blockquote)>/g, '\n').replace(/<[^>]+>/g, '');
  return unent(s).replace(/[ \t]+\n/g, '\n').replace(/\n{2,}/g, '\n').trim();
}
export function wordCount(html) { const t = toText(html).replace(/^(?:- |\[[ x]\] )/gm, ''); const w = t.match(/[\p{L}\p{N}][\p{L}\p{N}'’-]*/gu); return w ? w.length : 0; }

/** the body as markdown. */
export function toMd(html) {
  const toks = clean(html).split(/(<[^>]+>)/).filter((x) => x !== '');
  let o = '', href = null, lists = [], pre = false;
  const nl = () => { if (o && !o.endsWith('\n')) o += '\n'; };
  const blank = () => { nl(); if (o && !o.endsWith('\n\n')) o += '\n'; };
  for (const t of toks) {
    const tm = /^<(\/?)([a-z0-9]+)([^>]*)>$/.exec(t);
    if (!tm) { o += unent(pre ? t : t.replace(/\s+/g, ' ')); continue; }
    const [, close, tag, at] = tm;
    if (!close) {
      if (tag === 'b') o += '**'; else if (tag === 'i') o += '*'; else if (tag === 's') o += '~~'; else if (tag === 'u') o += '<u>';
      else if (tag === 'code') o += pre ? '' : '`'; else if (tag === 'pre') { blank(); o += '```\n'; pre = true; }
      else if (/^h[1-3]$/.test(tag)) { blank(); o += '#'.repeat(+tag[1]) + ' '; }
      else if (tag === 'ul' || tag === 'ol') { if (!lists.length) blank(); else nl(); lists.push({ ol: tag === 'ol', n: 0 }); }
      else if (tag === 'li') { nl(); const L = lists[lists.length - 1] || { n: 0 }; L.n++; o += '  '.repeat(Math.max(0, lists.length - 1)) + (/chk done/.test(at) ? '- [x] ' : /chk/.test(at) ? '- [ ] ' : L.ol ? L.n + '. ' : '- '); }
      else if (tag === 'blockquote') { blank(); o += '> '; } else if (tag === 'p' || tag === 'div') nl(); else if (tag === 'br') o += '  \n';
      else if (tag === 'a') { const h = /href="([^"]*)"/.exec(at); href = h ? unent(h[1]) : null; o += '['; }
      else if (tag === 'img') { const sr = /src="([^"]*)"/.exec(at), al = /alt="([^"]*)"/.exec(at); o += '![' + unent(al ? al[1] : '').replace(/[\[\]]/g, '') + '](' + (sr ? sr[1] : '') + ')'; }
    } else if (tag === 'b') o += '**'; else if (tag === 'i') o += '*'; else if (tag === 's') o += '~~'; else if (tag === 'u') o += '</u>';
    else if (tag === 'code') o += pre ? '' : '`'; else if (tag === 'pre') { nl(); o += '```\n'; pre = false; }
    else if (/^h[1-3]$/.test(tag) || tag === 'blockquote') blank();
    else if (tag === 'ul' || tag === 'ol') { lists.pop(); if (!lists.length) blank(); } else if (tag === 'li') nl();
    else if (tag === 'p' || tag === 'div') blank(); else if (tag === 'a') o += '](' + (href || '') + ')';
  }
  return o.replace(/\n{3,}/g, '\n\n').trim() + '\n';
}

const inline = (s) => esc(s).replace(/`([^`]+)`/g, '<code>$1</code>').replace(/\*\*([^*]+)\*\*/g, '<b>$1</b>').replace(/__([^_]+)__/g, '<b>$1</b>').replace(/\*([^*\s][^*]*)\*/g, '<i>$1</i>')
  .replace(/~~([^~]+)~~/g, '<s>$1</s>').replace(/!\[([^\]]*)\]\((data:image\/(?:png|jpeg|gif|webp);base64,[A-Za-z0-9+/]+={0,2})\)/g, '<img src="$2" alt="$1">').replace(/\[([^\]]+)\]\(((?:https?:|mailto:)[^)\s]+)\)/g, '<a href="$2">$1</a>');
/** markdown (headings, lists, - [ ] tasks, fenced code, quotes, bold, italic, code, links) as a clean body. */
export function mdToHtml(md) {
  const lines = String(md || '').replace(/\r\n?/g, '\n').split('\n'); let out = '', i = 0;
  while (i < lines.length) {
    const l = lines[i];
    if (/^```/.test(l)) { const buf = []; i++; while (i < lines.length && !/^```/.test(lines[i])) buf.push(lines[i++]); i++; out += '<pre><code>' + esc(buf.join('\n')) + '</code></pre>'; continue; }
    let m;
    if ((m = /^(#{1,6})\s+(.*)$/.exec(l))) { const n = Math.min(3, m[1].length); out += '<h' + n + '>' + inline(m[2]) + '</h' + n + '>'; i++; continue; }
    if (/^\s*(?:[-*+]|\d+[.)])\s+/.test(l)) {
      const ord = /^\s*\d+[.)]/.test(l), items = [];
      while (i < lines.length && /^\s*(?:[-*+]|\d+[.)])\s+/.test(lines[i])) items.push(lines[i++].replace(/^\s*(?:[-*+]|\d+[.)])\s+/, ''));
      const todo = items.every((x) => /^\[[ xX]\]\s/.test(x));
      out += (ord ? '<ol>' : todo ? '<ul class="todo">' : '<ul>') + items.map((x) => (todo ? '<li class="chk' + (/^\[[xX]\]/.test(x) ? ' done' : '') + '">' + inline(x.replace(/^\[[ xX]\]\s/, '')) : '<li>' + inline(x)) + '</li>').join('') + (ord ? '</ol>' : '</ul>'); continue;
    }
    if (/^>\s?/.test(l)) { const buf = []; while (i < lines.length && /^>\s?/.test(lines[i])) buf.push(lines[i++].replace(/^>\s?/, '')); out += '<blockquote>' + inline(buf.join(' ')) + '</blockquote>'; continue; }
    if (!l.trim()) { i++; continue; }
    const buf = []; while (i < lines.length && lines[i].trim() && !/^(?:```|#{1,6}\s|>|\s*(?:[-*+]|\d+[.)])\s+)/.test(lines[i])) buf.push(lines[i++]);
    out += '<p>' + buf.map(inline).join('<br>') + '</p>';
  }
  return clean(out);
}
/** a .txt file as a body: a paragraph per blank-line block, line breaks kept. */
export function textToHtml(t) { return String(t || '').replace(/\r\n?/g, '\n').split(/\n{2,}/).map((p) => p.trim()).filter(Boolean).map((p) => '<p>' + esc(p).replace(/\n/g, '<br>') + '</p>').join(''); }

export const titleOf = (doc) => (String(doc && doc.title || '').trim() || 'Untitled');
export function exportMd(doc) { return '# ' + titleOf(doc) + '\n\n' + toMd(doc.html); }
export function exportTxt(doc) { return titleOf(doc) + '\n\n' + toText(doc.html) + '\n'; }
export function exportHtml(doc) { return '<!doctype html>\n<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>' + esc(titleOf(doc)) + '</title><style>body{font:17px/1.6 system-ui,sans-serif;max-width:42em;margin:2em auto;padding:0 1em}code,pre{background:#f1f0f6;border-radius:4px}pre{padding:.6em}li.chk{list-style:none}li.chk:before{content:"\\2610 ";}li.chk.done:before{content:"\\2611 ";}</style></head><body><h1>' + esc(titleOf(doc)) + '</h1>\n' + clean(doc.html) + '\n</body></html>\n'; }
/** a file the person picked: .md or .txt (anything else is read as text) becomes {title, html}. */
export function importText(name, text) {
  const base = String(name || 'Imported').replace(/^.*[\\/]/, '').replace(/\.[^.]+$/, ''), md = /\.(?:md|markdown)$/i.test(name || '');
  let t = String(text || ''); let title = base;
  if (md) { const m = /^\s*#\s+(.+)\n?/.exec(t); if (m) { title = m[1].trim(); t = t.slice(m[0].length); } return { title, html: mdToHtml(t) }; }
  return { title, html: textToHtml(t) };
}

// ---- documents ----
export const uid = (now = Date.now(), r = Math.random()) => now.toString(36) + Math.floor(r * 1e6).toString(36);
export function newDoc(now = Date.now(), over = {}) { return { id: uid(now), title: '', html: '', updated: now, versions: [], ...over, html: clean(over.html || '') }; }
export function withDoc(docs, doc) { const a = (docs || []).filter((d) => d.id !== doc.id); a.unshift(doc); return a; }
export function sorted(docs) { return [...(docs || [])].sort((a, b) => (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0) || b.updated - a.updated); }
/** the stored value cleaned: only documents with an id, bodies cleaned, versions an array. */
export function load(raw) {
  let v = raw; if (typeof raw === 'string') { try { v = JSON.parse(raw); } catch (_) { v = null; } }
  const cleanDoc = (d) => ({ id: String(d.id), title: String(d.title || ''), html: clean(d.html || ''), updated: +d.updated || 0, ...(d.pinned ? { pinned: true } : {}), ...(Array.isArray(d.tags) && d.tags.length ? { tags: d.tags.map((x) => String(x).slice(0, 30)).slice(0, 20) } : {}), ...(Array.isArray(d.comments) && d.comments.length ? { comments: d.comments.filter((c) => c && /^[a-z0-9]{1,16}$/.test(c.id)).slice(0, 500).map((c) => ({ id: c.id, quote: String(c.quote || '').slice(0, 300), text: String(c.text || '').slice(0, 2000), at: +c.at || 0, ...(c.done ? { done: true } : {}), ...(Array.isArray(c.replies) && c.replies.length ? { replies: c.replies.slice(0, 100).map((r) => ({ text: String(r && r.text || '').slice(0, 2000), at: +(r && r.at) || 0 })) } : {}) })) } : {}), versions: Array.isArray(d.versions) ? d.versions.filter((x) => x && x.t).map((x) => ({ t: +x.t, title: String(x.title || ''), html: clean(x.html || '') })) : [] });
  const docs = ((v && v.docs) || []).filter((d) => d && d.id).map(cleanDoc);
  const trash = ((v && v.trash) || []).filter((x) => x && x.doc && x.doc.id && +x.at > 0).map((x) => ({ at: +x.at, doc: cleanDoc(x.doc) })).slice(0, 200);
  return { docs, ...(trash.length ? { trash } : {}), cur: v && v.cur && docs.some((d) => d.id === v.cur) ? v.cur : docs.length ? sorted(docs)[0].id : null };
}

// ---- version history ----
const same = (a, b) => a && b && a.title === b.title && a.html === b.html;
/** the note with its current content kept as a version: when it changed since the last one and EVERY ms have passed (or force). Pure. */
export function snapshot(doc, now = Date.now(), force = false) {
  const vs = doc.versions || [], last = vs[vs.length - 1];
  if (!doc.html && !doc.title) return doc;
  if (same(last, doc)) return doc;
  if (!force && last && now - last.t < EVERY) return doc;
  const next = [...vs, { t: now, title: doc.title || '', html: doc.html || '' }];
  return { ...doc, versions: next.length > KEEP ? next.slice(next.length - KEEP) : next };
}
/** a note's versions, newest first, each with its time, title, word count and body. */
export function snapshotsFor(doc) { return (doc.versions || []).map((v, i) => ({ i, t: v.t, title: v.title, html: v.html, words: wordCount(v.html), current: same(v, doc) })).reverse(); }
/** the note as it was at version time t: what it is now is kept as a version first, so a restore can be undone. Unknown t: the note unchanged. */
export function restore(doc, t, now = Date.now()) {
  const v = (doc.versions || []).find((x) => x.t === t); if (!v) return doc;
  const kept = snapshot(doc, now + 1, true);
  return { ...kept, title: v.title, html: v.html, updated: now };
}

// ---- search ----
const toks = (q) => String(q || '').toLowerCase().split(/\s+/).filter(Boolean);
/** every note holding all the words of q, best first: {id, title, snippet, score}. A word in the title counts five. */
export function search(docs, q, limit = 50) {
  const ws = toks(q); if (!ws.length) return [];
  const res = [];
  for (const d of docs || []) {
    const title = titleOf(d), text = toText(d.html), tl = title.toLowerCase(), bl = text.toLowerCase(); let score = 0, ok = true, at = -1;
    for (const w of ws) { const inT = tl.split(w).length - 1, inB = bl.split(w).length - 1; if (!inT && !inB) { ok = false; break; } score += inT * 5 + inB; if (at < 0 && bl.indexOf(w) >= 0) at = bl.indexOf(w); }
    if (!ok) continue;
    const from = Math.max(0, at < 0 ? 0 : at - 40), snippet = (from ? '… ' : '') + text.slice(from, from + 120).replace(/\s+/g, ' ') + (from + 120 < text.length ? ' …' : '');
    res.push({ id: d.id, title, snippet, score, updated: d.updated || 0 });
  }
  return res.sort((a, b) => b.score - a.score || b.updated - a.updated).slice(0, limit);
}
/** text escaped with every word of q wrapped in <mark>. */
export function mark(text, q) {
  const ws = toks(q).sort((a, b) => b.length - a.length); const s = String(text); if (!ws.length) return esc(s);
  const re = new RegExp('(' + ws.map((w) => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|') + ')', 'gi');
  return s.split(re).map((p, i) => (i % 2 ? '<mark>' + esc(p) + '</mark>' : esc(p))).join('');
}

// ---- the link, the quick line ----
const b64 = (s) => { const b = new TextEncoder().encode(s); let x = ''; for (const c of b) x += String.fromCharCode(c); return btoa(x).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''); };
const unb64 = (s) => { const x = atob(String(s).replace(/-/g, '+').replace(/_/g, '/')); return new TextDecoder().decode(Uint8Array.from(x, (c) => c.charCodeAt(0))); };
/** a link that carries one note (title and body): /notes/?n=<base64url json>. */
export function shareLink(doc, origin = '') { return origin + '/notes/?n=' + b64(JSON.stringify({ t: doc.title || '', h: clean(doc.html || '') })); }
/** the note a link carries, or null. */
export function fromShare(n) { try { const o = JSON.parse(unb64(n)); if (o && typeof o.h === 'string') return { title: String(o.t || '').slice(0, 300), html: clean(o.h) }; } catch (_) {} return null; }
/** "note: Shopping list - milk, eggs, bread" is a note titled Shopping list with a checklist of milk, eggs, bread; "buy milk" is a note titled buy milk. */
export function quickNote(q) {
  let s = String(q || '').replace(/^\s*(?:(?:new|add|make|create|neue?|notiz)\s+)?(?:note|notiz)\s*[:,-]?\s*/i, '').trim(); if (!s) return null;
  const m = /^(.{1,80}?)\s+[-–—:]\s+(.+)$/s.exec(s) || /^([^:\n]{1,80}):\s*(.+)$/s.exec(s);
  if (!m) return { title: s.slice(0, 80), html: '' };
  const items = m[2].split(/\s*[,;\n]\s*/).map((x) => x.trim()).filter(Boolean);
  const html = items.length > 1 ? '<ul class="todo">' + items.map((x) => '<li class="chk">' + esc(x) + '</li>').join('') + '</ul>' : '<p>' + esc(m[2].trim()) + '</p>';
  return { title: m[1].trim(), html };
}

// ---- the words ----
const EN = { title: 'Notes', sub: 'Documents on your device: rich formatting, search across all of them, version history. Nothing goes to a server; it works offline.', newDoc: 'New note', search: 'Search all notes', searchPh: 'Search all notes', untitled: 'Untitled', titlePh: 'Title', bodyPh: 'Start writing…', words: 'words', saved: 'Saved on this device', none: 'No notes yet. Make one.', noMatch: 'No note has all those words.', history: 'Version history', versions: 'versions', saveVersion: 'Save a version', restore: 'Restore this version', current: 'current', previewing: 'Previewing', back: 'Back to the note', noVersions: 'No versions yet: one is kept every 30 seconds of change.', restored: 'Restored. What it replaced is kept in the history.', del: 'Delete', delSure: 'Delete this note and its history?', exportMd: 'Export .md', exportHtml: 'Export .html', exportTxt: 'Export .txt', importFile: 'Import .md or .txt', print: 'Print', share: 'Copy share link', copied: 'Link copied', bold: 'Bold', italic: 'Italic', underline: 'Underline', h1: 'Heading', h2: 'Subheading', ul: 'Bulleted list', ol: 'Numbered list', todo: 'Checklist', code: 'Code', link: 'Link', linkAsk: 'Link address (https://…)', clear: 'Clear formatting', shared: 'Shared note', saveShared: 'Save a copy', notes: 'notes', offline: 'Offline: your notes are on this device.', found: 'found', imported: 'imported', keys: 'Ctrl+B bold, Ctrl+I italic, Ctrl+U underline, Ctrl+K link, Ctrl+Alt+1 and 2 headings, Ctrl+Shift+7 and 8 lists, Ctrl+/ searches, Ctrl+Alt+N is a new note', note: 'Notes stay in this browser; nothing goes to a server. A share link carries the note itself.', toolbar: 'Formatting', pin: 'Pin', unpin: 'Unpin', all: 'All', pinnedF: 'Pinned', tagsLabel: 'Tags', tagsPh: 'Tags: travel, work', linksTo: 'Links to', linkedFrom: 'Linked from', linkHint: 'Write [[Note title]] to link notes.', newLink: 'new', tpl: 'Start from a template', tplMeeting: 'Meeting', tplTrip: 'Trip', tplShopping: 'Shopping list', tplWeekly: 'Weekly plan', tbl: 'Table', addRow: 'Row +', addCol: 'Column +', colAsk: 'Column name', sortUp: 'Sort A-Z', sortDown: 'Sort Z-A', delTable: 'Remove table', slash: 'Insert a block', slashNone: 'Nothing matches', trash: 'Trash', trashEmpty: 'The trash is empty. Deleted notes stay here for 30 days.', restoreN: 'Restore', foreverN: 'Delete forever', emptyTrash: 'Empty trash', movedTrash: 'Moved to the trash: Trash brings it back.', fr: 'Find and replace', frFind: 'Find', frWith: 'Replace with', frAll: 'Replace all', frNone: 'No match.', frDone: 'replaced', outline: 'Outline', };
const DE = { title: 'Notizen', sub: 'Dokumente auf Ihrem Gerät: Formatierung, Suche in allen, Versionsverlauf. Nichts geht an einen Server; es funktioniert offline.', newDoc: 'Neue Notiz', search: 'Alle Notizen durchsuchen', searchPh: 'Alle Notizen durchsuchen', untitled: 'Ohne Titel', titlePh: 'Titel', bodyPh: 'Schreiben Sie los…', words: 'Wörter', saved: 'Auf diesem Gerät gespeichert', none: 'Noch keine Notizen. Legen Sie eine an.', noMatch: 'Keine Notiz enthält alle diese Wörter.', history: 'Versionsverlauf', versions: 'Versionen', saveVersion: 'Version speichern', restore: 'Diese Version wiederherstellen', current: 'aktuell', previewing: 'Vorschau', back: 'Zurück zur Notiz', noVersions: 'Noch keine Versionen: alle 30 Sekunden Änderung wird eine gespeichert.', restored: 'Wiederhergestellt. Das Ersetzte steht im Verlauf.', del: 'Löschen', delSure: 'Diese Notiz und ihren Verlauf löschen?', exportMd: '.md exportieren', exportHtml: '.html exportieren', exportTxt: '.txt exportieren', importFile: '.md oder .txt importieren', print: 'Drucken', share: 'Link kopieren', copied: 'Link kopiert', bold: 'Fett', italic: 'Kursiv', underline: 'Unterstrichen', h1: 'Überschrift', h2: 'Unterüberschrift', ul: 'Aufzählung', ol: 'Nummerierte Liste', todo: 'Checkliste', code: 'Code', link: 'Link', linkAsk: 'Linkadresse (https://…)', clear: 'Formatierung entfernen', shared: 'Geteilte Notiz', saveShared: 'Kopie speichern', notes: 'Notizen', offline: 'Offline: Ihre Notizen liegen auf diesem Gerät.', found: 'gefunden', imported: 'importiert', keys: 'Strg+B fett, Strg+I kursiv, Strg+U unterstrichen, Strg+K Link, Strg+Alt+1 und 2 Überschriften, Strg+Umschalt+7 und 8 Listen, Strg+/ sucht, Strg+Alt+N neue Notiz', note: 'Notizen bleiben in diesem Browser; nichts geht an einen Server. Ein Link enthält die Notiz selbst.', toolbar: 'Formatierung', pin: 'Anheften', unpin: 'Lösen', all: 'Alle', pinnedF: 'Angeheftet', tagsLabel: 'Tags', tagsPh: 'Tags: reise, arbeit', linksTo: 'Verweist auf', linkedFrom: 'Verlinkt von', linkHint: 'Schreiben Sie [[Notiztitel]], um Notizen zu verknüpfen.', newLink: 'neu', tpl: 'Aus Vorlage beginnen', tplMeeting: 'Besprechung', tplTrip: 'Reise', tplShopping: 'Einkaufsliste', tplWeekly: 'Wochenplan', tbl: 'Tabelle', addRow: 'Zeile +', addCol: 'Spalte +', colAsk: 'Spaltenname', sortUp: 'A-Z sortieren', sortDown: 'Z-A sortieren', delTable: 'Tabelle entfernen', slash: 'Block einfügen', slashNone: 'Nichts passt', trash: 'Papierkorb', trashEmpty: 'Der Papierkorb ist leer. Gelöschte Notizen bleiben hier 30 Tage.', restoreN: 'Wiederherstellen', foreverN: 'Endgültig löschen', emptyTrash: 'Papierkorb leeren', movedTrash: 'In den Papierkorb verschoben: dort lässt sie sich zurückholen.', fr: 'Suchen und ersetzen', frFind: 'Suchen', frWith: 'Ersetzen durch', frAll: 'Alle ersetzen', frNone: 'Keine Treffer.', frDone: 'ersetzt', outline: 'Gliederung', };
export function wordsFor(lang) { return /^de\b/i.test(lang || '') ? DE : EN; }
