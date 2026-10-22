// Backfill (owner, 2026-10-21: "Verse hardened itself: N benchmark ask(s) for X" says nothing): for each such ledger line without phrases, the
// commit that added it is found (git log -S), and the benchmark rows that commit added for the named skills become the line's `phrases`
// ([{ ask, skill }]): the actual phrases and the skill each now opens. Builder-written benchmark phrases only, never a visitor's words.
//   node tools/backfill-hardened.mjs          writes void-live-deploy/void.growth.json in place (only the phrases field is added)
import { execFileSync } from 'node:child_process'; import fs from 'node:fs';
const P = 'void-live-deploy/void.growth.json', L = JSON.parse(fs.readFileSync(P, 'utf8'));
const git = (...a) => execFileSync('git', a, { encoding: 'utf8', maxBuffer: 64 << 20 });
let n = 0;
// --last <passing.json>: the newest hardening line gets its phrases from this run's passing rows (grow-self.yml, right after it writes the line)
const li = process.argv.indexOf('--last');
if (li > 0) { const rows = JSON.parse(fs.readFileSync(process.argv[li + 1], 'utf8')); const e = L.filter((x) => /hardened itself/i.test(x.what || '')).sort((a, b) => String(a.at).localeCompare(String(b.at))).pop();
  if (e && !e.phrases && rows.length) { e.phrases = rows.map((r) => ({ ask: r.ask, skill: String(r.want).replace('skill:', '') })); n++; } }
else
for (const e of L) {
  const m = /hardened itself:\s*\d+ benchmark ask\(s\) for ([^.]+?)(?:, and the card art|\.|$)/i.exec(e.what || '');
  if (!m || Array.isArray(e.phrases)) continue; // already has them
  const skills = new Set(m[1].split(/,\s*|\s+and\s+/).map((s) => s.trim()).filter(Boolean));
  const c = git('log', '-1', '--format=%h', '-S', e.what.slice(0, 120), '--', P).trim(); if (!c) continue;
  const rows = git('show', c, '--', 'tools/bench.json').split('\n').filter((l) => l.startsWith('+') && !l.startsWith('+++'))
    .map((l) => { try { return JSON.parse(l.slice(1).trim().replace(/,$/, '')); } catch (_) { return null; } })
    .filter((r) => r && r.ask && r.want && skills.has(String(r.want).replace('skill:', '')));
  if (rows.length) { e.phrases = rows.map((r) => ({ ask: r.ask, skill: String(r.want).replace('skill:', '') })); n++; }
}
// a text edit, not a rewrite: the file keeps its own layout, and only `"phrases": [...]` is added after each line's "what"
let text = fs.readFileSync(P, 'utf8');
for (const e of L) if (Array.isArray(e.phrases)) { const k = '"what": ' + JSON.stringify(e.what); const i = text.indexOf(k); if (i >= 0 && !text.slice(i + k.length, i + k.length + 14).includes('"phrases"')) text = text.slice(0, i + k.length) + ', "phrases": ' + JSON.stringify(e.phrases) + text.slice(i + k.length); }
JSON.parse(text); fs.writeFileSync(P, text);
console.log('backfilled', n, 'hardened lines');
