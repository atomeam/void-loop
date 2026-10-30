// Chat-fill for Recipes (owner, 2026-10-25): "save this recipe: Lemon cake, serves 8, ingredients: 200 g flour, 3 eggs, 100 g sugar; steps: mix. bake 40
// minutes", "add pancakes to my recipes", "add salt to my lemon cake recipe", "remove eggs from my lemon cake recipe", "make my lemon cake recipe for 6",
// "add a step: cool it to my lemon cake recipe", "delete my lemon cake recipe" write into the recipes /recipes/ keeps on the device
// (a2m.void.recipes.v1, its `mine` list; the page finds them by name beside the built-in ones). Pure; the plan/undo shape of lib/chat-notes.js.
// Tests: tools/chat-recipes.test.mjs.
import { find, BUILT_IN } from './recipes.js';

const cap = (s) => { s = String(s || '').trim(); return s ? s[0].toUpperCase() + s.slice(1) : s; };
const lead = (t) => t.replace(/^(?:hey\s+)?(?:verse[,:]?\s+)?(?:please|bitte|can you|could you|would you)\s+/i, '').replace(/\s+(?:please|bitte)$/i, '');
const slug = (s) => String(s).toLowerCase().replace(/[^\p{L}\p{N}]+/gu, '-').replace(/^-+|-+$/g, '').slice(0, 40) || 'recipe';
const norm = (s) => String(s || '').toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, ' ').replace(/\s+/g, ' ').trim();
const stem = (w) => (w.length > 3 && w.endsWith('s') && !w.endsWith('ss') ? w.slice(0, -1) : w);

/** a recipe from typed text: "Name, serves 8, ingredients: a, b; steps: x. y". null when there are not at least two ingredients or a name. Pure. */
export function recipeFrom(text) {
  let s = String(text || '').trim().replace(/^(?:for|called|named|titled)\s+/i, ''); if (!s) return null;
  const sm = /\b(?:serves|serving|servings|feeds|for)\s+(\d{1,3})\b|\b(\d{1,3})\s+(?:servings?|portions?|people)\b/i.exec(s); const servings = sm ? +(sm[1] || sm[2]) : 4;
  if (sm) s = s.replace(sm[0], ' ').replace(/\s*,\s*,/g, ',').trim();
  const stepRe = /(?:^|[;.,\s])(?:steps?|method|directions?|instructions?|how to)\s*[:\-]\s*/i, ingRe = /(?:^|[;.,\s])ingredients?\s*[:\-]\s*/i;
  const si = stepRe.exec(s); let head = si ? s.slice(0, si.index) : s, stepText = si ? s.slice(si.index + si[0].length) : '';
  let name = '', ingText = '';
  const ii = ingRe.exec(head);
  if (ii) { name = head.slice(0, ii.index).replace(/[:,;\-\s]+$/, ''); ingText = head.slice(ii.index + ii[0].length); }
  else { const c = /^([^:]{1,60}):\s*(.+)$/s.exec(head) || /^(.{1,60}?)\s+[-–—]\s+(.+)$/s.exec(head); if (c) { name = c[1]; ingText = c[2]; } else return null; }
  name = cap(name.replace(/[:,;\s]+$/, '').replace(/^["']|["']$/g, '')); if (!name || name.length > 60) return null;
  const items = ingText.split(/\s*[,;\n]\s*/).map((x) => x.trim().replace(/^and\s+/i, '')).filter(Boolean).map(cap).slice(0, 60);
  if (!items.length || (items.length < 2 && !si)) return null;
  const steps = stepText.split(/\s*(?:[.;\n]|\bthen\b)\s*/i).map((x) => x.trim()).filter(Boolean).map(cap).slice(0, 40);
  return { name, servings: Math.max(1, Math.min(200, servings)), ingredients: items, steps: steps.length ? steps : ['Combine the ingredients and cook until done.'] };
}

/** { op, ... } for a recipes sentence, or null. Syntax only. Pure. */
export function parseIntent(raw) {
  const t = lead(String(raw || '').replace(/\s+/g, ' ').trim().replace(/[.!]+$/, '')); if (!t || t.length > 1500) return null; let m;
  if ((m = /^(?:save|add|keep|store|write down|new|create|speichere)\s+(?:this |a |my |the |new )*recipe(?: for| called| named)?\s*[:,\-]?\s*(.+)$/i.exec(t))) return { op: 'save', text: m[1].trim() };
  if ((m = /^add\s+(?:a |an )?step[:,]?\s*(.+?)\s+to\s+(?:my |the )?(.+?)\s+recipe$/i.exec(t))) return { op: 'step', text: m[1].trim(), target: m[2].trim() };
  if ((m = /^(?:remove|delete|take out|drop)\s+(.+?)\s+from\s+(?:my |the )?(.+?)\s+recipe$/i.exec(t))) return { op: 'unadd', text: m[1].trim(), target: m[2].trim() };
  if ((m = /^add\s+(.+?)\s+to\s+(?:my |the )?(.+?)\s+recipe$/i.exec(t))) return { op: 'addIng', text: m[1].trim(), target: m[2].trim() };
  if ((m = /^add\s+(.+?)\s+to\s+(?:my |the )?(?:saved |own )?recipes$/i.exec(t))) return { op: 'saveBuiltin', dish: m[1].trim() };
  if ((m = /^(?:make|change|set|scale)\s+(?:my |the )?(.+?)\s+recipe\s+(?:to\s+|for\s+|serve\s+|serves\s+)?(\d{1,3})(?:\s+(?:servings?|people|portions?))?$/i.exec(t))) return { op: 'servings', target: m[1].trim(), n: +m[2] };
  if ((m = /^(?:delete|remove|forget)\s+(?:my |the )?(.+?)\s+recipe$/i.exec(t))) return { op: 'delete', target: m[1].trim() };
  if (/^(?:what|which) recipes (?:have i|did i) (?:saved?|kept|added|made)$|^(?:show|list) (?:me )?my (?:saved )?recipes$/i.test(t)) return { op: 'list' };
  return null;
}
export const HINT = 'I can fill your recipes from a sentence: "save this recipe: Lemon cake, serves 8, ingredients: 200 g flour, 3 eggs, 100 g sugar; steps: mix. bake 40 minutes", "add pancakes to my recipes", "add salt to my lemon cake recipe", "remove eggs from my lemon cake recipe", "make my lemon cake recipe for 6", "delete my lemon cake recipe". Every change has Undo.';

const mineOf = (store) => (store && Array.isArray(store.mine) ? store.mine : []);
const idFor = (name, mine) => { let id = 'mine-' + slug(name), n = 2; while (mine.some((x) => x.id === id)) id = 'mine-' + slug(name) + '-' + n++; return id; };
const entry = (r) => ({ id: r.id, name: r.name, recipe: r });
const find1 = (mine, phrase, id) => { if (id) return mine.filter((x) => x.id === id); const k = norm(phrase); if (!k) return []; const w = k.split(' ').map(stem); const ex = mine.filter((x) => norm(x.name) === k); if (ex.length) return ex; return mine.filter((x) => { const nw = norm(x.name).split(' ').map(stem); return w.every((q) => nw.includes(q)); }); };
const sameIng = (a, b) => norm(a).split(' ').map(stem).join(' ') === norm(b).split(' ').map(stem).join(' ');
const swap = (S, e, r) => ({ ...S, mine: S.mine.map((x) => (x.id === e.id ? entry(r) : x)) });

/** what the intent does to the stored recipes page ({ mine, ... }); see lib/fill-card.js. Pure. */
export function plan(store, it) {
  if (!it) return { kind: 'none' }; const S = { ...(store || {}), mine: mineOf(store) };
  const one = (hits, mk, q) => (hits.length === 1 ? null : { kind: 'ask', question: q, options: hits.slice(0, 6).map((x) => ({ label: x.name, intent: mk(x.id) })) });
  const made = (r, said) => ({ kind: 'write', title: r.name, said, detail: r.servings + ' servings · ' + r.ingredients.length + ' ingredients · ' + r.steps.length + ' steps', store: { ...S, mine: [entry(r), ...S.mine] }, changes: [{ id: r.id, before: null }], openId: r.id });
  switch (it.op) {
    case 'save': {
      const f = recipeFrom(it.text); if (!f) return { kind: 'none', hint: true };
      const dup = S.mine.find((x) => norm(x.name) === norm(f.name)); if (dup && !it.sure) return { kind: 'confirm', preview: 'You already have "' + dup.name + '". Save this one beside it', detail: f.ingredients.join(', '), intent: { ...it, sure: true } };
      const r = { id: idFor(f.name, S.mine), name: f.name, aliases: [f.name.toLowerCase()], servings: f.servings, time: 0, tags: ['mine'], ingredients: f.ingredients, steps: f.steps };
      return made(r, 'Saved "' + r.name + '" to your recipes');
    }
    case 'saveBuiltin': {
      const b = find(it.dish, BUILT_IN)[0]; if (!b) return { kind: 'show', title: 'Recipes', lines: ['I have no built-in recipe called "' + it.dish + '". Say it whole: "save this recipe: ' + cap(it.dish) + ', ingredients: ..., steps: ..."'] };
      if (S.mine.some((x) => norm(x.name) === norm(b.name))) return { kind: 'show', title: b.name, lines: ['"' + b.name + '" is already in your recipes.'], openId: S.mine.find((x) => norm(x.name) === norm(b.name)).id };
      return made({ ...b, id: idFor(b.name, S.mine), aliases: [...(b.aliases || []), b.name.toLowerCase()], tags: [...(b.tags || []), 'mine'] }, 'Copied "' + b.name + '" into your recipes');
    }
    case 'list': return { kind: 'show', title: 'Your recipes', hits: S.mine.map((x) => ({ id: x.id, title: x.name, snippet: x.recipe.servings + ' servings, ' + x.recipe.ingredients.length + ' ingredients' })), lines: S.mine.length ? [] : ['None saved yet. Say "save this recipe: Name, ingredients: a, b, c; steps: ..."'], openId: (S.mine[0] || {}).id };
    default: break;
  }
  let hits = find1(S.mine, it.target, it.docId);
  if (!hits.length && (it.op === 'addIng') && !it.docId) { const b = find(it.target, BUILT_IN)[0]; if (b && norm(b.name) === norm(it.target) || b && norm(it.target).split(' ').every((w) => norm(b.name).includes(w))) return { kind: 'confirm', preview: 'Copy the built-in "' + b.name + '" into your recipes and add "' + cap(it.text) + '" to it', intent: { op: 'copyAdd', dish: b.name, text: it.text, sure: true } }; }
  if (it.op === 'copyAdd') { const b = find(it.dish, BUILT_IN)[0]; if (!b) return { kind: 'none' }; const r = { ...b, id: idFor(b.name, S.mine), aliases: [...(b.aliases || []), b.name.toLowerCase()], tags: [...(b.tags || []), 'mine'], ingredients: [...b.ingredients, cap(it.text)] }; return made(r, 'Copied "' + b.name + '" into your recipes with ' + cap(it.text) + ' added'); }
  if (!hits.length) return { kind: 'none' };
  const mk = (id) => ({ ...it, docId: id }), q = one(hits, mk, 'Which recipe do you mean by "' + it.target + '"?'); if (q) return q; const e = hits[0], r = e.recipe;
  switch (it.op) {
    case 'addIng': { const add = it.text.split(/\s*[,;]\s*/).map(cap).filter(Boolean).filter((x) => !r.ingredients.some((y) => sameIng(y, x))); if (!add.length) return { kind: 'show', title: r.name, lines: ['Already in "' + r.name + '": ' + it.text + '. Nothing changed.'], openId: e.id }; return { kind: 'write', title: r.name, said: 'Added ' + add.join(', ') + ' to "' + r.name + '"', detail: 'Now ' + (r.ingredients.length + add.length) + ' ingredients', store: swap(S, e, { ...r, ingredients: [...r.ingredients, ...add] }), changes: [{ id: e.id, before: e }], openId: e.id }; }
    case 'unadd': { const k = r.ingredients.filter((y) => !(norm(y).includes(norm(it.text)) || sameIng(y, it.text))); if (k.length === r.ingredients.length) return { kind: 'show', title: r.name, lines: ['"' + r.name + '" has no ingredient like "' + it.text + '". It has: ' + r.ingredients.join(', ') + '.'], openId: e.id }; return { kind: 'write', title: r.name, said: 'Removed ' + (r.ingredients.length - k.length) + ' ingredient (' + it.text + ') from "' + r.name + '"', store: swap(S, e, { ...r, ingredients: k }), changes: [{ id: e.id, before: e }], openId: e.id }; }
    case 'step': return { kind: 'write', title: r.name, said: 'Added the step "' + cap(it.text) + '" to "' + r.name + '"', store: swap(S, e, { ...r, steps: [...r.steps.filter((x) => !/^Combine the ingredients and cook until done\.$/.test(x)), cap(it.text)] }), changes: [{ id: e.id, before: e }], openId: e.id };
    case 'servings': { const n = Math.max(1, Math.min(200, it.n)); if (n === r.servings) return { kind: 'show', title: r.name, lines: ['"' + r.name + '" already serves ' + n + '.'], openId: e.id }; return { kind: 'write', title: r.name, said: '"' + r.name + '" now serves ' + n + ' (was ' + r.servings + '); the quantities in its lines stay as typed, the page scales them from the servings', store: swap(S, e, { ...r, servings: n }), changes: [{ id: e.id, before: e }], openId: e.id }; }
    case 'delete': if (!it.sure && !it.docId) return { kind: 'confirm', preview: 'Delete your recipe "' + r.name + '"', intent: { ...it, sure: true } }; return { kind: 'write', title: r.name, said: 'Deleted your recipe "' + r.name + '"', store: { ...S, mine: S.mine.filter((x) => x.id !== e.id) }, changes: [{ id: e.id, before: e }], openId: null };
    default: return { kind: 'none' };
  }
}
/** the recipes put back as they were. Pure. */
export function undoOf(store, changes) { let mine = [...mineOf(store)]; for (const c of [...changes].reverse()) { mine = mine.filter((x) => x.id !== c.id); if (c.before) mine.unshift(c.before); } return { ...(store || {}), mine }; }
