// Ask live Verse, once per run, what it learned from its builders and what it would do differently, and keep its answer word
// for word in docs/void-voice.md (newest last). The facts it answers from are domains/handoff.md (via self.json); its words are input, not a gate.
//   node tools/ask-void.mjs            ask the site (VOID_SITE, default https://a-to-mind.com) and append the answer
//   node tools/ask-void.mjs --print    ask and print only; nothing is written
//   node tools/ask-void.mjs --ask "…"  ask your own question instead (logged the same way)
// Exit 3 when the site can't be reached or Verse gave no answer, so a run never fails because Verse was busy.
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
export const LOG = resolve(root, 'docs/void-voice.md');
export const QUESTION = 'What did your builders learn lately, and what would you do differently?';
// --ask "<question>" asks something else (a track's own question, e.g. how to make its video card better than YouTube's) and logs it the same way
const ASKED = (() => { const i = process.argv.indexOf('--ask'); return i > 0 && process.argv[i + 1] ? String(process.argv[i + 1]).slice(0, 500) : QUESTION; })();
const HEAD = '# Verse on its builders, in its own words\n\nOnce per run `node tools/ask-void.mjs` asks Verse what it learned from its builders (domains/handoff.md) and what it\nwould do differently. Its answers are copied as it gave them, newest last. Input, not a gate.\n';

export function entry(at, question, answer, sources = []) {
  const quoted = String(answer).replace(/\r/g, '').split('\n').map((l) => ('> ' + l).trimEnd()).join('\n');
  const src = sources.length ? '\n\nSources: ' + sources.map((s) => s.title || s.url || s).join(' · ') : '';
  return `\n<!-- ask-void:${at} -->\n### ${at.slice(0, 16).replace('T', ' ')} UTC\n\n**Asked:** ${question}\n\n${quoted}${src}\n`;
}
// Verse once said its builders' lessons were "codified in void.assimilate.md / void.plan.md"; they were not. Every file it names is
// checked: one that does not exist, or a claim that lessons live anywhere but the board, gets a correction under its words.
export const BOARD = 'domains/handoff.md';
export function checkCites(answer, exists = (f) => existsSync(resolve(root, f)) || existsSync(resolve(root, 'domains', f)) || existsSync(resolve(root, 'docs', f))) {
  const notes = [];
  for (const f of new Set(String(answer).match(/[\w./-]+\.(?:md|mjs|js|json)\b/g) || [])) {
    if (f === BOARD || f.endsWith('/handoff.md') || f === 'handoff.md') continue;
    notes.push(exists(f) ? `${f} exists, but the builders' lessons are kept only in ${BOARD}` : `${f} does not exist`);
  }
  return notes;
}
export function append(text, block) { return (text && text.trim() ? text.replace(/\n*$/, '\n') : HEAD) + block; }

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const site = process.env.VOID_SITE || 'https://a-to-mind.com';
  let j = null;
  try {
    const r = await fetch(site + '/api/answer', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ ask: ASKED }), signal: AbortSignal.timeout(60000) });
    j = r.ok ? await r.json() : null;
  } catch (_) { j = null; }
  const answer = j && typeof j.answer === 'string' ? j.answer.trim() : '';
  if (!answer) { console.log('Verse gave no answer' + (j && j.note ? ': ' + j.note : '')); process.exit(3); }
  if (process.argv.includes('--print')) { console.log(answer); process.exit(0); }
  const at = new Date().toISOString();
  const notes = checkCites(answer);
  writeFileSync(LOG, append(existsSync(LOG) ? readFileSync(LOG, 'utf8') : '', entry(at, ASKED, answer, Array.isArray(j.sources) ? j.sources : []) + (notes.length ? '\n**Checked:** ' + notes.join('; ') + '.\n' : '')));
  console.log(answer + '\n\n(logged in docs/void-voice.md)');
}
