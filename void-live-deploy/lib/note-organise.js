// What Notes takes from Simplenote and Google Keep, so one page carries the features of every notes app that does the same job: the six sort orders (Simplenote), tag:, is: and color:
// in search (Simplenote's tag:), renaming and removing a tag everywhere (Simplenote), an archive (Keep), a colour per note (Keep), a copy of
// a note (Keep), a backup of every note and its import, which also reads Simplenote's and Google Keep's own exports, and the line starts
// that turn into a heading, a list, a checklist or a quote as you type (Simplenote's Markdown, Keep). The pure half; the page wires it up.
// Tests: tools/note-organise.test.mjs (rules), tools/notes-rivals-e2e.mjs (the page in a real browser).
import { clean, mdToHtml, textToHtml, toText, uid } from './notes.js';
import { parseTags } from './note-extras.js';

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const created = (d) => +d.created || Math.min(+d.updated || 0, ...((d.versions || []).map((v) => +v.t || Infinity)));
const name = (d) => String(d.title || toText(d.html || '').trim().split('\n')[0] || '').trim().toLowerCase();

// ---- sort orders: Simplenote's six (Modified, Created, Name; newest or oldest first, A-Z or Z-A); pinned notes stay on top ----
export const SORTS = Object.freeze([
  { key: 'modified-new', label: 'Modified: newest' }, { key: 'modified-old', label: 'Modified: oldest' },
  { key: 'created-new', label: 'Created: newest' }, { key: 'created-old', label: 'Created: oldest' },
  { key: 'name-az', label: 'Name: A-Z' }, { key: 'name-za', label: 'Name: Z-A' },
]);
/** the notes in one of SORTS' orders, pinned first. Pure. */
export function sortDocs(docs, key = 'modified-new') {
  const by = {
    'modified-new': (a, b) => (b.updated || 0) - (a.updated || 0), 'modified-old': (a, b) => (a.updated || 0) - (b.updated || 0),
    'created-new': (a, b) => created(b) - created(a), 'created-old': (a, b) => created(a) - created(b),
    'name-az': (a, b) => name(a).localeCompare(name(b)) || (b.updated || 0) - (a.updated || 0), 'name-za': (a, b) => name(b).localeCompare(name(a)) || (b.updated || 0) - (a.updated || 0),
  }[key] || ((a, b) => (b.updated || 0) - (a.updated || 0));
  return [...(docs || [])].sort((a, b) => (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0) || by(a, b));
}

// ---- colours: Google Keep's twelve, the same names ----
export const COLORS = Object.freeze([
  { key: '', label: 'Default', hex: '' }, { key: 'coral', label: 'Coral', hex: '#faafa8' }, { key: 'peach', label: 'Peach', hex: '#f39f76' },
  { key: 'sand', label: 'Sand', hex: '#fff8b8' }, { key: 'mint', label: 'Mint', hex: '#e2f6d3' }, { key: 'sage', label: 'Sage', hex: '#b4ddd3' },
  { key: 'fog', label: 'Fog', hex: '#d4e4ed' }, { key: 'storm', label: 'Storm', hex: '#aeccdc' }, { key: 'dusk', label: 'Dusk', hex: '#d3bfdb' },
  { key: 'blossom', label: 'Blossom', hex: '#f6e2dd' }, { key: 'clay', label: 'Clay', hex: '#e9e3d4' }, { key: 'chalk', label: 'Chalk', hex: '#efeff1' },
]);
const COLOR_KEYS = new Set(COLORS.map((c) => c.key).filter(Boolean));
export const colorOf = (k) => COLORS.find((c) => c.key === k) || COLORS[0];
// Keep's Takeout names its colours in capitals (DEFAULT, RED, ORANGE, YELLOW, GREEN, TEAL, BLUE, CERULEAN, PURPLE, PINK, BROWN, GRAY)
const KEEP_COLOR = { RED: 'coral', ORANGE: 'peach', YELLOW: 'sand', GREEN: 'mint', TEAL: 'sage', BLUE: 'fog', CERULEAN: 'storm', DARK_BLUE: 'storm', PURPLE: 'dusk', PINK: 'blossom', BROWN: 'clay', GRAY: 'chalk' };

// ---- search words: tag:x, is:pinned / is:archived / is:checklist, color:x; the rest are plain words ----
/** { words, tags, is, colors } from a typed search. Pure. */
export function parseQuery(q) {
  const out = { words: [], tags: [], is: [], colors: [] };
  for (const w of String(q || '').trim().split(/\s+/).filter(Boolean)) {
    const m = /^(tag|is|colou?r):(.+)$/i.exec(w);
    if (!m) { out.words.push(w); continue; }
    const k = m[1].toLowerCase(), v = m[2].toLowerCase().replace(/^#/, '');
    if (k === 'tag') out.tags.push(v); else if (k === 'is') out.is.push(v); else out.colors.push(v);
  }
  return out;
}
/** the notes the operators keep (words are left to the full-text search). Archived notes only with is:archived. Pure. */
export function applyOperators(docs, p) {
  return (docs || []).filter((d) => {
    if (p.is.includes('archived') && !d.archived) return false;
    if (p.tags.some((t) => !(d.tags || []).some((x) => x === t || x.startsWith(t + '/')))) return false;
    if (p.colors.some((c) => (d.color || '') !== c && !(c === 'default' && !d.color))) return false;
    for (const i of p.is) { if (i === 'pinned' && !d.pinned) return false; if (i === 'checklist' && !/<ul class="todo">/.test(d.html || '')) return false; if (i === 'untagged' && (d.tags || []).length) return false; }
    return true;
  });
}
/** the list the page shows under a filter (all, pinned, archive, #tag): archived notes only under 'archive'. Pure. */
export function inView(docs, filter) {
  if (filter === 'archive') return (docs || []).filter((d) => d.archived);
  return (docs || []).filter((d) => !d.archived);
}

// ---- tags everywhere ----
/** every note with tag `from` renamed `to` (merged when a note has both); `to` empty removes it. Pure. */
export function renameTag(docs, from, to, now = Date.now()) {
  const f = String(from || '').replace(/^#/, '').toLowerCase(), t = parseTags(to || '')[0] || '';
  if (!f) return docs || [];
  return (docs || []).map((d) => {
    if (!(d.tags || []).includes(f)) return d;
    const tags = [...new Set((d.tags || []).map((x) => (x === f ? t : x)).filter(Boolean))];
    const { tags: _, ...rest } = d; return { ...rest, ...(tags.length ? { tags } : {}), updated: now };
  });
}

// ---- a copy of a note (Keep's "Make a copy") ----
export function copyOf(d, now = Date.now()) {
  const { versions: _v, comments: _c, ...rest } = d;
  return { ...rest, id: uid(now), title: (d.title || 'Untitled') + ' (copy)', created: now, updated: now, versions: [], pinned: false };
}

// ---- backups: every note as one .json; reads it back, and Simplenote's and Google Keep's exports ----
export const BACKUP_KIND = 'verse-notes-backup';
/** the whole store (notes, archive, trash, versions) as a backup string. Pure. */
export function backup(store, now = Date.now()) {
  return JSON.stringify({ kind: BACKUP_KIND, version: 1, at: new Date(now).toISOString(), docs: store.docs || [], trash: store.trash || [] }, null, 1);
}
const usec = (v) => { const n = +v; return n > 1e14 ? Math.round(n / 1000) : n > 1e11 ? n : n > 0 ? n * 1000 : 0; };
const dateMs = (v) => { if (!v) return 0; const n = Date.parse(v); return Number.isFinite(n) ? n : usec(v); };
/** Simplenote's note: the first line is its title; markdown notes stay formatted. */
function fromSimplenote(n, now) {
  const text = String(n.content || '').replace(/\r\n?/g, '\n'), [first, ...more] = text.split('\n'), body = more.join('\n').replace(/^\n+/, '');
  return { title: first.trim().slice(0, 300), html: clean(n.markdown || /^\s*(?:#|- \[|[-*] |\d+\. )/m.test(body) ? mdToHtml(body) : textToHtml(body)), created: dateMs(n.creationDate) || now, updated: dateMs(n.lastModified) || now, ...(n.pinned ? { pinned: true } : {}), ...(Array.isArray(n.tags) && n.tags.length ? { tags: parseTags(n.tags.join(',')) } : {}) };
}
/** Google Keep's Takeout note (one .json per note). */
function fromKeep(n, now) {
  let html = '';
  if (Array.isArray(n.listContent) && n.listContent.length) html = '<ul class="todo">' + n.listContent.map((i) => '<li class="chk' + (i.isChecked ? ' done' : '') + '">' + esc(String(i.text || '')) + '</li>').join('') + '</ul>';
  if (n.textContent) html = (n.textContentHtml ? clean(n.textContentHtml) : textToHtml(n.textContent)) + html;
  const color = KEEP_COLOR[String(n.color || '').toUpperCase()] || '';
  return { title: String(n.title || '').slice(0, 300), html: clean(html), created: usec(n.createdTimestampUsec) || now, updated: usec(n.userEditedTimestampUsec) || now, ...(n.isPinned ? { pinned: true } : {}), ...(n.isArchived ? { archived: true } : {}), ...(color ? { color } : {}), ...(Array.isArray(n.labels) && n.labels.length ? { tags: parseTags(n.labels.map((l) => l && l.name).join(',')) } : {}) };
}
/** the notes in an imported .json: a Verse backup, a Simplenote export (activeNotes) or a Google Keep note; [] when it is none. Fresh ids. Pure. */
export function readBackup(text, now = Date.now()) {
  let v; try { v = JSON.parse(String(text || '')); } catch (_) { return { kind: 'unknown', docs: [] }; }
  const fresh = (d, i) => ({ versions: [], ...d, id: uid(now + i, Math.random()) });
  if (v && v.kind === BACKUP_KIND && Array.isArray(v.docs)) return { kind: 'verse', docs: v.docs.filter((d) => d && typeof d === 'object').map((d, i) => fresh({ title: String(d.title || ''), html: clean(d.html || ''), created: +d.created || +d.updated || now, updated: +d.updated || now, ...(d.pinned ? { pinned: true } : {}), ...(d.archived ? { archived: true } : {}), ...(COLOR_KEYS.has(d.color) ? { color: d.color } : {}), ...(Array.isArray(d.tags) && d.tags.length ? { tags: parseTags(d.tags.join(',')) } : {}), versions: Array.isArray(d.versions) ? d.versions.filter((x) => x && x.t).map((x) => ({ t: +x.t, title: String(x.title || ''), html: clean(x.html || '') })) : [] }, i)) };
  if (v && Array.isArray(v.activeNotes)) return { kind: 'simplenote', docs: v.activeNotes.filter((n) => n && n.content != null).map((n, i) => fresh(fromSimplenote(n, now), i)) };
  const keep = Array.isArray(v) ? v : [v];
  if (keep.length && keep.every((n) => n && typeof n === 'object' && ('textContent' in n || 'listContent' in n) && ('userEditedTimestampUsec' in n || 'createdTimestampUsec' in n || 'isTrashed' in n)))
    return { kind: 'keep', docs: keep.filter((n) => !n.isTrashed).map((n, i) => fresh(fromKeep(n, now), i)) };
  return { kind: 'unknown', docs: [] };
}

// ---- line starts that format as you type (Markdown, as Simplenote and Keep's editors take it) ----
/** what a line's start becomes once its space is typed: { block, strip } or null. "# " h1, "## " h2, "### " h3, "- " / "* " bullets, "1. " numbers, "[] " / "[ ] " / "- [ ] " a checklist, "> " a quote. Pure. */
export function lineStart(t) {
  const s = String(t || '').replace(/\u00a0/g, ' ');
  const R = [[/^### $/, 'h3'], [/^## $/, 'h2'], [/^# $/, 'h1'], [/^-? ?\[ ?\] $/, 'todo'], [/^[-*] $/, 'ul'], [/^1[.)] $/, 'ol'], [/^> $/, 'quote']];
  for (const [re, block] of R) if (re.test(s)) return { block, strip: s.length };
  return null;
}
