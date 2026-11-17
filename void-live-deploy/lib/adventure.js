/**
 * adventure engine - the pure rules behind Verse's choose-your-own-adventure books (skills/adventure.js on the stage,
 * /games/adventure/ full-screen). A book is data (void-live-deploy/data/adventures/*.json): numbered nodes of
 * second-person prose, 2-4 branching choices each, choices gated by inventory items or story flags, and multiple
 * endings. A run holds the seed, the node, the flags, the pack and the path; a run code replays or shares it.
 * Everything is pure and device-local; tests: tools/adventure.test.mjs.
 */

/** a 32-bit seeded generator, so a run replays exactly (same seed, same omens). Pure. */
export function mulberry32(seed) {
  let a = (Number(seed) || 0) >>> 0;
  return () => {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** a book's shape errors, or [] when #work builders can ship it. Pure. */
export function validateBook(book) {
  const errs = [];
  if (!book || typeof book !== 'object') return ['not a book object'];
  if (!book.id || !book.title || !book.start) errs.push('id, title and start are required');
  if (!book.nodes || typeof book.nodes !== 'object') return [...errs, 'nodes is required'];
  if (book.start && !book.nodes[book.start]) errs.push('start node "' + book.start + '" is missing');
  for (const [id, n] of Object.entries(book.nodes)) {
    if (!n || typeof n !== 'object') { errs.push('node "' + id + '" is not an object'); continue; }
    if (typeof n.prose !== 'string' || !n.prose.trim()) errs.push('node "' + id + '" needs prose');
    const choices = Array.isArray(n.choices) ? n.choices : [];
    if (!n.ending && !choices.length) errs.push('node "' + id + '" has no choices and no ending');
    for (const c of choices) {
      if (!c || typeof c.text !== 'string' || !book.nodes[c.to]) errs.push('node "' + id + '" has a choice to nowhere');
    }
  }
  return errs;
}

/** a fresh run on a book: { book, seed, node, flags, pack, path }. Pure. */
export function createRun(bookId, seed) {
  const s = Number.isFinite(+seed) ? (+seed >>> 0) : ((Date.now() & 0xffff) >>> 0);
  return { book: String(bookId), seed: s, node: null, flags: {}, pack: [], path: [] };
}

export const getNode = (book, id) => (book && book.nodes ? book.nodes[id] || null : null);

/** unmet requirements of a choice as item/flag names. Pure. */
const missing = (choice, run) => {
  const need = (choice && choice.needs) || {}, out = [];
  for (const item of need.items || []) if (!run.pack.includes(item)) out.push(item);
  for (const [k, v] of Object.entries(need.flags || {})) if (!!run.flags[k] !== !!v) out.push((v ? '' : 'not ') + k);
  return out;
};

/** whether a choice's requirements are met by this run. Pure. */
export const choiceOpen = (choice, run) => !missing(choice, run).length;

/** the choices at this run's node, each { i, text, to, open, need }. Pure. */
export function availableChoices(book, run) {
  const n = getNode(book, run.node || book.start);
  if (!n || n.ending) return [];
  return (Array.isArray(n.choices) ? n.choices : []).map((c, i) => {
    const miss = missing(c, run);
    return { i, text: c.text, to: c.to, open: !miss.length, need: miss.length ? 'needs ' + miss.join(', ') : '' };
  });
}

const OMENS = ['Somewhere, a bulkhead ticks as it cools.', 'Dust hangs in the dark, lit green from a dead panel.', 'Your own breath is the loudest machine here.'];

/** one ambient line for a node, fixed by the run's seed. Pure. */
export function omenFor(nodeId, seed) {
  return OMENS[Math.floor(mulberry32((seed ^ (String(nodeId).length * 2654435761)) >>> 0)() * OMENS.length)];
}

/** take choice i: applies gives/removes, moves on. { ok, run, ended } (run is a fresh object). Pure. */
export function choose(book, run, i) {
  const node = getNode(book, run.node || book.start);
  const list = availableChoices(book, { ...run, node: node ? (run.node || book.start) : null });
  const hit = list[Number(i)];
  if (!hit || !hit.open) return { ok: false, run, ended: false };
  const raw = (node.choices || [])[hit.i] || {};
  const next = { book: run.book, seed: run.seed, node: hit.to, flags: { ...run.flags }, pack: [...run.pack], path: [...run.path, hit.to] };
  for (const [k, v] of Object.entries((raw.gives && raw.gives.flags) || {})) next.flags[k] = !!v;
  for (const item of (raw.gives && raw.gives.items) || []) if (!next.pack.includes(item)) next.pack.push(item);
  for (const item of raw.removes || []) next.pack = next.pack.filter((p) => p !== item);
  const at = getNode(book, hit.to);
  return { ok: true, run: next, ended: !!(at && at.ending) };
}

/** a shareable run code (seed + path), and the run it replays. btoa/TextEncoder exist in browsers and node. Pure. */
const toB64 = (bytes) => { let s = ''; for (const b of bytes) s += String.fromCharCode(b); return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''); };
const fromB64 = (s) => { const bin = atob(String(s).replace(/-/g, '+').replace(/_/g, '/')); return Uint8Array.from(bin, (c) => c.charCodeAt(0)); };
export function runCode(run) {
  return toB64(new TextEncoder().encode(JSON.stringify({ s: run.seed, p: run.path })));
}
export function runFromCode(book, code) {
  try {
    const o = JSON.parse(new TextDecoder().decode(fromB64(code)));
    if (!book.nodes[book.start] || !Number.isFinite(+o.s) || !Array.isArray(o.p)) return null;
    let run = { ...createRun(book.id, +o.s >>> 0), node: book.start };
    for (const want of o.p) {
      const open = availableChoices(book, run).filter((c) => c.open);
      const idx = open.findIndex((c) => c.to === want);
      if (idx < 0) return null;
      run = choose(book, run, open[idx].i).run;
    }
    return run;
  } catch (_) { return null; }
}
