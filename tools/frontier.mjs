// Reading domains/void.frontier.md, the one build order (cleanup step 2, 2026-10-11), the same way everywhere: the open items
// folded in from the old lists, the cleanup steps not done yet, and adding an item. Used by tools/next.mjs (what a run takes
// next), tools/self-context.mjs (what Verse says is still open about itself) and tools/grow-ideas.mjs (the idea intake).
// tools/will.py reads the same open list with the same rule (it is Python). Tests: tools/frontier.test.mjs.
import { readFileSync } from 'node:fs';

export const FRONTIER = new URL('../domains/void.frontier.md', import.meta.url);
export const OPEN_HEADER = '**Folded in from the old lists';
export const TARGETS_HEADER = '**After the cleanup';
const plain = (s) => String(s || '').replace(/\*\*|`/g, '').replace(/\s+/g, ' ').trim();

/** what an open item waits on, from its own words: "the owner" when it says it needs or waits for the owner ("Needs the owner.",
 *  "(waits for the owner)", "waits for the owner to decide"), or a thing it names in brackets ("(needs the miss board)"); '' when
 *  it waits on nothing. "Waits on the owner:" opens a list of parts that wait while the rest goes on, so it is not read as the item's own
 *  wait. Pure. */
export function waitsOf(title, why) {
  const t = plain(title + ' ' + why);
  if (/\b(?:needs|waits for|waiting for) the owner\b/i.test(t)) return 'the owner';
  const m = /\((?:needs|waits for|waiting for) (the [a-z][a-z -]{2,40})\)/i.exec(t);
  return m ? m[1].trim() : '';
}

/** the open items: [{ title, why, from, waits? }] from the bullets under OPEN_HEADER, up to the first blank line; `waits` only when the
 *  item says what it waits on (waitsOf) */
export function openItems(text) {
  const lines = String(text || '').split('\n');
  const at = lines.findIndex((l) => l.startsWith(OPEN_HEADER));
  if (at < 0) return [];
  const out = [];
  for (const line of lines.slice(at + 1)) {
    if (!line.trim()) break;
    const m = /^- \*\*(.+?)\*\*\s*(.*)$/.exec(line);
    if (!m) continue;
    let title = m[1].replace(/[:.]\s*$/, '').trim(), rest = m[2];
    const src = /\(`([^`]+)`([^)]*)\)/.exec(title + ' ' + rest); // void-review: ok (RegExp.exec on frontier text, not a shell: nothing runs)
    title = plain(title.replace(/\s*\(`[^)]*\)\s*/, ' '));
    rest = rest.replace(/^\s*\(`[^)]*\)\s*:?\s*/, '');
    const why = plain(rest).replace(/^:\s*/, ''), waits = waitsOf(title, why);
    out.push({ title, why, from: src ? plain(src[1] + src[2]) : '', ...(waits ? { waits } : {}) });
  }
  return out;
}

/** the targets held until the cleanup was done (the bullets under TARGETS_HEADER, up to the first blank line): [{ title }] */
export function targets(text) {
  const lines = String(text || '').split('\n');
  const at = lines.findIndex((l) => l.startsWith(TARGETS_HEADER));
  if (at < 0) return [];
  const out = [];
  for (const line of lines.slice(at + 1)) {
    if (!line.trim()) break;
    const m = /^- \*\*(.+?)\*\*/.exec(line);
    if (m) out.push({ title: plain(m[1].replace(/\s*\(.*$/, '')).replace(/[:.]\s*$/, '') });
  }
  return out;
}

/** the cleanup steps (numbered, under "## Current priority") with no "**done**" line under them: [{ n, title }] */
export function stepsLeft(text) {
  const s = String(text || ''), start = s.indexOf('## Current priority'), end = s.indexOf('\n---', start);
  if (start < 0) return [];
  const block = s.slice(start, end < 0 ? undefined : end), out = [];
  const re = /^(\d+)\. \*\*(.+?)\*\*/gm;
  const heads = [...block.matchAll(re)];
  heads.forEach((h, i) => {
    const body = block.slice(h.index, i + 1 < heads.length ? heads[i + 1].index : undefined);
    if (!/\*\*done\*\*/.test(body)) out.push({ n: +h[1], title: plain(h[2]).replace(/\.$/, '') });
  });
  return out;
}

/** the frontier with one more open item at the end of the open list (unchanged when there is no open list) */
export function addOpen(text, { title, why, from }) {
  const lines = String(text || '').split('\n');
  const at = lines.findIndex((l) => l.startsWith(OPEN_HEADER));
  if (at < 0) return String(text);
  let i = at + 1;
  while (i < lines.length && lines[i].trim()) i++;
  const line = `- **${String(title).replace(/\*/g, '')}**${from ? ` (\`${String(from).replace(/`/g, '')}\`)` : ''}${why ? ': ' + String(why).replace(/\n/g, ' ') : ''}`;
  lines.splice(i, 0, line);
  return lines.join('\n');
}

export const readFrontier = () => readFileSync(FRONTIER, 'utf8');
