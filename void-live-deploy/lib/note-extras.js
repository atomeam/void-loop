// What Notes borrows from Notion (owner, 2026-10-25: "if we do it right we are on the way to surpassing Notion"): [[wiki links]] with backlinks, tables
// you can add a row or column to and sort, tags and pinned filters, the slash menu's commands. The pure half, shared by the /notes/ page and by chat
// (lib/chat-notes.js). Everything on the device. Tests: tools/note-extras.test.mjs.
import { toText, clean } from './notes.js';

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const unent = (s) => String(s).replace(/&(?:amp|lt|gt|quot|#39|nbsp);/g, (m) => ({ '&amp;': '&', '&lt;': '<', '&gt;': '>', '&quot;': '"', '&#39;': "'", '&nbsp;': ' ' }[m]));
const plain = (h) => unent(String(h).replace(/<[^>]+>/g, '')).replace(/\s+/g, ' ').trim();
const norm = (s) => String(s || '').toLowerCase().replace(/\s+/g, ' ').trim();

// ---- [[wiki links]] ----
/** the titles a note links to with [[Title]] (or [[Title|shown text]]), once each, in order. Pure. */
export function linksOf(html) { const seen = new Set(), out = []; for (const m of toText(html).matchAll(/\[\[([^\[\]|\n]{1,120})(?:\|[^\]\n]*)?\]\]/g)) { const t = m[1].trim(), k = norm(t); if (t && !seen.has(k)) { seen.add(k); out.push(t); } } return out; }
/** the notes that link to this one, newest first: [{ id, title }]. Pure. */
export function backlinks(docs, doc) { const k = norm(doc.title); if (!k) return []; return (docs || []).filter((d) => d.id !== doc.id && linksOf(d.html).some((t) => norm(t) === k)).sort((a, b) => (b.updated || 0) - (a.updated || 0)).map((d) => ({ id: d.id, title: d.title || 'Untitled' })); }
/** the note a link title names (case and spacing ignored), or null. Pure. */
export const noteByTitle = (docs, title) => (docs || []).find((d) => norm(d.title) === norm(title)) || null;

// ---- tags and pins ----
/** every tag in use with how many notes carry it, most used first: [{ tag, n }]. Pure. */
export function tagCounts(docs) { const m = new Map(); for (const d of docs || []) for (const t of d.tags || []) m.set(t, (m.get(t) || 0) + 1); return [...m].map(([tag, n]) => ({ tag, n })).sort((a, b) => b.n - a.n || a.tag.localeCompare(b.tag)); }
/** the notes under a filter: 'all', 'pinned', or '#tag'. Pure. */
export function filterDocs(docs, f) { if (!f || f === 'all') return docs || []; if (f === 'pinned') return (docs || []).filter((d) => d.pinned); const t = String(f).replace(/^#/, '').toLowerCase(); return (docs || []).filter((d) => (d.tags || []).includes(t)); }
/** tags typed as "travel, #work" as a clean list. Pure. */
export const parseTags = (s) => [...new Set(String(s || '').split(/[,;\n]+/).map((x) => x.trim().replace(/^#/, '').toLowerCase().replace(/[^\p{L}\p{N}_-]+/gu, '-').replace(/^-+|-+$/g, '').slice(0, 30)).filter(Boolean))].slice(0, 20);

// ---- tables ----
const CELL = /<(th|td)>([\s\S]*?)<\/\1>/g;
/** a table's cells: { head: [html], rows: [[html]] }; the first row is the head. null when it is not a table. Pure. */
export function parseTable(t) {
  if (!/<table>/.test(t || '')) return null;
  const trs = [...String(t).matchAll(/<tr>([\s\S]*?)<\/tr>/g)].map((m) => [...m[1].matchAll(CELL)].map((c) => c[2]));
  if (!trs.length) return null; const w = Math.max(...trs.map((r) => r.length));
  const fill = (r) => Array.from({ length: w }, (_, i) => (r[i] == null ? '' : r[i]));
  return { head: fill(trs[0]), rows: trs.slice(1).map(fill) };
}
/** the table html of a head and rows of cell html (already clean). Pure. */
export const tableHtml = (head, rows) => '<table><thead><tr>' + head.map((c) => '<th>' + c + '</th>').join('') + '</tr></thead><tbody>' + rows.map((r) => '<tr>' + r.map((c) => '<td>' + c + '</td>').join('') + '</tr>').join('') + '</tbody></table>';
/** a new table of named columns and a few empty rows. Pure. */
export const newTable = (cols, rows = 2) => { const c = (cols && cols.length ? cols : ['Name', 'Status', 'Notes']).map((x) => esc(String(x).trim())); return tableHtml(c, Array.from({ length: rows }, () => c.map(() => '<br>'))); };
/** the column a name or number means (names ignore case); -1 when none. Pure. */
export function colIndex(t, which) { const p = parseTable(t); if (!p) return -1; if (typeof which === 'number') return which >= 0 && which < p.head.length ? which : -1; const k = norm(which); return p.head.findIndex((h) => norm(plain(h)) === k); }
export function addColumn(t, name) { const p = parseTable(t); if (!p) return t; return tableHtml([...p.head, esc(String(name || 'Column ' + (p.head.length + 1)).trim())], p.rows.map((r) => [...r, '<br>'])); }
export function addRow(t, cells = []) { const p = parseTable(t); if (!p) return t; const row = p.head.map((_, i) => (cells[i] != null && String(cells[i]).trim() ? esc(String(cells[i]).trim()) : '<br>')); return tableHtml(p.head, [...p.rows, row]); }
/** the rows ordered by a column (numbers as numbers, empty last); stable. Pure. */
export function sortTable(t, which, dir = 'asc') {
  const p = parseTable(t), i = colIndex(t, which); if (!p || i < 0) return t; const sign = /^d/i.test(dir) ? -1 : 1;
  const v = (r) => plain(r[i]), num = (s) => (/^-?\d+(?:[.,]\d+)?$/.test(s) ? parseFloat(s.replace(',', '.')) : NaN);
  const rows = p.rows.map((r, n) => ({ r, n, s: v(r) })).sort((a, b) => { if (!a.s && !b.s) return a.n - b.n; if (!a.s) return 1; if (!b.s) return -1; const x = num(a.s), y = num(b.s); const c = !isNaN(x) && !isNaN(y) ? x - y : a.s.localeCompare(b.s, undefined, { numeric: true, sensitivity: 'base' }); return c * sign || a.n - b.n; });
  return tableHtml(p.head, rows.map((x) => x.r));
}
/** a body with its first table (or the n-th) replaced by fn(tableHtml); the body unchanged and found false when it has none. Pure. */
export function mapTable(html, fn, n = 0) { let i = -1, found = false; const out = String(html || '').replace(/<table>[\s\S]*?<\/table>/g, (t) => { i++; if (i !== n) return t; found = true; return fn(t); }); return { html: out, found }; }

// ---- the slash menu ----
/** what typing / offers: key, words that find it, and what it does. Pure. */
export const SLASH = Object.freeze([
  { key: 'heading', label: 'Heading', hint: 'Big section title', words: 'heading title h1 h2' }, { key: 'todo', label: 'To-do list', hint: 'Checklist with boxes', words: 'todo to-do task check checklist' },
  { key: 'bullet', label: 'Bulleted list', hint: 'A simple list', words: 'bullet list ul' }, { key: 'number', label: 'Numbered list', hint: '1, 2, 3', words: 'number numbered ol list' },
  { key: 'table', label: 'Table', hint: 'Rows and columns you can sort', words: 'table grid columns' }, { key: 'divider', label: 'Divider', hint: 'A line between sections', words: 'divider line hr rule' },
  { key: 'quote', label: 'Quote', hint: 'Set a passage apart', words: 'quote blockquote' }, { key: 'code', label: 'Code block', hint: 'Monospace', words: 'code pre' },
]);
/** the commands matching what was typed after the slash, best first. Pure. */
export function slashFor(q) { const k = norm(q); if (!k) return [...SLASH]; return SLASH.filter((c) => c.key.startsWith(k) || c.label.toLowerCase().startsWith(k) || c.words.split(' ').some((w) => w.startsWith(k))).sort((a, b) => (b.key.startsWith(k) ? 1 : 0) - (a.key.startsWith(k) ? 1 : 0)); }
// ---- find and replace, outline, trash ----
/** the body with every match of `find` in its text (never inside a tag) replaced: { html, count }. Pure. */
export function replaceIn(html, find, repl, matchCase = false) {
  const f = String(find || ''); if (!f) return { html: String(html || ''), count: 0 };
  const re = new RegExp(esc(f).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), matchCase ? 'g' : 'gi'), r = esc(String(repl || '')); let count = 0;
  const out = String(html || '').split(/(<[^>]*>)/).map((seg) => (seg.startsWith('<') ? seg : seg.replace(re, () => { count++; return r; }))).join('');
  return { html: out, count };
}
/** the headings of a body, in order: [{ level: 1-3, text }]. Pure. */
export const outlineOf = (html) => [...String(html || '').matchAll(/<h([1-3])>([\s\S]*?)<\/h\1>/g)].map((m) => ({ level: +m[1], text: plain(m[2]) })).filter((h) => h.text);
export const TRASH_DAYS = 30;
/** the store with a note moved to the trash (kept 30 days). Pure. */
export function toTrash(store, doc, now = Date.now()) { const docs = (store.docs || []).filter((d) => d.id !== doc.id); return { ...store, docs, trash: [{ at: now, doc }, ...(store.trash || []).filter((x) => x.doc.id !== doc.id)].slice(0, 200), cur: store.cur === doc.id ? (docs[0] ? docs[0].id : null) : store.cur }; }
/** the store with a note taken out of the trash (a title the notes already use is kept as it is). Pure. */
export function fromTrash(store, id, now = Date.now()) { const x = (store.trash || []).find((t) => t.doc.id === id); if (!x) return store; return { ...store, docs: [{ ...x.doc, updated: now }, ...(store.docs || [])], trash: (store.trash || []).filter((t) => t.doc.id !== id), cur: id }; }
/** the trash without what is over 30 days old. Pure. */
export const purgeTrash = (store, now = Date.now()) => (store.trash || []).some((x) => now - x.at > TRASH_DAYS * 864e5) ? { ...store, trash: store.trash.filter((x) => now - x.at <= TRASH_DAYS * 864e5) } : store;

/** the starting points "start a meeting note" and the page's template menu make. Pure. */
export const TEMPLATES = {
  meeting: { title: 'Meeting', html: '<h2>Date and people</h2><p><br></p><h2>Agenda</h2><ul><li></li></ul><h2>Notes</h2><p><br></p><h2>Actions</h2><ul class="todo"><li class="chk"></li></ul>' },
  trip: { title: 'Trip', html: '<h2>Flights</h2><p><br></p><h2>Stay</h2><p><br></p><h2>Plans</h2><ul><li></li></ul><h2>Packing list</h2><ul class="todo"><li class="chk"></li></ul>' },
  shopping: { title: 'Shopping list', html: '<ul class="todo"><li class="chk"></li></ul>' },
  weekly: { title: 'Weekly plan', html: '<h2>Goals</h2><ul class="todo"><li class="chk"></li></ul><h2>Monday</h2><p><br></p><h2>Tuesday</h2><p><br></p><h2>Wednesday</h2><p><br></p><h2>Thursday</h2><p><br></p><h2>Friday</h2><p><br></p><h2>Weekend</h2><p><br></p>' },
};
export { clean };
