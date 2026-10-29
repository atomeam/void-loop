#!/usr/bin/env node
// A novelty score for the fringe ledger, and a growth-inbox proposal when a run's behavior matches no skill (asked by Verse: "Create a
// 'novelty score' for skills that triggers a growth inbox proposal whenever a behavior is logged in the fringe ledger that doesn't match
// an existing skill pattern"). The score is 0 to 1: the share of a run's behavior words that NO single skill's pattern (its name and
// its example asks) holds; 0 means one skill already says it all, 1 means no skill says any of it. A run at or over NOVEL becomes one
// `novelty:<family>-<run>` job at /api/queue (the owner token, as tools/review-main.mjs queues `review:<skill>` jobs): one open at a time,
// a run never queued twice, the words the run's own research note (public in tools/fringe.json), never a visitor's. The build is still a
// builder's; the job names the closest skill so the builder knows whether to extend it or write a new one.
//   node tools/fringe-novelty.mjs          score, queue the first new proposal (VOID_OWNER_TOKEN; without it a quiet no-op, exit 0)
//   node tools/fringe-novelty.mjs --dry    score and print what would be queued
//   node tools/fringe-novelty.mjs --all    also queue runs older than FRESH_DAYS (the default is a behavior just logged)
//   node tools/fringe-novelty.mjs --list   every scored run, most novel first
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { words, nearOf } from './fringe.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
export const SITE = process.env.VOID_SITE || 'https://a-to-mind.com';
export const PREFIX = 'novelty:';
export const NOVEL = 0.8;
export const FRESH_DAYS = 3; // a behavior just logged: older runs are scored and listed, never queued by themselves (--all)

/** what a run says it does: its behavior, else its hypothesis, else its lab card, else its first source's claim. Pure. */
export function behaviorOf(r) {
  if (!r) return '';
  if (typeof r.behavior === 'string' && r.behavior.trim()) return r.behavior.trim();
  if (typeof r.hypothesis === 'string' && r.hypothesis.trim()) return r.hypothesis.trim();
  if (r.lab && r.lab.sub) return (r.lab.label ? r.lab.label + '. ' : '') + r.lab.sub;
  return (r.sources && r.sources[0] && r.sources[0].claim) || '';
}
/** a skill's pattern: the words of its name and its example asks. Pure. */
export const patternOf = (skill) => new Set(words([skill && skill.name, ...((skill && skill.examples) || [])].filter(Boolean).join(' ')));

/** { score, skill, shared }: 1 minus the largest share of the behavior's words any one skill's pattern holds. `patterns`: { skill: Set }. Pure. */
export function noveltyOf(text, patterns) {
  const w = words(text); if (w.length < 3) return null;
  let best = 0, skill = '', shared = [];
  for (const [name, set] of Object.entries(patterns)) {
    const hit = w.filter((x) => set.has(x)), c = hit.length / w.length;
    if (c > best) { best = c; skill = name; shared = hit; }
  }
  return { score: Math.round((1 - best) * 100) / 100, skill, shared };
}
/** every run scored: [{ run, family, score, skill, text }], most novel first. Pure. */
export function scoreRuns(runs, patterns) {
  return (runs || []).map((r) => { const text = behaviorOf(r), n = text ? noveltyOf(text, patterns) : null; return n ? { run: r.run, family: r.family, at: String(r.at || '').slice(0, 10), ...n, text, near: nearOf(r) } : null; })
    .filter(Boolean).sort((a, b) => b.score - a.score || b.run - a.run);
}
export function jobOf(s) {
  const id = (s.family + '-' + s.run).slice(0, 40 - PREFIX.length);
  return {
    target: PREFIX + id,
    ask: ('novelty ' + s.score.toFixed(2) + ' · fringe run ' + s.run + ' (' + s.family + '): ' + s.text + (s.skill ? ' [closest skill: ' + s.skill + ']' : '') + (s.near.length ? ' [input: ' + s.near.join(', ') + ']' : '')).slice(0, 200),
    note: 'A behavior logged in the fringe ledger that no skill pattern holds (tools/fringe-novelty.mjs; asked by Verse). Extend the closest skill, or write a new one with tools/new-skill.mjs.',
  };
}
/** what to queue: the most novel run at or over `bar` whose job is not in the queue yet, while no novelty job is open. Pure. */
export function plan(scored, queue, bar = NOVEL, { today = new Date().toISOString().slice(0, 10), all = false } = {}) {
  const items = (queue && queue.items) || [];
  const open = items.filter((i) => i && String(i.target || '').startsWith(PREFIX) && /^(queued|building)$/.test(i.state));
  const seen = new Set(items.map((i) => i && i.target));
  const young = (s) => all || !s.at || (Date.parse(today) - Date.parse(s.at)) / 864e5 <= FRESH_DAYS;
  const jobs = scored.filter((s) => s.score >= bar && young(s)).map(jobOf), fresh = jobs.filter((j) => !seen.has(j.target));
  return { open: open.length, found: jobs.length, fresh, queue: open.length ? [] : fresh.slice(0, 1) };
}

export async function loadPatterns(dir = resolve(root, 'void-live-deploy/skills')) {
  const names = JSON.parse(readFileSync(resolve(dir, 'index.json'), 'utf8')), out = {};
  for (const n of names) { try { out[n] = patternOf((await import(pathToFileURL(resolve(dir, n + '.js')).href)).default); } catch (_) {} }
  return out;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2), dry = args.includes('--dry');
  const scored = scoreRuns(JSON.parse(readFileSync(resolve(root, 'tools/fringe.json'), 'utf8')), await loadPatterns());
  if (args.includes('--list')) { for (const s of scored) console.log(s.score.toFixed(2) + '  run ' + String(s.run).padEnd(4) + s.family.padEnd(30) + (s.skill ? '~' + s.skill : '').padEnd(18) + s.text.slice(0, 80)); console.log(scored.filter((s) => s.score >= NOVEL).length + ' of ' + scored.length + ' at or over ' + NOVEL); process.exit(0); }
  const tok = (process.env.VOID_OWNER_TOKEN || process.env.VOID_MISSES_TOKEN || '').trim();
  if (!tok && !dry) { console.log('fringe-novelty: no VOID_OWNER_TOKEN, nothing queued (' + scored.filter((s) => s.score >= NOVEL).length + ' novel runs)'); process.exit(0); }
  const api = async (path, method = 'GET', body) => {
    const res = await fetch(SITE + path, { method, headers: { 'user-agent': 'a2m-fringe-novelty/1.0', ...(tok ? { authorization: 'Bearer ' + tok } : {}), ...(body ? { 'content-type': 'application/json' } : {}) }, ...(body ? { body: JSON.stringify(body) } : {}), signal: AbortSignal.timeout(30000) });
    if (!res.ok) throw new Error(path + ' answered ' + res.status);
    return res.json();
  };
  let q = { items: [] };
  try { if (tok) q = await api('/api/queue'); } catch (e) { console.error('fringe-novelty: could not read the queue: ' + e.message); if (!dry) process.exit(2); }
  const p = plan(scored, q, NOVEL, { all: args.includes('--all') }), queued = [];
  if (!dry) for (const job of p.queue) {
    try { const r = await api('/api/queue', 'POST', { ask: job.ask, target: job.target }), it = r.item || {}; if (it.id && it.ask === job.ask) { await api('/api/queue', 'PATCH', { id: it.id, note: job.note }); queued.push(job); } }
    catch (e) { console.error('fringe-novelty: could not queue ' + job.target + ': ' + e.message); }
  }
  console.log('fringe-novelty: ' + p.found + ' novel run(s), ' + p.fresh.length + ' not queued before, ' + p.open + ' open; queued ' + (dry ? 'none (dry)' : queued.map((j) => j.target).join(', ') || 'none'));
  if (dry && p.queue.length) console.log('would queue: ' + p.queue[0].target + ' · ' + p.queue[0].ask);
}
