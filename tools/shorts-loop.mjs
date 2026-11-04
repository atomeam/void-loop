#!/usr/bin/env node
// Verse's Shorts get better on real outcomes (owner, 2026-11-03: "it should just get better over time as well as the video quality").
// Each day one challenger changes ONE knob of the best variant (hook wording, pacing, music, caption style, or scene); both are filmed,
// gated (tools/video-gate.mjs) and posted. Once each has MIN_VIEWS views on /films/, the one with the higher outcome score is the new
// best. "Quality improved" is claimed only when the gate's objective score went up too. Every trial and verdict is logged in
// domains/shorts.loop.json (the log /films/ and /progress/ read).
//   node tools/shorts-loop.mjs plan  [--day YYYYMMDD]   -> today's { champion, challenger } (writes the trial into the log)
//   node tools/shorts-loop.mjs record <film.json>         -> the film's gate score into its trial
//   node tools/shorts-loop.mjs judge                     -> fetch outcomes, decide every open trial that has enough views
// Outcomes: views (/api/film-views), clicks to a-to-mind.com (/c/_stats, the owner's token VOID_OWNER_TOKEN), watch-through when the
// films page reports it (outcome.watch, 0..1). YouTube stats are added when the YT_* secrets exist (not yet).
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { KNOBS, BASE, SCENES } from './shorts.mjs';

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
    const t = nextTrial(log, day); log.trials.push(t); log.best = log.best || { ...BASE, scene: SCENES[0].id };
    fs.writeFileSync(LOG, JSON.stringify(log, null, 2) + '\n'); console.log(JSON.stringify(t));
  } else if (cmd === 'record') { // a rendered film's gate result into its trial: node tools/shorts-loop.mjs record media/shorts/<film>.json
    const m = JSON.parse(fs.readFileSync(process.argv[3], 'utf8'));
    for (const t of log.trials) for (const side of [t.champion, t.challenger]) if (side.film === m.filmId) side.gate = { pass: m.gate.pass, score: m.gate.score, hookScore: m.gate.hookScore };
    fs.writeFileSync(LOG, JSON.stringify(log, null, 2) + '\n');
  } else if (cmd === 'judge') {
    const open = log.trials.filter((t) => t.verdict === 'waiting'), ids = open.flatMap((t) => [t.champion.film, t.challenger.film]);
    if (!ids.length) { console.log('no open trials'); process.exit(0); }
    const out = await outcomesOf(ids, site, process.env.VOID_OWNER_TOKEN), gates = Object.fromEntries(open.flatMap((t) => [[t.champion.film, t.champion.gate || {}], [t.challenger.film, t.challenger.gate || {}]]));
    for (const t of open) {
      const r = judge(t, out, gates); t.outcomes = { champion: out[t.champion.film], challenger: out[t.challenger.film] };
      if (!r) { console.log(t.day + ' ' + t.knob + '=' + t.value + ': waiting for ' + MIN_VIEWS + ' views each'); continue; }
      Object.assign(t, r, { decided: new Date().toISOString() });
      if (r.verdict === 'challenger') { const { film, gate, ...knobs } = t.challenger; log.best = knobs; }
      console.log(t.day + ' ' + t.knob + '=' + t.value + ': ' + r.verdict + ' wins ' + r.scores.challenger + ' vs ' + r.scores.champion + (r.qualityImproved ? ' (quality up: gate ' + r.gate.champion + ' -> ' + r.gate.challenger + ')' : ''));
    }
    fs.writeFileSync(LOG, JSON.stringify(log, null, 2) + '\n');
  } else { console.error('usage: node tools/shorts-loop.mjs plan [--day YYYYMMDD] | judge'); process.exit(2); }
}
