// What "better" means for V01D: product metrics that track whether the system
// takes load off the owner, not just how many skills have evidence.
//
//   node tools/better.mjs           compute + write domains/void.better.json
//   node tools/better.mjs --json    print only
//
// Metrics (all from repo / public mirrors, no behaviour tracking of visitors):
//   ask_throughput   Void's own asks from voice that a growth-ledger entry built
//                    in the last 7d vs total open/queued Void asks in that window
//   miss_conversion  recent bench misses that are no longer missed (covered)
//   friction         failing + barely-checked skills from families.json
//   queue_lag_hours  median hours queued→building or queued→live from queue mirror
//   probe_yield      from /api/probe-log style stats if present in tools/probe stats file
//
// Trend: better | same | worse vs the previous void.better.json snapshot.
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = resolve(root, 'domains', 'void.better.json');
const DAY = 864e5;

function read(rel) {
  try { return readFileSync(resolve(root, rel), 'utf8'); } catch (_) { return ''; }
}
function readJson(rel) {
  try { return JSON.parse(read(rel)); } catch (_) { return null; }
}

/** Pure: parse voice "current asks" bullet lines. */
export function parseVoiceAsks(voiceMd) {
  const out = [];
  const section = String(voiceMd || '').split(/## Void's current asks/i)[1] || '';
  const block = section.split(/## /)[0] || '';
  for (const line of block.split('\n')) {
    const m = line.match(/^\s*-\s+(.+?)\s*(?:\(.*?\))?\s*`?(ask-[a-z0-9-]+)?`?\s*$/i);
    if (!m) continue;
    const ask = m[1].replace(/\*\(small\)\*/gi, '').replace(/\*$/, '').trim();
    if (ask.length < 8 || /^_/.test(ask)) continue;
    out.push({ ask, id: m[2] || '', small: /\*\(small\)\*/i.test(line) || /\(small\)/i.test(line) });
  }
  return out;
}

/** Pure: growth ledger entries that credit Void asks (asked field or "asked by Void" in what). */
export function builtAskIds(ledger) {
  const ids = new Set();
  for (const e of Array.isArray(ledger) ? ledger : []) {
    if (Array.isArray(e.asked)) for (const a of e.asked) if (a && a.id) ids.add(a.id);
    if (typeof e.what === 'string' && /asked by void/i.test(e.what) && e.at) ids.add('at:' + String(e.at).slice(0, 10));
  }
  return ids;
}

/** Pure: friction counts from families.json shape. */
export function frictionCounts(fam) {
  const all = ((fam && fam.families) || []).flatMap((f) => (f.skills || []).filter((s) => s && s.name));
  const failing = all.filter((s) => Array.isArray(s.failing) && s.failing.length).length;
  const unsure = all.filter((s) => (s.tier === 'experiment' || s.tier === 'tested') && !(s.failing && s.failing.length)).length;
  return { failing, unsure, total: all.length };
}

/** Pure: median lag in hours from queue mirror rows that left queued. */
export function queueLagHours(rows, now = Date.now()) {
  const hours = [];
  for (const r of rows || []) {
    if (!r.asked) continue;
    const start = Date.parse(r.asked);
    if (!Number.isFinite(start)) continue;
    if (r.state === 'queued') {
      hours.push((now - start) / 36e5);
      continue;
    }
    if (r.state === 'building' || r.state === 'live' || r.state === 'needs-you') {
      // without updated timestamp, lag is asked→now when still building; when live, still useful as upper bound
      hours.push((now - start) / 36e5);
    }
  }
  if (!hours.length) return null;
  hours.sort((a, b) => a - b);
  const mid = Math.floor(hours.length / 2);
  return Math.round((hours.length % 2 ? hours[mid] : (hours[mid - 1] + hours[mid]) / 2) * 10) / 10;
}

export function parseQueueMirror(md) {
  const rows = [];
  for (const line of String(md || '').split(/\r?\n/)) {
    const t = line.trim();
    if (!t.startsWith('|')) continue;
    const cells = t.split('|').slice(1, -1).map((c) => c.trim());
    if (cells.length < 4) continue;
    const [id, target, state, asked] = cells;
    if (!id || /^-+$/.test(id) || id.toLowerCase() === 'id') continue;
    rows.push({ id, target, state, asked, note: cells[4] || '' });
  }
  return rows;
}

/** Pure: compare two score snapshots → better | same | worse. */
export function trendOf(cur, prev) {
  if (!prev || !prev.scores) return 'same';
  let score = 0;
  const a = cur.scores, b = prev.scores;
  if (a.ask_throughput != null && b.ask_throughput != null) {
    if (a.ask_throughput > b.ask_throughput + 0.05) score += 1;
    else if (a.ask_throughput < b.ask_throughput - 0.05) score -= 1;
  }
  if (a.friction_total != null && b.friction_total != null) {
    if (a.friction_total < b.friction_total) score += 1;
    else if (a.friction_total > b.friction_total) score -= 1;
  }
  if (a.queue_lag_hours != null && b.queue_lag_hours != null) {
    if (a.queue_lag_hours < b.queue_lag_hours * 0.9) score += 1;
    else if (a.queue_lag_hours > b.queue_lag_hours * 1.1) score -= 1;
  }
  if (a.probe_yield != null && b.probe_yield != null) {
    if (a.probe_yield > b.probe_yield + 0.05) score += 1;
    else if (a.probe_yield < b.probe_yield - 0.05) score -= 1;
  }
  return score > 0 ? 'better' : score < 0 ? 'worse' : 'same';
}

export function computeBetter({ voice, ledger, fam, queueMd, probeStats, prev, now = Date.now() } = {}) {
  const asks = parseVoiceAsks(voice);
  const built = builtAskIds(ledger);
  const openAsks = asks.filter((a) => a.id && !built.has(a.id));
  const builtRecent = (Array.isArray(ledger) ? ledger : []).filter((e) => {
    const t = Date.parse(e && e.at);
    return Number.isFinite(t) && now - t < 7 * DAY && (e.kind === 'grow' || e.kind === 'build') &&
      (Array.isArray(e.asked) && e.asked.length || /asked by void/i.test(String(e.what || '')));
  }).length;
  const ask_throughput = asks.length ? Math.round((builtRecent / Math.max(asks.length, 1)) * 1000) / 1000 : null;

  const fr = frictionCounts(fam);
  const queueRows = parseQueueMirror(queueMd);
  const queue_lag_hours = queueLagHours(queueRows, now);
  const queued = queueRows.filter((r) => r.state === 'queued').length;

  let probe_yield = null;
  if (probeStats && typeof probeStats.rate === 'number') probe_yield = probeStats.rate / 100;
  else if (probeStats && probeStats.proposed > 0) probe_yield = Math.round((probeStats.passed / probeStats.proposed) * 1000) / 1000;

  const scores = {
    ask_throughput,
    open_void_asks: openAsks.length,
    built_void_asks_7d: builtRecent,
    friction_failing: fr.failing,
    friction_unsure: fr.unsure,
    friction_total: fr.failing + fr.unsure,
    queue_lag_hours,
    queue_queued: queued,
    probe_yield,
  };

  const cur = { at: new Date(now).toISOString(), scores, small_eligible: asks.filter((a) => a.small && a.id && !built.has(a.id)).map((a) => ({ id: a.id, ask: a.ask })) };
  cur.trend = trendOf(cur, prev);
  cur.summary = cur.trend === 'better'
    ? 'V01D is better than last check on the product metrics that matter.'
    : cur.trend === 'worse'
      ? 'V01D is worse than last check: throughput, friction, lag or probe yield slipped.'
      : 'V01D is about the same as last check.';
  cur.means = {
    ask_throughput: 'share of current Void asks that led to a grow/build ledger line in 7 days',
    friction_total: 'failing + barely-checked skills from families.json',
    queue_lag_hours: 'median hours items sit on the build queue',
    probe_yield: 'share of self-probe fix proposals that passed every check',
  };
  return cur;
}

export function run({ write = true } = {}) {
  const voice = read('domains/void.voice.md');
  const ledger = readJson('void-live-deploy/void.growth.json') || [];
  const fam = readJson('void-live-deploy/skills/families.json');
  const queueMd = read('domains/void.queue.md');
  const probeStats = (readJson('tools/probe-stats.json') || {}).stats || readJson('tools/probe-stats.json');
  const prev = readJson('domains/void.better.json');
  const cur = computeBetter({ voice, ledger, fam, queueMd, probeStats, prev });
  if (write) writeFileSync(OUT, JSON.stringify(cur, null, 2) + '\n');
  return cur;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const jsonOnly = process.argv.includes('--json');
  const cur = run({ write: !jsonOnly });
  if (jsonOnly) console.log(JSON.stringify(cur, null, 2));
  else {
    console.log(`better: trend=${cur.trend} open_void_asks=${cur.scores.open_void_asks} friction=${cur.scores.friction_total} lag_h=${cur.scores.queue_lag_hours} → ${OUT}`);
    console.log(cur.summary);
  }
}
