#!/usr/bin/env node
// Verse's charter, kept in place (void-live-deploy/lib/charter.js holds the core lines; STANDING.md carries them between the charter markers).
//   node tools/charter.mjs check     every prompt Verse runs on its own still starts with the charter, and STANDING.md still carries every core line (exit 1 when not)
//   node tools/charter.mjs restore   put STANDING.md's charter section back from the core lines and the grown ones (a dropped line returns)
// The house loops run `check` and `restore` once a day (tools/house-loops.mjs), so a change that drops a line is put back and a prompt that no
// longer loads the charter is named. A pull request that drops it fails tools/charter.test.mjs first, which blocks the merge.
// Growth: growFrom(evidence) proposes one more line from what scored well; Verse may add up to MAX_GROWN of them and never drops a core line.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { CORE, START, END, MAX_GROWN, charterBlock, charterSection, coreMissing, withGrowth } from '../void-live-deploy/lib/charter.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const STANDING = path.join(root, 'STANDING.md'), GROWN = path.join(root, 'void-live-deploy/charter.json');
export const read = (f) => { try { return fs.readFileSync(f, 'utf8'); } catch { return ''; } };
export function loadGrown() { try { return JSON.parse(read(GROWN) || 'null') || { added: [] }; } catch { return { added: [] }; } }
/** the text a node-side prompt starts with: the core lines and what Verse has grown. */
export const charterPrompt = () => charterBlock(loadGrown());

/** the files whose prompts start with the charter, and what in each proves it. Pure data. */
export const PROMPTS = Object.freeze([
  { name: 'coder', file: 'tools/verse-coder.mjs', needs: 'charterPrompt(' },
  { name: 'planner (a lap of the Verse loop)', file: 'tools/verse-loop.mjs', needs: 'charterPrompt(' },
  { name: 'skill fixer', file: 'void-live-deploy/lib/propose-fix.js', needs: 'charterBlock(' },
  { name: 'game-updates conductor', file: 'void-live-deploy/lib/game-updates.js', needs: 'charterBlock(' },
  { name: 'game judge', file: 'tools/game-updates.mjs', needs: 'charterPrompt(' },
  { name: 'quality judge', file: 'void-live-deploy/lib/quality.js', needs: 'charterBlock(' },
  { name: 'quality engine', file: 'tools/quality-engine.mjs', needs: 'charterPrompt(' },
]);
/** which prompt files no longer carry the charter. Pure over a reader. */
export function dropped(reader = (f) => read(path.join(root, f))) {
  return PROMPTS.filter((p) => { const t = reader(p.file); return t && !t.includes(p.needs); }).map((p) => p.name);
}
/** STANDING.md with the charter section set from the core and grown lines; the rest of the file untouched. Pure. */
export function standingWith(text, grown) {
  const section = charterSection(grown), a = String(text).indexOf(START), b = String(text).indexOf(END);
  if (a >= 0 && b > a) return text.slice(0, a) + section + text.slice(b + END.length);
  const at = String(text).indexOf('## What A-to-Mind is');
  return at >= 0 ? text.slice(0, at) + section + '\n\n' + text.slice(at) : text + '\n' + section + '\n';
}
export function check() {
  const standing = read(STANDING), a = standing.indexOf(START), b = standing.indexOf(END);
  const section = a >= 0 && b > a ? standing.slice(a, b) : '';
  return { standingMissing: coreMissing(section), promptsDropped: dropped(), grown: withGrowth(loadGrown()).length - CORE.length };
}
export function restore() {
  const was = read(STANDING), now = standingWith(was, loadGrown());
  if (now !== was) fs.writeFileSync(STANDING, now);
  return now !== was;
}

/** one more charter line from what scored well. `evidence` is [{ improver, gain, n }] (the quality engine's kept cycles, by kind of fix). Pure.
 *  Returns null when there is no evidence or the line is already there. Never touches the core. */
export function growFrom(evidence, grown = { added: [] }, now = new Date().toISOString()) {
  const best = (evidence || []).filter((e) => e && e.n >= 2 && e.gain > 0).sort((x, y) => y.gain - x.gain)[0];
  if (!best) return null;
  const line = 'Verse has found that ' + String(best.improver).replace(/[^\w ,'-]/g, '').slice(0, 80) + ' raised scores the most (an average of ' + (+best.gain).toFixed(1) + ' points over ' + best.n + ' kept changes), so it reaches for that first.';
  const have = withGrowth(grown).some((c) => c.id === 'grown' && c.text.includes(String(best.improver)));
  if (have) return null;
  const added = [...(grown.added || []), { at: now, line, why: 'the kept cycles of the quality engine' }].slice(-MAX_GROWN);
  return { added };
}
export function grow(evidence) {
  const next = growFrom(evidence, loadGrown());
  if (next) fs.writeFileSync(GROWN, JSON.stringify(next, null, 1) + '\n');
  return !!next;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const cmd = process.argv[2];
  if (cmd === 'restore') { console.log(restore() ? 'the charter in STANDING.md was put back' : 'the charter in STANDING.md is whole'); }
  const c = check();
  console.log(JSON.stringify(c));
  process.exit(c.standingMissing.length || c.promptsDropped.length ? 1 : 0);
}
