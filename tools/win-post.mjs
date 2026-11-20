#!/usr/bin/env node
// The showcase step: posts Verse's biggest verified-live quality win to its X account, @addumm (the owner said Verse may post there on its own).
//   node tools/win-post.mjs [--dry]
// Needs four repo secrets for that account (an X developer app with Read and Write, user tokens for @addumm):
//   X_API_KEY, X_API_SECRET, X_ACCESS_TOKEN, X_ACCESS_TOKEN_SECRET
// Without them it writes the packet and says so; it never posts to any other account (it asks X who the token is first).
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { clipPrompt, readClip, scoreClip, CLIP_MIN } from '../void-live-deploy/lib/quality.js';
import { SITES } from '../void-live-deploy/lib/versus-floor.js';
import { ACCOUNT, oauth1Header, rivalWords, namesRival, caption, allowed, nextPost, reachTotals } from '../void-live-deploy/lib/win-post.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const BOARD = path.join(root, 'void-live-deploy/quality/board.json'), FILE = path.join(root, 'void-live-deploy/quality/win-posts.json');
const SITE = (process.env.QUALITY_SITE || 'https://a-to-mind.com').replace(/\/$/, '');
const read = (f, d) => { try { return JSON.parse(fs.readFileSync(f, 'utf8')); } catch { return d; } };
const creds = (env) => (env.X_API_KEY && env.X_API_SECRET && env.X_ACCESS_TOKEN && env.X_ACCESS_TOKEN_SECRET) ? { key: env.X_API_KEY, secret: env.X_API_SECRET, token: env.X_ACCESS_TOKEN, tokenSecret: env.X_ACCESS_TOKEN_SECRET } : null;

async function call(method, url, c, body, fetchFn) {
  const r = await fetchFn(url, { method, headers: { authorization: oauth1Header(method, url, c), ...(body ? { 'content-type': 'application/json' } : {}) }, body: body ? JSON.stringify(body) : undefined });
  const j = await r.json().catch(() => ({})); return { ok: r.ok, status: r.status, j };
}

/** the post picture (the live blobfish page) marked on graphics, animation, writing and humor; null when no judge saw it */
export async function judgeClip(text, env = process.env) {
  try {
    const { launch } = await import('./quality-measure.mjs'), { visionJudge } = await import('./quality-engine.mjs'), b = await launch();
    try { const c = await b.newContext({ viewport: { width: 1200, height: 675 } }), p = await c.newPage(); await p.goto(SITE + '/blub/', { waitUntil: 'load', timeout: 30000 }); await p.waitForTimeout(3500);
      const v = await visionJudge(await p.screenshot({ type: 'jpeg', quality: 85 }), 'post picture', env, fetch, 'image/jpeg', { prompt: clipPrompt(text), read: readClip }); return v ? scoreClip(v) : null; } finally { await b.close(); }
  } catch { return null; }
}

export async function run({ env = process.env, fetchFn = fetch, dry = false, now = Date.now(), judge = judgeClip, boardFile = BOARD, file = FILE } = {}) {
  const board = read(boardFile, { cycles: [] }), rec = read(file, { id: 'win-posts', about: 'Posts of verified live wins on Verse\'s own X account, and how many people saw them. Numbers and links only.', account: '@' + ACCOUNT, posts: [], reach: null, last: '' });
  const towers = fs.readdirSync(path.join(root, 'void-live-deploy')).filter((f) => /^tower\..*\.json$/.test(f)).map((f) => read(path.join(root, 'void-live-deploy', f), null));
  const c = creds(env); rec.posts = rec.posts || [];
  if (c && !dry) {   // reach first: what people did with the earlier posts
    const ids = rec.posts.filter((p) => p.id).slice(-20).map((p) => p.id);
    if (ids.length) { const g = await call('GET', 'https://api.x.com/2/tweets?' + new URLSearchParams({ ids: ids.join(','), 'tweet.fields': 'public_metrics' }).toString(), c, null, fetchFn).catch(() => null); if (g && g.ok && Array.isArray(g.j.data)) for (const t of g.j.data) { const p = rec.posts.find((x) => x.id === t.id); if (p) p.reach = t.public_metrics; } }
  }
  rec.reach = reachTotals(rec.posts);
  const cyc = nextPost(board.cycles || [], rec.posts);
  const say = (s) => { rec.last = s; if (!dry) fs.writeFileSync(file, JSON.stringify(rec) + '\n'); return { ...rec, note: s }; };
  if (!cyc) return say('no verified live win is waiting to be shared');
  const gate = allowed(rec.posts, now); if (!gate.ok) return say('holding: ' + gate.why);
  const text = caption(cyc, SITE + '/blub/');
  const hit = namesRival(text, [...rivalWords(towers), ...SITES.flatMap((s) => [s.rival, (() => { try { return new URL(s.url).hostname.replace(/^www\./, '').split('.')[0]; } catch { return ''; } })()]).filter(Boolean)]); if (hit) return say('held back: the caption names something it should not');
  if (text.length > 280) return say('held back: caption too long');
  const clip = dry ? null : await judge(text, env); rec.lastClip = clip;
  if (!dry && (clip == null || clip < CLIP_MIN)) return say('held back: ' + (clip == null ? 'no judge has seen the post picture yet' : 'the post picture scored ' + clip + ', under ' + CLIP_MIN));
  rec.channels = { x: c ? 'ready' : 'queued until X_API_KEY, X_API_SECRET, X_ACCESS_TOKEN and X_ACCESS_TOKEN_SECRET are repo secrets', youtube: 'queued until YT_REFRESH_TOKEN works for the current OAuth client (tools/youtube.mjs sends the clip then)' };
  if (!c) { rec.queued = { cycle: cyc.at, text, since: rec.queued && rec.queued.cycle === cyc.at ? rec.queued.since : new Date(now).toISOString() }; return say('queued, nothing posted yet: waiting for the X secrets'); }
  if (dry) return { note: 'would post', text };
  const me = await call('GET', 'https://api.x.com/2/users/me', c, null, fetchFn);
  if (!me.ok || String(me.j.data && me.j.data.username).toLowerCase() !== ACCOUNT) return say('refused: the token is not @' + ACCOUNT + ' (' + (me.ok ? 'another account' : 'X said ' + me.status) + ')');
  const t = await call('POST', 'https://api.x.com/2/tweets', c, { text }, fetchFn);
  if (!t.ok || !(t.j.data && t.j.data.id)) return say('X refused the post (' + t.status + ')');
  rec.posts.push({ cycle: cyc.at, id: t.j.data.id, url: 'https://x.com/' + ACCOUNT + '/status/' + t.j.data.id, text, at: new Date(now).toISOString(), gain: cyc.gain, clip, reach: null });
  rec.queued = null; rec.reach = reachTotals(rec.posts);
  return say('posted: https://x.com/' + ACCOUNT + '/status/' + t.j.data.id);
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) run({ dry: process.argv.includes('--dry') }).then((r) => { console.log(r.note || r.last); process.exit(0); }).catch((e) => { console.error(String(e && e.message || e)); process.exit(1); });
