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

export function record(failed, at = new Date().toISOString()) {
  const data = load();
  for (const f of failed || []) {
    const name = String(f.want || '').replace(/^skill:/, '');
    if (!name) continue;
    const s = data.skills[name] || { misses: 0, last: '', examples: [] };
    s.misses += 1;
    s.last = at;
    if (f.ask && !s.examples.includes(f.ask)) s.examples.push(f.ask);
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
