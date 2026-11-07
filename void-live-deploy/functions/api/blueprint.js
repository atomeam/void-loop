// A blueprint's build, started and shown on its card (the owner asked on 2026-11-06 for every blueprint to build into Verse by itself).
// lib/watch-build.js has the why and the pure half; skills/system-blueprint.js is the card.
//   GET  ?idea=<the blueprint's idea>  -> { slug, state, line, page?, pr? }   what is real about its build now
//   POST { idea }                      -> the same, after starting the build when it has not started
// A build starts only for an idea Verse wrote itself (an idea note it learned from TV or radio, /api/watchalong). The job's words come from
// that stored note (lib/watch-build.js jobOf), never from the request, so a stranger can make Verse build only what Verse already chose to;
// someone's own typed blueprint stays a plan (state "plan"). The job goes on the same tv: lane the watch build uses (one idea, one job,
// whichever way it started), and the queue keeps one open job per target. What a stranger can make this do: read the state of one tv: job
// (its state and pull request number, never its note) and start at most one job for a note Verse wrote, 20 calls a minute per connection.
import { rateLimited } from './answer.js';
import { readNotes } from './watchalong.js';
import { track } from '../../lib/actions.js';
import { ideaAskFromNote } from '../../lib/watch-along.js';
import { noteOfIdea, targetOf, slugOf, scoreIdea, skipOf, buildState, planAll, CATEGORIES, jobOf } from '../../lib/watch-build.js';

export const PER_MIN = 20;
const json = (body, status = 200) => Response.json(body, { status, headers: { 'cache-control': 'no-store' } });
const ideaOf = (s) => String(s == null ? '' : s).replace(/[\u0000-\u001f\u007f]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 280);
// the category pages a build may fold into (lib/watch-build.js CATEGORIES): every one of them is a page on the site (tools/blueprint-build.test.mjs)
const PAGES = CATEGORIES.map((c) => ({ route: c.route, title: c.route }));

async function builtLog(env, origin) {
  if (!env.ASSETS) return [];
  try { const r = await env.ASSETS.fetch(new Request(new URL('/tv-built.json', origin))); if (!r.ok) return []; const j = await r.json(); return Array.isArray(j.builds) ? j.builds : []; }
  catch (_) { return []; }
}
const rowOf = (env, target) => env.DB.prepare('SELECT state, note, updated FROM void_queue WHERE target = ? ORDER BY updated DESC LIMIT 1').bind(target).first().catch(() => null);

/** what is real about one idea's build: { slug, state, line, page?, pr?, note?, target? }. note and target are kept for start(), never sent. */
export async function stateOf(env, origin, idea) {
  const slug = slugOf(idea);
  const [built, notes] = await Promise.all([builtLog(env, origin), env.DB ? readNotes(env, { kind: 'idea', limit: 200 }).catch(() => []) : []]);
  const note = noteOfIdea(notes, idea, ideaAskFromNote), key = note ? slugOf(note.topic || note.note) : slug, target = note ? targetOf(note) : 'tv:' + slug;
  const row = env.DB ? await rowOf(env, target) : null;
  return { slug: key, ...buildState({ slug: key, built, row, verse: !!note, skip: note ? skipOf(scoreIdea(note)) : '' }), _note: note, _target: target };
}

/** start the build of a blueprint Verse wrote: one tv: job, its words from the stored note, written with its execution record. */
async function start(env, s) {
  const plan = planAll([s._note], { pages: PAGES })[0];
  if (!plan) return false;
  const job = jobOf(plan), at = new Date().toISOString(), id = Date.now().toString(36);
  const open = await env.DB.prepare("SELECT id FROM void_queue WHERE target = ? AND state IN ('queued','building') LIMIT 1").bind(job.target).first();
  if (open) return true;
  await track(env, { owner: 'verse', kind: 'queue.add', ref: job.target }, async () => {
    await env.DB.prepare('INSERT INTO void_queue (id, ask, target, state, note, at, updated) VALUES (?, ?, ?, ?, ?, ?, ?)').bind(id, job.ask, job.target, 'queued', 'started from its blueprint card', at, at).run();
    return 'queued ' + id + ': ' + job.ask;
  });
  return true;
}

const shown = ({ _note, _target, ...s }) => s;

export async function onRequestGet({ request, env }) {
  const u = new URL(request.url), idea = ideaOf(u.searchParams.get('idea'));
  if (idea.length < 8) return json({ error: 'name the blueprint: ?idea=<its idea>' }, 400);
  if (await rateLimited(request, env, 'blueprint', PER_MIN)) return json({ error: 'That is a lot in a minute. Give me a moment.' }, 429);
  try { return json(shown(await stateOf(env, u.origin, idea))); } catch (_) { return json({ error: 'the build state did not load just now' }, 502); }
}

export async function onRequestPost({ request, env }) {
  let body; try { body = await request.json(); } catch (_) { return json({ error: 'send JSON: { idea }' }, 400); }
  const idea = ideaOf(body && body.idea), origin = new URL(request.url).origin;
  if (idea.length < 8) return json({ error: 'name the blueprint: { idea }' }, 400);
  if (await rateLimited(request, env, 'blueprint', PER_MIN)) return json({ error: 'That is a lot in a minute. Give me a moment.' }, 429);
  try {
    let s = await stateOf(env, origin, idea);
    if (s.state === 'starting' && env.DB && await start(env, s)) s = await stateOf(env, origin, idea);
    return json(shown(s));
  } catch (_) { return json({ error: 'the build did not start just now' }, 502); }
}
