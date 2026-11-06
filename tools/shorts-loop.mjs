#!/usr/bin/env node
// Verse's Shorts get better on real outcomes (owner, 2026-11-03: "it should just get better over time as well as the video quality").
// Since 2026-11-06 every film is a different kind of video about something people are watching today: each day three films, each in a
// different format of tools/studio.mjs (news parody, trailer parody, explainer, POV skit, countdown, nature parody, review parody,
// lyric video), about topics from tools/trends.mjs that pass tools/topic-gate.mjs (no small everyday sums, no harm, nothing adult, no
// repeat of the last 30 days). The formats rotate, least recently made first; once films have MIN_VIEWS views their format's outcome
// is scored, and the best-scoring format keeps one of the day's three places. The older knob trials (one Short against a challenger)
// are still judged when they have views. Every trial and verdict is logged in domains/shorts.loop.json.
//   node tools/shorts-loop.mjs plan --trends trends.json [--day YYYYMMDD]  -> today's { films: [3] } (writes the trial into the log)
//   node tools/shorts-loop.mjs plan  [--day YYYYMMDD]   -> the old knob trial { champion, challenger }
//   node tools/shorts-loop.mjs record <film.json>         -> the film's gate score into its trial
//   node tools/shorts-loop.mjs judge                     -> fetch outcomes, decide every open trial that has enough views
// Outcomes: views (/api/film-views), clicks to a-to-mind.com (/c/_stats, the owner's token VOID_OWNER_TOKEN), watch-through when the
// films page reports it (outcome.watch, 0..1). YouTube stats are added when the YT_* secrets exist (not yet).
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { KNOBS, BASE, SCENES } from './shorts.mjs';
import { ORDER as FORMATS, FORMATS as FORMAT_DEFS, fits, scriptOf, nameOf, lineChars, linesOf } from './studio.mjs';
import { topicCheck } from './topic-gate.mjs';
import { hookScore, HOOK_MIN } from './video-gate.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
export const LOG = path.join(here, '..', 'domains', 'shorts.loop.json');
export const MIN_VIEWS = 20;
const ORDER = ['hook', 'pace', 'music', 'style', 'scene'];

/** the outcome score of one film: clicks per view counts most, then watch-through. Pure. */
export function outcomeScore(o) {
  const v = Math.max(1, o.views || 0);
  return +(100 * (o.clicks || 0) / v * 3 + 100 * (o.watch || 0)).toFixed(2);
}
/** the next challenger: the knob after the last one tried, set to the next value that differs from the best. Pure. */
export function nextTrial(log, day) {
  const best = { ...BASE, scene: SCENES[0].id, ...(log.best || {}) }, last = (log.trials || []).at(-1);
  const knob = ORDER[((last ? ORDER.indexOf(last.knob) : -1) + 1) % ORDER.length];
  const values = knob === 'scene' ? SCENES.map((s) => s.id) : KNOBS[knob];
  const value = values[(values.indexOf(best[knob]) + 1) % values.length];
  const id = (v, tag) => day + '-short-' + v.scene + '-' + tag;
  return { day, knob, value, champion: { ...best, film: id(best, 'a') }, challenger: { ...best, [knob]: value, film: id({ ...best, [knob]: value }, 'b') }, verdict: 'waiting' };
}
/** decide one trial from both films' outcomes and gate scores; null while either has too few views. Pure. */
export function judge(trial, outcomes, gates) {
  const a = outcomes[trial.champion.film] || {}, b = outcomes[trial.challenger.film] || {};
  if ((a.views || 0) < MIN_VIEWS || (b.views || 0) < MIN_VIEWS) return null;
  const sa = outcomeScore(a), sb = outcomeScore(b), ga = (gates[trial.champion.film] || {}).score || 0, gb = (gates[trial.challenger.film] || {}).score || 0;
  const win = sb > sa;
  return { verdict: win ? 'challenger' : 'champion', scores: { champion: sa, challenger: sb }, gate: { champion: ga, challenger: gb }, qualityImproved: win && gb > ga };
}

export const PER_DAY = 3;
const slug = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40).replace(/-+$/, '');
/** every film the log has made or planned: [{ format, topic, day }]. Pure. */
export function madeOf(log) {
  return (log.trials || []).flatMap((t) => (t.films || []).map((f) => ({ format: f.format, topic: f.topic, day: t.day })));
}
/** each format's outcome score over its judged films (null until one has MIN_VIEWS views). Pure. */
export function formatScores(log) {
  const sum = {};
  for (const t of log.trials || []) for (const f of t.films || []) if (f.outcome && (f.outcome.views || 0) >= MIN_VIEWS) {
    const s = (sum[f.format] = sum[f.format] || { n: 0, score: 0 }); s.n++; s.score += outcomeScore(f.outcome);
  }
  return Object.fromEntries(Object.entries(sum).map(([k, v]) => [k, +(v.score / v.n).toFixed(2)]));
}
/** the order formats are tried in today: the best-scoring format first (it keeps a place), then least recently made. Pure. */
export function formatOrder(log) {
  const last = {}; for (const m of madeOf(log)) if (!last[m.format] || m.day > last[m.format]) last[m.format] = m.day;
  const byAge = FORMATS.slice().sort((a, b) => String(last[a] || '').localeCompare(String(last[b] || '')) || FORMATS.indexOf(a) - FORMATS.indexOf(b));
  const sc = formatScores(log), best = Object.keys(sc).sort((a, b) => sc[b] - sc[a])[0];
  return best ? [best, ...byAge.filter((f) => f !== best)] : byAge;
}
/** whether a script will pass the gate's word checks: the hook scores HOOK_MIN+, and no line is too long for its card. Pure. */
export function scriptOk(sc) {
  if (!sc || hookScore(sc.hook) < HOOK_MIN) return false;
  return [{ kind: 'hook', text: sc.hook }, ...sc.beats].every((b) => { const L = linesOf(b); return L.text.split('\n').length <= 9 && L.text.split('\n').every((l) => l.length <= lineChars(L.size) + 2); });
}
/** today's films: PER_DAY formats, each a different one, each about a different trend that passes the topic gate and fits the format.
 *  trends: { topics: [..] } from tools/trends.mjs. Returns { day, films: [{ format, label, topic, film, hook, topicData }], refused }. Pure. */
export function planFilms(log, trends, day, n = PER_DAY) {
  const recent = madeOf(log).map((m) => ({ topic: m.topic, day: m.day })), topics = (trends && trends.topics) || [], refused = [], used = new Set(), films = [];
  const okTopics = topics.filter((t) => { const c = topicCheck(t, recent, day); if (!c.ok) refused.push({ topic: t.topic, kinds: c.kinds, why: c.reasons.join('; ') }); return c.ok; });
  for (const format of formatOrder(log)) {
    if (films.length >= n) break;
    const t = okTopics.find((x) => !used.has(x.topic.toLowerCase()) && fits(format, x) && scriptOk(scriptOf(format, x)));
    if (!t) continue;
    used.add(t.topic.toLowerCase());
    const sc = scriptOf(format, t);
    films.push({ format, label: FORMAT_DEFS[format].label, topic: t.topic, name: nameOf(t), film: day + '-' + format + '-' + (slug(nameOf(t)) || 'trend'), hook: sc.hook, source: t.source, topicData: t });
  }
  return { day, kind: 'formats', films, refused, verdict: 'waiting' };
}
export const read = (f = LOG) => (fs.existsSync(f) ? JSON.parse(fs.readFileSync(f, 'utf8')) : { best: null, trials: [] });

async function outcomesOf(ids, site, token) {
  const views = (await (await fetch(site + '/api/film-views?ids=' + ids.join(','))).json()).views || {};
  let clicks = {};
  if (token) { try { const j = await (await fetch(site + '/c/_stats', { headers: { authorization: 'Bearer ' + token } })).json(); for (const r of j.visits || []) clicks[r.clip] = (clicks[r.clip] || 0) + Number(r.visits || 0); } catch (_) {} }
  return Object.fromEntries(ids.map((id) => [id, { views: views[id] || 0, clicks: clicks[id] || 0 }]));
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const log = read(), cmd = process.argv[2], site = process.env.VOID_SITE || 'https://a-to-mind.com';
  if (cmd === 'plan') {
    const i = process.argv.indexOf('--day'), day = i > 0 ? process.argv[i + 1] : new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const ti = process.argv.indexOf('--trends');
    if (ti > 0) { // the format studio: three films in three formats about today's trends
      const t = planFilms(log, JSON.parse(fs.readFileSync(process.argv[ti + 1], 'utf8')), day);
      // a second run on the same day replans that day instead of adding a twin
      log.trials = log.trials.filter((x) => !(x.kind === 'formats' && x.day === day && x.verdict === 'waiting'));
      log.trials.push({ ...t, films: t.films.map(({ topicData, ...f }) => f), refused: t.refused.slice(0, 12) });
      log.best = { ...(log.best || {}), formats: formatOrder(log).slice(0, 1)[0] || null, scores: formatScores(log) };
      fs.writeFileSync(LOG, JSON.stringify(log, null, 2) + '\n'); console.log(JSON.stringify(t));
      for (const f of t.films) console.error('planned ' + f.label + ' about ' + f.topic + ' (' + f.source + '): ' + f.hook);
      for (const r of t.refused.slice(0, 12)) console.error('refused ' + r.topic + ': ' + r.why);
      if (!t.films.length) { console.error('no trend fits a format today'); process.exit(3); }
      process.exit(0);
    }
    const t = nextTrial(log, day); log.trials.push(t); log.best = log.best || { ...BASE, scene: SCENES[0].id };
    fs.writeFileSync(LOG, JSON.stringify(log, null, 2) + '\n'); console.log(JSON.stringify(t));
  } else if (cmd === 'record') { // a rendered film's gate result into its trial: node tools/shorts-loop.mjs record media/shorts/<film>.json
    const m = JSON.parse(fs.readFileSync(process.argv[3], 'utf8'));
    for (const t of log.trials) for (const side of [t.champion, t.challenger, ...(t.films || [])]) if (side && side.film === m.filmId) side.gate = { pass: m.gate.pass, score: m.gate.score, hookScore: m.gate.hookScore, failed: m.gate.checks.filter((c) => !c.ok).map((c) => c.name) };
    fs.writeFileSync(LOG, JSON.stringify(log, null, 2) + '\n');
  } else if (cmd === 'judge') {
    const all = log.trials.filter((t) => t.verdict === 'waiting'), open = all.filter((t) => t.champion), studio = all.filter((t) => t.films);
    const ids = [...open.flatMap((t) => [t.champion.film, t.challenger.film]), ...studio.flatMap((t) => t.films.filter((f) => f.gate && f.gate.pass).map((f) => f.film))];
    if (!ids.length) { console.log('no open trials'); process.exit(0); }
    const out = await outcomesOf(ids, site, process.env.VOID_OWNER_TOKEN), gates = Object.fromEntries(open.flatMap((t) => [[t.champion.film, t.champion.gate || {}], [t.challenger.film, t.challenger.gate || {}]]));
    for (const t of studio) { // each studio film's outcome; the day is judged once every posted film has enough views
      const posted = t.films.filter((f) => f.gate && f.gate.pass);
      for (const f of posted) f.outcome = out[f.film];
      if (posted.length && posted.every((f) => (f.outcome.views || 0) >= MIN_VIEWS)) { t.verdict = 'judged'; t.decided = new Date().toISOString(); }
      else if (!posted.length) t.verdict = 'none posted';
      console.log(t.day + ' formats: ' + (posted.map((f) => f.format + ' ' + (f.outcome.views || 0) + ' views').join(', ') || 'none posted'));
    }
    log.best = { ...(log.best || {}), scores: formatScores(log) };
    for (const t of open) {
      const r = judge(t, out, gates); t.outcomes = { champion: out[t.champion.film], challenger: out[t.challenger.film] };
      if (!r) { console.log(t.day + ' ' + t.knob + '=' + t.value + ': waiting for ' + MIN_VIEWS + ' views each'); continue; }
      Object.assign(t, r, { decided: new Date().toISOString() });
      if (r.verdict === 'challenger') { const { film, gate, ...knobs } = t.challenger; log.best = knobs; }
      console.log(t.day + ' ' + t.knob + '=' + t.value + ': ' + r.verdict + ' wins ' + r.scores.challenger + ' vs ' + r.scores.champion + (r.qualityImproved ? ' (quality up: gate ' + r.gate.champion + ' -> ' + r.gate.challenger + ')' : ''));
    }
    fs.writeFileSync(LOG, JSON.stringify(log, null, 2) + '\n');
  } else { console.error('usage: node tools/shorts-loop.mjs plan [--trends trends.json] [--day YYYYMMDD] | record <film.json> | judge'); process.exit(2); }
}
