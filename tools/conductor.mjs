// The conductor (tools/conductor-core.mjs decides; this file reads and acts). Every 10 minutes grow-clock.yml runs one tick:
//   node tools/conductor.mjs tick [--dry] [--state <file>]
// It reads the build queue (owner token, VOID_OWNER_TOKEN), the newest runs of each loop (GH_TOKEN, the workflow's own token), and what it
// handed out earlier (the state file, domains/conductor.json by default), then: puts back jobs a dead run left `building`, sets aside jobs
// tried MAX_TRIES times, queues a `heal:<workflow>` job for a loop that failed three runs in a row, claims and starts the most valuable job
// for each idle executor, and starts probe-asks when Verse should write new probe asks. --dry reads and plans but changes nothing.
// A tick never fails the clock: every error is a warning in the summary and the tick ends with exit 0. Playbook: docs/playbooks/conductor.md.
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import { plan, probeDue, growDue, willDue, lapDue, kindOf, triesOf, withTries, streakOf, ROUTES, AGENT, LAP } from './conductor-core.mjs';

const API = process.env.VOID_API || 'https://a-to-mind.com/api/queue';
const REPO = process.env.GITHUB_REPOSITORY || 'atomeam/void-loop';
const args = process.argv.slice(2), DRY = args.includes('--dry');
const STATE = (() => { const i = args.indexOf('--state'); return i >= 0 ? args[i + 1] : 'domains/conductor.json'; })();
// the loops watched for health: every executor, plus the loops the rest stand on (a broken one gets a heal: job)
export const WATCH = [...new Set([...Object.values(ROUTES).map((r) => r.wf), AGENT, LAP, 'probe-asks.yml', 'tower-self.yml', 'tower-gate.yml', 'deploy.yml',
  'grow-self.yml', 'will.yml', 'learn.yml', 'review-main.yml', 'traffic.yml', 'jobs-snapshot.yml', 'coins-snapshot.yml', 'void-voice.yml', 'earn-self.yml'])];
const BUSY = new Set(['queued', 'in_progress', 'waiting', 'requested', 'pending']);
const warnings = [];
const warn = (m) => { warnings.push(m); console.log('::warning title=Conductor::' + m); };

async function queue(method, body, query = '') {
  const token = process.env.VOID_OWNER_TOKEN;
  if (!token) throw new Error('VOID_OWNER_TOKEN is not set');
  const res = await fetch(API + query, { method, headers: { authorization: 'Bearer ' + token, 'content-type': 'application/json', 'user-agent': 'a2m-conductor/1' }, body: body ? JSON.stringify(body) : undefined });
  const text = await res.text();
  let json = null; try { json = JSON.parse(text); } catch (_) { /* a refusal is plain text */ }
  return { status: res.status, json, text };
}
const gh = (...a) => execFileSync('gh', a, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], timeout: 60000 });
function runsOf(wf) {
  try { return JSON.parse(gh('api', `repos/${REPO}/actions/workflows/${wf}/runs?branch=main&per_page=10`)).workflow_runs || []; }
  catch (e) { if (/HTTP 404|Not Found/i.test(String(e.stderr || e.message))) return null; warn(wf + ': runs unreadable (' + String(e.message).slice(0, 80) + ')'); return []; }
}
function todayOf(wf, day) {
  try { return JSON.parse(gh('api', `repos/${REPO}/actions/workflows/${wf}/runs?created=>=${day}&per_page=1`)).total_count || 0; } catch (_) { return 0; }
}
function start(wf, input, id) {
  const a = ['workflow', 'run', wf, '--repo', REPO, '--ref', 'main'];
  if (input && id) a.push('-f', `${input}=${id}`);
  gh(...a);
}

async function tick() {
  const now = Date.now(), day = new Date(now).toISOString().slice(0, 10);
  const state = (() => { try { return JSON.parse(fs.readFileSync(STATE, 'utf8')); } catch (_) { return {}; } })();
  const handed = Object.fromEntries(Object.entries(state.handed || {}).filter(([, t]) => now - t < 24 * 3600000));
  const open = await queue('GET', null, '?state=queued,building&limit=500');
  if (open.status !== 200 || !open.json) { warn('the queue answered ' + open.status + ' (' + open.text.slice(0, 80) + '); nothing started this tick'); return finish(state, now, null); }
  const jobs = open.json.items || [];
  const closed = await queue('GET', null, '?state=failed,done&limit=500');
  const recent = (closed.json && closed.json.items || []).filter((j) => kindOf(j.target) === 'probe' && now - Date.parse(j.updated || 0) < 24 * 3600000);
  const wf = {}, runs = {};
  for (const f of WATCH) {
    const r = runsOf(f);
    if (r === null) { wf[f] = { exists: false }; continue; }
    runs[f] = r;
    const s = streakOf(r);
    wf[f] = { exists: true, busy: r.some((x) => BUSY.has(x.status)), today: 0, fails: s.fails, url: s.url, last: r[0] ? Date.parse(r[0].created_at) : 0 };
  }
  for (const r of Object.values(ROUTES)) if (wf[r.wf] && wf[r.wf].exists && !('counted' in wf[r.wf])) { wf[r.wf].today = todayOf(r.wf, day); wf[r.wf].counted = true; }
  // the kill switch is a file in the repository the clock checks out each tick (domains/verse-loop.pause): while it exists the coder takes no job
  const paused = fs.existsSync('domains/verse-loop.pause');
  for (const f of [AGENT, LAP]) if (wf[f] && wf[f].exists) wf[f].paused = paused;
  const p = plan({ jobs, wf, handed, now });
  const done = { started: [], requeued: [], setAside: [], healed: [], probe: false };
  const act = async (label, fn) => { if (DRY) return true; try { return await fn(); } catch (e) { warn(label + ': ' + String(e.message || e).slice(0, 120)); return false; } };
  for (const r of p.requeue) if (await act('requeue ' + r.id, async () => (await queue('PATCH', { id: r.id, state: 'queued', note: r.note })).status === 200)) done.requeued.push(r.id);
  for (const r of p.setAside) if (await act('set aside ' + r.id, async () => (await queue('PATCH', { id: r.id, state: 'set aside', note: r.note })).status === 200)) done.setAside.push(r.id);
  for (const h of p.heal) {
    const target = ('heal:' + h.wf).slice(0, 40), ask = `Repair ${h.wf}: ${h.fails} failed runs in a row on main, the latest ${h.url}`.slice(0, 200);
    if (await act('heal ' + h.wf, async () => (await queue('POST', { ask, target })).status === 200)) done.healed.push(h.wf);
  }
  for (const s of p.start) {
    const ok = await act('start ' + s.id, async () => {
      if (s.claims) {
        const c = await queue('PATCH', { id: s.id, state: 'building', from: 'queued', by: 'conductor' });
        if (c.status !== 200) { warn(s.id + ' not claimed (' + c.status + ')'); return false; }
      }
      try { start(s.wf, s.input, s.id); } catch (e) {
        if (s.claims) { const j = jobs.find((x) => x.id === s.id) || {}; await queue('PATCH', { id: s.id, state: 'queued', note: withTries(j.note, triesOf(j.note), 'not started: ' + String(e.message).slice(0, 60)) }); }
        throw e;
      }
      if (!s.claims) handed[s.id] = now;
      return true;
    });
    if (ok) done.started.push({ id: s.id, kind: s.kind, wf: s.wf, score: s.score });
  }
  const probes = (runs['probe-asks.yml'] || []);
  const due = wf['probe-asks.yml'] && wf['probe-asks.yml'].exists && !wf['probe-asks.yml'].busy && probeDue({
    openProbes: jobs.filter((j) => kindOf(j.target) === 'probe' && j.state === 'queued').length,
    done24: recent.filter((j) => j.state === 'done').length, failed24: recent.filter((j) => j.state === 'failed').length,
    lastProbeRunMs: probes[0] ? Date.parse(probes[0].created_at) : 0, now });
  if (due && await act('probe-asks', async () => { start('probe-asks.yml'); return true; })) done.probe = true;
  // a proving pass (grow-self.yml) at most every 2 hours: it locks in asks Verse answers right and queues the ones it misses as fixes
  const grow = wf['grow-self.yml'] || {};
  if (growDue({ exists: grow.exists, busy: grow.busy, lastRunMs: grow.last, now }) && await act('grow-self', async () => { start('grow-self.yml'); return true; })) done.grow = true;
  // Verse's will every hour (will.yml: three fresh wants, the top one to the queue); its own schedule comes hours late
  const will = wf['will.yml'] || {};
  if (willDue({ exists: will.exists, busy: will.busy, lastRunMs: will.last, now }) && await act('will', async () => { start('will.yml'); return true; })) done.will = true;
  // nothing for the coder to take from the queue: a lap of the Verse loop (red checks, the top of docs/NEXT.md, grooming) at most hourly
  const lapWf = wf[LAP] || {}, lapRuns = runs[LAP] || [];
  if (lapDue({ exists: lapWf.exists, busy: lapWf.busy || (wf[AGENT] || {}).busy, started: done.started.some((s) => s.wf === AGENT), paused, lastRunMs: lapWf.last, now })
    && await act('verse-loop', async () => { start(LAP); return true; })) done.lap = true;
  void lapRuns;
  // the site's own clock (void-tick.yml, a chain like this one) is started again when no run of it is going or waiting
  const siteClock = runsOf('void-tick.yml');
  if (siteClock && !siteClock.some((x) => BUSY.has(x.status)) && await act('void-tick', async () => { start('void-tick.yml'); return true; })) done.revived = ['void-tick.yml'];
  return finish({ ...state, handed }, now, { open: jobs.length, held: p.held, wf, done });
}

function finish(state, now, t) {
  const at = new Date(now).toISOString();
  const tick = t ? { at, open: t.open, started: t.done.started, requeued: t.done.requeued.length, setAside: t.done.setAside.length, healed: t.done.healed, probe: t.done.probe, grow: !!t.done.grow, will: !!t.done.will, lap: !!t.done.lap, revived: t.done.revived || [], held: t.held.length, warnings: warnings.length }
    : { at, error: warnings[0] || 'no plan', warnings: warnings.length };
  const ticks = [...(state.ticks || []), tick].filter((x) => now - Date.parse(x.at) < 24 * 3600000).slice(-200);
  const day = { ticks: ticks.length, started: ticks.reduce((n, x) => n + ((x.started || []).length), 0), requeued: ticks.reduce((n, x) => n + (x.requeued || 0), 0),
    setAside: ticks.reduce((n, x) => n + (x.setAside || 0), 0), probes: ticks.filter((x) => x.probe).length, errors: ticks.filter((x) => x.error).length };
  const broken = t ? Object.entries(t.wf).filter(([, s]) => s.exists && s.fails >= 3).map(([f, s]) => ({ wf: f, fails: s.fails, url: s.url })) : (state.broken || []);
  const out = { about: 'What the conductor (tools/conductor.mjs, every 10 minutes from grow-clock.yml) did: the last 24 hours of ticks, loops it found broken, and the jobs it handed to executors that claim for themselves. Counts and job ids only.',
    updated: at, last24h: day, broken, held: t ? t.held.slice(0, 20) : (state.held || []), handed: state.handed || {}, ticks };
  if (!DRY) { fs.mkdirSync(STATE.replace(/\/[^/]*$/, '') || '.', { recursive: true }); fs.writeFileSync(STATE, JSON.stringify(out, null, 1) + '\n'); }
  const lines = [`### Conductor ${at}${DRY ? ' (dry run)' : ''}`, t ? `open jobs ${t.open}; started ${t.done.started.map((s) => `${s.kind}:${s.id}→${s.wf}`).join(', ') || 'none'}; requeued ${t.done.requeued.length}; set aside ${t.done.setAside.length}; repairs queued ${t.done.healed.join(', ') || 'none'}; probe asks ${t.done.probe ? 'started' : 'not due'}; Verse loop lap ${t.done.lap ? 'started' : 'not due'}; proving pass ${t.done.grow ? 'started (locks in asks Verse answers right, queues the ones it misses as fixes)' : 'not due'}` : 'no plan: ' + (warnings[0] || ''),
    t && t.held.length ? 'held: ' + [...new Set(t.held.map((h) => h.why))].slice(0, 6).join('; ') : '', broken.length ? 'broken loops: ' + broken.map((b) => `${b.wf} (${b.fails})`).join(', ') : 'no broken loops',
    `last 24 h: ${day.started} started, ${day.requeued} put back, ${day.setAside} set aside, ${day.probes} probe runs, ${day.errors} ticks without a plan`].filter(Boolean);
  console.log(lines.join('\n'));
  if (process.env.GITHUB_STEP_SUMMARY) fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, lines.join('\n\n') + '\n');
  return out;
}

if (import.meta.url === `file://${process.argv[1]}` && args[0] === 'tick') tick().catch((e) => { warn('tick: ' + String(e.message || e).slice(0, 160)); finish({}, Date.now(), null); }).finally(() => process.exit(0));
