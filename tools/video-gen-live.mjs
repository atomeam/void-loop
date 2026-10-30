// The video-gen skill against the live site (Verse's daily reflection, 2026-10-30: "Address the least-checked skills: video-gen and baggage";
// the owner pasted that card the same day). Every six hours, from GitHub's network, this reads what the skill's card reads: GET /api/clip on
// a-to-mind.com (whether video is on, why not, when Verse last tested the partner video model) and the /video/ page the card links to. The
// read itself spends nothing: when video is off and the last test is over six hours old, the GET starts the route's own self-check, one
// 1 second draft clip inside PROBE_DAILY_USD ($0.02 a day, lib/video-gen.js), so this schedule also makes sure the self-check runs on time
// even with no visitors. The answer is kept as an artifact (findings/video-gen/<date>T<hhmm>.json: what each read said, how long it took,
// attempt "live", the occasion number) and as one `finding` line in the growth ledger pointing at it.
// checksPass means the live path the card stands on works and tells the truth: /api/clip answers a known state with its own words, its last
// test is under FRESH_HOURS old, and /video/ is served with its state line, its Make button and its hand-off tag. `ok` (the field the family
// rating in tools/families.mjs counts as a live finding) is checksPass AND video on: a check while video is off proves the card tells the
// truth, not that the skill makes clips, so it never raises the rating. `why` says the model's reason (credits: no AI Gateway credits yet).
//   node tools/video-gen-live.mjs              read, write the artifact, append the ledger line (the workflow commits both)
//   node tools/video-gen-live.mjs --dry        read and print the record, write nothing
// Exit 0 when the checks pass (video on or off), 1 when the site answered but something is wrong, 3 when the site could not be reached.
import { writeFileSync, existsSync, mkdirSync, readdirSync } from 'node:fs';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { SAYS, PER_CONN } from '../void-live-deploy/lib/video-gen.js';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
export const DIR = join(root, 'findings', 'video-gen');
export const SITE = (process.env.SITE || 'https://a-to-mind.com').replace(/\/$/, '');
export const SERVICE = 'a-to-mind.com /api/clip and /video/ (the partner video model behind them on Workers AI)';
export const FRESH_HOURS = 7, SETTLE_MS = 60000;

/** what one GET /api/clip said, checked against the route's contract. Pure. */
export function apiProblem(a, now) {
  if (!a || a.status !== 200 || !a.body) return 'GET /api/clip answered ' + ((a && a.status) || 'nothing');
  const b = a.body;
  if (typeof b.on !== 'boolean') return 'no on field';
  if (b.on) return Number.isInteger(b.clipsLeft) && b.clipsLeft >= 0 && b.why === 'ok' ? '' : 'on, but no clips-left count';
  if (!Object.hasOwn(SAYS, b.why) || b.say !== SAYS[b.why]) return 'off with an unknown reason (' + String(b.why).slice(0, 20) + ')';
  const at = Date.parse(b.checkedAt || '');
  if (!Number.isFinite(at)) return 'off, and Verse has never tested the video maker';
  if (now - at > FRESH_HOURS * 3600e3) return 'the last test is ' + Math.round((now - at) / 3600e3) + ' hours old (the self-check should run every 6)';
  return '';
}
/** what the /video/ page served, checked for the parts the card links to. Pure. */
export function pageProblem(p) {
  if (!p || p.status !== 200) return 'GET /video/ answered ' + ((p && p.status) || 'nothing');
  const missing = ['state', 'make', 'handoff'].filter((k) => !p[k]);
  return missing.length ? '/video/ has no ' + missing.join(', ') : '';
}
export const pageOf = (status, html) => ({ status, state: html.includes('id="state"'), make: html.includes('id="make"'), handoff: /<meta name="verse-handoff"/.test(html), bytes: html.length });

/** The record of one live check. Pure: the reads go in, the artifact comes out. first: the first GET; last: the read the result stands on. */
export function recordOf({ first, last, page, ms = 0, error = '', at = new Date().toISOString(), occasion = 1 }) {
  const now = Date.parse(at), read = last || first, b = (read && read.body) || {};
  const problem = error || apiProblem(read, now) || pageProblem(page);
  return {
    attempt: 'live', occasion, at, family: 'make', skill: 'video-gen', service: SERVICE,
    ask: 'is AI video on at a-to-mind.com right now, and does the video page serve',
    request: [SITE + '/api/clip', SITE + '/video/'], status: (read && read.status) || 0, ms: Math.round(ms), checksPass: !problem, ok: !problem && b.on === true,
    video: b.on === true ? 'on' : b.on === false ? 'off' : null, why: typeof b.why === 'string' ? b.why.slice(0, 20) : null,
    lastTest: typeof b.checkedAt === 'string' ? b.checkedAt.slice(0, 24) : null, startedSelfCheck: !!(first && first.body && first.body.checking),
    clipsLeft: Number.isInteger(b.clipsLeft) ? b.clipsLeft : null, perConnection: Number.isInteger(b.perConnection) ? b.perConnection : PER_CONN,
    page: page ? { status: page.status, state: !!page.state, make: !!page.make, handoff: !!page.handoff } : null,
    error: problem ? String(problem).replace(/\s+/g, ' ').slice(0, 200) : '',
  };
}

export const artifactName = (rec) => rec.at.slice(0, 13) + rec.at.slice(14, 16) + '.json';
const whyWords = { credits: 'the partner video model says the account has no AI Gateway credits yet', unchecked: 'no test has run yet', failed: 'the video model did not answer its last test', cap: 'the day\'s video budget is used up', off: 'video is switched off on this deploy' };
/** The ledger line for a record: one plain sentence, what happened and where the artifact is. */
export const ledgerWhat = (rec) => {
  const where = ' (artifact findings/video-gen/' + artifactName(rec) + ')';
  if (!rec.checksPass) return 'video-gen live check found a problem on a-to-mind.com: ' + rec.error + '; attempt live, occasion ' + rec.occasion + where;
  const state = rec.video === 'on' ? 'video is on, ' + rec.clipsLeft + ' clips left today' : 'video is off: ' + (whyWords[rec.why] || rec.why);
  return 'video-gen checked against the live site' + (rec.occasion > 1 ? ', occasion ' + rec.occasion : ' for the first time') + ': ' + state
    + '; Verse last tested the video model at ' + rec.lastTest + (rec.startedSelfCheck ? ' (this check started that test)' : '') + ', and /video/ is served' + where;
};

/** The occasion number: one more than the artifacts already kept. */
export const nextOccasion = (dir = DIR) => (existsSync(dir) ? readdirSync(dir).filter((f) => /^\d{4}-\d\d-\d\dT\d{4}\.json$/.test(f)).length : 0) + 1;

const HEAD = { 'user-agent': 'a2m-video-gen-live/1.0 (https://a-to-mind.com)' };
export async function readApi(fetchFn = fetch, site = SITE) {
  const res = await fetchFn(site + '/api/clip', { headers: { ...HEAD, accept: 'application/json' }, cache: 'no-store', signal: AbortSignal.timeout(20000) });
  let body = null; try { body = await res.json(); } catch (_) { body = null; }
  return { status: res.status, body };
}
/** one live check: read /api/clip; if that read started the self-check, wait and read again; then read /video/ */
export async function checkOnce(fetchFn = fetch, wait = (ms) => new Promise((r) => setTimeout(r, ms)), site = SITE) {
  const t0 = Date.now();
  try {
    const first = await readApi(fetchFn, site);
    let last = first;
    if (first.body && first.body.checking) { await wait(SETTLE_MS); last = await readApi(fetchFn, site); }
    const res = await fetchFn(site + '/video/', { headers: HEAD, cache: 'no-store', signal: AbortSignal.timeout(20000) });
    const page = pageOf(res.status, await res.text());
    return { first, last, page, ms: Date.now() - t0 };
  } catch (e) { return { first: null, last: null, page: null, ms: Date.now() - t0, error: 'unreachable: ' + ((e && (e.cause && e.cause.code || e.name || e.message)) || 'error') }; }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const dry = process.argv.includes('--dry');
  const res = await checkOnce();
  const rec = recordOf({ ...res, occasion: nextOccasion() });
  console.log(JSON.stringify(rec, null, 1));
  if (!dry && rec.status) {
    mkdirSync(DIR, { recursive: true });
    writeFileSync(join(DIR, artifactName(rec)), JSON.stringify(rec, null, 1) + '\n');
    const ref = 'https://github.com/atomeam/void-loop/blob/main/findings/video-gen/' + artifactName(rec);
    const g = spawnSync(process.execPath, [join(root, 'tools', 'grow.mjs'), 'finding', ledgerWhat(rec), '--by', 'video-gen-live', '--ref', ref], { encoding: 'utf8' });
    if (g.status !== 0) { console.error('video-gen-live: the ledger line was not written: ' + (g.stderr || g.stdout).slice(0, 200)); process.exit(1); }
    console.log('### video-gen, live\n\n| What | |\n|:--|:--|\n| checks pass | ' + (rec.checksPass ? 'yes' : 'no: ' + rec.error) + ' |\n| video | ' + (rec.video || 'unknown') + (rec.why && rec.video === 'off' ? ' (' + rec.why + ')' : '') + ' |\n| last test of the video model | ' + (rec.lastTest || 'none') + ' |\n| this check started a test | ' + (rec.startedSelfCheck ? 'yes' : 'no') + ' |\n| /video/ served | ' + (rec.page && !pageProblem(rec.page) ? 'yes' : 'no') + ' |\n| time | ' + rec.ms + ' ms |\n');
  }
  process.exit(!rec.status ? 3 : rec.checksPass ? 0 : 1);
}
