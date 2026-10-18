// The table of list and table operations behind skills/list-tools.js (owner, 2026-10-18: "1000 more simple things", tools pack 10,
// items 281-331). Everything here is pure: an operation reads a list or table card (`th`) and says what changes - a `patch`
// for the card itself, or a `spawn` of a new card - and the skill applies it. Nothing is sent anywhere.
//   th (list):  { items: [{ id, text, done, depth?, pri? }], style?, cols?, view? }
//   th (table): { rows: string[][], header, zebra?, freeze?, filter?, hideEmpty?, result?, exportAs? }

const uid = () => 'item_' + Math.random().toString(36).slice(2, 9);
const lc = (s) => String(s == null ? '' : s).toLowerCase();
export const tidy = (s) => String(s || '').trim().replace(/\s+/g, ' ').replace(/[.!]+$/, '');
const unquote = (s) => { const t = String(s || '').trim(); const m = /^"([\s\S]*)"$/.exec(t) || /^'([\s\S]*)'$/.exec(t); return m ? m[1] : t; };
export const mkItem = (text, extra = {}) => ({ id: uid(), text: String(text), done: false, ...extra });
const cloneItems = (items) => (items || []).map((i) => ({ ...i }));

// ---------- small pure helpers (also exported for the card and the tests) ----------

/** the number at the front of a table cell ("$1,250.50", "12%", "3 kg"), or null. Pure. */
export function numOf(cell) {
  const m = /^\s*[-+]?\s*[$€£]?\s*[-+]?\d[\d,]*(?:\.\d+)?|^\s*[-+]?\s*[$€£]?\s*[-+]?\.\d+/.exec(String(cell == null ? '' : cell));
  if (!m) return null;
  const n = Number(m[0].replace(/[\s,$€£]/g, ''));
  return Number.isFinite(n) ? n : null;
}

/** the marker in front of the n-th item (1-based) for a list style: "1." or "a.". Pure. */
export function markerOf(style, n) {
  if (style === 'numbers') return n + '.';
  if (style === 'letters') { let s = '', k = n; while (k > 0) { k--; s = String.fromCharCode(97 + (k % 26)) + s; k = Math.floor(k / 26); } return s + '.'; }
  return '';
}

export const PRIORITY = { high: '\u{1F534}', medium: '\u{1F7E1}', low: '\u{1F7E2}' };
const PRI_WORD = { high: 'high', urgent: 'high', top: 'high', important: 'high', medium: 'medium', normal: 'medium', low: 'low', minor: 'low' };

/** the item at a name: exact (any case), then the one it starts, then the one that holds it (only when unique). -1 for none. Pure. */
export function findIdx(items, name) {
  const n = lc(String(name || '').replace(/^(?:the|my|an?)\s+/i, '').trim());
  if (!n) return -1;
  const list = items || [];
  let i = list.findIndex((x) => lc(x.text) === n);
  if (i >= 0) return i;
  const starts = list.map((x, k) => (lc(x.text).startsWith(n) ? k : -1)).filter((k) => k >= 0);
  if (starts.length === 1) return starts[0];
  const has = list.map((x, k) => (lc(x.text).includes(n) ? k : -1)).filter((k) => k >= 0);
  return has.length === 1 ? has[0] : -1;
}

/** the column an ask points at: "2", "last", or a header name; a 0-based index or -1. Pure. */
export function colIdx(th, ref) {
  const rows = (th && th.rows) || [], width = Math.max(0, ...rows.map((r) => r.length));
  const r = lc(unquote(ref)).trim();
  if (r === 'last') return width - 1;
  if (r === 'first') return width ? 0 : -1;
  if (/^\d+$/.test(r)) { const n = Number(r) - 1; return n >= 0 && n < width ? n : -1; }
  if (th && th.header && rows[0]) return rows[0].findIndex((h) => lc(h).trim() === r);
  return -1;
}

/** words of the items by how often they come up, for a tag cloud: [{ word, count, size }] (size 1 to 5). Pure. */
export function cloudOf(items) {
  const STOP = new Set(['a', 'an', 'the', 'of', 'to', 'and', 'or', 'in', 'on', 'for', 'with', 'at', 'is']);
  const count = new Map();
  for (const it of items || []) for (const w of lc(it.text).split(/[^a-z0-9À-￿']+/).filter((x) => x && !STOP.has(x))) count.set(w, (count.get(w) || 0) + 1);
  const max = Math.max(1, ...count.values());
  return [...count].map(([word, c]) => ({ word, count: c, size: max === 1 ? 3 : 1 + Math.round(((c - 1) / (max - 1)) * 4) })).sort((a, b) => b.count - a.count || a.word.localeCompare(b.word));
}

/** move the item `fromId` to where `toId` is (drag and drop). A new array; the same one for an unknown id. Pure. */
export function reorder(items, fromId, toId) {
  const list = cloneItems(items), a = list.findIndex((i) => i.id === fromId), b = list.findIndex((i) => i.id === toId);
  if (a < 0 || b < 0 || a === b) return list;
  const [it] = list.splice(a, 1);
  list.splice(b, 0, it);
  return list;
}

// ---------- CSV, TSV and Markdown ----------

/** rows of cells from CSV (or TSV with "\t"): quotes, doubled quotes and quoted line breaks handled. Pure. */
export function parseDelimited(text, delim = ',') {
  const src = String(text == null ? '' : text).replace(/\r\n?/g, '\n');
  const rows = []; let row = [], cell = '', q = false;
  for (let i = 0; i < src.length; i++) {
    const c = src[i];
    if (q) { if (c === '"') { if (src[i + 1] === '"') { cell += '"'; i++; } else q = false; } else cell += c; }
    else if (c === '"' && cell === '') q = true;
    else if (c === delim) { row.push(cell); cell = ''; }
    else if (c === '\n') { row.push(cell); rows.push(row); row = []; cell = ''; }
    else cell += c;
  }
  if (cell !== '' || row.length) { row.push(cell); rows.push(row); }
  return rows.filter((r) => r.some((x) => String(x).trim() !== '')).map((r) => r.map((x) => String(x).trim()));
}

const csvCell = (v, delim) => { const s = String(v == null ? '' : v); return s.includes('"') || s.includes('\n') || s.includes(delim) ? '"' + s.replace(/"/g, '""') + '"' : s; };
/** CSV text of the rows. Pure. */
export const toCsv = (rows) => (rows || []).map((r) => r.map((v) => csvCell(v, ',')).join(',')).join('\n');
/** TSV text of the rows (tabs and line breaks inside a cell become spaces). Pure. */
export const toTsv = (rows) => (rows || []).map((r) => r.map((v) => String(v == null ? '' : v).replace(/[\t\n\r]+/g, ' ')).join('\t')).join('\n');
/** a Markdown table: the first row is the header when `header`, otherwise an empty header line. Pure. */
export function toMarkdown(rows, header = true) {
  const rs = (rows || []).map((r) => r.map((v) => String(v == null ? '' : v).replace(/\|/g, '\\|').replace(/\n/g, ' ')));
  if (!rs.length) return '';
  const w = Math.max(...rs.map((r) => r.length));
  const pad = (r) => { const o = r.slice(); while (o.length < w) o.push(''); return '| ' + o.join(' | ') + ' |'; };
  const head = header ? rs[0] : new Array(w).fill('');
  return [pad(head), '| ' + new Array(w).fill('---').join(' | ') + ' |', ...(header ? rs.slice(1) : rs).map(pad)].join('\n');
}

// ---------- the operations ----------
// Each op: { id, n (the owner's number), on: 'list' | 'table', re (against the ask with "the list"/"the table" taken out),
// rawRe (against the whole ask, used when re is not given), needs: the ask must name the list or the table, args(match) -> args,
// apply(th, args, ctx) -> { say, patch?, spawn?: { kind: 'list' | 'datatable', props }, result? } or null when it cannot }.
// ctx: { rng, other (the second list for merge/intersect/subtract) }.

const setAll = (items, fn) => cloneItems(items).map(fn);
const wordsOf = (s) => String(s || '').split(/\s*(?:,|;|&|\band\b|\n)\s*/i).map((x) => x.trim()).filter(Boolean);
const rowsBody = (th) => ((th.rows || []).slice(th.header ? 1 : 0));
const nameList = (items) => items.map((i) => i.text);
const spawnList = (title, texts) => ({ kind: 'list', props: { title, items: texts.map((t) => mkItem(t)) } });
const pad2 = (rows) => { const w = Math.max(0, ...rows.map((r) => r.length)); return rows.map((r) => { const o = r.slice(); while (o.length < w) o.push(''); return o; }); };
const NO_ITEM = (name) => ({ say: 'I could not find "' + name + '" on the list', fail: true });

function groupsOf(items) { // a parent and the deeper items under it travel together
  const out = [];
  for (const it of items) { if ((it.depth || 0) === 0 || !out.length) out.push([it]); else out[out.length - 1].push(it); }
  return out;
}

const collator = new Intl.Collator(undefined, { numeric: true, sensitivity: 'base' });

export const OPS = [
  // --- lists: ticks (281 add item is skills/list.js: "add milk to the list") ---
  { n: 282, id: 'remove-checked', on: 'list', needs: true, re: /^(?:remove|delete|clear|drop)\s+(?:all\s+)?(?:the\s+)?(?:checked|done|completed|ticked|finished)(?:\s+items?)?$/,
    apply: (th) => { const left = th.items.filter((i) => !i.done); const n = th.items.length - left.length; return n ? { patch: { items: left }, say: 'removed ' + n + ' checked item' + (n === 1 ? '' : 's') } : { say: 'nothing was checked', fail: true }; } },
  { n: 283, id: 'check-all', on: 'list', needs: true, re: /^(?:check|tick|complete)\s+(?:off\s+)?(?:all|everything)(?:\s+items?)?$/,
    apply: (th) => ({ patch: { items: setAll(th.items, (i) => ({ ...i, done: true })) }, say: 'checked all ' + th.items.length }) },
  { n: 284, id: 'uncheck-all', on: 'list', needs: true, re: /^(?:uncheck|untick|reset|clear\s+the\s+checks\s+on)\s+(?:all|everything)(?:\s+items?)?$|^(?:uncheck|untick)(?:\s+(?:all|everything))?(?:\s+items?)?$/,
    apply: (th) => ({ patch: { items: setAll(th.items, (i) => ({ ...i, done: false })) }, say: 'unchecked all ' + th.items.length }) },
  { n: 285, id: 'invert-checks', on: 'list', needs: true, re: /^(?:invert|flip|toggle|reverse)\s+(?:all\s+)?(?:the\s+)?(?:checks?|ticks?|checked(?:\s+items?)?|checkmarks?)$|^invert(?:\s+selection)?$/,
    apply: (th) => ({ patch: { items: setAll(th.items, (i) => ({ ...i, done: !i.done })) }, say: 'flipped every check' }) },
  // --- lists: order, nesting ---
  { n: 286, id: 'move-up', on: 'list', needs: true, re: /^move\s+(.+?)\s+up(?:\s+(?:one|1)(?:\s+(?:place|spot|step))?)?$/, args: (m) => ({ name: m[1] }),
    apply: (th, a) => { const i = findIdx(th.items, a.name); if (i < 0) return NO_ITEM(a.name); if (i === 0) return { say: a.name + ' is already first', fail: true }; const items = cloneItems(th.items); [items[i - 1], items[i]] = [items[i], items[i - 1]]; return { patch: { items }, say: 'moved ' + th.items[i].text + ' up' }; } },
  { n: 287, id: 'move-down', on: 'list', needs: true, re: /^move\s+(.+?)\s+down(?:\s+(?:one|1)(?:\s+(?:place|spot|step))?)?$/, args: (m) => ({ name: m[1] }),
    apply: (th, a) => { const i = findIdx(th.items, a.name); if (i < 0) return NO_ITEM(a.name); if (i === th.items.length - 1) return { say: a.name + ' is already last', fail: true }; const items = cloneItems(th.items); [items[i + 1], items[i]] = [items[i], items[i + 1]]; return { patch: { items }, say: 'moved ' + th.items[i].text + ' down' }; } },
  { n: 286, id: 'move-edge', on: 'list', needs: true, re: /^move\s+(.+?)\s+to\s+(?:the\s+)?(top|bottom|start|end|front|back)$/, args: (m) => ({ name: m[1], to: /top|start|front/.test(m[2]) ? 'top' : 'bottom' }),
    apply: (th, a) => { const i = findIdx(th.items, a.name); if (i < 0) return NO_ITEM(a.name); const items = cloneItems(th.items); const [it] = items.splice(i, 1); if (a.to === 'top') items.unshift(it); else items.push(it); return { patch: { items }, say: 'moved ' + it.text + ' to the ' + a.to }; } },
  { n: 288, id: 'indent', on: 'list', needs: true, re: /^(?:indent|nest|demote)\s+(.+?)(?:\s+(?:under|below|beneath|inside)\s+(.+))?$|^make\s+(.+?)\s+a\s+sub-?\s?items?\s+of\s+(.+)$/,
    args: (m) => ({ name: m[3] || m[1], under: m[4] || m[2] || '' }),
    apply: (th, a) => {
      const i = findIdx(th.items, a.name); if (i < 0) return NO_ITEM(a.name);
      const items = cloneItems(th.items);
      if (a.under) {
        const p = findIdx(items, a.under); if (p < 0 || p === i) return NO_ITEM(a.under);
        const [it] = items.splice(i, 1);
        let at = items.findIndex((x) => x.id === th.items[p].id) + 1;
        const pd = items[at - 1].depth || 0;
        while (at < items.length && (items[at].depth || 0) > pd) at++;
        it.depth = Math.min(2, pd + 1);
        items.splice(at, 0, it);
        return { patch: { items }, say: 'nested ' + it.text + ' under ' + th.items[p].text };
      }
      if (i === 0) return { say: 'the first item has nothing to nest under', fail: true };
      const d = items[i].depth || 0; if (d >= 2 || d > (items[i - 1].depth || 0)) return { say: items[i].text + ' is already nested as far as it goes', fail: true };
      items[i].depth = d + 1;
      return { patch: { items }, say: 'indented ' + items[i].text };
    } },
  { n: 289, id: 'promote', on: 'list', needs: true, re: /^(?:promote|outdent|unindent|un-?nest|dedent)\s+(.+)$/, args: (m) => ({ name: m[1] }),
    apply: (th, a) => { const i = findIdx(th.items, a.name); if (i < 0) return NO_ITEM(a.name); const items = cloneItems(th.items); const d = items[i].depth || 0; if (!d) return { say: items[i].text + ' is not nested', fail: true }; items[i].depth = d - 1; return { patch: { items }, say: 'promoted ' + items[i].text }; } },
  { n: 295, id: 'sort-list', on: 'list', needs: true, re: /^sort(?:\s+(?:it|items))?(?:\s+(alphabetically|a-z|az|ascending|asc|z-a|za|descending|desc|backwards|in reverse))?$/, args: (m) => ({ desc: /z-a|za|desc|back|rev/.test(m[1] || '') }),
    apply: (th, a) => { const gs = groupsOf(cloneItems(th.items)).sort((x, y) => collator.compare(x[0].text, y[0].text) * (a.desc ? -1 : 1)); return { patch: { items: gs.flat() }, say: 'sorted ' + (a.desc ? 'z to a' : 'a to z') }; } },
  // --- lists: new lists from this one (the original stays) ---
  { n: 309, id: 'merge', on: 'list', needs: true, rawRe: /^(?:merge|combine|union|join)\s+(?:the\s+|my\s+)?(?:two\s+|both\s+)?lists(?:\s+together)?$/,
    apply: (th, a, ctx) => { if (!ctx.other) return { say: 'merging needs two lists on the stage', fail: true }; const seen = new Set(), out = []; for (const t of [...nameList(th.items), ...nameList(ctx.other.items)]) if (!seen.has(lc(t))) { seen.add(lc(t)); out.push(t); } return { spawn: spawnList('Merged', out), say: 'merged into a new list of ' + out.length }; } },
  { n: 310, id: 'intersect', on: 'list', needs: true, rawRe: /^(?:intersect|intersection\s+of|common\s+items\s+(?:in|of)|what(?:'s| is)\s+in\s+both)\s+(?:the\s+|my\s+)?(?:two\s+|both\s+)?lists$|^(?:intersect)\s+(?:the\s+)?lists$/,
    apply: (th, a, ctx) => { if (!ctx.other) return { say: 'intersecting needs two lists on the stage', fail: true }; const b = new Set(nameList(ctx.other.items).map(lc)), seen = new Set(); const out = nameList(th.items).filter((t) => b.has(lc(t)) && !seen.has(lc(t)) && seen.add(lc(t))); return { spawn: spawnList('In both', out), say: out.length + ' item' + (out.length === 1 ? '' : 's') + ' in both lists' }; } },
  { n: 311, id: 'subtract', on: 'list', needs: true, rawRe: /^subtract\s+(?:the\s+)?(?:second|other)\s+(?:list\s+)?from\s+(?:the\s+)?(?:first|this)(?:\s+list)?$|^(?:items\s+in\s+)?(?:the\s+)?first\s+(?:list\s+)?(?:but\s+not|minus|without)\s+(?:in\s+)?(?:the\s+)?(?:second|other)(?:\s+list)?$/,
    apply: (th, a, ctx) => { if (!ctx.other) return { say: 'subtracting needs two lists on the stage', fail: true }; const b = new Set(nameList(ctx.other.items).map(lc)); const out = nameList(th.items).filter((t) => !b.has(lc(t))); return { spawn: spawnList('Only in the first', out), say: out.length + ' item' + (out.length === 1 ? '' : 's') + ' only in the first list' }; } },
  { n: 313, id: 'chunk', on: 'list', needs: true, re: /^(?:split|chunk|group|break|cut|divide)(?:\s+(?:it|items))?\s+(?:in)?to\s+(?:groups?|chunks?|rows?|sets?)\s+of\s+(\d+)$|^chunk(?:\s+by)?\s+(\d+)$/, args: (m) => ({ n: Number(m[1] || m[2]) }),
    apply: (th, a) => { const n = Math.min(12, Math.max(1, a.n | 0)); const t = nameList(th.items), rows = []; for (let i = 0; i < t.length; i += n) rows.push(t.slice(i, i + n)); return rows.length ? { spawn: { kind: 'datatable', props: { title: 'Groups of ' + n, header: false, rows: pad2(rows) } }, say: 'made ' + rows.length + ' group' + (rows.length === 1 ? '' : 's') + ' of ' + n } : { say: 'the list is empty', fail: true }; } },
  { n: 314, id: 'pairs', on: 'list', needs: true, re: /^(?:sliding\s+pairs|make\s+(?:sliding\s+)?pairs|pair\s+up(?:\s+(?:neighbou?rs|neighbors|items))?|neighbou?r\s+pairs|adjacent\s+pairs|pairs)$/,
    apply: (th) => { const t = nameList(th.items); if (t.length < 2) return { say: 'a list needs two items to make pairs', fail: true }; const rows = []; for (let i = 0; i + 1 < t.length; i++) rows.push([t[i], t[i + 1]]); return { spawn: { kind: 'datatable', props: { title: 'Sliding pairs', header: false, rows } }, say: rows.length + ' sliding pairs' }; } },
  { n: 323, id: 'sample', on: 'list', needs: true, re: /^(?:pick|choose|draw|sample|select|give\s+me)\s+(\d+)\s+(?:random(?:ly)?(?:\s+items?)?|at\s+random)(?:\s+from)?$|^random\s+(?:sample\s+of\s+)?(\d+)$|^(?:pick|choose|sample)\s+(\d+)$/, args: (m) => ({ n: Number(m[1] || m[2] || m[3]) }),
    apply: (th, a, ctx) => { const rng = ctx.rng || Math.random; const pool = nameList(th.items); for (let i = pool.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [pool[i], pool[j]] = [pool[j], pool[i]]; } const out = pool.slice(0, Math.max(1, a.n | 0)); return out.length ? { spawn: spawnList('Random ' + out.length, out), say: 'picked ' + out.length + ' at random' } : { say: 'the list is empty', fail: true }; } },
  { n: 324, id: 'first-n', on: 'list', needs: true, re: /^(?:keep\s+|take\s+|show\s+|copy\s+|give\s+me\s+)?(?:only\s+)?(?:the\s+)?first\s+(\d+)(?:\s+items?)?$/, args: (m) => ({ n: Number(m[1]) }),
    apply: (th, a) => { const out = nameList(th.items).slice(0, Math.max(1, a.n | 0)); return out.length ? { spawn: spawnList('First ' + out.length, out), say: 'the first ' + out.length + ', as a new list' } : { say: 'the list is empty', fail: true }; } },
  { n: 325, id: 'last-n', on: 'list', needs: true, re: /^(?:keep\s+|take\s+|show\s+|copy\s+|give\s+me\s+)?(?:only\s+)?(?:the\s+)?last\s+(\d+)(?:\s+items?)?$/, args: (m) => ({ n: Number(m[1]) }),
    apply: (th, a) => { const n = Math.max(1, a.n | 0), t = nameList(th.items), out = t.slice(Math.max(0, t.length - n)); return out.length ? { spawn: spawnList('Last ' + out.length, out), say: 'the last ' + out.length + ', as a new list' } : { say: 'the list is empty', fail: true }; } },
  { n: 326, id: 'every-nth', on: 'list', needs: true, re: /^(?:keep\s+|take\s+|pick\s+|show\s+)?every\s+(\d+)(?:st|nd|rd|th)?(?:\s+item)?$/, args: (m) => ({ n: Number(m[1]) }),
    apply: (th, a) => { const n = Math.max(1, a.n | 0), out = nameList(th.items).filter((_, i) => i % n === n - 1); return out.length ? { spawn: spawnList('Every ' + n + (n === 1 ? 'st' : n === 2 ? 'nd' : n === 3 ? 'rd' : 'th'), out), say: out.length + ' item' + (out.length === 1 ? '' : 's') + ', every ' + n } : { say: 'the list is shorter than ' + n, fail: true }; } },
  { n: 312, id: 'assign', on: 'list', needs: true, re: /^(?:round[- ]?robin|assign|deal\s+out|hand\s+out|share\s+out|split\s+(?:up\s+)?between|divide\s+among)(?:\s+(?:items?|them|everything))?(?:\s+(?:out\s+)?(?:to|among|between))?\s+(.+)$/, args: (m) => ({ who: wordsOf(m[1]) }),
    apply: (th, a) => { if (a.who.length < 2) return { say: 'give two or more names, like "assign the list to Ann, Bob"', fail: true }; const items = cloneItems(th.items).map((it, i) => ({ ...it, text: it.text.replace(/\s+\(for [^)]*\)$/, '') + ' (for ' + a.who[i % a.who.length] + ')' })); return { patch: { items }, say: 'dealt ' + items.length + ' items to ' + a.who.join(', ') }; } },
  // --- lists: tidy the text ---
  { n: 315, id: 'prefix', on: 'list', needs: true, re: /^(?:add\s+)?(?:a\s+)?prefix\s+("[^"]*"|'[^']*'|\S+)\s+to\s+(?:every|each|all)(?:\s+(?:the\s+)?items?)?$|^prefix\s+(?:every|each|all)(?:\s+(?:the\s+)?items?)?\s+with\s+("[^"]*"|'[^']*'|\S+)$/, args: (m) => ({ s: unquote(m[1] || m[2]) }),
    apply: (th, a) => ({ patch: { items: setAll(th.items, (i) => ({ ...i, text: a.s + i.text })) }, say: 'put "' + a.s + '" in front of every item' }) },
  { n: 316, id: 'suffix', on: 'list', needs: true, re: /^(?:add\s+)?(?:a\s+)?suffix\s+("[^"]*"|'[^']*'|\S+)\s+to\s+(?:every|each|all)(?:\s+(?:the\s+)?items?)?$|^(?:suffix|append)\s+(?:every|each|all)(?:\s+(?:the\s+)?items?)?\s+with\s+("[^"]*"|'[^']*'|\S+)$|^append\s+("[^"]*"|'[^']*'|\S+)\s+to\s+(?:every|each|all)(?:\s+(?:the\s+)?items?)?$/, args: (m) => ({ s: unquote(m[1] || m[2] || m[3]) }),
    apply: (th, a) => ({ patch: { items: setAll(th.items, (i) => ({ ...i, text: i.text + a.s })) }, say: 'put "' + a.s + '" after every item' }) },
  { n: 317, id: 'style-numbers', on: 'list', needs: true, re: /^(?:number|add\s+numbers\s+to|show\s+numbers\s+on)(?:\s+(?:it|the\s+items?))?$|^(?:make\s+it\s+|turn\s+into\s+|show\s+as\s+)?(?:a\s+)?numbered(?:\s+(?:list|checklist))?$/, apply: () => ({ patch: { style: 'numbers' }, say: 'numbered' }) },
  { n: 318, id: 'style-letters', on: 'list', needs: true, re: /^(?:letter|add\s+letters\s+to|show\s+letters\s+on)(?:\s+(?:it|the\s+items?))?$|^(?:make\s+it\s+|turn\s+into\s+|show\s+as\s+)?(?:a\s+)?lettered(?:\s+(?:list|checklist))?$|^(?:use\s+)?letters\s+a,?\s*b,?\s*c$/, apply: () => ({ patch: { style: 'letters' }, say: 'lettered a, b, c' }) },
  { n: 317, id: 'style-plain', on: 'list', needs: true, re: /^(?:unnumber|remove\s+(?:the\s+)?(?:numbers|letters|numbering)(?:\s+from)?|no\s+numbers|plain)$|^(?:make\s+it\s+|show\s+as\s+)?(?:a\s+)?plain(?:\s+list)?$/, apply: () => ({ patch: { style: '' }, say: 'plain again' }) },
  { n: 319, id: 'priority', on: 'list', needs: true, re: /^(?:mark|set|make|flag)\s+(.+?)\s+(?:as\s+|to\s+|a\s+)?(high|urgent|top|important|medium|normal|low|minor)(?:\s+priority)?$|^(?:prioriti[sz]e)\s+(.+)$/, args: (m) => ({ name: m[3] || m[1], pri: m[3] ? 'high' : PRI_WORD[m[2]] }),
    apply: (th, a) => { const i = findIdx(th.items, a.name); if (i < 0) return NO_ITEM(a.name); const items = cloneItems(th.items); items[i].pri = a.pri; return { patch: { items }, say: PRIORITY[a.pri] + ' ' + items[i].text + ': ' + a.pri + ' priority' }; } },
  { n: 319, id: 'unprioritize', on: 'list', needs: true, re: /^(?:clear|remove|drop)\s+(?:the\s+)?priority\s+(?:on|of|from|for)\s+(.+)$|^(?:deprioriti[sz]e|unprioriti[sz]e)\s+(.+)$/, args: (m) => ({ name: m[1] || m[2] }),
    apply: (th, a) => { const i = findIdx(th.items, a.name); if (i < 0) return NO_ITEM(a.name); const items = cloneItems(th.items); delete items[i].pri; return { patch: { items }, say: 'cleared the priority on ' + items[i].text }; } },
  { n: 321, id: 'columns', on: 'list', needs: true, re: /^(?:show|put|lay\s*out|arrange|display|make)(?:\s+it)?\s+(?:in|into|as)\s+(\d|one|two|three|four)\s+columns?$|^(\d|two|three|four)[- ]columns?$|^(?:in\s+)?(one)\s+column$/, args: (m) => { const w = lc(m[1] || m[2] || m[3]); return { n: { one: 1, two: 2, three: 3, four: 4 }[w] || Number(w) }; },
    apply: (th, a) => (a.n >= 1 && a.n <= 4 ? { patch: { cols: a.n > 1 ? a.n : 0 }, say: a.n > 1 ? 'in ' + a.n + ' columns' : 'back to one column' } : { say: 'one to four columns', fail: true }) },
  { n: 322, id: 'cloud', on: 'list', needs: true, re: /^(?:show|turn|make|display)(?:\s+it)?\s+(?:as|into|like)\s+(?:a\s+)?(?:tag|word)\s+cloud$|^(?:tag|word)\s+cloud(?:\s+of)?$/, apply: () => ({ patch: { view: 'cloud' }, say: 'as a tag cloud: bigger words come up more' }) },
  { n: 322, id: 'uncloud', on: 'list', needs: true, re: /^(?:show|turn|make|display)(?:\s+it)?\s+(?:as|into|like|back\s+(?:to|as))\s+(?:a\s+)?(?:plain\s+)?(?:checklist|list|checkboxes)$|^(?:close|hide|stop)\s+(?:the\s+)?(?:tag|word)\s+cloud$/, apply: () => ({ patch: { view: '' }, say: 'back to the checklist' }) },
  // --- lists: duplicates and spaces ---
  { n: 327, id: 'dedupe', on: 'list', needs: true, re: /^(?:remove\s+(?:the\s+)?(?:duplicates?|dupes?|repeats?)|de-?dup(?:e|licate)?|dedupe|unique)(?:\s+(?:keep(?:ing)?|in)\s+(?:the\s+)?(?:same\s+|first\s+)?order)?$/,
    apply: (th) => { const seen = new Set(), items = th.items.filter((i) => !seen.has(i.text) && seen.add(i.text)); const n = th.items.length - items.length; return { patch: { items: cloneItems(items) }, say: n ? 'removed ' + n + ' exact duplicate' + (n === 1 ? '' : 's') : 'no exact duplicates', ...(n ? {} : { fail: true }) }; } },
  { n: 328, id: 'dedupe-ci', on: 'list', needs: true, re: /^(?:remove\s+(?:the\s+)?(?:duplicates?|dupes?|repeats?)|de-?dup(?:e|licate)?|dedupe|unique)\s+(?:ignoring\s+case|ignore\s+case|case[- ]insensitive(?:ly)?|regardless\s+of\s+case|any\s+case)$|^case[- ]insensitive\s+(?:dedupe|de-?dup(?:e|licate)?|unique)$/,
    apply: (th) => { const seen = new Set(), items = th.items.filter((i) => { const k = lc(i.text).replace(/\s+/g, ' ').trim(); return !seen.has(k) && seen.add(k); }); const n = th.items.length - items.length; return { patch: { items: cloneItems(items) }, say: n ? 'removed ' + n + ' duplicate' + (n === 1 ? '' : 's') + ', ignoring case' : 'no duplicates, ignoring case', ...(n ? {} : { fail: true }) }; } },
  { n: 329, id: 'normalize-spaces', on: 'list', needs: true, re: /^(?:normali[sz]e|tidy|clean(?:\s+up)?|collapse|fix|trim)\s+(?:the\s+)?(?:spaces|spacing|whitespace)(?:\s+in\s+(?:every|each|all)(?:\s+items?)?)?$/,
    apply: (th) => ({ patch: { items: setAll(th.items, (i) => ({ ...i, text: i.text.replace(/\s+/g, ' ').trim() })) }, say: 'tidied the spaces' }) },
  // --- lists <-> tables ---
  { n: 290, id: 'list-to-table', on: 'list', rawRe: /^(?:turn|convert|change|make|put)?\s*(?:the\s+|my\s+)?list\s+(?:in)?to\s+(?:a\s+)?(?:data\s+)?table$|^(?:turn|convert|change|make)\s+(?:the\s+|my\s+)?list\s+into\s+(?:a\s+)?table$/,
    apply: (th) => { if (!th.items.length) return { say: 'the list is empty', fail: true }; const split = th.items.some((i) => /\t|,|\|/.test(i.text)); const rows = split ? th.items.map((i) => i.text.split(/\t|\s*[,|]\s*/).map((x) => x.trim())) : [['Item', 'Done'], ...th.items.map((i) => [i.text, i.done ? 'yes' : 'no'])]; return { spawn: { kind: 'datatable', props: { title: th.title || 'From the list', header: !split, rows: pad2(rows) } }, say: 'the list as a table' }; } },
  { n: 291, id: 'table-to-list', on: 'table', rawRe: /^(?:turn|convert|change|make|put)?\s*(?:the\s+|my\s+)?(?:data\s+)?table\s+(?:in)?to\s+(?:a\s+)?list$|^(?:turn|convert|change|make)\s+(?:the\s+|my\s+)?(?:data\s+)?table\s+into\s+(?:a\s+)?list$/,
    apply: (th) => { const body = rowsBody(th).map((r) => r.map((c) => String(c).trim()).filter(Boolean).join(', ')).filter(Boolean); return body.length ? { spawn: spawnList(th.title || 'From the table', body), say: 'the table as a list of ' + body.length } : { say: 'the table is empty', fail: true }; } },
  // --- tables ---
  { n: 292, id: 'add-column', on: 'table', free: true, re: /^add\s+(?:a\s+|another\s+|one\s+|new\s+)*column(?:\s+(?:called|named|titled)?\s*(.+))?$/, args: (m) => ({ name: m[1] ? unquote(m[1]) : '' }),
    apply: (th, a) => { const rows = (th.rows || []).map((r) => r.slice()); const w = Math.max(0, ...rows.map((r) => r.length)); if (w >= 12) return { say: 'twelve columns is the most', fail: true }; rows.forEach((r, i) => { while (r.length < w) r.push(''); r.push(i === 0 && th.header ? (a.name || 'Column ' + (w + 1)) : ''); }); if (!rows.length) rows.push([a.name || 'Column 1']); return { patch: { rows }, say: 'added a column' }; } },
  { n: 293, id: 'add-row', on: 'table', free: true, re: /^add\s+(?:a\s+|another\s+|one\s+|new\s+)*row(?:\s*[:\-]\s*(.+)|\s+(?:with|of)\s+(.+))?$/, args: (m) => ({ cells: m[1] || m[2] ? parseDelimited(m[1] || m[2], ',')[0] || [] : [] }),
    apply: (th, a) => { const rows = (th.rows || []).map((r) => r.slice()); if (rows.length >= 200) return { say: 'two hundred rows is the most', fail: true }; const w = Math.max(1, ...rows.map((r) => r.length), a.cells.length); const row = new Array(w).fill(''); a.cells.forEach((c, i) => { row[i] = c; }); rows.push(row); return { patch: { rows }, say: 'added a row' }; } },
  { n: 294, id: 'delete-row', on: 'table', free: true, re: /^(?:delete|remove|drop)\s+row\s*(\d+|last|first)?$|^(?:delete|remove|drop)\s+the\s+(last|first)\s+row$/, args: (m) => ({ ref: m[1] || m[2] || 'last' }),
    apply: (th, a) => { const rows = (th.rows || []).slice(); const i = a.ref === 'last' ? rows.length - 1 : a.ref === 'first' ? 0 : Number(a.ref) - 1; if (!(i >= 0 && i < rows.length)) return { say: 'there is no row ' + a.ref, fail: true }; rows.splice(i, 1); return { patch: { rows }, say: 'deleted row ' + (i + 1) }; } },
  { n: 294, id: 'delete-column', on: 'table', free: true, re: /^(?:delete|remove|drop)\s+column\s+(.+)$/, args: (m) => ({ ref: m[1] }),
    apply: (th, a) => { const c = colIdx(th, a.ref); if (c < 0) return { say: 'there is no column ' + a.ref, fail: true }; const rows = (th.rows || []).map((r) => r.filter((_, k) => k !== c)); return { patch: { rows }, say: 'deleted column ' + (c + 1) }; } },
  { n: 295, id: 'sort-table', on: 'table', free: true, re: /^sort(?:\s+rows)?\s+by\s+(?:column\s+)?(.+?)(?:\s+(descending|desc|ascending|asc|z-a|a-z|reversed|high\s+to\s+low|low\s+to\s+high|highest\s+first|lowest\s+first|biggest\s+first|smallest\s+first))?$/, args: (m) => ({ ref: m[1] || '1', desc: /desc|z-a|reversed|high|biggest/.test(m[2] || '') }),
    apply: (th, a) => { const c = colIdx(th, a.ref); if (c < 0) return { say: 'there is no column ' + a.ref, fail: true }; const head = th.header ? [th.rows[0]] : [], body = rowsBody(th).slice(); const nums = body.every((r) => numOf(r[c]) !== null || String(r[c] || '').trim() === ''); body.sort((x, y) => (nums ? (numOf(x[c]) ?? Infinity) - (numOf(y[c]) ?? Infinity) : collator.compare(x[c] || '', y[c] || '')) * (a.desc ? -1 : 1)); return { patch: { rows: [...head, ...body] }, say: 'sorted by column ' + (c + 1) + (a.desc ? ', high to low' : ', low to high') }; } },
  { n: 295, id: 'sort-table-plain', on: 'table', needs: true, re: /^sort(?:\s+rows)?$/, args: () => ({ ref: '1', desc: false }), apply: (th, a) => OPS.find((o) => o.id === 'sort-table').apply(th, a) },
  { n: 296, id: 'column-stat', on: 'table', free: true, re: /^(?:what(?:'s| is)\s+)?(?:the\s+)?(sum|total|average|mean|avg|min(?:imum)?|max(?:imum)?|smallest|largest|lowest|highest|min\s+and\s+max|range)\s+(?:of\s+|in\s+)?(?:the\s+)?column\s+(.+)$|^(add\s+up)\s+column\s+(.+)$/, args: (m) => ({ what: lc(m[1] || m[3]), ref: m[2] || m[4] }),
    apply: (th, a) => {
      const c = colIdx(th, a.ref); if (c < 0) return { say: 'there is no column ' + a.ref, fail: true };
      const nums = rowsBody(th).map((r) => numOf(r[c])).filter((x) => x !== null);
      if (!nums.length) return { say: 'column ' + (c + 1) + ' has no numbers', fail: true };
      const sum = nums.reduce((s, x) => s + x, 0), r2 = (x) => Math.round(x * 1e6) / 1e6, lo = Math.min(...nums), hi = Math.max(...nums);
      const w = /sum|total|add up/.test(a.what) ? 'sum' : /average|mean|avg/.test(a.what) ? 'average' : /min and max|range/.test(a.what) ? 'range' : /min|smallest|lowest/.test(a.what) ? 'min' : 'max';
      const out = { sum: 'sum of column ' + (c + 1) + ' = ' + r2(sum), average: 'average of column ' + (c + 1) + ' = ' + r2(sum / nums.length), min: 'smallest in column ' + (c + 1) + ' = ' + r2(lo), max: 'largest in column ' + (c + 1) + ' = ' + r2(hi), range: 'column ' + (c + 1) + ' runs from ' + r2(lo) + ' to ' + r2(hi) }[w];
      return { patch: { result: out + ' (' + nums.length + ' numbers)' }, say: out };
    } },
  { n: 303, id: 'zebra', on: 'table', free: true, re: /^zebra[- ]?stripe(?:\s+(?:the\s+)?(?:rows|table))?$|^(?:add|turn\s+on|use)\s+zebra(?:\s+(?:stripes|striping|rows))?$/, apply: () => ({ patch: { zebra: true }, say: 'striped every other row' }) },
  { n: 303, id: 'unzebra', on: 'table', free: true, re: /^(?:remove|turn\s+off|no|stop)\s+(?:the\s+)?zebra(?:\s+(?:stripes|striping|rows))?$/, apply: () => ({ patch: { zebra: false }, say: 'stripes off' }) },
  { n: 304, id: 'freeze', on: 'table', free: true, re: /^(?:freeze|pin|stick|lock)\s+(?:the\s+)?(?:header|top)\s*(?:row)?$/, apply: (th) => (th.header ? { patch: { freeze: true }, say: 'the header row stays put while the rows scroll' } : { patch: { freeze: true, header: true }, say: 'the first row is now the header, and it stays put' }) },
  { n: 304, id: 'unfreeze', on: 'table', free: true, re: /^(?:unfreeze|unpin|unstick|unlock)\s+(?:the\s+)?(?:header|top)\s*(?:row)?$|^(?:stop\s+freezing)\s+(?:the\s+)?header$/, apply: () => ({ patch: { freeze: false }, say: 'the header scrolls again' }) },
  { n: 305, id: 'filter', on: 'table', free: true, re: /^(?:show\s+only|only\s+show|keep\s+only|filter)\s+(?:the\s+)?rows\s+(?:that\s+|which\s+)?(?:containing|contain|contains|with|has|have|having|matching)\s+(.+)$/, args: (m) => ({ q: unquote(m[1]) }),
    apply: (th, a) => { const q = lc(a.q); const hit = rowsBody(th).filter((r) => r.some((c) => lc(c).includes(q))).length; return { patch: { filter: a.q }, say: hit + ' row' + (hit === 1 ? '' : 's') + ' contain "' + a.q + '"' }; } },
  { n: 305, id: 'unfilter', on: 'table', free: true, re: /^(?:show\s+all\s+(?:the\s+)?rows|clear\s+(?:the\s+)?filter|remove\s+(?:the\s+)?filter|unfilter|show\s+every\s+row)$/, apply: () => ({ patch: { filter: '' }, say: 'every row is back' }) },
  { n: 306, id: 'hide-empty', on: 'table', free: true, re: /^(?:hide|skip|ignore)\s+(?:the\s+)?empty\s+rows$/, apply: () => ({ patch: { hideEmpty: true }, say: 'empty rows are hidden' }) },
  { n: 306, id: 'show-empty', on: 'table', free: true, re: /^(?:show|unhide)\s+(?:the\s+)?empty\s+rows$/, apply: () => ({ patch: { hideEmpty: false }, say: 'empty rows are back' }) },
  { n: 307, id: 'transpose', on: 'table', free: true, re: /^transpose$|^(?:swap|flip|switch)\s+(?:the\s+)?rows\s+and\s+(?:the\s+)?columns$|^(?:swap|flip|rotate)\s+(?:it\s+)?(?:rows\s+(?:with|to)\s+columns)$/,
    apply: (th) => { const rows = pad2((th.rows || []).map((r) => r.slice())); if (!rows.length) return { say: 'the table is empty', fail: true }; return { patch: { rows: rows[0].map((_, c) => rows.map((r) => r[c])) }, say: 'rows and columns swapped' }; } },
  { n: 308, id: 'pivot', on: 'table', free: true, re: /^pivot(?:\s+count)?(?:\s+(?:of|on|by))?\s+(?:column\s+)?(.+)$|^count\s+(?:the\s+)?(?:values|entries|rows|each\s+value)\s+(?:in|of|by)\s+column\s+(.+)$/, args: (m) => ({ ref: m[1] || m[2] }),
    apply: (th, a) => { const c = colIdx(th, a.ref); if (c < 0) return { say: 'there is no column ' + a.ref, fail: true }; const tally = new Map(); for (const r of rowsBody(th)) { const k = String(r[c] == null ? '' : r[c]).trim() || '(empty)'; tally.set(k, (tally.get(k) || 0) + 1); } const rows = [[th.header && th.rows[0][c] ? th.rows[0][c] : 'Value', 'Count'], ...[...tally].sort((x, y) => y[1] - x[1] || collator.compare(x[0], y[0])).map(([k, v]) => [k, String(v)])]; return { spawn: { kind: 'datatable', props: { title: 'Count of column ' + (c + 1), header: true, rows } }, say: tally.size + ' different value' + (tally.size === 1 ? '' : 's') + ' counted' }; } },
  { n: 300, id: 'export-csv', on: 'table', rawRe: /^(?:export|copy|show|give\s+me|convert|turn|save)?\s*(?:the\s+|my\s+)?(?:data\s+)?table\s+(?:as|to|into|in)\s+(csv|tsv|markdown|md)(?:\s+table)?$|^(csv|tsv|markdown|md)\s+(?:export\s+)?(?:of|from)\s+(?:the\s+|my\s+)?(?:data\s+)?table$|^(markdown)\s+table\s+export$|^export\s+(?:the\s+)?(?:data\s+)?table$/, args: (m) => ({ as: lc(m[1] || m[2] || m[3] || 'csv').replace('md', 'markdown') }),
    apply: (th, a) => { const text = a.as === 'tsv' ? toTsv(th.rows) : a.as === 'markdown' ? toMarkdown(th.rows, th.header) : toCsv(th.rows); return text ? { patch: { exportAs: a.as, exportText: text }, say: 'the table as ' + a.as.toUpperCase() + ', ready to copy' } : { say: 'the table is empty', fail: true }; } },
];

// ---------- reading an ask ----------

const TARGET_RE = /(?:\s+(?:in|on|of|from|to|into|for|at|with))?\s+(?:(?:the|my|this|that|our)\s+)(list|table)s?\b/gi;

/** { target: 'list' | 'table' | null, rest } for an ask: which card it names, and the ask with that mention taken out. Pure. */
export function splitTarget(text) {
  const t = tidy(text);
  let last = null; for (const m of t.matchAll(TARGET_RE)) last = m;
  if (last) return { target: lc(last[1]), rest: (t.slice(0, last.index) + t.slice(last.index + last[0].length)).trim() };
  const tail = /\s+(list|table)s?$/i.exec(t);
  if (tail) return { target: lc(tail[1]), rest: t.slice(0, tail.index).trim() };
  return { target: null, rest: t };
}

/** { op, args, target } for an ask, or null when it is not a list or table operation. `hint` is the kind of the picked card ('list' | 'table'),
 *  `kinds` the kinds on the stage; both only settle asks that do not name their card. Pure. */
export function parseOp(text, { hint = null, kinds = null } = {}) {
  const raw = tidy(text);
  if (!raw) return null;
  const { target, rest } = splitTarget(raw);
  const hits = [];
  for (const op of OPS) {
    let m = null;
    if (op.rawRe) m = op.rawRe.exec(raw);
    else if (op.re) m = op.re.exec(rest);
    if (!m) continue;
    const named = op.rawRe ? true : !!target;
    if (op.needs && !named && !target) continue;
    if (target && op.on !== target && !op.rawRe) continue;
    hits.push({ op, args: op.args ? op.args(m) : {}, target: target || op.on, explicit: !!target || !!op.rawRe });
  }
  if (!hits.length) return null;
  const pick = hits.find((h) => h.op.on === hint) || hits.find((h) => !kinds || kinds.has(h.op.on)) || hits[0];
  return { op: pick.op, args: pick.args, target: pick.op.on };
}

/** the ask as a request for a new data table: { title, header, rows } or null. "csv to table: a,b\n1,2", "data table with columns name, age",
 *  "make a 3x4 table", "paste tsv: ...". (A bare "make a table" belongs to the 3D table in forge.) Pure. */
export function parseTableCreate(text) {
  const raw = String(text || '').trim();
  let m = /^(?:please\s+)?(?:(?:paste|turn|convert|make|build|create|put)\s+(?:this\s+|the\s+|my\s+|some\s+)?)?(csv|tsv)(?:\s+(?:data|text))?\s+(?:in)?to\s+(?:a\s+)?(?:data\s+)?table\s*[:\n]\s*([\s\S]+)$/i.exec(raw)
    || /^(?:please\s+)?(?:(?:make|build|create|paste|start)\s+(?:me\s+)?)?(?:a\s+)?(?:data\s+)?table\s+from\s+(csv|tsv)\s*[:\n]\s*([\s\S]+)$/i.exec(raw)
    || /^(?:please\s+)?paste\s+(csv|tsv)\s*[:\n]\s*([\s\S]+)$/i.exec(raw);
  if (m) {
    const rows = parseDelimited(m[2].replace(/\s*\/\/\s*/g, '\n'), lc(m[1]) === 'tsv' ? '\t' : ',');
    return rows.length ? { title: lc(m[1]).toUpperCase() + ' table', header: true, rows: pad2(rows.slice(0, 200)) } : null;
  }
  m = /^(?:please\s+)?(?:(?:make|build|create|add|start|new)\s+(?:me\s+)?)?(?:a\s+|an\s+)?(?:new\s+)?(?:data\s+table|spreadsheet|simple\s+table|table\s+of\s+data)(?:\s+(?:with|having)\s+columns?\s*[:\-]?\s*(.+))?$/i.exec(tidy(raw))
    || /^(?:please\s+)?(?:(?:make|build|create|add|start)\s+(?:me\s+)?)?(?:a\s+|an\s+)?(?:new\s+)?table\s+(?:with|having)\s+columns?\s*[:\-]?\s*(.+)$/i.exec(tidy(raw));
  if (m) {
    const cols = m[1] ? wordsOf(m[1]).slice(0, 12) : [];
    if (cols.length) return { title: 'Table', header: true, rows: [cols, new Array(cols.length).fill('')] };
    return { title: 'Table', header: true, rows: [['Column 1', 'Column 2', 'Column 3'], ['', '', ''], ['', '', '']] };
  }
  m = /^(?:please\s+)?(?:(?:make|build|create|add|start)\s+(?:me\s+)?)?(?:a\s+|an\s+)?(\d{1,2})\s*(?:x|by|×)\s*(\d{1,3})\s+(?:data\s+)?(?:table|grid|spreadsheet)$/i.exec(tidy(raw));
  if (m) {
    const r = Math.min(200, Math.max(1, Number(m[1]))), c = Math.min(12, Math.max(1, Number(m[2])));
    return { title: r + ' by ' + c + ' table', header: false, rows: Array.from({ length: r }, () => new Array(c).fill('')) };
  }
  return null;
}

/** apply an op to a card: { say, patch?, spawn?, fail? } - `th` is not changed. */
export function runOp(op, th, args = {}, ctx = {}) {
  return op.apply(th, args || {}, ctx || {});
}
