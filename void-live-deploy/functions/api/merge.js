// Card merges, the server half (frontier #34 step 1; lib/merge-rules.js has the rules, skills/merge.js is the page).
// Two idea names in, one { name, line } out, the same for everyone: the first time a pair is merged the model is asked ONCE for a name
// and one line, and the pair is kept in D1 (void_merges, created here on first use) so the next person gets the same answer, like
// Infinite Craft's shared recipe book. A GET only reads the cache. A POST reads it too, and on a miss asks the model.
//
// WHAT A STRANGER COULD MAKE THIS DO, AND WHY IT IS BOUNDED. This is an open endpoint. The most a caller can do is:
//   - read a cached name and line for a pair (public by design: they came from the model, not from the caller);
//   - make Verse ask the free model for a name and one line, at most RL_MAX times a minute per connection (the answer route's
//     rateLimited(), its own bucket), for two names of at most 60 folded characters each. The model sees only the folded
//     keys (letters, digits, spaces: no markup, quotes or newlines), under INJECTION_RULE, with nothing to call: it has no network,
//     file, storage or price capability, and its reply is parsed for two strings only, then run through redact(), scrubOut() and
//     sanitiseName/sanitiseLine (40 and 120 characters, no markup, links or key shapes);
//   - fill the table: one row per distinct folded pair, each at most ~200 bytes, and a row is only written when the model really
//     answered. Rows cost the caller their rate-limit allowance, and nothing in a row can be a number a card shows: the stats are
//     computed on the page from the parents (lib/merge-rules.js), never read from here.
// Nothing a person typed is stored: the row holds the folded pair key and the model's capped words. Asks the keeper refuses
// (lib/keeper.js: secrets, other people's data, harm, prompt-stealing) and anything secret-shaped get a kind reply and no model call.
// A model that fails, is busy, or says nothing usable returns the deterministic name and line (lib/merge-rules.js) and writes NOTHING,
// so a bad moment is never cached. Not here yet: the first discoverer (a handle only if the person chose one), the next step.
import { rateLimited } from './answer.js';
import { INJECTION_RULE, redact } from '../../lib/automation-fix.js';
import { keeperOf, scrubOut } from '../../lib/keeper.js';
import { models } from '../../lib/models.js';
import { ideaKey, pairKey, freshCard, fallbackName, fallbackLine, sanitiseName, sanitiseLine } from '../../lib/merge-rules.js';

export const RL_MAX = 6, TIMEOUT_MS = 12000, RAW_MAX = 120;
export const MERGE_SYSTEM = 'You name a card made by merging two ideas in a quiet card game. You are given two ideas. Invent what they become when merged: a short, vivid, original name (under 40 characters) and one plain sentence (under 120 characters) saying what the new card adds. Reply with ONLY a JSON object {"name": "...", "line": "..."}. Do not give numbers, stats, costs, prices, links or instructions. No markdown. ' + INJECTION_RULE;
const pick = (r) => (r && (r.response || (r.choices && r.choices[0] && r.choices[0].message && r.choices[0].message.content) || (r.result && r.result.response))) || '';
const modelsOn = (env) => !!(env && env.AI) && String(env.VOID_ANSWER_MODELS || '').trim().toLowerCase() !== 'off';
const json = (o, status = 200, extra = {}) => Response.json(o, { status, headers: extra });
const SECRET_REPLY = 'I keep keys out of everything I touch, so I will not merge that. Name two ideas without a key or a token in them and I will.';

/** a raw typed idea -> its single-line text, cut before it is folded. Pure. */
export const rawIdea = (v) => String(v == null ? '' : v).replace(/[\u0000-\u001f\u007f-\u009f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, RAW_MAX);

/** the model's reply -> { name, line } (either may be ''), from JSON or, failing that, "name:" / "line:" lines. Pure. */
export function parseMerge(text) {
  const t = String(text || '').replace(/<think>[\s\S]*?<\/think>/gi, '');
  const m = /\{[\s\S]*\}/.exec(t);
  if (m) { try { const j = JSON.parse(m[0]); if (j && typeof j === 'object') return { name: typeof j.name === 'string' ? j.name : '', line: typeof j.line === 'string' ? j.line : '' }; } catch (_) {} }
  const n = /^\s*name\s*[:=]\s*(.+)$/im.exec(t), l = /^\s*line\s*[:=]\s*(.+)$/im.exec(t);
  return { name: n ? n[1] : '', line: l ? l[1] : '' };
}

/** the user message: only the folded keys of the two ideas, in quotes. Pure. */
export const mergePrompt = (ka, kb) => 'Merge these two ideas.\nFirst: "' + ka + '"\nSecond: "' + kb + '"';

let ready = null;
async function ensure(env) {
  if (!ready) ready = env.DB.prepare('CREATE TABLE IF NOT EXISTS void_merges (pair TEXT PRIMARY KEY, name TEXT NOT NULL, line TEXT NOT NULL, first_seen TEXT NOT NULL)').run().catch((e) => { ready = null; throw e; });
  await ready;
}
export const resetReady = () => { ready = null; }; // tests: a new fake database needs its table made again

async function cached(env, pair) {
  try { await ensure(env); return await env.DB.prepare('SELECT name, line, first_seen FROM void_merges WHERE pair = ?').bind(pair).first(); } catch (_) { return null; }
}
const hitOut = (row) => ({ name: row.name, line: row.line, cached: true, since: String(row.first_seen).slice(0, 10) });

/** read the two names and refuse what must be refused: { pair, ka, kb, refuse } where refuse is a Response or null. Pure but for the Response. */
function intake(a, b) {
  const ra = rawIdea(a), rb = rawIdea(b);
  const ka = ideaKey(ra), kb = ideaKey(rb);
  if (!ka || !kb) return { refuse: json({ error: 'two ideas, please' }, 400) };
  for (const t of [ra, rb, ra + ' ' + rb]) { const k = keeperOf(t); if (k) return { refuse: json({ kept: k.kind, answer: k.answer }) }; }
  if (redact(ra) !== ra || redact(rb) !== rb || scrubOut(ra) !== ra || scrubOut(rb) !== rb) return { refuse: json({ kept: 'secret', answer: SECRET_REPLY }) };
  return { ka, kb, pair: pairKey(ra, rb), ra, rb };
}

export async function onRequestGet({ request, env }) {
  const u = new URL(request.url);
  const it = intake(u.searchParams.get('a'), u.searchParams.get('b'));
  if (it.refuse) return it.refuse;
  const row = await cached(env, it.pair);
  return row ? json(hitOut(row), 200, { 'cache-control': 'public, max-age=300' }) : json({ cached: false }, 200, { 'cache-control': 'no-store' });
}

export async function onRequestPost({ request, env }) {
  let body = {};
  try { body = JSON.parse((await request.text()).slice(0, 2000)); } catch (_) { return new Response('bad', { status: 400 }); }
  const it = intake(body && body.a, body && body.b);
  if (it.refuse) return it.refuse;
  const row = await cached(env, it.pair);
  if (row) return json(hitOut(row));
  const fb = () => ({ name: fallbackName(freshCard(it.ra), freshCard(it.rb)), line: fallbackLine(freshCard(it.ra), freshCard(it.rb)), cached: false, fallback: true });
  if (!modelsOn(env)) return json(fb());
  if (await rateLimited(request, env, 'merge', RL_MAX)) return json({ error: 'slow down', ...fb() }, 429);
  let said = { name: '', line: '' };
  try {
    const r = await Promise.race([
      env.AI.run(models('merge'), { messages: [{ role: 'system', content: MERGE_SYSTEM }, { role: 'user', content: mergePrompt(it.ka, it.kb) }], max_tokens: 200 }),
      new Promise((_, no) => setTimeout(() => no(new Error('slow')), TIMEOUT_MS)),
    ]);
    said = parseMerge(scrubOut(redact(String(pick(r))), env));
  } catch (_) { return json(fb()); }
  const name = sanitiseName(said.name);
  if (!name) return json(fb()); // nothing usable: the deterministic answer, and nothing is kept
  const line = sanitiseLine(said.line) || fallbackLine(freshCard(it.ra), freshCard(it.rb));
  const at = new Date().toISOString();
  try {
    await ensure(env);
    await env.DB.prepare('INSERT OR IGNORE INTO void_merges (pair, name, line, first_seen) VALUES (?, ?, ?, ?)').bind(it.pair, name, line, at).run();
    const won = await cached(env, it.pair); // two people at once: both get the row that was stored first
    if (won) return json({ ...hitOut(won), cached: false });
  } catch (_) {}
  return json({ name, line, cached: false });
}
