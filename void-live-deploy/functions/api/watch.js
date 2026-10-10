// A standing watch (lib/watch.js, frontier build order step 4): one thing Void can already fetch and a condition, asked
// for in plain words. Owner token, or a paid member's session (their own watches only), the same way as /api/memory.
//   GET            -> { watches: [{ id, name, enabled, watch, tell, every, created, last: { at, matchedAt }, checks: [records] }] }
//   POST { ask, tell? }  the ask in plain words -> the watch is kept (an automation of kind watch on the 15-minute clock)
//                        and checked once now, so the card shows evidence at once -> { saved, check }
//   PATCH { id, enabled }  pause or resume · DELETE { id }  stop and forget it
// A stranger gets 401 and nothing is kept; a free account 403. Nothing is watched that was not asked for.
import { ownerOk } from '../../lib/guard.js';
import { ensureTables, session, tierOf } from '../../lib/void-me.js';
import { watchOf, TELLS } from '../../lib/watch.js';
import { watchRule } from '../../lib/automations.js';
import { list, save, get, setEnabled, remove, run, watchState } from '../../lib/automations-run.js';
import { recent } from '../../lib/actions.js';

const scopeOf = async ({ request, env }) => {
  if (await ownerOk(request, env)) return { scope: '' };
  if (!env.DB) return null;
  try {
    await ensureTables(env);
    const me = await session(request, env);
    if (!me) return null;
    return (await tierOf(env, me.userId)) === 'paid' ? { scope: me.userId } : { free: true };
  } catch (_) { return null; }
};
const guard = (fn) => async (ctx) => {
  const who = await scopeOf(ctx);
  if (!who) return new Response('no', { status: 401 });
  if (who.free) return new Response('Watches are for the owner and paid members', { status: 403 });
  if (!ctx.env.DB) return new Response('watches need the database', { status: 503 });
  try { return await fn(ctx, who.scope); } catch (e) { return Response.json({ error: 'watch error' }, { status: 500 }); }
};
const body = async (req) => { try { return JSON.parse((await req.text()).slice(0, 8000)); } catch (_) { return {}; } };
const isWatch = (r) => r.do && r.do[0] && r.do[0].action === 'watch';

async function view(env, scope) {
  const { rules } = await list(env, { scope });
  const recs = (await recent(env, { limit: 300, owner: scope || 'owner' })).filter((a) => /^watch\./.test(a.kind));
  const out = [];
  for (const r of rules.filter(isWatch)) {
    out.push({ id: r.id, name: r.name, enabled: r.enabled, watch: r.do[0].watch, tell: r.do[0].tell, every: r.when.every, created: r.created, last: await watchState(env, r.id), checks: recs.filter((a) => a.ref === r.id).slice(0, 5) });
  }
  return { watches: out };
}

export const onRequestGet = guard(async ({ env }, scope) => Response.json(await view(env, scope)));

export const onRequestPost = guard(async ({ request, env }, scope) => {
  const b = await body(request);
  const ask = watchOf(b.ask);
  if (!ask || !ask.watch) return Response.json({ error: 'say what to watch: "tell me when it\'s below 0 in Oslo", "let me know if https://… says sold out", "alert me when the price on https://… drops below 50", "tell me when it\'s 9am in Tokyo", "watch https://… for changes"' }, { status: 400 });
  const rule = watchRule(ask.watch, TELLS.includes(b.tell) ? b.tell : 'note');
  const saved = await save(env, rule, { scope });
  if (!saved.ok) return Response.json({ error: saved.errors.join(' · ') }, { status: 400 });
  // the first check now, so the card shows what Void saw; a failed fetch is a failed record, not a lost watch
  let check = null;
  try { const got = await get(env, saved.rule.id, scope); check = await run(env, got.rule, { tick: true, at: new Date().toISOString() }, 'manual'); } catch (_) {}
  return Response.json({ saved: saved.rule, check, ...(await view(env, scope)) });
});

export const onRequestPatch = guard(async ({ request, env }, scope) => {
  const b = await body(request);
  if (!b.id) return Response.json({ error: 'id missing' }, { status: 400 });
  const got = await get(env, b.id, scope);
  if (!got || !isWatch(got.rule)) return Response.json({ error: 'no such watch' }, { status: 404 });
  await setEnabled(env, b.id, !!b.enabled, scope);
  return Response.json(await view(env, scope));
});

export const onRequestDelete = guard(async ({ request, env }, scope) => {
  const b = await body(request);
  const got = b.id ? await get(env, b.id, scope) : null;
  if (!got || !isWatch(got.rule)) return Response.json({ error: 'no such watch' }, { status: 404 });
  await remove(env, b.id, scope);
  return Response.json(await view(env, scope));
});
