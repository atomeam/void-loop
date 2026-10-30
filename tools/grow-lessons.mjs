// Lessons from grow-self probes: skills whose example asks keep routing elsewhere.
// Written by grow-self.yml; read by tools/lacks.mjs so the next plan deprioritizes them.
// Pure helpers. Owner 2026-10-21.
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
export const LESSONS_FILE = resolve(root, 'tools/grow-lessons.json');

export function load() {
  try { return existsSync(LESSONS_FILE) ? JSON.parse(readFileSync(LESSONS_FILE, 'utf8')) : { skills: {} }; }
  catch { return { skills: {} }; }
}

// Persistent result memory (docs/LOOP-GAPS.md, Reflexion): every probed skill keeps wins and misses, and each miss keeps why
// (who answered instead), so the next plan picks by expected value instead of repeating what keeps failing.
export function record(failed, at = new Date().toISOString(), passed = []) {
  const data = load();
  for (const f of passed || []) {
    const name = String(f.want || '').replace(/^skill:/, '').split('|')[0];
    if (!name) continue;
    const s = data.skills[name] || { misses: 0, last: '', examples: [] };
    s.wins = (s.wins || 0) + 1; s.last = at; data.skills[name] = s;
  }
  for (const f of failed || []) {
    const name = String(f.want || '').replace(/^skill:/, '');
    if (!name) continue;
    const s = data.skills[name] || { misses: 0, last: '', examples: [] };
    s.misses += 1;
    s.last = at;
    if (f.ask && !s.examples.includes(f.ask)) s.examples.push(f.ask);
    const why = String(f.got || f.why || f.answered || '').slice(0, 80);
    // the failed-variant archive (Darwin Godel Machine, AlphaEvolve keep stepping stones): every missed candidate is kept with
    // what answered and how often it missed, so a later plan can retry it once the skill's chance rises
    data.variants = data.variants || [];
    const v = data.variants.find((x) => x.ask === f.ask && x.skill === name);
    if (v) { v.tries += 1; v.at = at; v.got = why || v.got; } else if (f.ask) data.variants.push({ ask: f.ask, skill: name, got: why, at, tries: 1 });
    if (data.variants.length > 200) data.variants = data.variants.slice(-200);
    if (why) s.why = [...(s.why || []).filter((w) => w !== why), why].slice(-4);
    if (s.examples.length > 8) s.examples = s.examples.slice(-8);
    data.skills[name] = s;
  }
  writeFileSync(LESSONS_FILE, JSON.stringify(data, null, 2) + '\n');
  return data;
}

/** skills that have missed at least `min` times recently; plan can deprioritize them. Pure. */
export function heavy(data = load(), min = 3) {
  return Object.entries(data.skills || {})
    .filter(([, s]) => (s.misses || 0) >= min)
    .map(([name]) => name);
}

/** chance the next try at a skill lands: the Beta(1,1) posterior mean of its wins and misses (Laplace's rule). Pure. */
export function chance(name, data = load()) {
  const s = (data.skills || {})[name] || {};
  return ((s.wins || 0) + 1) / ((s.wins || 0) + (s.misses || 0) + 2);
}
/** per-family outcome scores: wins, misses and chance summed over the skills each family holds. famOf(name) -> family. Pure. */
export function familyScores(data = load(), famOf = () => 'other') {
  const out = {};
  for (const [name, s] of Object.entries(data.skills || {})) {
    const f = famOf(name) || 'other', o = out[f] || (out[f] = { wins: 0, misses: 0 });
    o.wins += s.wins || 0; o.misses += s.misses || 0;
  }
  for (const o of Object.values(out)) o.chance = +((o.wins + 1) / (o.wins + o.misses + 2)).toFixed(3);
  return out;
}

/** archived variants worth another try: the skill's chance is at least `min` now, newest first, at most n. Pure. */
export function retryable(data = load(), min = 0.5, n = 3) {
  return (data.variants || []).filter((v) => chance(v.skill, data) >= min).sort((a, b) => (a.at < b.at ? 1 : -1)).slice(0, n);
}
