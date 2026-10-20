#!/usr/bin/env node
// Are the /fix/ pages lowering friction? Asked by Verse (2026-10-18): "Verify if the newly shipped /fix/ pages are actually reducing the
// 'friction' metric in the growth logs, or if they are just moving the debt elsewhere." From data in the repo only: the friction part of
// the daily "better" measure (void-live-deploy/void.better.json, lib/better.js: 100 * (1 - (2 * failing + unsure) / (2 * skills))), and
// the time each /fix/ page was first committed (git log). For each ship it takes the last measure before and the newest after, and splits
// the change into what moved: failing skills, barely-checked skills, and the skill count (a bigger denominator raises the score with no
// skill getting better). The /fix/ pages are static pages, not skills or bench asks, so none of the three counts them; the verdict says so.
//   node tools/fix-friction.mjs          the report in plain words
//   node tools/fix-friction.mjs --json   the same as JSON
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
/** the friction score of a measure's facts, as lib/better.js computes it; null without skills. Pure. */
export const frictionOf = (f) => (f && +f.skills > 0 ? Math.max(0, Math.min(100, Math.round(100 * (1 - (2 * f.failing + f.unsure) / (2 * f.skills))))) : null);

/** the ships of /fix/ pages from `git log --format=@%aI --name-only` text: [{ at, pages: [slug] }], oldest first. Pure. */
export function shipsOf(log) {
  const out = []; let cur = null;
  for (const line of String(log || '').split('\n')) {
    const t = line.trim();
    if (t.startsWith('@')) { cur = { at: new Date(t.slice(1)).toISOString(), pages: [] }; out.push(cur); continue; }
    const m = /fix\/([^/]+)\/index\.html$/.exec(t);
    if (m && cur) cur.pages.push(m[1]);
  }
  return out.filter((s) => s.pages.length).sort((a, b) => a.at.localeCompare(b.at));
}

/** one ship against the measures: { at, pages, before, after, delta, parts, verdict }. Pure. */
export function compareShip(ship, rows, skillNames = []) {
  const R = (Array.isArray(rows) ? rows : []).filter((r) => r && r.at && r.facts && +r.facts.skills > 0).sort((a, b) => String(a.at).localeCompare(String(b.at)));
  const before = R.filter((r) => r.at < ship.at).pop() || null, after = R.filter((r) => r.at > ship.at).pop() || null;
  const asSkill = ship.pages.filter((p) => skillNames.includes(p));
  const base = { at: ship.at, pages: ship.pages.length, pagesAsSkills: asSkill.length };
  if (!before || !after) return { ...base, before: before && before.at, after: after && after.at, delta: null, verdict: 'No friction measure ' + (!before ? 'before' : 'after') + ' this ship (the daily measure starts ' + (R[0] ? R[0].at.slice(0, 10) : 'later') + '), so it cannot be compared.' };
  const b = before.facts, a = after.facts, fb = frictionOf(b), fa = frictionOf(a);
  // the same change with the skill count held where it was: what the failing and barely-checked skills alone did
  const held = frictionOf({ failing: a.failing, unsure: a.unsure, skills: b.skills });
  const parts = { failing: a.failing - b.failing, unsure: a.unsure - b.unsure, skills: a.skills - b.skills, fromCounts: held - fb, fromSkillCount: fa - held };
  const moved = [parts.failing ? (parts.failing < 0 ? -parts.failing + ' fewer' : parts.failing + ' more') + ' failing' : 'no change in failing', parts.unsure ? (parts.unsure < 0 ? -parts.unsure + ' fewer' : parts.unsure + ' more') + ' barely checked' : 'no change in barely checked', parts.skills ? (parts.skills > 0 ? parts.skills + ' more' : -parts.skills + ' fewer') + ' skills counted' : 'the same skill count'];
  const verdict = 'Friction went from ' + fb + ' to ' + fa + ' (' + (fa - fb >= 0 ? '+' : '') + (fa - fb) + '): ' + moved.join(', ') + '. With the skill count held at ' + b.skills + ' it would be ' + held + ', so ' + (parts.fromSkillCount ? (parts.fromSkillCount > 0 ? '+' : '') + parts.fromSkillCount + ' of the change is only the bigger count. ' : 'none of the change is the count. ')
    + (asSkill.length ? asSkill.length + ' of the ' + ship.pages.length + ' pages are skills.' : 'None of the ' + ship.pages.length + ' /fix/ pages is a skill, so this score cannot see them: it neither shows they lowered friction nor that they moved debt.');
  return { ...base, before: before.at, after: after.at, friction: { before: fb, after: fa }, delta: fa - fb, parts, verdict };
}

/** the whole report: { ships: [...], answer }. Pure. */
export function report(ships, rows, skillNames = []) {
  const out = ships.map((s) => compareShip(s, rows, skillNames)), seen = out.filter((s) => s.delta !== null);
  const blind = out.every((s) => !s.pagesAsSkills);
  const answer = !seen.length ? 'No /fix/ ship has a friction measure on both sides yet.'
    : (blind ? 'Not shown either way. ' : '') + 'The friction score counts skills failing the bench or barely checked; ' + (blind ? 'no /fix/ page is in it, so its moves around the ships are other work (' + seen.map((s) => (s.delta >= 0 ? '+' : '') + s.delta + ' around ' + s.at.slice(0, 10) + ', ' + (s.parts.fromSkillCount >= 0 ? '+' : '') + s.parts.fromSkillCount + ' of it from a bigger skill count').join('; ') + '). Whether the pages pay off has to be read from what they are for: visits and fixes asked for from them, which the repo does not hold.' : 'see each ship.');
  return { ships: out, answer };
}

if (import.meta.url === 'file://' + process.argv[1]) {
  const rows = JSON.parse(readFileSync(resolve(root, 'void-live-deploy/void.better.json'), 'utf8'));
  const names = JSON.parse(readFileSync(resolve(root, 'void-live-deploy/skills/index.json'), 'utf8')); // the skill names, a list
  const log = execFileSync('git', ['log', '--diff-filter=A', '--format=@%aI', '--name-only', '--', 'void-live-deploy/fix/*/index.html'], { cwd: root, encoding: 'utf8' });
  const r = report(shipsOf(log), rows, names);
  if (process.argv.includes('--json')) console.log(JSON.stringify(r, null, 2));
  else { for (const s of r.ships) console.log(s.at.slice(0, 16).replace('T', ' ') + ' · ' + s.pages + ' /fix/ pages · ' + s.verdict); console.log('\n' + r.answer); }
}
