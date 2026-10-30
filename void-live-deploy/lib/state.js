// state — the one list of what Verse keeps on this device (asked by Verse, 2026-10-16: "Connect the memory card session
// persistence to a centralized 'state' skill"). Every browser-storage key Verse uses is named here once, with what it holds and
// whether it is secret; the memory card reads its session through sessionToken() instead of keeping its own copy of the
// key names, and the state skill (skills/state.js) shows the list. A secret is shown as "kept" or "not kept", never its value.
// Pure over the storage handed in (default localStorage), so a test can pass a stand-in.

export const STORES = {
  owner:    { key: 'a2m.void.owner.v1',    what: 'the owner key, if you unlocked Verse', secret: true },
  me:       { key: 'a2m.void.me.v1',       what: 'your member session (passkey)', secret: true },
  stage:    { key: 'a2m.void.state.v1',    what: 'the cards on your stage' },
  look:     { key: 'a2m.void.look.v1',     what: 'how your Verse looks (colours, stars, font)' },
  undo:     { key: 'a2m.void.undo.v1',     what: 'the one step "undo" goes back' },
  loop:     { key: 'a2m.void.loop.v1',     what: 'the last asks you made, so Verse can learn what it missed' },
  asks:     { key: 'a2m.void.asks.v1',     what: 'your asks, for suggestions' },
  agenda:   { key: 'a2m.void.calendar.v1', what: 'your calendar events (the stage card and the Calendar page share them)' },
  agendaOld: { key: 'a2m.void.agenda.v1',  what: 'the calendar entries kept before the stage and the Calendar page shared one list (moved over once, kept as they were)' },
  routines: { key: 'a2m.void.routines.v1', what: 'your routines' },
  incident: { key: 'a2m.void.incident.v1', what: 'the incident brief you were writing' },
  away:     { key: 'a2m.void.away.v1',     what: 'when you last left, so the stage can live on meanwhile' },
  entered:  { key: 'a2m.void.entered.v1',  what: 'that you have been here before' },
  used:     { key: 'a2m.void.used.v1',     what: 'which parts of Verse you have used' },
  ladder:   { key: 'a2m.void.ladder.v1',   what: 'your wins and losses against Verse in Pong and Snake' },
  games:    { key: 'a2m.void.games.v1',    what: 'the chess, checkers and reversi games you finished against Verse (when, result, moves, minutes), the last 100' },
  corrections: { key: 'a2m.void.corrections.v1', what: 'what you told Verse it got wrong (kept apart from how your Verse looks)' },
  friction: { key: 'a2m.void.friction.v1', what: 'how slippery things are when you throw them' },
  camera:   { key: 'a2m.void.camera.v1',   what: 'where the stage camera is and whether you are flying ("fly around")' },
  eclipse:  { key: 'a2m.void.eclipse.v1',  what: 'which families of skills you eclipsed (hidden from routing) and until when' },
  codex:    { key: 'a2m.void.codex.v1',    what: 'the cards and answers you filed in the codex' },
  capsule:  { key: 'a2m.void.capsule.v1',  what: 'your sealed time capsules (a word is kept only as a hash)' },
  whispers: { key: 'a2m.void.whispers.v1', what: 'notes you left on stage things, shown once' },
  graph:    { key: 'a2m.void.graph.v1',    what: 'what you ask about, as a small graph of skills and a few topic words (never the sentence), so Verse can build on it ("what do you know about me")' },
};

const store = (s) => { try { return s || globalThis.localStorage || null; } catch (_) { return null; } };

/** the raw value kept under a name, or null. Pure over the storage. */
export function read(name, s) {
  const d = STORES[name], st = store(s);
  if (!d || !st) return null;
  try { return st.getItem(d.key); } catch (_) { return null; }
}
/** keep a value under a name; false when it could not be kept. */
export function write(name, value, s) {
  const d = STORES[name], st = store(s);
  if (!d || !st) return false;
  try { st.setItem(d.key, String(value)); return true; } catch (_) { return false; }
}
/** the token the memory card sends: the owner key, else this device's member session; '' when neither. */
export function sessionToken(s) {
  const owner = read('owner', s);
  if (owner) return owner;
  try { return (JSON.parse(read('me', s) || 'null') || {}).token || ''; } catch (_) { return ''; }
}
/** one row per store: { name, what, secret, kept, size } — never a secret's value. Pure over the storage. */
export function summary(s) {
  return Object.entries(STORES).map(([name, d]) => {
    const v = read(name, s);
    return { name, what: d.what, secret: !!d.secret, kept: v != null && v !== '', size: v ? String(v).length : 0 };
  });
}
