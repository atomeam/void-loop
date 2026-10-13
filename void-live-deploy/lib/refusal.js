// The refusal object (asked by Void, in reflection after reflection, domains/void.voice.md: "Modify the refusal logic so
// that every 'I cannot' is accompanied by a structured data object identifying the missing skill."). When Void can't do
// an ask, it says what is missing, not just that something is: which kind of ability (knowledge, a skill's data, a
// connected service, an app, a real figure, a sum), the skill that tried if one did, and the build target the miss
// board files it under (miss:<slug>, lib/learn.js), so the same gap asked many ways is one gap with one id.
// The id is made from the kind and the target, never from the raw words (a shape taken from a fringe draft, run 170: a
// refusal keyed by its class, the person's sentence left out). Pure: the page and the agent door (WebMCP) both use it.
import { targetOf } from './learn.js';

// what reportMiss's fallback says -> the kind of ability that was missing, in words a person reads
export const KINDS = {
  knowledge: 'what this is (no source I can read knows it yet)',
  skill: 'the data this skill needs for that ask',
  connector: 'a connected service',
  app: 'an app for this',
  figure: 'a real model of this, not a figure',
  calc: 'the maths for this',
  unknown: 'a skill for this',
};

export function kindOf(fallback) {
  const f = String(fallback || '');
  if (/^skill:/.test(f)) return 'skill';
  if (f === 'not-connected') return 'connector';
  if (f === 'app' || f === 'figure' || f === 'calc') return f;
  if (f === 'none' || /not built yet/i.test(f)) return 'knowledge';
  return 'unknown';
}

/** ask + reportMiss's fallback -> { cannot, id, kind, missing, skill, target, next }. */
export function refusalOf(ask, fallback) {
  const kind = kindOf(fallback);
  const target = targetOf(String(ask || '').trim() || 'nothing');
  const skill = kind === 'skill' ? String(fallback).slice(6) : null;
  return {
    cannot: true,
    id: 'cannot:' + kind + ':' + target.slice(5),
    kind,
    missing: KINDS[kind],
    skill,
    target,
    next: 'noted; asked enough, it becomes a build job (' + target + ')',
  };
}

/** one line a person reads under the page */
export const refusalLine = (r) => 'Missing: ' + r.missing + (r.skill ? ' (' + r.skill + ')' : '') + '. Noted as ' + r.target + '.';
