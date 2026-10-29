// Reviews of Verse's films (owner, 2026-10-14: "ive asked for the films to just be put on the site so i can review them . film review
// could be for owner and paying members as contributer reviewrs"). Anyone who may watch (payer() in functions/api/support.js) gives
// each film one verdict and a short note, and can change it. The owner reads every note; a member reads the totals and their own.
// A reviewer is kept as payer()'s who (an account id, or a hash naming a key or license: never the key itself).
export const VERDICTS = { post: 'Post it', fix: 'Needs work', skip: 'Skip it' };
export const NOTE_MAX = 1000;
const TABLE = 'CREATE TABLE IF NOT EXISTS void_film_reviews (film TEXT NOT NULL, who TEXT NOT NULL, verdict TEXT NOT NULL, note TEXT NOT NULL, at TEXT NOT NULL, PRIMARY KEY (film, who))';
const made = new WeakMap();
export const ready = (env) => { let p = made.get(env.DB); if (!p) { p = env.DB.prepare(TABLE).run().catch((e) => { made.delete(env.DB); throw e; }); made.set(env.DB, p); } return p; };

export async function save(env, film, who, verdict, note, now = new Date()) {
  await ready(env);
  await env.DB.prepare('INSERT INTO void_film_reviews (film, who, verdict, note, at) VALUES (?, ?, ?, ?, ?) ON CONFLICT(film, who) DO UPDATE SET verdict = excluded.verdict, note = excluded.note, at = excluded.at')
    .bind(film, who, verdict, note, now.toISOString()).run();
}

// -> { [film]: { counts: { post, fix, skip }, mine: { verdict, note, at } | null, notes?: [{ by, verdict, note, at }] } }
// notes only for the owner; "by" says owner or member, never who
export async function forFilms(env, ids, p) {
  const out = {};
  for (const id of ids) out[id] = { counts: { post: 0, fix: 0, skip: 0 }, mine: null, ...(p.owner ? { notes: [] } : {}) };
  if (!ids.length || !env.DB) return out;
  await ready(env);
  const { results } = await env.DB.prepare('SELECT film, who, verdict, note, at FROM void_film_reviews WHERE film IN (' + ids.map(() => '?').join(',') + ') ORDER BY at DESC').bind(...ids).all(); // void-review: ok (only one ? per film is pasted in; every value is bound)
  for (const r of results || []) {
    const f = out[r.film]; if (!f || !VERDICTS[r.verdict]) continue;
    f.counts[r.verdict]++;
    if (r.who === p.who) f.mine = { verdict: r.verdict, note: r.note, at: r.at };
    if (p.owner && r.note) f.notes.push({ by: r.who === 'owner' ? 'owner' : 'member', verdict: r.verdict, note: r.note, at: r.at });
  }
  return out;
}
