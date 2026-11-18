// The book carries no decorative art (pitch-black glass, 2026-11-18): every page of the Book of Verse, its cover and its back cover are
// checked here for a decorative picture. A diagram that carries information may stay, but only as a monochrome hairline schematic:
// strokes of one colour, rgba(180,200,230,0.25), and no fills. Fails on any other <svg>, on an emoji or pictograph, and on an <img>.
// Run by tools/guard-source.mjs on every pull request.   node tools/book-art.mjs
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

export const SCHEMATIC = 'rgba(180,200,230,0.25)';
const norm = (c) => String(c || '').replace(/\s+/g, '').toLowerCase();

/** the faults in one piece of book html: a multi-colour or filled svg, an emoji or pictograph, an img. Pure. */
export function bookArtFaults(html, where = 'page') {
  const out = [], s = String(html || '');
  for (const svg of s.match(/<svg[\s\S]*?<\/svg>/gi) || []) {
    const fills = [...svg.matchAll(/\bfill\s*[=:]\s*["']?([^"';>\s]+)/gi)].map((m) => norm(m[1])).filter((c) => c !== 'none');
    const strokes = [...svg.matchAll(/\b(?:stroke|stop-color|color)\s*[=:]\s*["']?([^"';>\s]+)/gi)].map((m) => norm(m[1])).filter((c) => c !== 'none');
    const colours = new Set(strokes);
    if (fills.length || /<(?:image|lineargradient|radialgradient|filter)\b/i.test(svg)) out.push(where + ': a filled or shaded picture (' + (fills[0] || 'gradient or filter') + '); a diagram is hairline strokes only');
    else if (colours.size > 1 || (colours.size === 1 && !colours.has(norm(SCHEMATIC)))) out.push(where + ': a picture in ' + [...colours].slice(0, 3).join(', ') + '; a diagram is drawn in ' + SCHEMATIC + ' only');
    else if (!colours.size) out.push(where + ': a picture with no hairline stroke');
  }
  const emoji = s.replace(/<[^>]*>/g, ' ').match(/\p{Emoji_Presentation}|\p{Extended_Pictographic}\uFE0F/u);
  if (emoji) out.push(where + ': an emoji or pictograph (' + emoji[0] + ')');
  if (/<img\b/i.test(s)) out.push(where + ': an <img> (clipart or a thumbnail)');
  return out;
}

/** every page of the real book, typeset, and the covers. */
export async function auditBook(root = resolve(dirname(fileURLToPath(import.meta.url)), '..')) {
  const { pageHtml, coverHtml, backCoverHtml } = await import(resolve(root, 'void-live-deploy/lib/tome.js'));
  const book = JSON.parse(readFileSync(resolve(root, 'void-live-deploy/skills/guide.json'), 'utf8'));
  const esc = (v) => String(v == null ? '' : v).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  const out = [...bookArtFaults(coverHtml(book, esc), 'the cover'), ...bookArtFaults(backCoverHtml(book, esc), 'the back cover')];
  for (const p of book.pages) out.push(...bookArtFaults(pageHtml(p, book, esc), 'page ' + p.n + ' (' + (p.title || p.kind) + ')'));
  return out;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const bad = await auditBook();
  for (const b of bad.slice(0, 20)) console.log('FAIL book art: ' + b);
  console.log(bad.length ? bad.length + ' decorative picture(s) in the book' : 'the book carries no decorative art');
  process.exit(bad.length ? 1 : 0);
}
