// "Verse reports" (void-live-deploy/scores/reports.js, lib/reports.js): GET /api/report?league=epl&kind=recap&id=<game id> | kind=preview&id= | kind=brief&date= | kind=week&date=<week start>
// | kind=top&date= -> { ok, headline, body, polished, label, at }. The story is built by Verse from the facts /api/scores holds (the same allowlisted league, day and id), as a
// template draft first, which is always the fallback; the free answer model may reword it, and its wording is used only when lib/reports.js validate() finds every number and
// name in it in the facts. Not a model passthrough: the caller sends no text, only a league, a kind and an id or day.
//
// WHAT A STRANGER COULD MAKE THIS DO, AND WHY IT IS BOUNDED. This is an open GET. The most a caller can do is:
//   - make Verse's server read one of the three fixed score feeds for an allowlisted league and day or a numeric id (the same bounds as /api/scores: no host, path or header chosen);
//   - cause one model call per story KEY (league + kind + game id + state, or league + day): the result is kept on the edge (a final game's recap for 7 days, a preview 30 minutes,
//     a brief an hour, a week 6 hours), so the same story is never written twice for anyone;
//   - and not more than HOUR_CAP model calls an hour and DAY_CAP a day in all, from anyone together at every location (one D1 counter, lib/daily-cap.js; no D1 means no model call); past either cap the template draft is served and says so;
//     the caller's own allowance is 20 uncached stories a minute (rateLimited(), its own bucket).
//   Nothing the caller sends reaches the model; no database, no write besides the cache.
import { rateLimited, noThink } from './answer.js';
import { models } from '../../lib/models.js';
import { scrubOut } from '../../lib/keeper.js';
import { leagueOf, dateOk, idOk, ymd, shiftDay, weekStart, readScoreboard, readStandings } from '../../lib/scores.js';
import { lookScores } from './scores.js';
import { capAll } from '../../lib/daily-cap.js';
import { tableIndex, gameFacts, draftRecap, draftPreview, briefFacts, draftBrief, weekFacts, draftWeek, topStories, validate, polishMessages, LABEL } from '../../lib/reports.js';

export const RL_MAX = 20, HOUR_CAP = 40, DAY_CAP = 600, MODEL = models('answer');
const TTL = { recap: 7 * 86400, preview: 1800, brief: 3600, week: 21600, top: 300 };
const json = (o, status = 200, extra = {}) => Response.json(o, { status, headers: extra });
const pick = (r) => (r && (r.response || (r.choices && r.choices[0] && r.choices[0].message && r.choices[0].message.content) || (r.result && r.result.response))) || '';
/** what a request asks: { league, kind, id | day } or null. Pure. */
export function askIn(url, now = Date.now()) {
  const p = new URL(url).searchParams, league = leagueOf(String(p.get('league') || '')), kind = String(p.get('kind') || '');
  if (!league || league.kind !== 'espn' || !['recap', 'preview', 'brief', 'week', 'top'].includes(kind)) return null;
  if (kind === 'recap' || kind === 'preview') { const id = String(p.get('id') || ''); return idOk(id) ? { league, kind, id } : null; }
  const day = String(p.get('date') || ymd(new Date(now)));
  return dateOk(day, now) ? { league, kind, day: kind === 'week' ? weekStart(day, league.id) : day } : null;
}
/** the facts and the template draft of one ask, from the feeds: { facts, draft, source } or null. */
export async function build(ask, fetchFn, now = Date.now()) {
  const { league, kind } = ask, look = (a) => lookScores({ league, ...a }, fetchFn, now);
  if (kind === 'recap' || kind === 'preview') {
    const [sum, st] = await Promise.all([look({ view: 'game', id: ask.id }), look({ view: 'standings' })]); if (!sum.ok || !sum.game) return null;
    const facts = gameFacts(kind, league.name, sum, st.ok ? tableIndex(st.groups) : {});
    if ((kind === 'recap') !== (facts.state === 'final')) return { mismatch: facts.state };
    return { facts, draft: kind === 'recap' ? draftRecap(facts) : draftPreview(facts), source: 'ESPN', state: facts.state };
  }
  if (kind === 'brief' || kind === 'top') {
    const day = look({ view: 'scores', day: ask.day, span: 1 }); const [d, nx, st] = await Promise.all([day, look({ view: 'scores', day: shiftDay(ask.day, 1), span: 7 }), look({ view: 'standings' })]); if (!d.ok) return null;
    if (kind === 'top') return { top: topStories(d.games), source: 'ESPN' };
    const facts = briefFacts(league.name, ask.day, d.games, nx.ok ? nx.games.filter((g) => g.state === 'pre') : [], st.ok ? tableIndex(st.groups) : {});
    return { facts, draft: draftBrief(facts), source: 'ESPN' };
  }
  const w = await look({ view: 'scores', day: ask.day, span: 7 }); if (!w.ok) return null;
  const facts = weekFacts(league.name, ask.day, w.games); return { facts, draft: draftWeek(facts), source: 'ESPN' };
}
// the shared ceiling on model calls: one global counter in D1 (lib/daily-cap.js), an hour key and a day key, so a burst of visitors at any location together cannot spend more than the
// caps; no D1, or a full counter, is a refusal and the template draft is served
const spend = (env, now) => capAll(env, [['sports-report:h' + Math.floor(now / 3600000), HOUR_CAP], ['sports-report', DAY_CAP]], now).then((r) => r.ok);
export async function polish(env, facts, draft) {
  const r = await env.AI.run(MODEL, { messages: polishMessages(facts, draft), max_tokens: 220, chat_template_kwargs: { enable_thinking: false }, reasoning_effort: 'low' });
  const text = scrubOut(noThink(pick(r)), env).replace(/\s+/g, ' ').trim(); return validate(text, facts).ok ? text : null;
}
export async function onRequestGet({ request, env, fetchFn = fetch }) {
  const u = new URL(request.url), ask = askIn(request.url);
  if (!ask) return json({ ok: false, kind: 'missing', say: 'Ask for a league, a kind (recap, preview, brief, week, top) and a game id or a day.' }, 400);
  const cache = typeof caches !== 'undefined' ? caches.default : null, key = new Request(u.origin + '/__void-report/' + ask.league.id + '/' + ask.kind + '/' + (ask.id || ask.day));
  if (cache) { try { const hit = await cache.match(key); if (hit) return json({ ...(await hit.json()), cached: true }, 200, { 'cache-control': 'public, max-age=60' }); } catch (_) {} }
  if (await rateLimited(request, env || {}, 'report', RL_MAX)) return json({ ok: false, kind: 'limited', say: 'That is a lot of stories in a minute. Give it a moment.' }, 429);
  const now = Date.now(), b = await build(ask, fetchFn, now);
  if (!b) return json({ ok: false, kind: 'away', say: 'The score feed did not answer just now.' }, 502, { 'cache-control': 'no-store' });
  if (b.mismatch) return json({ ok: false, kind: 'state', say: ask.kind === 'recap' ? 'That game has not finished, so there is no recap yet.' : 'That game is already under way or finished, so there is no preview.' }, 409, { 'cache-control': 'no-store' });
  const at = new Date(now).toISOString();
  if (ask.kind === 'top') { const o = { ok: true, kind: 'top', stories: b.top, source: b.source, at }; if (cache) { try { await cache.put(key, new Response(JSON.stringify(o), { headers: { 'cache-control': 'max-age=' + TTL.top } })); } catch (_) {} } return json(o, 200, { 'cache-control': 'public, max-age=60' }); }
  let polished = null, capped = false;
  if (cache && env && env.AI && String(env.VOID_ANSWER_MODELS || '').trim().toLowerCase() !== 'off') {
    if (await spend(env, now)) { try { polished = await polish(env, b.facts, b.draft); } catch (_) { polished = null; } } else capped = true;
  }
  const o = { ok: true, kind: ask.kind, headline: b.draft.headline, body: polished || b.draft.body, polished: !!polished, capped, label: LABEL(b.source, at.slice(11, 16) + ' UTC'), source: b.source, at, state: b.state };
  const ttl = capped ? 120 : TTL[ask.kind]; // a draft served because the cap was hit is kept only briefly, so the polished story can replace it
  if (cache) { try { await cache.put(key, new Response(JSON.stringify(o), { headers: { 'cache-control': 'max-age=' + ttl } })); } catch (_) {} }
  return json(o, 200, { 'cache-control': 'public, max-age=60' });
}
