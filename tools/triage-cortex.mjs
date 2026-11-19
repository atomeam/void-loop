#!/usr/bin/env node
// Triage cortex: the scope guard every backlog task (a docs/NEXT.md item or a --task for tools/verse-loop.mjs) and every
// think-tank board line passes before any model turn. A task that names no target file and no failing test is refused in
// well under a second, so no coder lap is spent reading the repo to find out what it was meant to change. A red check
// (kind 'fix' or 'heal') already names its failing test; a probe job names its ask; a groom only re-ranks the queue.
// Caps for a backlog lap: one item, at most CAPS.reads read-only turns in a row, at most CAPS.lines changed lines.
// node tools/triage-cortex.mjs --task "<text>"  -> one JSON line { ok, why, files, tests }, exit 0 either way.
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';

export const CAPS = { issues: 1, reads: 6, lines: 120 };

const PATH = /(?:^|[\s`'"(\[])((?:\.github|tools|void-live-deploy|domains|docs|lib|scripts|functions|skills)\/[\w.@/-]+\.[a-z]{1,6}|[\w.-]+\.(?:mjs|cjs|js|ts|html|css|json|py|yml|yaml|md))(?=$|[\s`'"),.:;\]])/g;
const TEST = /\b(?:failing|failed|red)\s+(?:test|check)\s*[:=]?\s*(?:"([^"\n]{3,200})"|'([^'\n]{3,200})'|`([^`\n]{3,200})`)|--only\s+"([^"\n]{3,200})"|\b([\w./-]+\.test\.mjs)\b/gi;

/** The files and failing tests a task names. Pure. */
export function scopeOf(text) {
  const s = String(text || ''), files = new Set(), tests = new Set();
  for (const m of s.matchAll(PATH)) files.add(m[1].replace(/[.,:;]+$/, ''));
  for (const m of s.matchAll(TEST)) tests.add((m[1] || m[2] || m[3] || m[4] || m[5]).trim());
  // a parity gap names its page as 'site → /route/' (docs/PARITY.md): that page's file is the target
  for (const m of s.matchAll(/→\s*\/([a-z0-9-]+(?:\/[a-z0-9-]+)*)\/(?=$|[\s),.])/gi)) files.add('void-live-deploy/' + m[1] + '/index.html');
  return { files: [...files], tests: [...tests] };
}

/** Pass or refuse one task before a model is called. Pure. */
export function preflight(task) {
  const t = task || {};
  if (t.kind === 'fix' || t.kind === 'heal') return t.check ? { ok: true, why: 'red check: ' + t.check, files: [], tests: [t.check] } : { ok: false, why: 'a red check with no name', files: [], tests: [] };
  if (t.kind === 'probe' || t.kind === 'groom' || t.kind === 'idle') return { ok: true, why: t.kind + ' needs no scope', files: [], tests: [] };
  if (t.kind === 'game' || t.kind === 'invent') return { ok: true, why: 'one game', files: t.game ? [t.game.file] : [], tests: [] };
  const sc = scopeOf(t.text);
  if (!sc.files.length && !sc.tests.length) {
    return { ok: false, why: 'unscoped: the task names no target file path and no failing test id (name one, e.g. tools/<name>.mjs or failing test "<label>")', ...sc };
  }
  return { ok: true, why: 'scoped to ' + [...sc.files, ...sc.tests].slice(0, 4).join(', '), ...sc };
}

/** Changed lines (added + removed) in a `git diff --numstat` listing; binary files count 0. Pure. */
export function changedLines(numstat) {
  let n = 0;
  for (const l of String(numstat || '').split('\n')) { const [a, d] = l.split('\t'); n += (+a || 0) + (+d || 0); }
  return n;
}

/** Board lines a think-tank cycle offers as tasks, split into scoped (queued) and unscoped (kept in the plan, not queued). Pure. */
export function splitBoard(lines) {
  const scoped = [], unscoped = [];
  for (const l of lines || []) (preflight({ kind: 'next', text: l }).ok ? scoped : unscoped).push(l);
  return { scoped, unscoped };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const i = process.argv.indexOf('--task');
  const text = i > 0 ? String(process.argv[i + 1] || '') : '';
  console.log(JSON.stringify({ ...preflight({ kind: 'next', text }), caps: CAPS }));
}
