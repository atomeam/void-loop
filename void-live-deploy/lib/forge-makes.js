// Forge iterations (asked by Verse: "create the recipe-versioning system in the forge to save 'make' results as unique, inspectable
// iterations"). Every "make me a ..." the forge answers is kept as one iteration: a number of its own, the recipe and its id
// (skills/forge-rules.js recipeId: a change to a recipe gives a new id), the words that asked for it and the time. The same recipe
// made twice is two iterations with one recipe id; a recipe changed in between shows as a different id, so what produced what can
// be opened again ("make me a vase" brings back exactly that recipe's current form, and the list says when its id was not the same).
// Kept in this browser only (localStorage): nothing about anyone reaches the server. Pure apart from load/add.
export const KEY = 'a2m.void.forge.makes.v1', KEEP = 60;
const flat = (s, n) => String(s == null ? '' : s).replace(/[\u0000-\u001f\u007f<>]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, n);

/** an iteration as the forge reports it, made safe to keep: { n, at, key, recipe, ask } or null */
export function iterationOf(r, n, at = new Date().toISOString()) {
  if (!r || typeof r !== 'object' || !/^[a-z][a-z0-9-]{0,30}$/.test(String(r.key || '')) || !/^[0-9a-f]{8}$/.test(String(r.recipe || ''))) return null;
  return { n, at, key: r.key, recipe: r.recipe, ask: flat(r.ask, 80) };
}
export function load(ls) {
  try { const v = JSON.parse((ls && ls.getItem(KEY)) || '[]'); return Array.isArray(v) ? v.filter((x) => x && typeof x === 'object' && x.key && x.recipe) : []; } catch (_) { return []; }
}
/** keep one more iteration, newest first, numbered after the highest kept; returns the list (unchanged when it is not one) */
export function add(ls, r, at) {
  const list = load(ls), it = iterationOf(r, list.reduce((m, x) => Math.max(m, +x.n || 0), 0) + 1, at);
  if (!it) return list;
  const next = [it, ...list].slice(0, KEEP);
  try { ls.setItem(KEY, JSON.stringify(next)); } catch (_) {}
  return next;
}
/** each iteration with whether its recipe is still the forge's current one: now(key) gives the current recipe id. Pure. */
export function withStatus(list, now) {
  return (Array.isArray(list) ? list : []).map((x) => { const cur = now(x.key); return { ...x, current: cur === x.recipe, now: cur || null }; });
}
export function iterationsHtml(esc, rows) {
  if (!rows.length) return '<h2>Forge iterations</h2><div class="sub">Nothing made yet in this browser. Say “make me a vase”: each make is kept here with its recipe id.</div>';
  const li = rows.map((x) => '<li data-iteration="' + (+x.n) + '"><b>#' + (+x.n) + '</b> ' + esc(x.key) + ' · recipe ' + esc(x.recipe) + (x.current ? ' (the forge’s current one)' : ' (the recipe has changed since; now ' + esc(x.now || 'gone') + ')')
    + ' · ' + esc(String(x.at).slice(0, 16).replace('T', ' ')) + (x.ask ? ' · asked “' + esc(x.ask) + '”' : '') + (x.current ? ' · <a href="#" data-ask="' + esc(x.ask || 'make me a ' + x.key) + '">make it again</a>' : '') + '</li>').join('');
  return '<h2>Forge iterations</h2><div class="sub">' + rows.length + ' make' + (rows.length === 1 ? '' : 's') + ' kept, newest first · the recipe id is in the STL’s file name, so a printed file names the exact recipe</div><ul data-iterations>' + li + '</ul>'
    + '<div class="src">Source: this browser’s forge ledger (lib/forge-makes.js) · nothing about you leaves this device</div>';
}
