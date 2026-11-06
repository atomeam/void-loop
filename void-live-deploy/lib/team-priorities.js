// Verse's Priorities step (owner, 2026-11-03: "Verse sets priorities, not Atom"): every queued or building job and every open want is scored
// by expected impact (revenue, exam-score gain, user-facing breakage, Tower easiest-first progress) divided by effort, times confidence.
// The top 1-3 are the week's bets; the #work queue is handed out in that order; the WIP cap is 3 build lanes and 1 research lane. The owner
// overrides with one message ("priority: <job>" puts a job first, "drop: <job>" sends it last, "priority: reset" clears). Pure: the reads
// and writes are lib/team-crew-run.js prioritize and functions/api/team.js handOut.
import { kindOf } from './team.js';
import { leverageOf } from './team-leverage.js';

export const WIP = Object.freeze({ build: 3, research: 1 });
export const BETS_MAX = 3;
export const OVERRIDE_MS = 7 * 864e5; // an owner override lasts a week unless the owner says otherwise
const EFFORT = { heal: 1, flake: 1, review: 1, gap: 2, will: 2, voice: 2, auto: 2, versus: 3, feature: 3, novelty: 3 };
const RESEARCH = /\b(research|investigate|survey|study|compare|find out|explore|benchmark)\b/i;

/** research or build: a novelty job, a want from the idea or radar lane, or an ask that is a study */
export const laneOf = (j, w) => (kindOf(j.target) === 'novelty' || (w && ['idea', 'radar'].includes(w.lane)) || RESEARCH.test(String(j.ask || '')) ? 'research' : 'build');
const tries = (note) => { const m = /\btries (\d+)/.exec(String(note || '')); return m ? Number(m[1]) : 0; };
const r2 = (x) => Math.round(x * 100) / 100;

/** one job's score with the parts that made it, so the brief can say why. j: a void_queue row; w: its want (void_team_wants row) or null;
 * ev: { tower } (shorts per floor for easiest-first). -> { id, score, impact, effort, confidence, lane, drivers: [..], evidence: [..] } */
export function scoreOf(j, w, ev = {}) {
  const kind = kindOf(j.target), ask = String(j.ask || ''), drivers = [], evidence = [];
  let impact = 1, confidence = 0.5;
  const weight = new Map(), add = (n, why) => { impact = Math.max(impact, n); drivers.push(why); weight.set(why, n); };
  if (w) {
    confidence = 0.9; let cite = []; try { cite = JSON.parse(w.cite || '[]'); } catch (_) { cite = []; }
    if (!w.private) for (const c of cite.slice(0, 2)) if (c && /^https:\/\//.test(c.url || '')) evidence.push({ what: c.what || c.url, url: c.url });
    const base = Number(w.baseline);
    if (w.lane === 'page' || w.lane === 'link') add(w.lane === 'page' ? 9 : 7, 'user-facing breakage: ' + w.title);
    else if (w.lane === 'exam') add(Math.min(8, 2 + (Number.isFinite(base) ? (100 - base) / 8 : 2)), 'exam-score gain: ' + w.label + (Number.isFinite(base) ? ' is ' + base : ''));
    else if (w.lane === 'tower') add(Math.max(2, 7 - (Number.isFinite(base) ? base : 3)), 'Tower easiest-first: ' + (Number.isFinite(base) ? base + ' aspect' + (base === 1 ? '' : 's') + ' short' : 'a floor short'));
    else if (w.lane === 'revenue') add(8, 'revenue: no verified sale this month');
    else if (w.lane === 'miss') add(6, 'missed asks: visitors asked and got nothing');
    else add(3, w.title);
  }
  if (kind === 'heal' || kind === 'flake') add(kind === 'heal' ? 8 : 5, 'breakage: a red check or a broken page');
  if (/\b(store|gumroad|buy|checkout|price|pricing|subscribe|sale|revenue|pro plan)\b/i.test(ask)) add(7, 'revenue: it touches what Verse sells');
  if (kind === 'gap') add(5, 'exam-score gain: an answer Verse got wrong');
  if (kind === 'versus') {
    const floor = /versus:(?:floor-)?([^\s:]+)/.exec(String(j.target || '')), f = floor && ev.tower && ev.tower.floors ? ev.tower.floors[floor[1]] : null;
    const short = f ? Object.values(f).filter((a) => !['better', 'equal-and-better'].includes(a && a.verdict)).length : null;
    add(short == null ? 3 : Math.max(2, 7 - short), 'Tower easiest-first' + (short == null ? '' : ': ' + short + ' aspect' + (short === 1 ? '' : 's') + ' short'));
  }
  if (/^team-\d+$/.test(j.id)) { add(5, 'asked in #work by the owner'); confidence = Math.max(confidence, 0.8); }
  if (/^ask-\d+$/.test(j.id)) add(3, 'filed by a member in #work');
  // leverage (lib/team-leverage.js): what it unblocks, what it earns, the smallest site first; a repeat of shipped work or pure churn falls
  const L = leverageOf(j, ev, ev.now || Date.now());
  for (const [n, why] of L.add) add(n, why);
  drivers.sort((a, b) => (weight.get(b) || 0) - (weight.get(a) || 0)); // the strongest reason first, so a card's first words say it
  let mult = 1; for (const [f, why] of L.mult) { mult *= f; drivers.unshift(why); } // a repeat or churn says so before anything else
  if (!drivers.length) drivers.push('a ' + kind + ' job with no measured outcome yet');
  const effort = (EFFORT[kind] || 3) + (ask.length > 300 ? 1 : 0) + tries(j.note);
  confidence = Math.max(0.1, confidence - 0.15 * tries(j.note));
  return { id: j.id, ask: ask.slice(0, 200), kind, state: j.state, want: w ? w.key : null, lane: laneOf(j, w), impact: r2(impact), effort, confidence: r2(confidence), score: r2(impact * confidence / effort * mult), drivers, evidence, busywork: L.busywork };
}

/** an owner message that sets a priority -> { pin } | { drop } | { reset } | null */
export function overrideOf(body) {
  const m = /^\s*(priority|prioritize|first|drop|deprioritize|later)\s*[:\s]\s*(\S+)/i.exec(String(body || ''));
  if (!m) return null;
  const id = m[2].replace(/[.,;]+$/, '');
  if (/^(reset|clear|none)$/i.test(id)) return { reset: true };
  if (!/^[\w.:-]{1,80}$/.test(id)) return null;
  return /^(drop|deprioritize|later)$/i.test(m[1]) ? { drop: id } : { pin: id };
}
/** the override kept: the newest message wins per job; reset clears; a week old is gone */
export function mergeOverride(old, o, now) {
  const cur = old && now - (old.at || 0) < OVERRIDE_MS ? old : { pin: [], drop: [] };
  if (o.reset) return { pin: [], drop: [], at: now };
  const id = o.pin || o.drop, pin = cur.pin.filter((x) => x !== id), drop = cur.drop.filter((x) => x !== id);
  return o.pin ? { pin: [id, ...pin].slice(0, 5), drop, at: now } : { pin, drop: [id, ...drop].slice(0, 20), at: now };
}

/** rank everything; pick the bets; the hand-out order. -> { order: [id], bets: [scored], ranked: [scored], sig } */
export function prioritize(jobs, wants, ev = {}, override = null, now = Date.now()) {
  const byJob = new Map((wants || []).filter((w) => w.job).map((w) => [w.job, w]));
  const live = override && now - (override.at || 0) < OVERRIDE_MS ? override : { pin: [], drop: [] };
  const ranked = (jobs || []).filter((j) => j && ['queued', 'building'].includes(j.state)).map((j) => scoreOf(j, byJob.get(j.id), { now, ...ev }))
    .sort((a, b) => b.score - a.score || a.effort - b.effort || String(a.id).localeCompare(String(b.id)));
  for (const r of ranked) { if (live.pin.includes(r.id)) r.override = 'pinned by the owner'; if (live.drop.includes(r.id)) r.override = 'dropped by the owner'; }
  const pinned = live.pin.map((id) => ranked.find((r) => r.id === id)).filter(Boolean), dropped = ranked.filter((r) => live.drop.includes(r.id));
  const busy = ranked.filter((r) => r.busywork && !live.pin.includes(r.id) && !live.drop.includes(r.id)); // busywork goes last and is never a bet
  const rest = ranked.filter((r) => !live.pin.includes(r.id) && !live.drop.includes(r.id) && !r.busywork);
  const ordered = [...pinned, ...rest, ...dropped, ...busy];
  // the bets: pins first, then the best, within the WIP lanes (3 build, 1 research), at most 3, and none far below the best
  const bets = [], lanes = { build: 0, research: 0 }, top = rest.length ? rest[0].score : 0;
  for (const r of [...pinned, ...rest]) {
    if (bets.length >= BETS_MAX) break;
    if (lanes[r.lane] >= WIP[r.lane]) continue;
    if (!r.override && bets.length && r.score < top * 0.5) break;
    bets.push(r); lanes[r.lane]++;
  }
  const sig = bets.map((b) => b.id).join(' ') + '|' + ordered.slice(0, 12).map((r) => r.id).join(' ');
  return { order: ordered.map((r) => r.id), bets, ranked: ordered, sig, busywork: busy.map((r) => r.id) };
}

/** a job card's leverage line: the score and the reasons that made it, as an agent or the board shows it */
const whyOf = (r) => (r.busywork ? 'busywork, ' + r.busywork : r.drivers.slice(0, 2).join('; ')).slice(0, 160);
export const leverageLine = (r) => (r ? 'Leverage ' + r.score + ': ' + whyOf(r) : '');
/** the scores kept for every ranked job, so a card shows its own: { id: [score, why] } */
export const scoresOf = (ranked, max = 300) => Object.fromEntries((ranked || []).slice(0, max).map((r) => [r.id, [r.score, whyOf(r)]]));

/** the WIP cap at hand-out: may an agent start this job, with these jobs being built by agents now? */
export function wipAllows(job, building, laneById = {}) {
  const lane = laneById[job.id] || laneOf(job, null), n = building.filter((b) => (laneById[b.id] || laneOf(b, null)) === lane).length;
  return n < WIP[lane];
}

/** the pinned brief, as Verse posts it in #work */
export function briefText(p, week, why) {
  const lines = ['Verse\'s priorities for ' + week + (why ? ' (' + why + ')' : '') + '. Scored by impact (revenue, exam-score gain, breakage, Tower easiest-first) ÷ effort × confidence. WIP: ' + WIP.build + ' build lanes + ' + WIP.research + ' research lane.'];
  if (!p.bets.length) lines.push('No bet this week: nothing is on the queue.');
  p.bets.forEach((b, i) => lines.push('Bet ' + (i + 1) + ': ' + b.id + ' (' + b.lane + ', score ' + b.score + ' = impact ' + b.impact + ' × confidence ' + b.confidence + ' ÷ effort ' + b.effort + ')' + (b.override ? ' [' + b.override + ']' : '') + '. ' + b.ask
    + '\n   Why: ' + b.drivers.join('; ') + (b.evidence.length ? '\n   Evidence: ' + b.evidence.map((e) => e.what + ' ' + e.url).join(' · ') : '')));
  const next = p.ranked.filter((r) => !p.bets.includes(r)).slice(0, 5);
  if (next.length) lines.push('Then: ' + next.filter((r) => !r.busywork).map((r) => r.id + ' (' + r.score + ')').join(', ') + '.');
  if (p.busywork && p.busywork.length) lines.push('Last, as busywork (no agent gets these while better work waits): ' + p.busywork.slice(0, 6).join(', ') + '.');
  lines.push('Override with one message here: "priority: <job>" puts it first, "drop: <job>" sends it last, "priority: reset" clears.');
  return lines.join('\n');
}
