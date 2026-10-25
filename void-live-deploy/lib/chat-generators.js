// Chat-fill for Generators (owner, 2026-10-25): "make a generator of pirate ship names: Black Pearl, Sea Wolf, Revenge", "add Dread Maiden to my pirate ship
// names generator", "roll my pirate ship names generator", "keep that name" / "keep the name Black Pearl" write into the generators /generators/ keeps on
// the device (a2m.void.generators.v1: `own` is the make-your-own list, `favs` the kept names). Pure; the plan/undo shape of lib/chat-notes.js.
// Tests: tools/chat-generators.test.mjs.
import { fromList } from './generators.js';

const cap = (s) => { s = String(s || '').trim(); return s ? s[0].toUpperCase() + s.slice(1) : s; };
const lead = (t) => t.replace(/^(?:hey\s+)?(?:verse[,:]?\s+)?(?:please|bitte|can you|could you|would you)\s+/i, '').replace(/\s+(?:please|bitte)$/i, '');
const norm = (s) => String(s || '').toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, ' ').replace(/\s+/g, ' ').trim();
const stem = (w) => (w.length > 3 && w.endsWith('s') && !w.endsWith('ss') ? w.slice(0, -1) : w);
const nameKey = (s) => norm(s).replace(/\b(?:names?|generator|my|the)\b/g, ' ').split(' ').filter(Boolean).map(stem).join(' ');
export const linesOf = (text) => [...new Set(String(text || '').split(/\r?\n/).map((s) => s.trim()).filter(Boolean))].slice(0, 500);

/** { op, ... } for a generators sentence, or null. Syntax only. Pure. */
export function parseIntent(raw) {
  const t = lead(String(raw || '').replace(/\s+/g, ' ').trim().replace(/[.!]+$/, '')); if (!t || t.length > 2000) return null; let m;
  if ((m = /^(?:make|create|build|save|start)\s+(?:me\s+)?(?:a |an |my )?(?:own |custom |random )*generator\s+(?:of|for|with)\s+(.+?)\s*[:\-]\s*(.+)$/i.exec(t)) || (m = /^(?:make|create|build|save|start)\s+(?:me\s+)?(?:a |an |my )?(?:own |custom |random )*(.+?)\s+generator\s*[:\-]\s*(.+)$/i.exec(t)))
    return { op: 'make', name: m[1].trim(), items: m[2].split(/\s*[,;\n]\s*|\s+\|\s+/).map((x) => x.trim()).filter(Boolean) };
  if ((m = /^add\s+(.+?)\s+to\s+(?:my |the )?(.+?)\s+generator$/i.exec(t))) return { op: 'add', items: m[1].split(/\s*[,;]\s*/).map((x) => x.trim()).filter(Boolean), target: m[2].trim() };
  if ((m = /^(?:remove|delete)\s+(.+?)\s+from\s+(?:my |the )?(.+?)\s+generator$/i.exec(t))) return { op: 'remove', items: m[1].split(/\s*[,;]\s*/).map((x) => x.trim()).filter(Boolean), target: m[2].trim() };
  if ((m = /^(?:roll|run|use|spin|draw from|pick from|generate from)\s+(?:my |the )?(.+?)\s+generator$/i.exec(t))) return { op: 'roll', target: m[1].trim() };
  if ((m = /^(?:delete|remove|forget)\s+(?:my |the )?(.+?)\s+generator$/i.exec(t))) return { op: 'delete', target: m[1].trim() };
  if (/^keep\s+(?:that|this|the last)\s+(?:name|one|result)$/i.test(t)) return { op: 'keep', last: true };
  if ((m = /^keep\s+(?:the\s+)?name\s+(.+)$/i.exec(t))) return { op: 'keep', text: m[1].trim() };
  if (/^(?:what|which) generators? (?:have i|did i) (?:made|saved|kept|created)$|^(?:show|list) my (?:own )?generators?$|^(?:show|list) my kept names$/i.test(t)) return { op: 'list' };
  return null;
}
export const HINT = 'I can fill your generators from a sentence: "make a generator of pirate ship names: Black Pearl, Sea Wolf, Revenge", "add Dread Maiden to my pirate ship names generator", "roll my pirate ship names generator", "keep that name", "keep the name Sea Wolf". Every change has Undo.';

const favsOf = (s) => (s && Array.isArray(s.favs) ? s.favs : []);
/** what the intent does to the stored generators ({ favs, own: { name, text } }); `last` is the names the last card showed. Pure. */
export function plan(store, it, now = Date.now(), last = []) {
  if (!it) return { kind: 'none' }; const S = { ...(store || {}), favs: favsOf(store) }, own = S.own && S.own.text ? S.own : null, seed = (now % 99991) + 1;
  const ownOf = (phrase) => (own && (!phrase || nameKey(phrase) === nameKey(own.name) || nameKey(own.name).includes(nameKey(phrase)) || /^(?:own|custom)$/i.test(phrase)) ? own : null);
  const show = (o, said) => { const picks = fromList(o.text, seed, 5); return { kind: 'show', title: cap(o.name), lines: [said || ''].filter(Boolean).concat(picks), picks, offers: picks.slice(0, 5).map((p) => ({ label: 'Keep ' + p, intent: { op: 'keep', text: p } })), openId: 'own' }; };
  switch (it.op) {
    case 'make': {
      const items = [...new Set(it.items.map(cap))]; if (items.length < 2) return { kind: 'none', hint: true };
      const nw = { name: cap(it.name).replace(/\s+generator$/i, ''), text: items.join('\n') };
      if (own && nameKey(own.name) !== nameKey(nw.name) && !it.sure) return { kind: 'confirm', preview: 'Your own-generator slot holds "' + own.name + '" (' + linesOf(own.text).length + ' entries). Replace it with "' + nw.name + '"', intent: { ...it, sure: true } };
      const picks = fromList(nw.text, seed, 3);
      return { kind: 'write', title: nw.name, said: 'Made the generator "' + nw.name + '" with ' + items.length + ' entries', detail: 'First rolls: ' + picks.join(', '), picks, offers: picks.map((p) => ({ label: 'Keep ' + p, intent: { op: 'keep', text: p } })), store: { ...S, own: nw }, changes: [{ key: 'own', before: own }], openId: 'own' };
    }
    case 'add': { const o = ownOf(it.target); if (!o) return { kind: 'none' }; const have = new Set(linesOf(o.text).map((x) => x.toLowerCase())), add = it.items.map(cap).filter((x) => !have.has(x.toLowerCase())); if (!add.length) return { kind: 'show', title: o.name, lines: ['Already in "' + o.name + '". Nothing changed.'], openId: 'own' };
      return { kind: 'write', title: o.name, said: 'Added ' + add.join(', ') + ' to "' + o.name + '"', detail: linesOf(o.text).length + add.length + ' entries now', store: { ...S, own: { ...o, text: linesOf(o.text).concat(add).join('\n') } }, changes: [{ key: 'own', before: o }], openId: 'own' }; }
    case 'remove': { const o = ownOf(it.target); if (!o) return { kind: 'none' }; const drop = new Set(it.items.map((x) => x.toLowerCase())), ls = linesOf(o.text), k = ls.filter((x) => !drop.has(x.toLowerCase())); if (k.length === ls.length) return { kind: 'show', title: o.name, lines: ['"' + o.name + '" has none of those. It has: ' + ls.slice(0, 20).join(', ') + '.'], openId: 'own' };
      return { kind: 'write', title: o.name, said: 'Removed ' + (ls.length - k.length) + ' from "' + o.name + '"', store: { ...S, own: { ...o, text: k.join('\n') } }, changes: [{ key: 'own', before: o }], openId: 'own' }; }
    case 'roll': { const o = ownOf(it.target); if (!o) return { kind: 'none' }; return show(o); }
    case 'delete': { const o = ownOf(it.target); if (!o) return { kind: 'none' }; if (!it.sure) return { kind: 'confirm', preview: 'Delete your generator "' + o.name + '" (' + linesOf(o.text).length + ' entries)', intent: { ...it, sure: true } };
      const { own: _x, ...rest } = S; return { kind: 'write', title: o.name, said: 'Deleted the generator "' + o.name + '"', store: rest, changes: [{ key: 'own', before: o }], openId: null }; }
    case 'keep': {
      const text = it.text || (it.last ? (last || [])[0] : ''); if (!text) return { kind: 'none' };
      const g = own && linesOf(own.text).some((x) => x.toLowerCase() === text.toLowerCase()) ? 'own' : 'own';
      if (S.favs.some((f) => f.g === g && f.text.toLowerCase() === text.toLowerCase())) return { kind: 'show', title: 'Kept names', lines: ['"' + text + '" is already kept.'], openId: 'own' };
      return { kind: 'write', title: text, said: 'Kept the name "' + text + '"', store: { ...S, favs: [{ g, text }, ...S.favs] }, changes: [{ key: 'favs-add', text, g }], openId: 'own' };
    }
    case 'list': return { kind: 'show', title: 'Your generators', lines: [own ? '"' + own.name + '": ' + linesOf(own.text).length + ' entries' : 'No own generator yet.', S.favs.length ? 'Kept names: ' + S.favs.slice(0, 12).map((f) => f.text).join(', ') : 'No kept names yet.'], openId: 'own' };
    default: return { kind: 'none' };
  }
}
/** the generators put back as they were. Pure. */
export function undoOf(store, changes) {
  let S = { ...(store || {}), favs: favsOf(store) };
  for (const c of [...changes].reverse()) {
    if (c.key === 'own') { if (c.before) S.own = c.before; else delete S.own; }
    else if (c.key === 'favs-add') { const i = S.favs.findIndex((f) => f.g === c.g && f.text === c.text); if (i >= 0) S.favs = S.favs.filter((_, j) => j !== i); }
  }
  return S;
}
