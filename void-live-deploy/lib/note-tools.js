// Pure helpers for tools pack 1 (owner, 2026-10-18): notes and writing tools, nested bullets, csv tables, scanned values.
// Everything is device-local and client-side. No function here touches the page, the network or storage.

/** the kinds of stage thing that hold words a person wrote */
export const NOTE_KINDS = ['sticky', 'notepad', 'outline', 'list', 'csvtable', 'filecard'];

const clean = (s) => String(s == null ? '' : s).replace(/⏎/g, '\n');

/** words in a text (runs of non-space characters). Pure. */
export function wordsIn(text) { return (String(text || '').match(/\S+/g) || []).length; }

/** reading time at `wpm` words a minute: { words, seconds, label } ("under a minute", "2 min read"). Pure. */
export function readingTime(text, wpm = 200) {
  const words = wordsIn(text), seconds = Math.round(words / wpm * 60);
  const label = !words ? 'nothing to read' : seconds < 30 ? 'under half a minute' : seconds < 60 ? 'under a minute' : Math.round(seconds / 60) + ' min read';
  return { words, seconds, label };
}

const stripTags = (html) => String(html || '').replace(/<(?:script|style)[\s\S]*?<\/(?:script|style)>/gi, ' ').replace(/<br\s*\/?>|<\/(?:p|div|li|h[1-6])>/gi, '\n').replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim();

/** the nested bullets of an outline's text as { depth, text } (2 spaces or a tab a level; "- ", "* " and bullets dropped). Pure. */
export function outlineParse(text) {
  const out = [];
  for (const raw of clean(text).split('\n')) {
    if (!raw.trim()) continue;
    const m = /^([ \t]*)(?:[-*•]\s+)?(.*)$/.exec(raw);
    const depth = Math.min(6, Math.floor(m[1].replace(/\t/g, '  ').length / 2));
    out.push({ depth, text: m[2].trim() });
  }
  return out;
}

/** the outline as editable text: "- a", "  - b". Pure. */
export const outlineText = (items) => items.map((i) => '  '.repeat(i.depth) + '- ' + i.text).join('\n');

/** the words an ask starts an outline with: separated by ; or new lines, depth by leading ">" marks or 2-space indents. Pure. */
export function outlineFromAsk(body) {
  const items = [];
  for (const seg of clean(body).split(/[;\n]/)) {
    if (!seg.trim()) continue;
    const m = /^(\s*(?:>\s*)*)(.*)$/.exec(seg);
    const marks = (m[1].match(/>/g) || []).length;
    const depth = marks || Math.floor(seg.match(/^ */)[0].length / 2);
    const t = m[2].trim().replace(/^[-*•]\s+/, '');
    if (t) items.push({ depth: Math.min(6, depth), text: t.slice(0, 200) });
  }
  // a level can only go one deeper than the line above it
  let prev = -1;
  for (const i of items) { i.depth = Math.min(i.depth, prev + 1); prev = i.depth; }
  return items.slice(0, 200);
}

/** indent (dir 1) or outdent (dir -1) the lines a selection touches: { text, start, end }. A line goes at most one level
 *  deeper than the line above it, never above level 0 or below level 6. Pure. */
export function shiftLines(text, start, end, dir) {
  const lines = String(text).split('\n');
  let pos = 0, first = -1, last = -1;
  lines.forEach((l, i) => { const a = pos, b = pos + l.length; if (first < 0 && b >= start) first = i; if (a <= end) last = i; pos = b + 1; });
  if (first < 0) return { text, start, end };
  const depthOf = (l) => Math.floor(/^[ \t]*/.exec(l)[0].replace(/\t/g, '  ').length / 2);
  let delta0 = 0, deltaAll = 0;
  for (let i = first; i <= Math.max(first, last); i++) {
    const d = depthOf(lines[i]), prev = i === 0 ? -1 : depthOf(lines[i - 1]);
    const body = lines[i].replace(/^[ \t]*/, '');
    if (dir > 0 && d + 1 <= Math.min(6, prev + 1)) { lines[i] = '  ' + '  '.repeat(d) + body; if (i === first) delta0 = 2; deltaAll += 2; }
    else if (dir < 0 && d > 0) { lines[i] = '  '.repeat(d - 1) + body; if (i === first) delta0 = -2; deltaAll -= 2; }
  }
  return { text: lines.join('\n'), start: Math.max(0, start + delta0), end: Math.max(0, end + deltaAll) };
}

/** Enter at `pos` in an outline's text: a new bullet at the same level; Enter on an empty bullet steps out a level, and on a
 *  top-level empty bullet leaves it empty. { text, pos }. Pure. */
export function enterBullet(text, pos) {
  const before = text.slice(0, pos), after = text.slice(pos);
  const ls = before.lastIndexOf('\n') + 1, line = before.slice(ls);
  const m = /^([ \t]*)(?:[-*•]\s*)?(.*)$/.exec(line);
  const indent = m[1].replace(/\t/g, '  ');
  if (!m[2].trim() && !after.split('\n')[0].trim()) { // an empty bullet: out one level
    if (indent.length >= 2) { const ni = indent.slice(2); const nl = ni + '- '; return { text: text.slice(0, ls) + nl + after.replace(/^[^\n]*/, ''), pos: ls + nl.length }; }
    return { text, pos };
  }
  const ins = '\n' + indent + '- ';
  return { text: before + ins + after, pos: pos + ins.length };
}

/** a text's lines as a nested markdown list. Pure. */
export const outlineMd = (text) => outlineParse(text).map((i) => '  '.repeat(i.depth) + '- ' + i.text).join('\n');

/** rows of a csv/tsv/semicolon text, quotes and "" escapes honoured. Delimiter by the first line. Pure. */
export function parseCsv(text, limits = { rows: 200, cols: 20, cell: 200 }) {
  const t = clean(text).replace(/\r\n?/g, '\n').replace(/^﻿/, '').replace(/^\n+|\n+$/g, '');
  if (!t) return [];
  let first = '', q = false;
  for (const c of t) { if (c === '"') q = !q; if (c === '\n' && !q) break; first += c; }
  const count = (d) => { let n = 0, inq = false; for (const c of first) { if (c === '"') inq = !inq; else if (c === d && !inq) n++; } return n; };
  const delim = [['\t', count('\t')], [',', count(',')], [';', count(';')]].sort((a, b) => b[1] - a[1])[0];
  const D = delim[1] ? delim[0] : ',';
  const rows = []; let row = [], cell = '', inq = false;
  const endCell = () => { row.push(cell); cell = ''; };
  const endRow = () => { endCell(); if (row.some((c) => c.trim() !== '') || row.length > 1) rows.push(row); row = []; };
  for (let i = 0; i < t.length; i++) {
    const c = t[i];
    if (inq) { if (c === '"') { if (t[i + 1] === '"') { cell += '"'; i++; } else inq = false; } else cell += c; }
    else if (c === '"' && cell === '') inq = true;
    else if (c === D) endCell();
    else if (c === '\n') endRow();
    else cell += c;
  }
  endRow();
  return rows.slice(0, limits.rows).map((r) => r.slice(0, limits.cols).map((c) => c.trim().slice(0, limits.cell)));
}

/** the rows an ask carries: lines, or ";" between rows when the ask has no line break and mixes "," and ";". Pure. */
export function rowsFromAsk(body) {
  const b = clean(body);
  if (!/\n/.test(b) && b.includes(';') && b.includes(',')) return parseCsv(b.split(';').map((s) => s.trim()).join('\n'));
  return parseCsv(b);
}

const numeric = (v) => v !== '' && Number.isFinite(Number(String(v).replace(/[,$%\s]/g, '')));
const num = (v) => Number(String(v).replace(/[,$%\s]/g, ''));

/** body rows (header row kept first) ordered by column `col`, numbers as numbers; dir 1 up, -1 down, 0 as typed. Pure. */
export function sortedRows(rows, col, dir) {
  if (!rows.length || !dir || col == null || col < 0) return rows.slice();
  const head = rows[0], body = rows.slice(1);
  const allNum = body.every((r) => (r[col] == null || r[col] === '') || numeric(r[col]));
  const key = (r) => (allNum ? (r[col] === '' || r[col] == null ? -Infinity : num(r[col])) : String(r[col] == null ? '' : r[col]).toLowerCase());
  body.sort((a, b) => { const x = key(a), y = key(b); return (x < y ? -1 : x > y ? 1 : 0) * dir; });
  return [head, ...body];
}

const mdCell = (c) => String(c == null ? '' : c).replace(/\|/g, '\\|').replace(/\n/g, ' ');
/** rows as a markdown table (the first row is the header). Pure. */
export function mdTable(rows) {
  if (!rows.length) return '';
  const w = Math.max(...rows.map((r) => r.length));
  const pad = (r) => Array.from({ length: w }, (_, i) => mdCell(r[i]));
  return ['| ' + pad(rows[0]).join(' | ') + ' |', '| ' + pad(rows[0]).map(() => '---').join(' | ') + ' |', ...rows.slice(1).map((r) => '| ' + pad(r).join(' | ') + ' |')].join('\n');
}

/** the plain words of one stage thing: { title, body } or null when it holds no writing. Pure. */
export function thingText(th) {
  if (!th) return null;
  if (th.kind === 'sticky') return { title: '', body: String(th.text || '') };
  if (th.kind === 'notepad') return { title: String(th.title || ''), body: String(th.text || '') };
  if (th.kind === 'list') return { title: String(th.title || ''), body: (th.items || []).map((i) => (i.done ? '[x] ' : '[ ] ') + i.text).join('\n') };
  if (th.kind === 'outline') return { title: String(th.title || ''), body: outlineText(outlineParse(th.text)) };
  if (th.kind === 'csvtable') return { title: String(th.title || ''), body: (th.rows || []).map((r) => r.join('\t')).join('\n') };
  if (th.kind === 'filecard') return { title: String(th.name || ''), body: String(th.preview || '') };
  if (th.kind === 'kept') return { title: String(th.name || ''), body: stripTags(th.html) };
  return null;
}

/** one thing as markdown, or null when it holds no writing. Pure. */
export function thingMarkdown(th) {
  const t = thingText(th);
  if (!t) return null;
  const head = t.title ? '# ' + t.title + '\n\n' : '';
  let body = t.body;
  if (th.kind === 'list') body = (th.items || []).map((i) => '- [' + (i.done ? 'x' : ' ') + '] ' + i.text).join('\n');
  else if (th.kind === 'outline') body = outlineMd(th.text);
  else if (th.kind === 'csvtable') body = mdTable(th.rows || []);
  else if (th.kind === 'filecard') body = (th.preview ? '```\n' + th.preview + '\n```' : '_' + (th.mime || 'file') + ', ' + (th.size || 0) + ' bytes_');
  return (head + body).trim() + '\n';
}

/** the whole stage as plain text, top to bottom then left to right; things with no writing are left out. Pure. */
export function stageText(things) {
  const list = Object.values(things || {}).filter((t) => t && thingText(t)).sort((a, b) => (Math.round((+a.y || 0) / 40) - Math.round((+b.y || 0) / 40)) || ((+a.x || 0) - (+b.x || 0)));
  return list.map((t) => { const x = thingText(t); return '[' + t.kind + (x.title ? ': ' + x.title : '') + ']\n' + x.body.trim(); }).join('\n\n') + (list.length ? '\n' : '');
}

/** ids of the things whose words contain q (case-folded), with how many matches in all. Pure. */
export function findIn(things, q) {
  const needle = String(q || '').toLowerCase();
  if (!needle) return { ids: [], total: 0 };
  const ids = []; let total = 0;
  for (const t of Object.values(things || {})) {
    const x = t && thingText(t); if (!x) continue;
    const hay = (x.title + '\n' + x.body).toLowerCase(); let n = 0, i = -1;
    while ((i = hay.indexOf(needle, i + 1)) >= 0) n++;
    if (n) { ids.push(t.id); total += n; }
  }
  return { ids, total };
}

/** text with every `from` replaced by `to` (case-folded match): { text, count }. Pure. */
export function replaceIn(text, from, to) {
  const f = String(from || ''); if (!f) return { text: String(text || ''), count: 0 };
  let count = 0;
  const out = String(text || '').replace(new RegExp(f.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi'), () => { count++; return to; });
  return { text: out, count };
}

/** a file name from a thing's words: lower case, dashes, 40 characters. Pure. */
export function slugOf(s, fallback = 'note') {
  const t = String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40).replace(/-+$/g, '');
  return t || fallback;
}

// ---- the asks --------------------------------------------------------------------------------------------------------
const NOUN = String.raw`(?:note|notes|sticky|stickies|sticky\s+note|notepad|outline|list|table|card|selection|selected(?:\s+(?:note|text|card))?|it)`;
const THE = String.raw`(?:the\s+|this\s+|that\s+|my\s+|these\s+|those\s+)?`;
const tidy = (s) => String(s || '').trim().replace(/\s+/g, ' ').replace(/[.!?]+$/, '');
const unq = (s) => { const m = /^["'“‘](.*)["'”’]$/.exec(String(s).trim()); return (m ? m[1] : String(s)).trim(); };

/** what a notes-and-writing ask means: { act, ... } or null. acts: md, text, find, unfind, replace, count, reading, pin, unpin,
 *  collapse, expand, duplicate. Pure. */
export function noteIntent(raw) {
  const t = tidy(clean(raw)), l = t.toLowerCase();
  let m;
  if ((m = new RegExp('^(?:please\\s+)?(?:export|download|save|get)\\s+' + THE + '(' + NOUN + ')?\\s*(?:as|to|into|in)\\s+(?:a\\s+)?(?:markdown|md)(?:\\s+file)?$').exec(l))
    || (m = new RegExp('^(?:a\\s+)?markdown\\s+(?:export|download|file)\\s+(?:of|for)\\s+' + THE + '(' + NOUN + ')$').exec(l))) return { act: 'md', noun: m[1] || 'it' };
  if (/^(?:please\s+)?(?:export|download|save|get)\s+(?:the\s+|my\s+|everything\s+on\s+the\s+)?(?:whole\s+)?(?:stage|everything(?:\s+on\s+the\s+stage)?|all\s+(?:my\s+)?notes)\s*(?:as|to|into|in)\s+(?:a\s+)?(?:plain\s+)?(?:text|txt)(?:\s+file)?$/.test(l)
    || /^(?:a\s+)?(?:plain[- ]?text|text)\s+export\s+of\s+(?:the\s+|my\s+)?(?:stage|notes|all\s+notes)$/.test(l)) return { act: 'text' };
  if ((m = /^(?:find|search(?:\s+for)?|highlight)\s+(.+?)\s+(?:on|in|across)\s+(?:the\s+|my\s+|all\s+)?(?:stage|notes|my\s+notes|everything|all\s+notes)$/.exec(t))) { const q = unq(m[1]); if (q) return { act: 'find', q }; }
  if (/^(?:clear|remove|stop|hide)\s+(?:the\s+)?(?:find|highlights?|highlighting|search\s+highlights?)$/.test(l)) return { act: 'unfind' };
  if ((m = new RegExp('^(?:please\\s+)?replace\\s+(.+?)\\s+with\\s+(.+?)\\s+(?:in|across|on)\\s+(all\\s+(?:my\\s+|the\\s+)?(?:notes|stickies)|' + THE + NOUN + ')$', 'i').exec(t))) {
    const from = unq(m[1]); if (from) return { act: 'replace', from, to: unq(m[2]), all: /^all\b/i.test(m[3]), noun: /^all/i.test(m[3]) ? 'notes' : m[3].replace(/^(?:the|this|that|my)\s+/i, '').toLowerCase() };
  }
  if ((m = new RegExp('^(?:word\\s+count|count\\s+(?:the\\s+)?words|how\\s+many\\s+words)\\s*(?:of|in|on|for|are\\s+in)?\\s*' + THE + '(' + NOUN + ')$').exec(l))) return { act: 'count', noun: m[1] };
  if ((m = new RegExp('^(?:the\\s+)?(?:reading\\s+time|read\\s+time)\\s*(?:of|for|on|in)\\s*' + THE + '(' + NOUN + ')$').exec(l))
    || (m = new RegExp('^how\\s+long\\s+(?:does\\s+it\\s+take\\s+)?(?:to\\s+)?read\\s+' + THE + '(' + NOUN + ')$').exec(l))) return { act: 'reading', noun: m[1] };
  if ((m = new RegExp('^(?:please\\s+)?(?:pin|stick|fix|anchor)\\s+' + THE + '(' + NOUN + ')\\s+(?:to|in|at|on)\\s+' + THE + '(?:(top|bottom)[-\\s]?)?(?:(left|right)[-\\s]?)?corner$').exec(l))) return { act: 'pin', noun: m[1], v: m[2] || 'top', h: m[3] || 'right' };
  if ((m = new RegExp('^(?:please\\s+)?(?:unpin|release)\\s+' + THE + '(' + NOUN + ')$').exec(l))) return { act: 'unpin', noun: m[1] };
  if ((m = new RegExp('^(?:please\\s+)?collapse\\s+(?:all\\s+)?(?:the\\s+|this\\s+|that\\s+|my\\s+)?(long\\s+)?(notes|stickies|' + NOUN + ')$').exec(l))) return { act: 'collapse', noun: m[2], long: !!m[1] };
  if ((m = new RegExp('^(?:please\\s+)?(?:expand|uncollapse|unfold|open\\s+up)\\s+(?:all\\s+)?(?:the\\s+|this\\s+|that\\s+|my\\s+)?(notes|stickies|' + NOUN + ')$').exec(l))) return { act: 'expand', noun: m[1] };
  if ((m = new RegExp('^(?:please\\s+)?(?:duplicate|clone|copy)\\s+' + THE + '(note|sticky|sticky\\s+note|notepad|outline|list|table)$').exec(l))
    || (m = new RegExp('^(?:please\\s+)?(?:make|give\\s+me)\\s+(?:a\\s+)?(?:copy|duplicate)\\s+of\\s+' + THE + '(note|sticky|sticky\\s+note|notepad|outline|list|table)$').exec(l))) return { act: 'duplicate', noun: m[1] };
  return null;
}

/** the stage kinds a noun in an ask can mean. Pure. */
export function kindsOfNoun(noun) {
  const n = String(noun || 'it').toLowerCase();
  if (/^(sticky|stickies|sticky note)$/.test(n)) return ['sticky'];
  if (n === 'notepad') return ['notepad'];
  if (n === 'outline') return ['outline'];
  if (n === 'list') return ['list'];
  if (n === 'table') return ['csvtable'];
  if (/^notes?$/.test(n)) return ['sticky', 'notepad', 'outline'];
  return NOTE_KINDS.concat('kept');
}

/** the thing an ask means: the picked one if its kind fits the noun, else the newest of the kinds the noun names. Pure. */
export function targetOf(things, selectedId, noun) {
  const kinds = kindsOfNoun(noun), sel = things[selectedId];
  if (sel && kinds.includes(sel.kind)) return sel;
  const all = Object.values(things).filter((t) => t && kinds.includes(t.kind));
  return all.length ? all[all.length - 1] : null;
}

/** what a scanned code holds: { type: 'link' | 'text', value } (a link only for http(s) with a host). Pure. */
export function scanValue(raw) {
  const v = String(raw == null ? '' : raw).trim().slice(0, 2000);
  try { const u = new URL(v); if ((u.protocol === 'https:' || u.protocol === 'http:') && u.hostname) return { type: 'link', value: v }; } catch (_) {}
  return { type: 'text', value: v };
}
