#!/usr/bin/env node
// One GitHub issue per new stranger-test failure. The same title is not opened twice. Reads the gate's JSON.
//   node tools/stranger-issues.mjs stranger-out/stranger.json
import fs from 'node:fs';
import { spawnSync } from 'node:child_process';

const file = process.argv[2] || 'stranger-out/stranger.json';
function asList(text) {
  try { const v = JSON.parse(text || '[]'); return Array.isArray(v) ? v : []; }
  catch (_) { return []; }
}
let rows = [];
try { const parsed = JSON.parse(fs.readFileSync(file, 'utf8')); rows = parsed && Array.isArray(parsed.rows) ? parsed.rows : []; }
catch (_) { console.log('no stranger.json'); process.exit(0); }
const bad = rows.filter((r) => r && r.reasons && r.reasons.length);
if (!bad.length) { console.log('no failures'); process.exit(0); }
const gh = (args) => spawnSync('gh', args, { encoding: 'utf8', timeout: 120000 });
gh(['label', 'create', 'stranger-test', '--color', '5319e7', '--description', 'Found by the stranger test']);
const listed = gh(['issue', 'list', '--label', 'stranger-test', '--state', 'open', '--limit', '100', '--json', 'title']);
const open = new Set((listed.status === 0 ? asList(listed.stdout) : []).map((i) => i && i.title).filter(Boolean));
for (const r of bad) {
  const title = ('Stranger test: ' + r.id).slice(0, 80);
  if (open.has(title)) { console.log('already open: ' + title); continue; }
  const note = 'stranger-out/issue.md';
  fs.mkdirSync('stranger-out', { recursive: true });
  fs.writeFileSync(note, r.id + ' (' + (r.kind || 'page') + ')\n\n' + r.reasons.map((x) => '- ' + x).join('\n') + '\n\nFix job from the stranger test.\n' + (process.env.STRANGER_RUN_URL || '') + '\n');
  const made = gh(['issue', 'create', '--label', 'stranger-test', '--title', title, '--body-file', note]);
  console.log(made.status === 0 ? String(made.stdout || '').trim() : String(made.stderr || 'not opened').slice(0, 240));
}
