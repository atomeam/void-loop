// The shared kit of Verse Studio's games (domains/void.game-studio.md). A game is a pure rules module (state in, action in, state out); this is what they
// share: seeded randomness, the live data a game's content is read from (so every build changes the games without anyone editing them), saves on this
// device, and the version and "what changed" lines a game shows. No DOM, no clock, no fetch: the card fetches and passes the files in.

/** mulberry32: a small seeded generator, [0, 1) per call. The same seed gives the same sequence on every machine. Pure. */
export function rng(seed) {
  let a = seed >>> 0;
  return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
/** a number from any text, so a name or a build id can seed a game. Pure. */
export function seedOf(text) { let h = 2166136261; for (const c of String(text == null ? '' : text)) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619); } return h >>> 0; }
export const pick = (r, list) => list[Math.floor(r() * list.length) % list.length];
export const clamp = (n, a, b) => Math.max(a, Math.min(b, n));

const clip = (s, n) => String(s == null ? '' : s).replace(/\s+/g, ' ').trim().slice(0, n);

/**
 * The live data a game reads, with a safe default for anything missing, so a bad deploy or an offline visitor never breaks a game.
 * live = { incidents, growth, families } as fetched from /incidents.json, /void.growth.json and /skills/families.json (any may be null).
 * Returns { incidents: [{ at, sha, checks: [text] }] newest first, growth: [{ at, what }] newest first, families: [{ id, name, skills, proven }], live: boolean }.
 */
export function feedOf(live = {}) {
  const inc = live && live.incidents && Array.isArray(live.incidents.incidents) ? live.incidents.incidents : [];
  const incidents = inc.filter((i) => i && Array.isArray(i.checks) && i.checks.length).map((i) => ({ at: clip(i.at, 24), sha: clip(i.sha, 8), checks: i.checks.map((c) => clip(c, 90)).filter(Boolean).slice(0, 4) }))
    .sort((a, b) => String(b.at).localeCompare(String(a.at))).slice(0, 40);
  const growth = (Array.isArray(live && live.growth) ? live.growth : []).filter((g) => g && g.what).map((g) => ({ at: clip(g.at, 24), what: clip(g.what, 160) })).reverse().slice(0, 400);
  const fams = live && live.families && Array.isArray(live.families.families) ? live.families.families : [];
  const families = fams.filter((f) => f && (f.name || f.id)).map((f) => ({ id: String(f.id || f.name), name: clip(f.name || f.id, 40), skills: Array.isArray(f.skills) ? f.skills.length : 0, proven: (f.count && f.count.proven) || 0 }));
  return { incidents, growth, families, live: !!(incidents.length || growth.length || families.length) };
}

/** this build's short id for a game's version line ('dev' when there is none). Pure. */
export const versionOf = (build) => { const id = build && typeof build === 'object' ? build.id : build; return /^[0-9a-f]{7,40}$/i.test(String(id || '')) ? String(id).slice(0, 7) : 'dev'; };

/** the newest ledger lines that name a game (its name or id, any case): what changed in it lately. Pure. */
export function changesFor(growth, names, n = 3) {
  const needles = (Array.isArray(names) ? names : [names]).map((x) => String(x || '').toLowerCase()).filter((x) => x.length > 2);
  if (!needles.length) return [];
  return (Array.isArray(growth) ? growth : []).filter((g) => g && needles.some((x) => String(g.what || '').toLowerCase().includes(x))).slice(0, n).map((g) => ({ at: String(g.at || '').slice(0, 10), what: clip(g.what, 140) }));
}

export const SAVE_PREFIX = 'a2m.void.studio.';
/** a save is { v, state }; a save from another version of the rules is dropped (the game starts again), never half-loaded. */
export function saveOf(storage, game, state, v) { try { storage.setItem(SAVE_PREFIX + game + '.v1', JSON.stringify({ v, state })); return true; } catch (_) { return false; } }
export function loadOf(storage, game, v) {
  try { const s = JSON.parse(storage.getItem(SAVE_PREFIX + game + '.v1') || 'null'); return s && s.v === v && s.state && typeof s.state === 'object' ? s.state : null; } catch (_) { return null; }
}
export function forgetOf(storage, game) { try { storage.removeItem(SAVE_PREFIX + game + '.v1'); } catch (_) { /* none */ } }
