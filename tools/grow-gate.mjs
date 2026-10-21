// The close-out gate for Verse's own hardening runs (owner, 2026-10-20: "hardened itself or new asks are not enough ...
// previews should have way more info. and close out before next preview starts").
//
// grow-self.yml used to check for an open pull request labelled "verse hardens", but nothing ever creates that label:
// the pull request job pushes straight to main. The guard read zero on every run, so the loop stacked a new preview
// every few hours without closing the last one. This file is the state machine that replaces that dead guard:
//
//   open   one run has a preview on the site that nobody has closed yet
//   closed the preview answered live (or a person closed it), so the next run may start
//
// grow-self.yml reads the state before it starts (an open "made by Verse" pull request also blocks it), verifies the
// previous preview's ask on the live site, closes it, and only then probes new work. A run that cannot close the last
// preview stops with exit 0 and says it is waiting: it never piles another preview on top.
//
//   node tools/grow-gate.mjs status                  open | closed
//   node tools/grow-gate.mjs try                     the ask the open preview plays (empty when none)
//   node tools/grow-gate.mjs open --run <id> --try "<ask>" --what "<ledger line>"
//   node tools/grow-gate.mjs close --proof "<why it is closed>"
//   node tools/grow-gate.mjs check                   the state file is valid
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
export const STATE_FILE = resolve(root, 'tools/grow-self.state.json');
export const PREVIEW_LINE = /^Verse hardened itself:/i;
// labels that mean one of Verse's own previews is still waiting for a person or a merge
export const OPEN_LABELS = ['made by Verse', 'verse hardens'];
export const CLEAN = (s) => String(s || '').trim().toLowerCase().replace(/['']/g, "'").replace(/[?!.]+$/, '').replace(/\s+/g, ' ');

/** a ledger entry is a grow-self preview when Verse wrote it as a hardening and it has an ask to play. Pure. */
export function isPreview(e) {
  return !!e && typeof e === 'object' && e.by === 'verse' && PREVIEW_LINE.test(String(e.what || ''))
    && typeof e.try === 'string' && !!e.try.trim();
}

/** the newest grow-self preview in the ledger, or null. Pure. */
export function previewOf(entries) {
  const list = (Array.isArray(entries) ? entries : []).filter(isPreview);
  return list.sort((a, b) => (a.at < b.at ? 1 : a.at > b.at ? -1 : 0))[0] || null;
}

/** a new open state for the run that is shipping now. Pure. */
export function opened(prev, { run, at, what, try: ask, note = '' }) {
  return {
    status: 'open',
    run: String(run || ''),
    at,
    what: String(what || ''),
    try: String(ask || ''),
    closedAt: null,
    proof: null,
    note: String(note || ''),
    previous: prev && prev.at ? { at: prev.at, try: prev.try || '', closedAt: prev.closedAt || null } : undefined,
  };
}

/** the same state, closed: the preview answered live or a person closed it. Pure. */
export function closed(prev, { at, proof }) {
  return { ...prev, status: 'closed', closedAt: at, proof: String(proof || '') };
}

/** null when the state is valid, else what is wrong. Pure. */
export function stateProblem(s) {
  if (!s || typeof s !== 'object' || Array.isArray(s)) return 'the state is not an object';
  if (s.status !== 'open' && s.status !== 'closed') return '"status" must be open or closed';
  if (typeof s.at !== 'string' || !/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\dZ$/.test(s.at) || isNaN(Date.parse(s.at))) return '"at" must be a UTC time';
  if (typeof s.try !== 'string') return '"try" must be text (empty is allowed for a run with no preview)';
  if (s.status === 'closed' && (typeof s.closedAt !== 'string' || !s.closedAt)) return 'a closed state needs "closedAt"';
  return null;
}

/** the asks on claims-verified.json, normalized. Pure. */
export function verifiedOf(text) {
  try {
    const j = JSON.parse(String(text || '{}'));
    return new Set((Array.isArray(j.ok) ? j.ok : []).map(CLEAN).filter(Boolean));
  } catch (_) { return new Set(); }
}

/** an open pull request with any of the labels that mean a preview is still out. Pure. */
export function openPreviews(prs) {
  return (Array.isArray(prs) ? prs : []).filter((p) => p && Array.isArray(p.labels)
    && p.labels.some((l) => l && OPEN_LABELS.includes(String(l.name || l))));
}

const nowIso = () => new Date().toISOString().replace(/\.\d{3}Z$/, 'Z');
const read = () => { try { return JSON.parse(readFileSync(STATE_FILE, 'utf8')); } catch (_) { return null; } };
const write = (s) => { const p = stateProblem(s); if (p) throw new Error(p); writeFileSync(STATE_FILE, JSON.stringify(s, null, 2) + '\n'); };

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2), cmd = args[0];
  const opt = (name) => { const i = args.indexOf(name); return i >= 0 && args[i + 1] !== undefined && !String(args[i + 1]).startsWith('--') ? args[i + 1] : ''; };
  const s = read();
  // fail closed: a missing or broken state is not "closed"; grow-self.yml treats this exit as "nothing new starts"
  if (cmd === 'status') {
    const p = s ? stateProblem(s) : 'the state file is missing';
    if (p) { console.error('grow-self.state.json: ' + p); process.exit(2); }
    console.log(s.status); process.exit(0);
  }
  if (cmd === 'try') {
    const p = s ? stateProblem(s) : 'the state file is missing';
    if (p) { console.error('grow-self.state.json: ' + p); process.exit(2); }
    console.log(s.status === 'open' ? String(s.try || '') : ''); process.exit(0);
  }
  if (cmd === 'check') { const p = s ? stateProblem(s) : 'the state file is missing'; if (p) { console.error('grow-self.state.json: ' + p); process.exit(1); } console.log('grow-self.state.json: ' + s.status + (s.try ? ' (' + s.try + ')' : '')); process.exit(0); }
  if (cmd === 'open') {
    const ask = String(opt('--try') || '').trim(), what = String(opt('--what') || '').trim();
    if (!ask) { console.error('open needs --try "<the ask the preview plays>"'); process.exit(2); }
    const at = nowIso();
    write(opened(s, { run: opt('--run'), at, what, try: ask, note: opt('--note') }));
    console.log('grow-self.state.json: open (' + ask + ')'); process.exit(0);
  }
  if (cmd === 'close') {
    if (!s) { console.error('there is no open preview to close'); process.exit(2); }
    if (s.status === 'closed') { console.log('already closed'); process.exit(0); }
    write(closed(s, { at: nowIso(), proof: opt('--proof') || 'closed by hand' }));
    console.log('grow-self.state.json: closed (' + (opt('--proof') || 'closed by hand') + ')'); process.exit(0);
  }
  console.error('usage: node tools/grow-gate.mjs <status|try|open|close|check> [--run id] [--try ask] [--what line] [--proof why]');
  process.exit(2);
}
