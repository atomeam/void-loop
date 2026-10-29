// The first live external rung for the "Out in the world" family (owner, 2026-10-16; Verse's own reflection: "turn those 3 tested
// skills into 3 proven ones by actually interacting with external APIs or real-world data"). Once a day, from GitHub's network, the
// rides family asks a real routing service one real question: how long is the drive from SFO to downtown San Francisco right now.
// The service is the public OSRM demo router (router.project-osrm.org): no key, no account, no person in the loop. The answer is
// kept as an artifact (findings/rides/<date>T<hhmm>.json: the request, the status, how long it took, a short excerpt of the response,
// attempt "live" and the occasion number) and as one `finding` line in the growth ledger pointing at it. Success is both at once:
// the call answered with a route AND the finding was written. This is the "tested against a live service" rung, not "proven":
// proven still means a real outcome (a ride booked, a meal delivered), which none of these services offers an API for today.
//   node tools/rides-live.mjs              call, write the artifact, append the ledger line (the workflow commits both)
//   node tools/rides-live.mjs --dry        call and print the record, write nothing
// Exit 0 when the call answered with a route, 1 when it answered without one, 3 when the service could not be reached.
import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync } from 'node:fs';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
export const DIR = join(root, 'findings', 'rides');
export const SERVICE = 'OSRM public demo router (router.project-osrm.org)';
// SFO terminal curb to Union Square: longitude,latitude pairs, the order OSRM reads them in
export const FROM = { name: 'SFO', lon: -122.3790, lat: 37.6213 }, TO = { name: 'Union Square, San Francisco', lon: -122.4075, lat: 37.7880 };
export const url = (a = FROM, b = TO) => `https://router.project-osrm.org/route/v1/driving/${a.lon},${a.lat};${b.lon},${b.lat}?overview=false&alternatives=false&steps=false`;

/** The record of one live call. Pure: the fetch result goes in, the artifact comes out. */
export function recordOf({ status, body, ms, error = '', at = new Date().toISOString(), occasion = 1 }) {
  const r = body && Array.isArray(body.routes) && body.routes[0];
  const ok = status === 200 && !!body && body.code === 'Ok' && !!r && r.duration > 0 && r.distance > 0;
  return {
    attempt: 'live', occasion, at, family: 'life', skill: 'rides', service: SERVICE,
    ask: 'how long is the drive from ' + FROM.name + ' to ' + TO.name + ' right now',
    request: url(), status: status || 0, ms: Math.round(ms || 0), ok,
    answer: ok ? { minutes: Math.round(r.duration / 60), km: Math.round(r.distance / 100) / 10 } : null,
    excerpt: body ? { code: body.code || null, routes: Array.isArray(body.routes) ? body.routes.length : 0, duration_s: r ? Math.round(r.duration) : null, distance_m: r ? Math.round(r.distance) : null } : null,
    error: ok ? '' : String(error || (body && (body.message || body.code)) || ('HTTP ' + status)).replace(/\s+/g, ' ').slice(0, 200),
  };
}

/** The ledger line for a record: one plain sentence, what happened and where the artifact is. */
export const artifactName = (rec) => rec.at.slice(0, 13) + rec.at.slice(14, 16) + '.json';
export const ledgerWhat = (rec) => rec.ok
  ? `rides tested against a live service${rec.occasion > 1 ? ', occasion ' + rec.occasion : ' for the first time'}: asked ${rec.service} for the drive from ${FROM.name} to ${TO.name} and got a route back, ${rec.answer.minutes} min and ${rec.answer.km} km, in ${rec.ms} ms; attempt live, no key, no person in the loop (artifact findings/rides/${artifactName(rec)})`
  : `rides asked ${rec.service} for the drive from ${FROM.name} to ${TO.name} and got no route (${rec.error}); attempt live, occasion ${rec.occasion} (artifact findings/rides/${artifactName(rec)})`;

/** The occasion number: one more than the artifacts already kept. */
export const nextOccasion = (dir = DIR) => (existsSync(dir) ? readdirSync(dir).filter((f) => /^\d{4}-\d\d-\d\dT\d{4}\.json$/.test(f)).length : 0) + 1;

export async function callOnce(fetchFn = fetch) {
  const t0 = Date.now();
  try {
    const res = await fetchFn(url(), { headers: { 'user-agent': 'a2m-rides-live/1.0 (https://a-to-mind.com)', accept: 'application/json' }, signal: AbortSignal.timeout(15000) });
    let body = null; try { body = await res.json(); } catch (_) { body = null; }
    return { status: res.status, body, ms: Date.now() - t0 };
  } catch (e) { return { status: 0, body: null, ms: Date.now() - t0, error: (e && (e.cause && e.cause.code || e.name || e.message)) || 'unreachable' }; }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const dry = process.argv.includes('--dry');
  const res = await callOnce();
  const rec = recordOf({ ...res, occasion: nextOccasion() });
  console.log(JSON.stringify(rec, null, 1));
  if (!dry && res.status) {
    mkdirSync(DIR, { recursive: true });
    const file = join(DIR, artifactName(rec));
    writeFileSync(file, JSON.stringify(rec, null, 1) + '\n');
    const ref = 'https://github.com/atomeam/void-loop/blob/main/findings/rides/' + artifactName(rec);
    const g = spawnSync(process.execPath, [join(root, 'tools', 'grow.mjs'), 'finding', ledgerWhat(rec), '--by', 'rides-live', '--ref', ref], { encoding: 'utf8' });
    if (g.status !== 0) { console.error('rides-live: the ledger line was not written: ' + (g.stderr || g.stdout).slice(0, 200)); process.exit(1); }
    console.log('### rides, live\n\n| What | |\n|:--|:--|\n| service | ' + rec.service + ' |\n| answered with a route | ' + (rec.ok ? 'yes' : 'no') + ' |\n| time | ' + rec.ms + ' ms |\n| answer | ' + (rec.ok ? rec.answer.minutes + ' min, ' + rec.answer.km + ' km' : rec.error) + ' |\n| occasion | ' + rec.occasion + ' |');
  }
  process.exit(!res.status ? 3 : rec.ok ? 0 : 1);
}
