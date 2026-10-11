// Reading domains/void.frontier.md, the one build order (cleanup step 2, 2026-10-11), the same way everywhere: the open items
// folded in from the old lists, the cleanup steps not done yet, and adding an item. Used by tools/next.mjs (what a run takes
// next), tools/self-context.mjs (what Void says is still open about itself) and tools/grow-ideas.mjs (the idea intake).
// tools/will.py reads the same open list with the same rule (it is Python). Tests: tools/frontier.test.mjs.
import { readFileSync } from 'node:fs';

export const FRONTIER = new URL('../domains/void.frontier.md', import.meta.url);
export const OPEN_HEADER = '**Folded in from the old lists';
const plain = (s) => String(s || '').replace(/\*\*|`/g, '').replace(/\s+/g, ' ').trim();

/** the open items: [{ title, why, from }] from the bullets under OPEN_HEADER, up to the first blank line */
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
    const src = /\(`([^`]+)`([^)]*)\)/.exec(title + ' ' + rest);
    title = plain(title.replace(/\s*\(`[^)]*\)\s*/, ' '));
    rest = rest.replace(/^\s*\(`[^)]*\)\s*:?\s*/, '');
    out.push({ title, why: plain(rest).replace(/^:\s*/, ''), from: src ? plain(src[1] + src[2]) : '' });
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
