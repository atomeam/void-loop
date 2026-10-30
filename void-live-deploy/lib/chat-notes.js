// Chat-fill for Notes (owner, 2026-10-25: "make sure Verse knows how to fill out its own relevant pages for you just by chatting with it, similar to
// notion"): a plain sentence on the stage writes into the notes /notes/ keeps (lib/notes.js, KEY a2m.void.notes.v1). The pure half: parseIntent reads
// the sentence (English and German), plan works out what it would do to the stored notes and says so in words, undoOf puts it back. Nothing is sent
// anywhere and nothing is guessed silently: a weak match comes back as a "confirm" with what would be written, two notes that fit come back as an
// "ask" that lists them. Every write keeps the note's earlier state as a version first (notes.snapshot) and records the notes it touched, so undo is
// a real restore (or a removal for a note the sentence made). No model is called: the structure is rules. Tests: tools/chat-notes.test.mjs.
import { clean, toText, newDoc, snapshot, search, titleOf, uid } from './notes.js';
import { TEMPLATES, replaceIn, outlineOf, toTrash, fromTrash, backlinks, filterDocs, newTable, addColumn, addRow, sortTable, mapTable, parseTable, colIndex, parseTags } from './note-extras.js';

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const unent = (s) => String(s).replace(/&(?:amp|lt|gt|quot|#39|nbsp);/g, (m) => ({ '&amp;': '&', '&lt;': '<', '&gt;': '>', '&quot;': '"', '&#39;': "'", '&nbsp;': ' ' }[m]));
const plain = (h) => unent(String(h).replace(/<[^>]+>/g, '')).replace(/\s+/g, ' ').trim();
const cap = (s) => { s = String(s || '').trim(); return s ? s[0].toUpperCase() + s.slice(1) : s; };
const stem = (w) => (w.length > 3 && w.endsWith('s') && !w.endsWith('ss') ? w.slice(0, -1) : w);
const words = (s) => String(s || '').toLowerCase().replace(/[^\p{L}\p{N}\s'-]/gu, ' ').split(/\s+/).filter(Boolean).map(stem);
const STOP = new Set(['my', 'the', 'a', 'an', 'our', 'meine', 'meiner', 'meinem', 'meinen', 'die', 'der', 'das', 'dem', 'note', 'notes', 'notiz', 'notizen']);
const keyWords = (s) => words(s).filter((w) => !STOP.has(w));
const LISTY = /\b(?:lists?|todos?|to-do|shopping|groceries|packing|checklist|tasks?|errands|liste|einkauf\w*|aufgaben)\b/i;
const NOT_NOTE_TARGET = /\b(?:calendar|kalender|verse|void|notepad|cart|playlist|queue|favou?rites|stage|wheel|agenda|schedule|recipes?|rezepte?|generators?|folders?)\b/i;

// ---------------------------------------------------------------- reading the sentence
const lead = (t) => t.replace(/^(?:hey\s+)?(?:verse[,:]?\s+)?(?:please|bitte|can you|could you|would you|kannst du|könntest du)\s+/i, '').replace(/\s+(?:please|bitte)$/i, '');
/** { op, ... } for a sentence about notes, or null when it is not one. Syntax only: which note is meant is plan()'s business. Pure. */
export function parseIntent(raw) {
  const t = lead(String(raw || '').replace(/\s+/g, ' ').trim().replace(/[.!]+$/, '')); if (!t || t.length > 600) return null;
  let m;
  if ((m = /^undo (?:that |the last |my last )?(?:note|notes)(?: change| edit)?$/i.exec(t))) return { op: 'undo' };
  if (/^(?:what(?:'s| is) in|show|open|list)(?: me)? (?:my )?(?:trash|bin|deleted notes)$/i.test(t)) return { op: 'trash' };
  if ((m = /^(?:restore|undelete|bring back|recover)\s+(?:my |the )?(.+?)(?: note)?(?: from (?:the )?trash)?$/i.exec(t))) return { op: 'restore', target: m[1].trim() };
  if ((m = /^(?:replace|change)\s+(.+?)\s+(?:with|to)\s+(.+?)\s+in\s+(?:my |the )?(.+?)(?: note)?$/i.exec(t))) return { op: 'replace', find: m[1].trim().replace(/^["']|["']$/g, ''), to: m[2].trim().replace(/^["']|["']$/g, ''), target: m[3].trim() };
  if ((m = /^(?:outline|table of contents|toc|headings)\s+(?:of|for|in)\s+(?:my |the )?(.+?)(?: note)?$/i.exec(t))) return { op: 'outline', target: m[1].trim() };
  // Notion's core: tables, links, pins and tags
  if ((m = /^add (?:a |another )?column(?: called| named)? (.+?) to (?:my |the )?(.+?)(?: table| note)?$/i.exec(t))) return { op: 'tableCol', name: m[1].trim(), target: m[2].trim() };
  if ((m = /^add (?:a |another )?row[:,]? (.+?) to (?:my |the )?(.+?)(?: table| note)?$/i.exec(t))) return { op: 'tableRow', cells: m[1].split(/\s*[,;|]\s*/).filter(Boolean), target: m[2].trim() };
  if ((m = /^sort (?:my |the )?(.+?)(?: table| note)? by (.+?)(?: (ascending|descending|asc|desc))?$/i.exec(t))) return { op: 'tableSort', target: m[1].trim(), by: m[2].trim(), dir: /^d/i.test(m[3] || '') ? 'desc' : 'asc' };
  if ((m = /^(?:make|create|add|insert) (?:me )?(?:a |an )?(?:new )?table (?:with|of|for) (?:columns? )?(.+?)(?: (?:in|to|into) (?:my |the )?(.+?)(?: note)?)?$/i.exec(t))) return { op: 'tableMake', cols: m[1].split(/\s*(?:,|;| and )\s*/).filter(Boolean), target: (m[2] || '').trim() };
  if ((m = /^(?:make|create|add|insert) (?:me )?(?:a |an )?(?:new )?table(?: (?:in|to|into) (?:my |the )?(.+?)(?: note)?)?$/i.exec(t))) return { op: 'tableMake', cols: [], target: (m[1] || '').trim() };
  if ((m = /^link (?:my |the )?(.+?)(?: note)? to (?:my |the )?(.+?)(?: note)?$/i.exec(t))) return { op: 'link', target: m[1].trim(), to: m[2].trim() };
  if ((m = /^(?:what|which notes?)(?: notes?)? links? to (?:my |the )?(.+?)(?: note)?$/i.exec(t)) || (m = /^backlinks (?:of|for|to) (?:my |the )?(.+?)(?: note)?$/i.exec(t))) return { op: 'backlinks', target: m[1].trim() };
  if (/^(?:show|list)(?: me)?(?: all)? (?:my )?pinned notes$/i.test(t)) return { op: 'filter', f: 'pinned' };
  if ((m = /^(?:show|list)(?: me)?(?: all)? (?:my )?notes (?:tagged|with the tag|tagged with|with tag) #?([\w-]+)$/i.exec(t))) return { op: 'filter', f: '#' + m[1].toLowerCase() };
  // find
  if ((m = /^(?:what|which)(?: notes?)? (?:did|have|do) (?:i|my notes?) (?:write|wrote|written|say|said|note|noted|save|saved|keep|kept|jot|jotted)(?: down)? (?:about|on|regarding|for)\s+(.+)$/i.exec(t))
    || (m = /^(?:find|search|look up|look for|show|list)(?: me)?(?: (?:all )?(?:my )?notes?)? (?:about|on|for|with|mentioning|containing)\s+(.+?)(?: in my notes?)?$/i.exec(t))
    || (m = /^search (?:in )?my notes?(?: for| about)\s+(.+)$/i.exec(t)) || (m = /^which notes? (?:mention|have|are about|contain)\s+(.+)$/i.exec(t))
    || (m = /^was habe ich (?:über|zu|von)\s+(.+?)\s+(?:geschrieben|notiert|gespeichert)$/i.exec(t)) || (m = /^suche (?:in )?(?:meinen )?notizen (?:nach|zu|über)\s+(.+)$/i.exec(t))) return { op: 'find', q: m[1].trim() };
  // templates
  if ((m = /^(?:start|make|create|begin|open|new|neue?|erstelle(?: mir)?(?: eine?n?)?)\s+(?:me )?(?:a |an |my |eine?n? )?(?:new |neue?n? )?(meeting|trip|travel|shopping|weekly(?: plan)?|week plan|reise|einkaufs\w*|wochen\w*)\s*(note|notes|template|list|liste|plan|notiz)(?:\s+(?:for|about|called|on|zu|für)\s+(.+))?$/i.exec(t)) && !(/^(?:shopping|einkaufs\w*)$/i.test(m[1]) && /^(?:list|liste)$/i.test(m[2]))) return { op: 'template', kind: m[1].toLowerCase(), about: (m[3] || '').trim() };
  // create
  // "take a note: buy milk", "new note buy milk", "take a note of my locker code"; not "take a note of this url" (a pointer at a page, sticky's)
  if ((m = /^(?:make|create|start|write|draft|add|save|take|new|neue?|erstelle|mach(?:e)?|schreibe?)(?: me| mir)?(?: an?| eine?)?(?: new| neue?)? (?:note|notiz)\b(?:\s+(?:about|on|of|for|über|zu|mit dem titel))?\s*[:,\-–]?\s*(.+)$/i.exec(t)) && !/^(?:called|titled|named|that says|saying|which says)\s/i.test(m[1]) && !/^(?:this|that|it|these|those)(?:\s+(?:url|page|link|site|tab))?$/i.test(m[1])
    || (m = /^(?:note to self|notiz an mich)\s*[:,\-–]\s*(.+)$/i.exec(t)) || (m = /^note to self\s+(.+)$/i.exec(t))
    || (m = /^(?:write down|jot down|jot|note down|schreib auf|notiere(?: mir)?)\s*[:,]?\s*(.+)$/i.exec(t))) return { op: 'create', rest: m[1].trim() };
  if ((m = /^(?:remember to|don'?t forget to|merk dir[:,]? (?:zu )?)\s*(.+)$/i.exec(t))) return { op: 'create', rest: 'To do: ' + m[1].trim() };
  // append: under a heading, to a note
  if ((m = /^(?:under|in) (?:the )?(.+?)(?: section| heading)? (?:in|of|on) (?:my |the )?(.+?)(?: note)?,? (?:add|put|write|insert)\s+(.+)$/i.exec(t))) return { op: 'under', heading: m[1].trim(), target: m[2].trim(), text: m[3].trim() };
  if ((m = /^(?:add|put|append|include)\s+to (?:my |the |our )?(.+?)\s*[:,]\s*(.+)$/i.exec(t))) return { op: 'append', target: m[1].trim(), text: m[2].trim() };
  if ((m = /^füge (.+?) (?:zu|zur|zum|in|auf) (?:meiner |meinem |meine |der |dem |die |das )?(.+?) hinzu$/i.exec(t)) || (m = /^setze (.+?) auf (?:meine |die |der )(.+)$/i.exec(t))) return { op: 'append', target: m[2].trim(), text: m[1].trim() };
  if ((m = /^(?:add|put|append|include)\s+(.+?)\s+(?:to|on|in|into|onto)\s+(?:my |the |our )?(.+)$/i.exec(t)) && !NOT_NOTE_TARGET.test(m[2])) return { op: 'append', target: m[2].trim(), text: m[1].trim(), soft: true };
  // tick / untick / remove an item
  if ((m = /^(?:untick|un-tick|uncheck|unmark)\s+(.+)$/i.exec(t))) { const f = fromSplit(m[1]); return { op: 'untick', item: f.item, target: f.target }; }
  if ((m = /^(?:tick(?: off)?|check off|cross off|cross out|mark (?:off )?|strike)\s+(.+?)(?:\s+(?:as )?(?:done|bought|finished|complete|completed))?$/i.exec(t)) || (m = /^hake (.+?) ab$/i.exec(t))) { const f = fromSplit(m[1]); return { op: 'tick', item: f.item, target: f.target }; }
  if ((m = /^(?:remove|delete|take off|take out|drop|scratch|streiche|entferne|lösche)\s+(.+?)\s+(?:from|off|on|von|aus)\s+(?:my |the |our |meiner |meinem |der |dem )?(.+)$/i.exec(t))) return { op: 'removeItem', item: m[1].trim(), target: m[2].trim() };
  // whole-note verbs
  if ((m = /^(?:delete|remove|trash|lösche)\s+(?:my |the |meine |die )?(.+?)\s+(?:note|notiz)$/i.exec(t))) return { op: 'delete', target: m[1].trim() };
  if ((m = /^(?:clean up|tidy(?: up)?|neaten|sort|organi[sz]e|dedupe)\s+(?:my |the |our )?(.+)$/i.exec(t)) || (m = /^(?:räum|räume)\s+(.+?)\s+auf$/i.exec(t))) return { op: 'tidy', target: m[1].trim() };
  if ((m = /^(?:summari[sz]e|sum up|give me (?:a )?(?:summary|tl;?dr) of)\s+(?:my |the |our )?(.+)$/i.exec(t)) || (m = /^fasse\s+(?:meine |die )?(.+?)\s+zusammen$/i.exec(t))) return { op: 'summary', target: m[1].trim() };
  if ((m = /^rename\s+(?:my |the )?(.+?)\s+(?:to|as)\s+(.+)$/i.exec(t)) || (m = /^benenne\s+(?:meine |die )?(.+?)\s+in\s+(.+?)\s+um$/i.exec(t))) return { op: 'rename', target: m[1].trim(), to: m[2].trim() };
  if ((m = /^(pin|unpin|anheften|pinne)\s+(?:my |the |meine |die )?(.+?)$/i.exec(t))) return { op: /^un/i.test(m[1]) ? 'unpin' : 'pin', target: m[2].trim() };
  if ((m = /^tag\s+(?:my |the )?(.+?)\s+(?:note\s+)?(?:as|with)\s+#?(.+)$/i.exec(t))) return { op: 'tag', target: m[1].trim(), tag: m[2].trim() };
  if ((m = /^(?:add )?(?:the )?tag\s+#?([\w-]+)\s+to\s+(?:my |the )?(.+)$/i.exec(t))) return { op: 'tag', target: m[2].trim(), tag: m[1].trim() };
  if ((m = /^merge\s+(?:my |the )?(.+?)\s+(and|with|into)\s+(?:my |the )?(.+?)$/i.exec(t))) return { op: 'merge', a: m[1].trim(), b: m[3].trim(), into: m[2].toLowerCase() === 'into' ? 'b' : 'a' };
  if ((m = /^split\s+(?:my |the )?(.+?)(?:\s+(?:by|at|into|on)\s+(?:its )?(?:headings?|sections?))?$/i.exec(t))) return { op: 'split', target: m[1].trim() };
  if ((m = /^(?:open|show|zeig(?:e)?)\s+(?:me )?(?:my |the |meine |die )?(.+?)\s+(?:note|notiz)$/i.exec(t))) return { op: 'open', target: m[1].trim() };
  return null;
}
function fromSplit(s) { const m = /^(.+?)\s+(?:from|on|in|off|von|auf|in)\s+(?:my |the |our |meiner |der )?(.+)$/i.exec(String(s || '').trim()); return m ? { item: m[1].trim(), target: m[2].trim() } : { item: String(s || '').trim(), target: '' }; }
/** a sentence that is close to a notes ask but did not parse: the one-line hint. Pure. */
export function looksLikeNotes(raw) { const t = String(raw || '').trim(); if (/\bnote\b.{0,12}\b(?:that says|saying|called|titled)\b/i.test(t)) return false; return /^(?:add|make|create|write|put|append|save|jot|tick|untick|remove|merge|split|tidy|rename|pin|tag|summari[sz]e)\b/i.test(t) && /\b(?:my notes?|a note|the note|my \w+ note|notiz\w*)\b/i.test(t) && !parseIntent(t); }
export const HINT = 'I can fill your notes from a sentence: "add a note: buy milk", "make a note about my trip to Lisbon: flights Friday, hotel Alfama, packing list", "add eggs to my shopping list", "tick milk", "clean up my shopping list", "summarise my meeting note", "what did I write about Lisbon", "rename my X note to Y", "pin / tag / merge / split my X note", "start a meeting note". Every change has Undo.';

// ---------------------------------------------------------------- the notes' html
const LI = /<li( class="chk(?: done)?")?>([\s\S]*?)<\/li>/g;
/** the list items of a body: [{ text, done, chk, index }] in order. Pure. */
export function itemsOf(html) { const out = []; let m; const re = new RegExp(LI.source, 'g'); while ((m = re.exec(html || ''))) out.push({ text: plain(m[2]), done: /done/.test(m[1] || ''), chk: !!m[1], index: out.length, from: m.index, to: m.index + m[0].length, inner: m[2] }); return out; }
const liHtml = (text, done) => '<li class="chk' + (done ? ' done' : '') + '">' + esc(text) + '</li>';
/** the items of a sentence ("milk, eggs and bread"), each starting with a capital. Pure. */
export function splitItems(s, andToo = true) { return String(s || '').split(new RegExp('\\s*(?:[,;\\n]' + (andToo ? '|\\s+and\\s+|\\s+und\\s+' : '') + ')\\s*', 'i')).map((x) => x.trim().replace(/^(?:some|a few)\s+/i, '')).filter(Boolean).map(cap); }
const isListy = (doc) => LISTY.test(doc.title || '') || /<ul class="todo">/.test(doc.html || '');
const todoOf = (items) => '<ul class="todo">' + items.map((x) => liHtml(x, false)).join('') + '</ul>';

/** the title and body of a new note from one sentence: "my trip to Lisbon: flights Friday, hotel Alfama, packing list" is headed sections (a checklist under the list), a list title is a checklist. Pure. */
export function noteFrom(rest) {
  let s = String(rest || '').trim().replace(/^(?:about|on|called|titled|named|for)\s+/i, ''), title = '', body = '';
  const m = /^(.{1,80}?)\s*[:\-–—]\s+(.+)$/s.exec(s) || /^([^:\n]{1,80}):\s*(.+)$/s.exec(s);
  if (m) { title = m[1].trim(); body = m[2].trim(); } else if (s.length <= 60) title = s; else { const cut = s.slice(0, 50).replace(/\s+\S*$/, ''); title = cut; body = s; }
  title = cap(title);
  if (!body) return { title, html: '' };
  const parts = body.split(/\s*[,;\n]\s*/).map((x) => x.trim()).filter(Boolean);
  if (LISTY.test(title)) return { title, html: todoOf(parts.map(cap)) };
  if (parts.length < 2) return { title, html: '<p>' + esc(cap(body)) + '</p>' };
  let html = '';
  for (const p of parts) {
    if (/\b(?:list|checklist|todo|to-do|liste)\b/i.test(p)) { html += '<h2>' + esc(cap(p)) + '</h2><ul class="todo"><li class="chk"></li></ul>'; continue; }
    const w = /^(\S+)\s+(.+)$/.exec(p); html += w ? '<h2>' + esc(cap(w[1])) + '</h2><p>' + esc(cap(w[2])) + '</p>' : '<h2>' + esc(cap(p)) + '</h2><p><br></p>';
  }
  return { title, html };
}

export { TEMPLATES };
const templateKey = (k) => (/meet/.test(k) ? 'meeting' : /trip|travel|reise/.test(k) ? 'trip' : /shop|einkauf/.test(k) ? 'shopping' : 'weekly');

// ---------------------------------------------------------------- which note is meant
/** the notes a few words name: { level: 'exact'|'title'|'weak'|'none', docs }. Pure. */
export function resolve(store, phrase) {
  const kw = keyWords(phrase), docs = store.docs || []; if (!kw.length) return { level: 'none', docs: [] };
  const norm = (d) => keyWords(d.title).join(' ');
  const exact = docs.filter((d) => norm(d) === kw.join(' ')); if (exact.length) return { level: 'exact', docs: exact };
  const title = docs.filter((d) => { const tw = new Set(keyWords(d.title)); return kw.every((w) => tw.has(w)); }); if (title.length) return { level: 'title', docs: title };
  const tagged = docs.filter((d) => (d.tags || []).some((g) => kw.includes(stem(g.toLowerCase())))); if (tagged.length) return { level: 'title', docs: tagged };
  const part = docs.filter((d) => { const tw = new Set(keyWords(d.title)); return kw.some((w) => tw.has(w)); });
  const body = docs.filter((d) => { const b = new Set(words(toText(d.html))); return kw.every((w) => b.has(w)); });
  const weak = [...new Set([...part, ...body])]; return weak.length ? { level: 'weak', docs: weak } : { level: 'none', docs: [] };
}
const byId = (store, id) => (store.docs || []).find((d) => d.id === id);
const pick = (store, phrase, id) => (id ? { level: byId(store, id) ? 'exact' : 'none', docs: byId(store, id) ? [byId(store, id)] : [] } : resolve(store, phrase));
const opts = (docs, mk) => docs.slice(0, 6).map((d) => ({ label: titleOf(d), intent: mk(d.id) }));

// ---------------------------------------------------------------- doing it
function touch(store, id, fn, now) {
  const before = byId(store, id), kept = snapshot(before, now, true), next = fn(kept);
  const nd = { ...kept, ...next, html: clean(next.html != null ? next.html : kept.html), updated: now };
  return { store: { ...store, docs: [nd, ...store.docs.filter((d) => d.id !== id)], cur: id }, change: { id, before } };
}
const made = (store, doc) => ({ store: { ...store, docs: [doc, ...store.docs], cur: doc.id }, change: { id: doc.id, before: null } });
const done = (stores, said, openId, extra = {}) => ({ kind: 'write', said, openId, store: stores.store, changes: stores.changes, ...extra });
const chain = (store, steps) => { let s = store; const changes = []; for (const f of steps) { const r = f(s); s = r.store; changes.push(r.change); } return { store: s, changes }; };

/** add items under the last checklist of a note, or as a paragraph. Pure. */
function addTo(doc, text) {
  const listy = isListy(doc), html = doc.html || '';
  if (listy) {
    const items = splitItems(text), have = new Set(itemsOf(html).map((i) => i.text.toLowerCase())), fresh = items.filter((x) => !have.has(x.toLowerCase()));
    if (!fresh.length) return { html, added: [], dup: items };
    const add = fresh.map((x) => liHtml(x, false)).join(''), at = html.lastIndexOf('</ul>');
    const hasTodo = /<ul class="todo">/.test(html), lastTodo = html.lastIndexOf('<ul class="todo">');
    if (hasTodo && at > lastTodo) { const cleaned = html.replace(/<li class="chk"><\/li>(?=<\/ul>)/, ''); const at2 = cleaned.lastIndexOf('</ul>'); return { html: cleaned.slice(0, at2) + add + cleaned.slice(at2), added: fresh }; }
    return { html: html + todoOf(fresh), added: fresh };
  }
  return { html: html + '<p>' + esc(cap(text)) + '</p>', added: [cap(text)] };
}
function underHeading(doc, heading, text) {
  const html = doc.html || '', hw = keyWords(heading), re = /<(h[1-3])>([\s\S]*?)<\/\1>/g; let m, hit = null;
  while ((m = re.exec(html))) { const tw = new Set(keyWords(plain(m[2]))); if (hw.length && hw.every((w) => tw.has(w))) { hit = m; break; } }
  if (!hit) return { html: html + '<h2>' + esc(cap(heading)) + '</h2><p>' + esc(cap(text)) + '</p>', created: true };
  const start = hit.index + hit[0].length, rest = html.slice(start), nx = rest.search(/<h[1-3]>/), end = nx < 0 ? html.length : start + nx, sect = html.slice(start, end);
  const lastUl = sect.lastIndexOf('</ul>');
  if (/<ul class="todo">/.test(sect) && lastUl >= 0) return { html: html.slice(0, start + lastUl) + splitItems(text).map((x) => liHtml(x, false)).join('') + html.slice(start + lastUl) };
  return { html: html.slice(0, end) + '<p>' + esc(cap(text)) + '</p>' + html.slice(end) };
}
function setItems(html, pick, fn) { const its = itemsOf(html); let out = '', last = 0; for (const it of its) { if (!pick(it)) continue; out += html.slice(last, it.from) + fn(it); last = it.to; } return out + html.slice(last); }
/** the notes and items an item phrase names across the notes (or one note). Pure. */
export function findItems(store, phrase, docs, want) {
  const kw = keyWords(phrase), out = [];
  for (const d of docs || store.docs) for (const it of itemsOf(d.html)) { if (want && !want(it)) continue; const tw = new Set(words(it.text)); if (kw.length && kw.every((w) => tw.has(w))) out.push({ doc: d, item: it }); }
  return out;
}
/** a note tidied: empty items and paragraphs gone, duplicate items gone, checklist items with the done ones last, capital letters. Pure. */
export function tidyHtml(html) {
  let h = String(html || '').replace(/<li( class="chk(?: done)?")?>\s*(?:<br>)?\s*<\/li>/g, '').replace(/<p>\s*(?:<br>)?\s*<\/p>/g, '').replace(/<(ul|ol)( class="todo")?><\/\1>/g, '');
  h = h.replace(/<ul( class="todo")?>((?:(?!<ul|<ol)[\s\S])*?)<\/ul>/g, (all, todo, inner) => {
    const its = itemsOf(inner), seen = new Set(), keep = []; for (const it of its) { const k = it.text.toLowerCase(); if (!k || seen.has(k)) continue; seen.add(k); keep.push(it); }
    if (todo) keep.sort((a, b) => (a.done === b.done ? 0 : a.done ? 1 : -1));
    return '<ul' + (todo || '') + '>' + keep.map((it) => (it.chk ? liHtml(cap(it.text), it.done) : '<li>' + esc(cap(it.text)) + '</li>')).join('') + '</ul>';
  });
  return h.replace(/\s+/g, ' ').replace(/> </g, '><').trim();
}
/** a few plain lines about a note: its headings, how much of the checklist is done, and its first sentences. Rule-based. Pure. */
export function summaryOf(doc) {
  const html = doc.html || '', heads = [...html.matchAll(/<h[1-3]>([\s\S]*?)<\/h[1-3]>/g)].map((m) => plain(m[1])).filter(Boolean), its = itemsOf(html).filter((i) => i.chk);
  const body = toText(html.replace(/<h[1-3]>[\s\S]*?<\/h[1-3]>/g, '').replace(/<ul class="todo">[\s\S]*?<\/ul>/g, '')), sents = (body.match(/[^.!?\n]+[.!?]?/g) || []).map((x) => x.trim()).filter((x) => x.length > 12).slice(0, 3);
  const lines = []; if (heads.length) lines.push('Sections: ' + heads.join(', ') + '.');
  if (its.length) { const d = its.filter((i) => i.done).length; lines.push(d + ' of ' + its.length + ' checklist items done' + (d < its.length ? '; still open: ' + its.filter((i) => !i.done).slice(0, 5).map((i) => i.text).join(', ') + '.' : '.')); }
  if (sents.length) lines.push(sents.join(' '));
  return lines.length ? lines : ['Nothing written in it yet.'];
}
const sectionsOf = (html) => { const parts = String(html || '').split(/(?=<h[1-3]>)/).filter((x) => x.trim()); return parts.filter((p) => /^<h[1-3]>/.test(p)).map((p) => { const m = /^<h[1-3]>([\s\S]*?)<\/h[1-3]>/.exec(p); return { title: plain(m[1]), html: p.slice(m[0].length) }; }); };

/**
 * what a sentence's intent does to the stored notes ({ docs, cur }), at time `now`:
 *  { kind: 'write', said, openId, store, changes }   done: store is the new state, changes lists what to put back
 *  { kind: 'confirm', preview, intent }              a weak match: say what would be written, write on a second tap (intent.sure)
 *  { kind: 'ask', question, options }                two or more fit: each option carries the intent to run
 *  { kind: 'show', title, lines, hits, openId }      nothing written (a find, a summary, an open)
 *  { kind: 'none' }                                  not about a note that exists: leave the sentence to someone else. Pure.
 */
export function plan(store, it, now = Date.now()) {
  if (!it) return { kind: 'none' };
  const S = { docs: store.docs || [], ...(store.trash ? { trash: store.trash } : {}), cur: store.cur || null };
  const needs = (res, phrase, mk, what, sure) => {
    if (res.level === 'none') return { kind: 'none' };
    if (res.level === 'exact' || res.level === 'title') { if (res.docs.length === 1) return null; return { kind: 'ask', question: 'Which note do you mean by "' + phrase + '"?', options: opts(res.docs, mk) }; }
    if (res.docs.length === 1 && !sure) return { kind: 'confirm', preview: what(res.docs[0]), intent: mk(res.docs[0].id, true) };
    return { kind: 'ask', question: 'I found these notes close to "' + phrase + '". Which one?', options: opts(res.docs, mk) };
  };
  switch (it.op) {
    case 'find': {
      const hits = search(S.docs, it.q, 6); const tagged = S.docs.filter((d) => (d.tags || []).some((g) => g.toLowerCase() === it.q.toLowerCase()) && !hits.some((h) => h.id === d.id)).map((d) => ({ id: d.id, title: titleOf(d), snippet: toText(d.html).slice(0, 100) }));
      return { kind: 'show', title: 'Notes about ' + it.q, hits: [...hits, ...tagged], lines: hits.length + tagged.length ? [] : ['No note mentions "' + it.q + '".'], openId: (hits[0] || tagged[0] || {}).id };
    }
    case 'create': {
      const n = noteFrom(it.rest); if (!n.title) return { kind: 'none' };
      const dup = S.docs.find((d) => d.title.toLowerCase() === n.title.toLowerCase());
      if (dup && !it.sure && LISTY.test(n.title) && n.html) { const items = itemsOf(n.html).map((i) => i.text); return plan(store, { op: 'append', target: dup.title, text: items.join(', '), docId: dup.id }, now); }
      const d = newDoc(now, { title: n.title, html: n.html }); const r = made(S, d);
      return done({ store: r.store, changes: [r.change] }, 'Made the note "' + n.title + '"' + (n.html ? (/<h2>/.test(n.html) ? ' with ' + sectionsOf(n.html).length + ' sections' : ' with ' + (itemsOf(n.html).length || 1) + (itemsOf(n.html).length ? ' items' : ' line')) : ''), d.id, { preview: toText(n.html) });
    }
    case 'template': {
      const k = templateKey(it.kind), T = TEMPLATES[k], title = it.about ? cap(it.about) + (k === 'shopping' ? '' : ' ' + T.title.toLowerCase()) : T.title + ' ' + new Date(now).toISOString().slice(0, 10);
      const d = newDoc(now, { title: k === 'shopping' && it.about ? cap(it.about) + ' shopping list' : title, html: T.html }); const r = made(S, d);
      return done({ store: r.store, changes: [r.change] }, 'Started "' + d.title + '" from the ' + k + ' template', d.id);
    }
    case 'append': case 'under': {
      let res = pick(S, it.target, it.docId); const mk = (id, sure) => ({ ...it, docId: id, sure: sure || it.sure });
      if (res.level === 'none') {
        if (it.op === 'under' || NOT_NOTE_TARGET.test(it.target) || /^(?:list|todo|to-do|the list|my list)$/i.test(it.target.trim()) || !(LISTY.test(it.target) || /\bnote$/i.test(it.target))) return { kind: 'none' };
        const title = cap(it.target.replace(/\s+note$/i, '')), d0 = newDoc(now, { title, html: LISTY.test(title) ? todoOf(splitItems(it.text)) : '<p>' + esc(cap(it.text)) + '</p>' }); const r0 = made(S, d0);
        return done({ store: r0.store, changes: [r0.change] }, 'No note called "' + title + '" yet, so I made it with ' + it.text, d0.id);
      }
      const q = needs(res, it.target, mk, (d) => 'Add "' + it.text + '" to "' + titleOf(d) + '"', it.sure || !!it.docId); if (q) return q;
      const d = res.docs[0];
      if (it.op === 'under') { let u; const r = touch(S, d.id, (x) => { u = underHeading(x, it.heading, it.text); return { html: u.html }; }, now); return done({ store: r.store, changes: [r.change] }, 'Added "' + it.text + '" under ' + (u.created ? 'a new heading "' + cap(it.heading) + '"' : '"' + cap(it.heading) + '"') + ' in ' + titleOf(d), d.id); }
      let a; const r = touch(S, d.id, (x) => { a = addTo(x, it.text); return { html: a.html }; }, now);
      if (!a.added.length) return { kind: 'show', title: titleOf(d), lines: ['Already there: ' + a.dup.join(', ') + '. Nothing changed.'], openId: d.id };
      return done({ store: r.store, changes: [r.change] }, 'Added ' + a.added.join(', ') + ' to ' + titleOf(d), d.id);
    }
    case 'tick': case 'untick': case 'removeItem': {
      const tickOp = it.op === 'tick', want = it.op === 'removeItem' ? null : (i) => i.chk && (tickOp ? !i.done : i.done);
      let docs = S.docs;
      if (it.docId) docs = docs.filter((d) => d.id === it.docId);
      else if (it.target) { const res = resolve(S, it.target); if (res.level === 'none') return { kind: 'none' }; docs = res.docs; }
      let hits = findItems(S, it.item, docs, want); if (it.itemIndex != null) hits = hits.filter((h) => h.doc.id === it.itemDoc && h.item.index === it.itemIndex);
      if (!hits.length) return { kind: 'none' };
      if (hits.length > 1) return { kind: 'ask', question: 'Which "' + it.item + '"?', options: hits.slice(0, 6).map((h) => ({ label: h.item.text + ' (' + titleOf(h.doc) + ')', intent: { ...it, docId: h.doc.id, itemDoc: h.doc.id, itemIndex: h.item.index } })) };
      const { doc, item } = hits[0], r = touch(S, doc.id, (x) => ({ html: setItems(x.html, (i) => i.index === item.index, (i) => (it.op === 'removeItem' ? '' : liHtml(i.text, tickOp))) }), now);
      return done({ store: r.store, changes: [r.change] }, (it.op === 'removeItem' ? 'Removed "' : tickOp ? 'Ticked "' : 'Unticked "') + item.text + '" ' + (it.op === 'removeItem' ? 'from ' : 'in ') + titleOf(doc), doc.id);
    }
    case 'trash': return { kind: 'show', title: 'Trash', hits: (S.trash || []).map((x) => ({ id: x.doc.id, title: titleOf(x.doc), snippet: 'deleted ' + new Date(x.at).toISOString().slice(0, 10) + ': say "restore ' + titleOf(x.doc) + '"' })), lines: (S.trash || []).length ? [] : ['The trash is empty. Deleted notes stay here for 30 days.'] };
    case 'restore': {
      const tdocs = (S.trash || []).map((x) => x.doc), res = resolve({ docs: tdocs }, it.target); if (res.level === 'none' || !tdocs.length) return { kind: 'none' };
      const q = needs(res, it.target, (id, sure) => ({ ...it, docId: id, sure: sure || it.sure }), (d) => 'Restore "' + titleOf(d) + '" from the trash', it.sure || !!it.docId); if (q) return q;
      const d = it.docId ? tdocs.find((x) => x.id === it.docId) : res.docs[0]; if (!d) return { kind: 'none' }; const entry = (S.trash || []).find((x) => x.doc.id === d.id);
      return done({ store: fromTrash(S, d.id, now), changes: [{ id: d.id, before: null, fromTrash: entry }] }, 'Restored "' + titleOf(d) + '" from the trash', d.id);
    }
    case 'filter': { const hits = filterDocs(S.docs, it.f).map((d) => ({ id: d.id, title: titleOf(d), snippet: toText(d.html).slice(0, 100) })); return { kind: 'show', title: it.f === 'pinned' ? 'Pinned notes' : 'Notes tagged ' + it.f, hits, lines: hits.length ? [] : ['None yet.'], openId: (hits[0] || {}).id }; }
    case 'tableMake': {
      const html = newTable(it.cols); if (!it.target) { const d0 = newDoc(now, { title: it.cols.length ? cap(it.cols[0]) + ' table' : 'Table', html }); const r0 = made(S, d0); return done({ store: r0.store, changes: [r0.change] }, 'Made a table with ' + (it.cols.length ? it.cols.join(', ') : 'Name, Status, Notes'), d0.id); }
      const res = pick(S, it.target, it.docId); if (res.level === 'none') return { kind: 'none' }; const q = needs(res, it.target, (id, sure) => ({ ...it, docId: id, sure: sure || it.sure }), (d) => 'Add a table to "' + titleOf(d) + '"', it.sure || !!it.docId); if (q) return q;
      const r = touch(S, res.docs[0].id, (x) => ({ html: (x.html || '') + html }), now); return done({ store: r.store, changes: [r.change] }, 'Added a table (' + (it.cols.join(', ') || 'Name, Status, Notes') + ') to ' + titleOf(res.docs[0]), res.docs[0].id);
    }
    case 'backlinks': { const res = resolve(S, it.target); if (res.level === 'none') return { kind: 'none' }; const d = res.docs[0], bl = backlinks(S.docs, d); return { kind: 'show', title: 'Linked to ' + titleOf(d), hits: bl.map((b) => ({ id: b.id, title: b.title, snippet: 'links to [[' + titleOf(d) + ']]' })), lines: bl.length ? [] : ['No note links to it yet. Write [[' + titleOf(d) + ']] in another note.'], openId: d.id }; }
    default: break;
  }
  // verbs on one whole note
  const target = it.op === 'merge' ? it.a : it.target; if (target == null) return { kind: 'none' };
  const mk = (id, sure) => ({ ...it, docId: id, sure: sure || it.sure }); const res = pick(S, target, it.docId);
  const q = needs(res, target, mk, (d) => ({ delete: 'Delete "' + titleOf(d) + '"', tidy: 'Tidy "' + titleOf(d) + '"', rename: 'Rename "' + titleOf(d) + '" to "' + it.to + '"', merge: 'Merge "' + titleOf(d) + '" with "' + it.b + '"' }[it.op] || it.op + ' "' + titleOf(d) + '"'), it.sure || !!it.docId);
  if (q) return q;
  const d = res.docs[0];
  switch (it.op) {
    case 'tableCol': case 'tableRow': case 'tableSort': {
      let note = '', found = false;
      const fn = (t) => { found = true; if (it.op === 'tableCol') { if (colIndex(t, it.name) >= 0) { note = 'It already has a column "' + it.name + '".'; return t; } return addColumn(t, cap(it.name)); }
        if (it.op === 'tableRow') return addRow(t, it.cells); if (colIndex(t, it.by) < 0) { note = 'No column "' + it.by + '". Columns: ' + parseTable(t).head.map((h) => h.replace(/<[^>]+>/g, '')).join(', ') + '.'; return t; } return sortTable(t, it.by, it.dir); };
      const probe = mapTable(d.html, fn); if (!probe.found) return { kind: 'show', title: titleOf(d), lines: ['There is no table in this note. Say "make a table with Name, Status in my ' + titleOf(d) + ' note".'], openId: d.id };
      if (note) return { kind: 'show', title: titleOf(d), lines: [note], openId: d.id };
      const r = touch(S, d.id, (x) => ({ html: mapTable(x.html, fn).html }), now); const said = it.op === 'tableCol' ? 'Added the column ' + cap(it.name) : it.op === 'tableRow' ? 'Added a row (' + it.cells.join(', ') + ')' : 'Sorted the table by ' + it.by + (it.dir === 'desc' ? ', largest first' : '');
      return done({ store: r.store, changes: [r.change] }, said + ' in ' + titleOf(d), d.id);
    }
    case 'link': { const rb = resolve(S, it.to); if (rb.level === 'none') return { kind: 'none' }; const b = rb.docs[0]; if (b.id === d.id) return { kind: 'none' }; if (toText(d.html).includes('[[' + titleOf(b) + ']]')) return { kind: 'show', title: titleOf(d), lines: ['It already links to ' + titleOf(b) + '.'], openId: d.id }; const r = touch(S, d.id, (x) => ({ html: (x.html || '') + '<p>See [[' + esc(titleOf(b)) + ']]</p>' }), now); return done({ store: r.store, changes: [r.change] }, 'Linked ' + titleOf(d) + ' to [[' + titleOf(b) + ']]; it shows under Linked from in ' + titleOf(b), d.id); }
    case 'replace': { let n = 0; const r = touch(S, d.id, (x) => { const o = replaceIn(x.html, it.find, it.to); n = o.count; return { html: o.html, title: replaceIn(x.title || '', it.find, it.to).html.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"') }; }, now);
      if (!n) return { kind: 'show', title: titleOf(d), lines: ['"' + it.find + '" is not in ' + titleOf(d) + '. Nothing changed.'], openId: d.id }; return done({ store: r.store, changes: [r.change] }, 'Replaced "' + it.find + '" with "' + it.to + '" ' + n + (n === 1 ? ' time' : ' times') + ' in ' + titleOf(d), d.id); }
    case 'outline': { const o = outlineOf(d.html); return { kind: 'show', title: 'Outline of ' + titleOf(d), lines: o.length ? o.map((h) => '  '.repeat(h.level - Math.min(...o.map((x) => x.level))) + h.text) : ['No headings in it yet. Type /heading in the note, or say "under X in my ' + titleOf(d) + ' note add ...".'], openId: d.id }; }
    case 'open': return { kind: 'show', title: titleOf(d), lines: toText(d.html).split('\n').slice(0, 12), openId: d.id };
    case 'summary': return { kind: 'show', title: 'Summary of ' + titleOf(d), lines: summaryOf(d), openId: d.id, offer: { label: 'Add this summary to the note', intent: { op: 'addSummary', docId: d.id } } };
    case 'addSummary': { const r = touch(S, d.id, (x) => ({ html: (x.html || '') + '<h2>Summary</h2>' + summaryOf(x).map((l) => '<p>' + esc(l) + '</p>').join('') }), now); return done({ store: r.store, changes: [r.change] }, 'Added a summary to ' + titleOf(d), d.id); }
    case 'tidy': { const nh = tidyHtml(d.html), was = String(d.html || '').replace(/\s+/g, ' ').replace(/> </g, '><').trim(); if (nh === was) return { kind: 'show', title: titleOf(d), lines: ['Already tidy. Nothing changed.'], openId: d.id }; const r = touch(S, d.id, () => ({ html: nh }), now); return done({ store: r.store, changes: [r.change] }, 'Tidied ' + titleOf(d) + ': empty and repeated items gone, done items last', d.id); }
    case 'rename': { if (!it.to) return { kind: 'none' }; const r = touch(S, d.id, () => ({ title: cap(it.to).slice(0, 200) }), now); return done({ store: r.store, changes: [r.change] }, 'Renamed "' + titleOf(d) + '" to "' + cap(it.to) + '"', d.id); }
    case 'pin': case 'unpin': { const r = touch(S, d.id, () => ({ pinned: it.op === 'pin' }), now); return done({ store: r.store, changes: [r.change] }, (it.op === 'pin' ? 'Pinned ' : 'Unpinned ') + titleOf(d), d.id); }
    case 'tag': { const g = it.tag.toLowerCase().replace(/^#/, '').slice(0, 30); const r = touch(S, d.id, (x) => ({ tags: [...new Set([...(x.tags || []), g])] }), now); return done({ store: r.store, changes: [r.change] }, 'Tagged ' + titleOf(d) + ' #' + g, d.id); }
    case 'delete': { const r = { store: toTrash(S, d, now), change: { id: d.id, before: d, trashed: true } }; return done({ store: r.store, changes: [r.change] }, 'Moved "' + titleOf(d) + '" to the trash (Undo or "restore ' + titleOf(d) + '" brings it back; it stays 30 days)', null); }
    case 'merge': {
      const rb = pick(S, it.b, it.docIdB); const qb = needs(rb, it.b, (id, sure) => ({ ...it, docIdB: id, sure: sure || it.sure }), (x) => 'Merge "' + titleOf(d) + '" with "' + titleOf(x) + '"', it.sure || !!it.docIdB); if (qb) return qb;
      let a = d, b = rb.docs[0]; if (a.id === b.id) return { kind: 'show', title: titleOf(a), lines: ['That is one note; nothing to merge.'], openId: a.id }; if (it.into === 'b') [a, b] = [b, a];
      const r1 = touch(S, a.id, (x) => ({ html: (x.html || '') + '<h2>' + esc(titleOf(b)) + '</h2>' + (b.html || ''), tags: [...new Set([...(x.tags || []), ...(b.tags || [])])] }), now);
      const r2 = { store: { ...r1.store, docs: r1.store.docs.filter((x) => x.id !== b.id) }, change: { id: b.id, before: b } };
      return done({ store: r2.store, changes: [r1.change, r2.change] }, 'Merged "' + titleOf(b) + '" into "' + titleOf(a) + '" (its text sits under its own heading)', a.id);
    }
    case 'split': {
      const secs = sectionsOf(d.html); if (secs.length < 2) return { kind: 'show', title: titleOf(d), lines: ['Split needs headings: this note has ' + (secs.length || 'none') + '. Nothing changed.'], openId: d.id };
      let s = S; const changes = []; secs.forEach((x, i) => { const r = made(s, newDoc(now + i, { title: x.title || 'Part ' + (i + 1), html: x.html })); s = r.store; changes.push(r.change); });
      return done({ store: s, changes }, 'Split "' + titleOf(d) + '" into ' + secs.length + ' notes (the original stays)', s.cur);
    }
    default: return { kind: 'none' };
  }
}

/** the notes put back as they were before the changes: a made note is removed, an edited one gets its earlier content (what it held is kept as a version), a deleted one returns. Pure. */
export function undoOf(store, changes, now = Date.now()) {
  let docs = [...(store.docs || [])], trash = [...(store.trash || [])];
  for (const c of [...changes].reverse()) {
    const cur = docs.find((d) => d.id === c.id);
    if (c.trashed) trash = trash.filter((x) => x.doc.id !== c.id);
    if (c.fromTrash) { docs = docs.filter((d) => d.id !== c.id); trash = [c.fromTrash, ...trash.filter((x) => x.doc.id !== c.id)]; continue; }
    if (!c.before) docs = docs.filter((d) => d.id !== c.id);
    else if (cur) { const kept = snapshot(cur, now, true); docs = [{ ...c.before, versions: kept.versions, updated: now }, ...docs.filter((d) => d.id !== c.id)]; }
    else docs = [c.before, ...docs];
  }
  return { ...store, docs, ...(trash.length ? { trash } : { trash: undefined }), cur: docs.length ? docs[0].id : null };
}
export { uid };
