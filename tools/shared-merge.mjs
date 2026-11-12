// Deterministic settles for files two bot branches both change. No model. merge-main.mjs, merge-gate.mjs
// and the helper rebase (helper-pr.yml) call these. A skill registry is the union of both sides, keyed by
// skill id, sorted. A growth-inbox row is keyed by its ask; status only moves forward.
import { execFileSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

export const INDEX = 'void-live-deploy/skills/index.json';
export const INBOX = 'domains/growth-inbox.md';
// Only the registries that are a skill-id map. families.json, deps.json and guide.json nest skills inside other keys, so a shallow union would keep main's list and drop the pull request's skills. Those stay on the regenerate path.
export const REGISTRIES = [INDEX, 'void-live-deploy/skills/what.json', 'void-live-deploy/skills/first.json'];
const RANK = { open: 0, building: 1, shipped: 2 };

export const slugOf = (ask) => String(ask || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 80);
export const statusRank = (status) => { const k = String(status || '').toLowerCase().split(/\s+/)[0]; return Object.prototype.hasOwnProperty.call(RANK, k) ? RANK[k] : -1; };
const idOf = (x) => typeof x === 'string' ? x : String((x && (x.id || x.name)) || '');

/** Union of two skill registries, keyed by skill id, sorted. Main's value wins when both have the id. Pure. */
export function mergeRegistry(mainSide, prSide) {
  if (Array.isArray(mainSide) || Array.isArray(prSide)) {
    const map = new Map();
    for (const item of [...(Array.isArray(mainSide) ? mainSide : []), ...(Array.isArray(prSide) ? prSide : [])]) {
      const id = idOf(item);
      if (id && !map.has(id)) map.set(id, item);
    }
    return [...map.keys()].sort().map((k) => map.get(k));
  }
  const main = mainSide && typeof mainSide === 'object' ? mainSide : {};
  const pr = prSide && typeof prSide === 'object' ? prSide : {};
  const out = {};
  for (const k of [...new Set([...Object.keys(main), ...Object.keys(pr)])].sort()) out[k] = Object.prototype.hasOwnProperty.call(main, k) ? main[k] : pr[k];
  return out;
}

export function inboxRows(text) {
  const rows = [];
  for (const line of String(text || '').split('\n')) {
    if (!line.startsWith('|')) continue;
    const cells = line.split('|').slice(1, -1).map((s) => s.trim());
    if (cells.length < 3 || /^status$/i.test(cells[0]) || /^-+$/.test(cells[0].replace(/\s/g, ''))) continue;
    rows.push({ status: cells[0], date: cells[1], ask: cells[2], source: cells.slice(3).join(' | ') });
  }
  return rows;
}

/** Main's rows stay in order. A pull request row is added, or it raises status. It never lowers one. Pure. */
export function mergeInbox(mainText, prText) {
  const order = [];
  const by = new Map();
  const put = (row, fromPr) => {
    const slug = slugOf(row.ask);
    if (!slug) return;
    const have = by.get(slug);
    if (!have) { order.push(slug); by.set(slug, { ...row }); return; }
    if (fromPr && statusRank(row.status) > statusRank(have.status)) by.set(slug, { ...have, status: row.status, date: row.date || have.date, source: row.source || have.source });
  };
  for (const row of inboxRows(mainText)) put(row, false);
  for (const row of inboxRows(prText)) put(row, true);
  const lines = String(mainText || prText || '').split('\n');
  let start = lines.findIndex((l) => /^\|\s*status\s*\|/i.test(l));
  if (start < 0) start = lines.length;
  const header = start < lines.length ? lines[start] : '| status | date | ask | source |';
  const sep = lines[start + 1] && /^\|/.test(lines[start + 1]) ? lines[start + 1] : '| --- | --- | --- | --- |';
  let end = start + 2;
  while (end < lines.length && lines[end].startsWith('|')) end++;
  const body = order.map((slug) => { const r = by.get(slug); return '| ' + [r.status, r.date, r.ask, r.source].filter((c) => c !== undefined).join(' | ') + ' |'; });
  const tail = lines.slice(Math.max(end, start));
  return [...lines.slice(0, start), header, sep, ...body, ...tail].join('\n').replace(/\n{3,}/g, '\n\n');
}

/** During a merge, stage 2 is the branch and stage 3 is main. During a rebase onto main, those two swap. */
export function stages(rebasing) { return rebasing ? { main: 2, pr: 3 } : { main: 3, pr: 2 }; }

/** Settled text for a conflicted path, or null when this file is not one of the shared ones. Pure. */
export function settleText(path, mainText, prText) {
  if (path === INBOX) return mergeInbox(mainText, prText);
  if (!REGISTRIES.includes(path)) return null;
  try { return JSON.stringify(mergeRegistry(JSON.parse(mainText || 'null'), JSON.parse(prText || 'null')), null, path === INDEX ? 0 : 2) + '\n'; }
  catch (_) { return null; }
}

/** During a rebase or merge: write the shared files we can settle and leave the rest unmerged. */
export function settleWorktree(cwd = process.cwd()) {
  const run = (args) => execFileSync('git', args, { cwd, encoding: 'utf8' });
  let rebasing = false;
  try { run(['rev-parse', '-q', '--verify', 'REBASE_HEAD']); rebasing = true; } catch (_) {}
  const side = stages(rebasing);
  const files = String(run(['diff', '--name-only', '--diff-filter=U']) || '').split('\n').map((s) => s.trim()).filter(Boolean);
  const left = [];
  for (const f of files) {
    const show = (n) => { try { return run(['show', `:${n}:${f}`]); } catch (_) { return ''; } };
    const text = settleText(f, show(side.main), show(side.pr));
    if (text == null) { left.push(f); continue; }
    writeFileSync(resolve(cwd, f), text);
    run(['add', '--', f]);
  }
  return { settled: files.filter((f) => !left.includes(f)), left };
}

function main(argv) {
  if (!argv.includes('--rebase')) { console.error('usage: node tools/shared-merge.mjs --rebase'); return 2; }
  const { settled, left } = settleWorktree();
  if (!settled.length || left.length) { console.error('shared-merge: still conflicted: ' + (left.join(', ') || '(none we settle)')); return 1; }
  try { execFileSync('git', ['rebase', '--continue'], { env: { ...process.env, GIT_EDITOR: 'true' }, encoding: 'utf8' }); }
  catch (e) { console.error(String(e.stderr || e.message).slice(0, 300)); return 1; }
  console.log('shared-merge: settled ' + settled.join(', '));
  return 0;
}

if (process.argv[1] && process.argv[1].endsWith('shared-merge.mjs')) process.exit(main(process.argv.slice(2)));
