// The print ledger (asked by Verse: "establish a feedback loop between 'print-file' and 'inventory' so I know exactly what physical
// assets exist"). Every file that left for a printer from this browser leaves one record here: the forge's STLs (skills/forge.js
// printOrRefuse, after the file passed its check) and the stage's 3MF (skills/print-file.js, after its check). The inventory
// reads it: "what have I printed" lists the files, the things, the recipe ids and the grams of PLA they add up to. Kept in this
// browser only (localStorage), like the routines: nothing about anyone reaches the server. Pure apart from load/add.
export const KEY = 'a2m.void.prints.v1', KEEP = 50;
const flat = (s, n) => String(s == null ? '' : s).replace(/[\u0000-\u001f\u007f<>]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, n);
const int = (v, max) => { const n = Math.floor(+v); return Number.isFinite(n) && n >= 0 ? Math.min(n, max) : null; };

/** a record as a skill reports it, made safe to keep: { at, kind: 'stl' | '3mf', file, label, key?, recipe?, triangles, grams?, size?, figures? } or null */
export function recordOf(r, at = new Date().toISOString()) {
  if (!r || typeof r !== 'object' || !['stl', '3mf'].includes(r.kind)) return null;
  const file = flat(r.file, 80), label = flat(r.label, 40), triangles = int(r.triangles, 5e6);
  if (!/^[a-z0-9][a-z0-9._-]{0,78}\.(?:stl|3mf)$/i.test(file) || !label || triangles === null) return null;
  const out = { at, kind: r.kind, file, label, triangles };
  if (/^[a-z][a-z0-9-]{0,30}$/.test(String(r.key || ''))) out.key = r.key;
  if (/^[0-9a-f]{8}$/.test(String(r.recipe || ''))) out.recipe = r.recipe;
  const grams = int(r.grams, 1e5); if (grams !== null) out.grams = grams;
  const figures = int(r.figures, 1e4); if (figures !== null) out.figures = figures;
  if (Array.isArray(r.size) && r.size.length === 3 && r.size.every((x) => Number.isFinite(+x))) out.size = r.size.map((x) => Math.round(+x));
  return out;
}

export function load(ls) {
  try { const v = JSON.parse((ls && ls.getItem(KEY)) || '[]'); return Array.isArray(v) ? v.filter((x) => x && typeof x === 'object' && x.file) : []; } catch (_) { return []; }
}
/** keep one record, newest first, at most KEEP; returns the list (unchanged when the record is not one) */
export function add(ls, r, at) {
  const rec = recordOf(r, at), list = load(ls);
  if (!rec) return list;
  const next = [rec, ...list].slice(0, KEEP);
  try { ls.setItem(KEY, JSON.stringify(next)); } catch (_) {}
  return next;
}
export function clear(ls) { try { ls.removeItem(KEY); } catch (_) {} }

/** what exists: how many files went out, how many distinct things, grams of PLA in all, each thing with its count and last time. Pure. */
export function summary(list) {
  const L = Array.isArray(list) ? list : [], by = new Map();
  for (const r of L) { const k = r.key || r.label; const e = by.get(k) || { label: r.label, key: r.key || null, n: 0, last: r.at, grams: 0, recipes: new Set() }; e.n++; if (String(r.at) > String(e.last)) e.last = r.at; e.grams += +r.grams || 0; if (r.recipe) e.recipes.add(r.recipe); by.set(k, e); }
  const things = [...by.values()].sort((a, b) => String(b.last).localeCompare(String(a.last))).map((e) => ({ ...e, recipes: [...e.recipes] }));
  return { files: L.length, things: things.length, grams: L.reduce((a, r) => a + (+r.grams || 0), 0), stl: L.filter((r) => r.kind === 'stl').length, mf: L.filter((r) => r.kind === '3mf').length, list: things };
}

/** the inventory page's section: the things that exist, newest first, with their files and recipes. Pure. */
export function printsHtml(esc, list) {
  const s = summary(list);
  if (!s.files) return '<h2>What I have printed</h2><div class="sub">Nothing has gone to a printer from this browser yet.</div>'
    + '<div class="sub">Say “make me a vase” then “print it” for an STL, or “export a print file” for the stage as a 3MF; every file that passes its check is written down here.</div>';
  const rows = s.list.map((t) => '<li><b>' + esc(t.label) + '</b> — ' + t.n + ' file' + (t.n === 1 ? '' : 's') + (t.grams ? ', about ' + t.grams + ' g of PLA' : '') + ' · last ' + esc(String(t.last).slice(0, 10))
    + (t.recipes.length ? ' · recipe ' + t.recipes.map(esc).join(', ') : '') + (t.key ? ' · say “make me a ' + esc(t.label.toLowerCase()) + '” for another' : '') + '</li>').join('');
  const files = (Array.isArray(list) ? list : []).slice(0, 12).map((r) => '<li>' + esc(r.file) + ' · ' + esc(r.label) + ' · ' + esc(String(r.at).slice(0, 16).replace('T', ' ')) + ' · ' + (+r.triangles).toLocaleString('en') + ' triangles' + (r.figures ? ' · ' + r.figures + ' figure' + (r.figures === 1 ? '' : 's') : '') + '</li>').join('');
  return '<h2>What I have printed</h2>'
    + '<div class="sub" data-prints-sum>' + s.files + ' file' + (s.files === 1 ? '' : 's') + ' went to a printer from this browser (' + s.stl + ' STL, ' + s.mf + ' 3MF): ' + s.things + ' kind' + (s.things === 1 ? '' : 's') + ' of thing' + (s.grams ? ', about ' + s.grams + ' g of PLA in all' : '') + '. Each one passed its check before it left.</div>'
    + '<ul data-prints>' + rows + '</ul>'
    + '<div class="sub">The files, newest first</div><ul>' + files + '</ul>'
    + '<div class="src">Source: this browser\'s print ledger (lib/prints.js), written by “print it” and “export a print file” · nothing about you leaves this device · “what can you print” lists what the forge can still make</div>';
}

/** this browser's storage, or null (kept here so the skills that read the ledger touch no storage themselves) */
export const storeOf = () => { try { return typeof localStorage === 'undefined' ? null : localStorage; } catch (_) { return null; } };
