/**
 * wheel: spin a wheel of names or choices, fairly (owner, 2026-10-24: "find the site to conquer and get to work now"; the frontier's wheelofgold.com,
 * and the category's best, a wheel of names: an entries list, a spin with ticks, the winner, remove it, shuffle, sort, a link, a history). Here the
 * winner is picked FIRST with the browser's cryptographic random numbers (a weighted entry, "Pizza*3", has three times the chance), and the spin
 * is planned to land on it: the wheel cannot be nudged and every slice's chance is exactly its weight. The pointer is at the top; slices run
 * clockwise from it. Entries live in the link (base64url), so a wheel is shared by sharing its address. Pure; the page draws and spins.
 * Tests: tools/wheel.test.mjs.
 */
export const MAX_ENTRIES = 500;
const clean = (s) => String(s || '').replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 80);

/** the entries typed: one a line (or commas when it is one line), blanks dropped, "Name*3" or "Name x3" a weight of 3 (1 to 100):
 *  [{ label, weight }]. Pure. */
export function entriesOf(text) {
  const raw = String(text || ''), lines = /\n/.test(raw) ? raw.split('\n') : raw.split(',');
  const out = [];
  for (const l of lines) { const t = clean(l); if (!t) continue; const m = /^(.*?)\s*(?:\*|\bx)\s*(\d{1,3})$/i.exec(t); const label = clean(m ? m[1] : t), weight = m ? Math.min(100, Math.max(1, +m[2])) : 1; if (label) out.push({ label, weight }); if (out.length >= MAX_ENTRIES) break; }
  return out;
}
/** the entries as text again, weights kept. Pure. */
export const textOf = (entries) => (entries || []).map((e) => e.label + (e.weight > 1 ? ' *' + e.weight : '')).join('\n');

/** each slice: { label, weight, start, end } in degrees clockwise from the pointer at the top, sized by weight. Pure. */
export function slices(entries) {
  const total = (entries || []).reduce((a, e) => a + e.weight, 0); let at = 0;
  return (entries || []).map((e) => { const size = (e.weight / total) * 360, s = { ...e, start: at, end: at + size }; at += size; return s; });
}
/** a fair weighted pick: an index, from a random number u in [0, 1) (the page passes crypto's). Pure. */
export function pickIndex(entries, u) {
  const total = entries.reduce((a, e) => a + e.weight, 0); let x = u * total;
  for (let i = 0; i < entries.length; i++) { x -= entries[i].weight; if (x < 0) return i; }
  return entries.length - 1;
}
/** a random number in [0, 1) from the browser's cryptographic source, no modulo bias. */
export const fairRandom = () => { const a = new Uint32Array(2); crypto.getRandomValues(a); return (a[0] * 2 ** 21 + (a[1] >>> 11)) / 2 ** 53; };

/** the spin that lands index `i` under the pointer: the wheel's final rotation in degrees (clockwise), from where it is now (`from`), at least
 *  `turns` whole turns, landing at `v` (0..1) of the way across the slice, kept away from its edges so no one argues over a line. Pure. */
export function plan(entries, i, from = 0, turns = 5, v = 0.5) {
  const s = slices(entries)[i], margin = Math.min(0.2, 2 / Math.max(1e-9, s.end - s.start)), at = s.start + (s.end - s.start) * (margin + (1 - 2 * margin) * v);
  // the pointer reads the slice at (360 - rotation) mod 360, so the wheel must stop at rotation = 360 - at (mod 360)
  const base = ((from % 360) + 360) % 360, want = ((360 - at) % 360 + 360) % 360; let delta = want - base; if (delta < 0) delta += 360;
  return from + turns * 360 + delta;
}
/** which entry the pointer is on at a rotation. Pure. */
export function under(entries, rotation) {
  const a = ((360 - (rotation % 360)) % 360 + 360) % 360, s = slices(entries);
  return Math.max(0, s.findIndex((x) => a >= x.start && a < x.end));
}
/** the ease the spin follows (quick start, long slow finish), t in 0..1. Pure. */
export const ease = (t) => 1 - Math.pow(1 - Math.min(1, Math.max(0, t)), 4);

/** a shuffled copy (Fisher-Yates over crypto random numbers by default). Pure for a given `rand`. */
export function shuffle(entries, rand = fairRandom) { const a = entries.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }
/** sorted A to Z, by the language's own order. Pure. */
export const sorted = (entries) => entries.slice().sort((a, b) => a.label.localeCompare(b.label, undefined, { sensitivity: 'base', numeric: true }));

/** the entries in a link: base64url of the text; read back with open(). Pure. */
export function pack(entries) { const b = new TextEncoder().encode(textOf(entries)); let s = ''; for (const x of b) s += String.fromCharCode(x); return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''); }
export function open(code) { try { const s = atob(String(code || '').replace(/-/g, '+').replace(/_/g, '/')); const e = entriesOf(new TextDecoder().decode(Uint8Array.from(s, (c) => c.charCodeAt(0)))); return e.length ? e : null; } catch (_) { return null; } }

/** the stage ask that opens these exact entries, weights kept: "spin the wheel with pizza, tacos*3, sushi" when that reads back the same, else
 *  "spin the wheel #<pack>"; '' for fewer than two (the card has nothing to spin). Pure. */
export function askOf(entries) {
  const e = entries || []; if (e.length < 2) return '';
  const words = 'spin the wheel with ' + e.map((x) => x.label + (x.weight > 1 ? '*' + x.weight : '')).join(', '), back = askWheel(words);
  return back && textOf(back.entries) === textOf(e) ? words : 'spin the wheel #' + pack(e);
}

// the asks: "spin the wheel", "wheel of names", "spinner wheel", "spin a wheel with pizza, tacos, sushi", "random name picker wheel"
/** what an ask wants: { entries } (maybe empty, for the starting wheel) or null. Pure. */
export function askWheel(text) {
  const t = String(text || '').trim().replace(/[?.!]+$/, '').replace(/\s+/g, ' '), l = t.toLowerCase();
  // the wheel page's own stage link: "spin the wheel #<entries in a link>" when its entries do not read back from words (owner via the team, 2026-10-29)
  const k = /^spin\s+(?:the|a)\s+wheel\s+#([a-z0-9_-]{2,12000})$/i.exec(t);
  if (k) { const e = open(k[1]); return e && e.length >= 2 ? { entries: e } : null; }
  if (t.length > 400) return null;
  const m = /^(?:spin|make|create|build)\s+(?:me\s+)?(?:a|the)\s+(?:prize\s+|random\s+|decision\s+)?wheel\s+(?:with|of|for)\s*:?\s+(.+)$/i.exec(t);
  if (m) { const e = entriesOf(m[1].replace(/\s+(?:and|or)\s+/gi, ', ')); return e.length >= 2 ? { entries: e } : null; }
  if (/^(?:spin\s+(?:the|a)\s+wheel|wheel\s+(?:of|for)\s+names|(?:random\s+)?(?:name|names)\s+(?:picker\s+)?wheel|(?:spinner|spinning|prize|decision|random|picker)\s+wheel|wheel\s+(?:spinner|picker|decide|of\s+fortune\s+spinner)|spin\s+(?:the|a)\s+wheel\s+(?:of\s+names|to\s+(?:decide|pick|choose)))$/.test(l)) return { entries: [] };
  return null;
}
