// No human in the loop (owner rule, 2026-10-28; again 2026-11-04: "NEVER add a human to the loop"). Nothing Verse builds or runs
// sits in a state that waits for its owner: an item that cannot go on by itself is retried, then dropped and logged
// (tools/verse-loop.mjs for probe patches, lib/will-guard.js for wants and the build order's open items).
// This check fails when that wait comes back as words in live code or docs (HUMAN_WAIT below: an item that waits, is waiting,
// or is held for its owner, the retired PR label, or a status saying it needs its owner). A sentence that says it never happens ("nothing waits on a person")
// is not a wait. Kept as records, not live: archive/, and the append-only history files in HISTORY (what was true then stays true).
// The confirm line (lib/approval-core.js: a send, a booking or a spend asks the person it acts for) is a safety gate, not a wait,
// and is described in those words.
//   node tools/no-human-wait.mjs        prints each hit as file:line and exits 1 when there is one
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');

/** the wait, in its words: built from parts so this file does not hold the phrase it looks for */
const WHO = '(?:the\\s+)?own' + 'er';
export const HUMAN_WAIT = new RegExp('\\b(?:waits?|waiting|held|holds?)\\s+(?:for|on|until)\\s+(?:' + WHO + ')\\b(?!\\s*(?:token|key|session))'
  + '|\\bneeds\\s+(?:the|an)\\s+own' + 'er(?:\'s)?(?:\\s+(?:budget|go-ahead))?\\s*[.:)]', 'i');
/** a sentence that says the wait never happens: "nothing waits on a person", "Never wait on the owner", "it never waits for a person" */
const DENIED = /\b(?:never|nothing|no(?:\s+\w+)?|not|without|instead of)\s+(?:\w+\s+){0,3}wait/i;

/** history kept as it was written (append-only logs, ledgers and Verse's own past reflections) */
export const HISTORY = new Set(['domains/void.agents.log.md', 'domains/void.voice.md', 'void-live-deploy/void.growth.json', 'domains/handoff.md',
  'domains/lists.metrics.json', 'domains/void.decisions.json']);
const live = (f) => !f.startsWith('archive/') && !HISTORY.has(f) && /\.(?:m?js|md|json|ya?ml|html|py|txt)$/.test(f);

/** a line that says why it holds the words: the retired PR label's name (lib/v01d-fixes.js WAITS), or a test's old words that it
 *  proves are read as no wait. The reason is on the line, so a reader sees it. */
export const MARK = /no-human-wait: (?:retired label|old words)/;
/** where a mark counts: the retired label only where it is defined, old words only in tests. A mark anywhere else is ignored. */
export const markOk = (file, line) => (/no-human-wait: retired label/.test(line) && file === 'void-live-deploy/lib/v01d-fixes.js')
  || (/no-human-wait: old words/.test(line) && /\.test\.mjs$/.test(file || ''));

/** the hits in one text: [{ line, text }]; `file` is its repo path, which decides whether a mark counts. Pure. */
export function waitsIn(text, file = '') {
  const out = [];
  String(text || '').split('\n').forEach((l, i) => {
    if (MARK.test(l) && markOk(file, l)) return;
    for (const part of l.split(/(?<=[.;!?])\s+/)) if (HUMAN_WAIT.test(part) && !DENIED.test(part)) { out.push({ line: i + 1, text: l.trim().slice(0, 160) }); break; }
  });
  return out;
}

/** every hit in the tracked live files: [{ file, line, text }] */
export function scan(files = spawnSync('git', ['ls-files'], { cwd: root, encoding: 'utf8', maxBuffer: 64 << 20 }).stdout.split('\n').filter(Boolean)) {
  const out = [];
  for (const f of files.filter(live)) {
    let t = ''; try { t = readFileSync(resolve(root, f), 'utf8'); } catch (_) { continue; }
    if (t.length > 5e6 || t.includes('\0')) continue;
    for (const h of waitsIn(t, f)) out.push({ file: f, ...h });
  }
  return out;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const hits = scan();
  for (const h of hits) console.log(h.file + ':' + h.line + '  ' + h.text);
  console.log(hits.length ? hits.length + ' line(s) wait for a person: retry, then drop and log instead (docs/VERSE-LOOP.md)' : 'nothing waits for a person');
  process.exit(hits.length ? 1 : 0);
}
