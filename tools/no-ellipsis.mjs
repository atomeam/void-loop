// No sentence is cut with an ellipsis (owner, 2026-10-21: "i need to see the whole sentences"). Counts, per file, the code that cuts text
// with "…" (+ '…', + '\u2026') and the CSS that hides it (text-overflow:ellipsis, line-clamp) in the page, lib/ and skills/, and fails when
// any file has more than tools/no-ellipsis.json allows. The allowance only goes down:  node tools/no-ellipsis.mjs --write  after removing some.
import fs from 'node:fs'; import path from 'node:path'; import { fileURLToPath } from 'node:url';
const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..'), base = path.join(root, 'tools', 'no-ellipsis.json');
const PAT = /\+\s*['"`](?:…|\\u2026)['"`]|text-overflow:\s*ellipsis|line-clamp/g;
const files = ['void.html', ...['void-live-deploy/lib', 'void-live-deploy/skills'].flatMap(function walk(d) { return fs.readdirSync(path.join(root, d), { withFileTypes: true }).flatMap((e) => e.isDirectory() ? walk(d + '/' + e.name) : /\.js$/.test(e.name) ? [d + '/' + e.name] : []); })];
const now = {}; for (const f of files) { const n = fs.readFileSync(path.join(root, f), 'utf8').split('\n').filter((l) => !/ellipsis-ok/.test(l)).join('\n').match(PAT)?.length || 0; /* a line marked ellipsis-ok is not a cut sentence: a progress line, a drawn picture, a short label */ if (n) now[f] = n; }
if (process.argv.includes('--write')) { fs.writeFileSync(base, JSON.stringify(now, null, 1) + '\n'); console.log('wrote', Object.keys(now).length, 'files'); process.exit(0); }
const allow = JSON.parse(fs.readFileSync(base, 'utf8')), over = Object.entries(now).filter(([f, n]) => n > (allow[f] || 0));
if (over.length) { console.error('FAIL new sentence cuts with an ellipsis: ' + over.map(([f, n]) => f + ' ' + n + ' > ' + (allow[f] || 0)).join(', ') + ' — show the whole text (wrap or scroll)'); process.exit(1); }
console.log('ok: no new ellipsis cuts (' + Object.values(now).reduce((a, b) => a + b, 0) + ' left to remove)');
