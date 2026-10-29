// /social/'s own half (lib/social-core.js) on top of Verse's boards (functions/api/boards/, void_boards and void_board_posts): a feed in hot, new or
// top order with each post's votes, the votes of one thread, an RSS feed per community, and a vote. Posting, replying, reporting, making a community
// and the bans stay with /api/boards and its bot check and rates; this route never writes a post.
//   GET  /api/social?feed=hot|new|top[&span=day|week|month|all][&b=code,code][&adult=1]   up to 60 live posts in that order, with votes
//   GET  /api/social?votes=<code>&t=<no>     the vote sums of a thread's posts: { no: sum }
//   GET  /api/social?rss=<code|all>          RSS 2.0: a community's (or every community's) 30 newest posts
//   POST /api/social {do: 'vote', b, no, v}  v is 1, -1 or 0 (take the vote back); one vote per post per connection, changed as often as wanted
//
// WHAT A STRANGER COULD MAKE THIS DO, AND WHY IT IS BOUNDED. An open endpoint with no account.
//   - GET: read what the boards show anyone already: live, not hidden, not deleted posts (18+ communities only when asked), sums of votes, never a
//     voter. At most 60 posts (30 in RSS) a call; the middleware caps requests per connection per minute (lib/guard.js LIMITS.social).
//   - POST a vote: move one post's score by one, on a post that exists and is shown. A closed value (1, -1, 0), a board code and a number; nothing
//     typed is stored or echoed. One row per post per connection (a keyed hash of the address, HMAC with SALT, the same hash the boards keep for
//     rates; never the address), 60 votes an hour and 400 a day per connection, 20,000 a day in all (the D1 write budget: 2 writes a vote).
//   - THAT IS NOT PREVENTED: one person with many addresses can push a post up or down, one vote per address within those rates. Scores only order a
//     feed; they decide nothing else, and the boards' reports and the owner's review still hide anything that breaks the rules.
// With no D1 or no SALT the route is off (503). Same-origin only; no CORS header. No model, no KV, no third party.
import { ipHash, shape } from './boards/[[path]].js';
import { excerpt } from '../../lib/boards.js';
import { SORTS, SPANS, sortPosts, voteOf, rss } from '../../lib/social-core.js';

export const RATES = Object.freeze({ hour: 60, day: 400, all: 20000, feed: 60, scan: 400, rss: 30 });
const json = (o, status = 200, extra = {}) => Response.json(o, { status, headers: { 'cache-control': 'no-store', ...extra } });
const off = () => json({ ok: false, say: 'the social page\'s votes are off for now' }, 503);
const CODE = /^[a-z0-9]{1,10}$/, intOf = (x) => (/^\d{1,9}$/.test(String(x || '')) ? +x : 0);

let ready = null;
async function ensure(env) {
  if (!ready) ready = (async () => {
    await env.DB.prepare('CREATE TABLE IF NOT EXISTS void_social_votes (board TEXT NOT NULL, no INTEGER NOT NULL, voter TEXT NOT NULL, v INTEGER NOT NULL, at INTEGER NOT NULL, PRIMARY KEY (board, no, voter))').run();
    await env.DB.prepare('CREATE INDEX IF NOT EXISTS void_social_votes_voter ON void_social_votes (voter, at)').run();
    await env.DB.prepare('CREATE INDEX IF NOT EXISTS void_social_votes_at ON void_social_votes (at)').run();
  })().catch((e) => { ready = null; throw e; });
  await ready;
}
export const resetReady = () => { ready = null; };
const all = async (env, sql, ...a) => (await env.DB.prepare(sql).bind(...a).all()).results || [];

async function votesFor(env, keys) { // keys: [[board, no]] -> Map('board/no' -> sum)
  const out = new Map(); if (!keys.length) return out;
  for (let i = 0; i < keys.length; i += 40) {
    const part = keys.slice(i, i + 40), where = part.map(() => '(board = ? AND no = ?)').join(' OR ');
    for (const r of await all(env, 'SELECT board, no, SUM(v) AS s FROM void_social_votes WHERE ' + where + ' GROUP BY board, no', ...part.flat())) out.set(r.board + '/' + r.no, +r.s || 0);
  }
  return out;
}

export async function onRequestGet({ request, env }) {
  const u = new URL(request.url), sp = u.searchParams;
  if (!env || !env.DB) return off();
  try {
    await ensure(env);
    if (sp.has('rss')) {
      const code = sp.get('rss'), one = code !== 'all';
      if (one && !CODE.test(code || '')) return json({ ok: false, say: 'not a community' }, 400);
      const board = one ? (await all(env, 'SELECT code, title, about, nsfw FROM void_boards WHERE code = ?', code))[0] : null;
      if (one && !board) return json({ ok: false, say: 'no such community' }, 404);
      const rows = await all(env, 'SELECT p.board, p.no, p.at, p.sub, p.body FROM void_board_posts p JOIN void_boards b ON b.code = p.board WHERE p.thread = p.no AND p.deleted = 0 AND p.hidden = 0' + (one ? ' AND p.board = ?' : ' AND b.nsfw = 0') + ' ORDER BY p.at DESC LIMIT ' + RATES.rss, ...(one ? [code] : []));
      return new Response(rss(u.origin, board, rows), { headers: { 'content-type': 'application/rss+xml; charset=utf-8', 'cache-control': 'public, max-age=600' } });
    }
    if (sp.has('votes')) {
      const code = sp.get('votes'), t = intOf(sp.get('t')); if (!CODE.test(code || '') || !t) return json({ ok: false, say: 'votes=<community>&t=<post>' }, 400);
      const rows = await all(env, 'SELECT v.no, SUM(v.v) AS s FROM void_social_votes v JOIN void_board_posts p ON p.board = v.board AND p.no = v.no WHERE v.board = ? AND p.thread = ? GROUP BY v.no', code, t);
      return json({ ok: true, votes: Object.fromEntries(rows.map((r) => [r.no, +r.s || 0])) });
    }
    const sort = SORTS.includes(sp.get('feed')) ? sp.get('feed') : 'hot', span = Object.prototype.hasOwnProperty.call(SPANS, sp.get('span')) ? sp.get('span') : 'all';
    const codes = String(sp.get('b') || '').split(',').filter((c) => CODE.test(c)).slice(0, 30), adult = sp.get('adult') === '1';
    const rows = await all(env, 'SELECT p.*, b.nsfw AS bnsfw, b.title AS btitle FROM void_board_posts p JOIN void_boards b ON b.code = p.board WHERE p.thread = p.no AND p.archived = 0 AND p.deleted = 0 AND p.hidden = 0' + (adult ? '' : ' AND b.nsfw = 0') + (codes.length ? ' AND p.board IN (' + codes.map(() => '?').join(',') + ')' : '') + ' ORDER BY ' + (sort === 'new' ? 'p.at' : 'p.bumped') + ' DESC LIMIT ' + RATES.scan, ...codes);
    const votes = await votesFor(env, rows.map((r) => [r.board, r.no]));
    const posts = rows.map((r) => ({ board: r.board, btitle: r.btitle, nsfw: !!r.bnsfw, ...shape(r, env), body: excerpt(r.body, 300), votes: votes.get(r.board + '/' + r.no) || 0 }));
    return json({ ok: true, sort, span, posts: sortPosts(posts, sort, span).slice(0, RATES.feed) });
  } catch (_) { return off(); }
}

export async function onRequestPost({ request, env, now = Date.now() }) {
  const here = new URL(request.url).origin, from = request.headers.get('origin');
  if (from && from !== here) return json({ ok: false, say: 'same-origin only' }, 403);
  if (!env || !env.DB || !env.SALT) return off();
  let d; try { d = JSON.parse((await request.text()).slice(0, 400)); } catch (_) { return json({ ok: false, say: 'send JSON' }, 400); }
  const b = String((d && d.b) || ''), no = intOf(d && d.no), v = voteOf(d && d.v);
  if (!d || d.do !== 'vote' || !CODE.test(b) || !no || v === null) return json({ ok: false, say: 'a vote is {do: "vote", b, no, v: 1, -1 or 0}' }, 400);
  try {
    await ensure(env);
    const p = (await all(env, 'SELECT no FROM void_board_posts WHERE board = ? AND no = ? AND deleted = 0 AND hidden = 0', b, no))[0];
    if (!p) return json({ ok: false, say: 'that post is not here' }, 404);
    const voter = await ipHash(request, env);
    const mine = (await all(env, 'SELECT SUM(CASE WHEN at > ? THEN 1 ELSE 0 END) AS hour, COUNT(*) AS day FROM void_social_votes WHERE voter = ? AND at > ?', now - 3600e3, voter, now - 864e5))[0] || {};
    if ((+mine.hour || 0) >= RATES.hour || (+mine.day || 0) >= RATES.day) return json({ ok: false, say: 'that is a lot of votes from one place: take a break' }, 429, { 'retry-after': '3600' });
    const allDay = (await all(env, 'SELECT COUNT(*) AS n FROM void_social_votes WHERE at > ?', now - 864e5))[0];
    if (allDay && +allDay.n >= RATES.all) return json({ ok: false, say: 'votes are full for today' }, 429, { 'retry-after': '3600' });
    if (v === 0) await env.DB.prepare('DELETE FROM void_social_votes WHERE board = ? AND no = ? AND voter = ?').bind(b, no, voter).run();
    else await env.DB.prepare('INSERT INTO void_social_votes (board, no, voter, v, at) VALUES (?, ?, ?, ?, ?) ON CONFLICT(board, no, voter) DO UPDATE SET v = excluded.v, at = excluded.at').bind(b, no, voter, v, now).run();
    const s = (await all(env, 'SELECT COALESCE(SUM(v), 0) AS s FROM void_social_votes WHERE board = ? AND no = ?', b, no))[0];
    return json({ ok: true, b, no, v, votes: +(s && s.s) || 0 });
  } catch (_) { return off(); }
}
