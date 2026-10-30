// brain-dream: Verse Brain's dream loop on the server side (owner, 2026-10-30: "Verse can use its brain to come up with ideas and jobs and
// fixes ... it can dream"). Every few hours (.github/workflows/brain-dream.yml) it reads what the brain's watch reads (lib/brain-host.js
// watchNow: the newest runs on main, the open pull requests and issues of the public repository, Verse's will), adds the frontier drafts
// the brain left out (lib/brain-drafts.json), and turns them into dreams (lib/brain-dream.js). The first dream not posted before goes to
// /team/ #work as a post by Verse with its full brief, where it is a job on the build queue (functions/api/team.js 'dream'). One a run at
// most; the server also keeps a day's limit and leaves room for the owner's own asks. Nothing a visitor typed is read here.
//   node tools/brain-dream.mjs           post the next dream (needs VOID_OWNER_TOKEN; without it, a quiet no-op)
//   node tools/brain-dream.mjs --dry     print the dreams and the one it would post, post nothing
import { readFileSync } from 'node:fs';
import * as Dream from '../void-live-deploy/lib/brain-dream.js';
import * as Watch from '../void-live-deploy/lib/brain-watch.js';
import * as S from '../void-live-deploy/skills/status.js';

const SITE = process.env.VOID_SITE || 'https://a-to-mind.com';
const API = 'https://api.github.com/repos/' + S.REPO;

/** fetch with the GitHub token when one is there (more reads an hour); never sent to any other host. */
const fetchFn = (u, o = {}) => {
  const h = { ...(o.headers || {}) }, t = process.env.GH_TOKEN || process.env.GITHUB_TOKEN;
  if (t && String(u).startsWith('https://api.github.com/')) h.authorization = 'Bearer ' + t;
  return fetch(u, { ...o, headers: h });
};
const json = async (u, o) => { try { const r = await fetchFn(u, o); return r.ok ? await r.json() : null; } catch (_) { return null; } };

/** what the brain remembers, read now: { breaks, prs, issues, decision, drafts, at }. */
export async function memory(read = json, at = Date.now()) {
  const [rows, inc, prs, issues, will] = await Promise.all([S.buildState(fetchFn).catch(() => null), read(SITE + '/incidents.json'), read(API + '/pulls?state=open&per_page=50'), read(API + '/issues?state=open&per_page=50'), read(SITE + '/api/will')]);
  const W = Watch.createWatch();
  Watch.takeIn(W, Watch.observe({ rows: rows ? S.causesOf(rows, inc) : null, prs: Array.isArray(prs) ? prs : null, issues: Array.isArray(issues) ? issues : null, will }, at), at);
  const drafts = JSON.parse(readFileSync(new URL('../void-live-deploy/lib/brain-drafts.json', import.meta.url), 'utf8')).drafts;
  return { breaks: Watch.breaksOf(W), prs: Array.isArray(prs) ? prs : [], issues: Array.isArray(issues) ? issues : [], decision: Watch.decisionOf(will), drafts, at };
}

/** the keys of the dreams already in #work (the owner's search of the workspace). */
export async function posted(H) {
  const r = await fetch(SITE + '/api/team?c=work&q=' + encodeURIComponent('Dream key'), { headers: H });
  if (!r.ok) throw new Error('the team workspace answered HTTP ' + r.status);
  const j = await r.json(); return Dream.keysIn((j.hits || []).map((m) => m.body));
}

if (process.argv[1] && process.argv[1].endsWith('brain-dream.mjs')) {
  const dry = process.argv.includes('--dry'), tok = process.env.VOID_OWNER_TOKEN;
  if (!dry && !tok) { console.log('no VOID_OWNER_TOKEN: nothing to do'); process.exit(0); }
  const dreams = Dream.dreamsOf(await memory());
  const H = tok ? { authorization: 'Bearer ' + tok, 'content-type': 'application/json' } : null;
  const had = H ? await posted(H) : new Set(), next = Dream.nextDream(dreams, had);
  console.log(dreams.length + ' dream' + (dreams.length === 1 ? '' : 's') + ', ' + had.size + ' posted before');
  for (const d of dreams) console.log((had.has(d.key) ? '  posted ' : '  ') + d.kind + ' ' + d.key + ': ' + d.title);
  if (!next) { console.log('nothing new to post'); process.exit(0); }
  if (dry) { console.log('\nwould post:\n' + Dream.briefOf(next)); process.exit(0); }
  const r = await fetch(SITE + '/api/team', { method: 'POST', headers: H, body: JSON.stringify({ do: 'dream', key: next.key, body: Dream.briefOf(next) }) });
  const j = await r.json().catch(() => ({}));
  console.log('HTTP ' + r.status + ': ' + (j.say || (j.had ? 'posted before' : j.job ? 'posted, on the build queue as ' + j.job : 'posted')));
  if (!r.ok && r.status !== 429) process.exit(1);
}
