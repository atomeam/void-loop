#!/usr/bin/env node
// Report to growth (asked by Verse, 2026-10-18: "Create a 'report-to-growth' automation that parses builder progress notes for wishlist
// items and populates the growth inbox"). A builder's note (a PR's Evolve section, a "Next:" line, "What I'd add: ...", a pasted report)
// names what should be built next; until now someone had to copy it into the frontier (domains/void.frontier.md, the one build order the
// growth inbox points at). This reads the note, keeps the wishes, drops the ones the frontier or the inbox already has (same words, or
// nearly), and adds the rest to the frontier's open list, each marked with where it came from. Never removes or rewrites anything.
//
//   node tools/report-to-growth.mjs <file|->            print the wishes a note holds and which are new (nothing is written)
//   node tools/report-to-growth.mjs --text "a; b" ...   the same for a short list: pieces split on ; or new lines count as wishes
//   ... --write [--from "who and when"]                 add the new ones to the frontier's open list
// tools/finish.mjs --evolve "a; b" runs it on the wishes a ship names, and prints them under the PR's Evolve heading.
import { readFileSync, writeFileSync } from 'node:fs';
import { FRONTIER, openItems, addOpen } from './frontier.mjs';

const inboxPath = new URL('../domains/growth-inbox.md', import.meta.url);
const MAX = 8, MIN_LEN = 12, MAX_LEN = 300;
const HEAD = /^\s{0,3}(?:#{1,6}\s*)?(?:\*\*)?(?:evolve|next(?: steps?| asks?)?|wish ?list|follow-?ups?|to-?do|still to do|ideas?|what i(?:'d| would) add)(?:\*\*)?\s*:?\s*(?:\*\*)?\s*$/i;
const INLINE = /^\s*(?:[-*+]\s+)?(?:\*\*)?(?:evolve|next(?: asks?)?|wish ?list|follow-?up|to-?do|what i(?:'d| would) add|i(?:'d| would) like)(?:\*\*)?\s*:\s*(?:\*\*)?\s*(.+)$/i;
const WOULD = /^\s*(?:[-*+]\s+)?(i(?:'d| would) (?:add|implement|build|create|teach|make)\b.*)$/i;
const BULLET = /^\s*(?:[-*+]|\d+[.)])\s+(.*)$/;
const NONE = /^(?:none|nothing|n\/a|tbd|no\b|-+)\s*\.?$/i;
const STOP = new Set('the and for with that this from into when what will than then also only each every about have has are was were can could should would not its their your you our out all any new more'.split(' '));

const clean = (s) => String(s || '').replace(/\*\*|__|`/g, '').replace(/\[([^\]]+)\]\([^)]*\)/g, '$1').replace(/\s+/g, ' ').replace(/[\s.;:]+$/, '').trim();
const words = (t) => [...new Set(String(t || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').split(' ').filter((w) => w.length > 3 && !STOP.has(w)).map((w) => w.replace(/(?:ing|ed|es|s)$/, '')))];
// a long wish ends at its last whole sentence, else its last whole clause, else its last whole word, and never with "…" (owner: no
// line cut with "..."; the wants card showed "wait for the card to settle before checking…", 2026-10-30)
const cut = (t) => {
  if (t.length <= MAX_LEN) return t;
  const head = t.slice(0, MAX_LEN + 1); let end = -1, m;
  for (const re of [/[.!?](?=\s)/g, /[,;:](?=\s)/g]) { while ((m = re.exec(head))) if (m.index > 40) end = re.source[1] === '.' ? m.index + 1 : m.index; if (end > 0) break; }
  if (end < 0) { const sp = head.lastIndexOf(' '); end = sp > 40 ? sp : MAX_LEN; }
  return t.slice(0, end).replace(/[\s,;:(\-]+$/, '');
};
const keep = (s) => { const t = clean(s); return t.length >= MIN_LEN && !NONE.test(t) ? cut(t) : ''; };

/** the wishes in a builder's note, in order, without repeats: bullets under a heading like Evolve / Next / Wishlist / Follow-ups / To do,
 *  lines like "Next: ...", "Wishlist: ...", "What I'd add: ..." and "I would implement ..." sentences. `bare` treats every piece of a short list
 *  (split on ; and new lines) as a wish. Pure. */
export function wishlistOf(text, { bare = false } = {}) {
  const lines = String(text || '').split('\n'), found = [];
  if (bare) for (const piece of lines.flatMap((l) => l.split(';'))) found.push(keep(piece.replace(BULLET, '$1')));
  else {
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const inline = INLINE.exec(line);
      if (inline) { found.push(keep(inline[1])); continue; }
      if (HEAD.test(line)) {
        let seen = 0, blanks = 0;
        for (let j = i + 1; j < lines.length; j++) {
          const l = lines[j];
          if (!l.trim()) { if (++blanks > 1 || seen) break; continue; }
          const b = BULLET.exec(l);
          if (!b) break;
          blanks = 0; seen++; found.push(keep(b[1])); i = j;
        }
        continue;
      }
      const would = WOULD.exec(line);
      if (would) found.push(keep(would[1]));
    }
  }
  const seen = new Set();
  return found.filter((t) => { const k = t.toLowerCase(); if (!t || seen.has(k)) return false; seen.add(k); return true; }).slice(0, MAX);
}

/** the asks the growth inbox's table holds (any status), lower-cased. Pure. */
export const inboxAsks = (md) => String(md || '').split('\n').flatMap((l) => { const c = l.split('|').map((x) => x.trim()); return c.length >= 5 && /^(?:open|shipped|dropped|done)/i.test(c[1]) ? [c[3]] : []; });

const same = (a, b) => { const x = words(a), y = new Set(words(b)); if (x.length < 3 || y.size < 3) return a.toLowerCase() === b.toLowerCase(); return x.filter((w) => y.has(w)).length / Math.min(x.length, y.size) >= 0.7; };

/** the wishes the frontier's open list and the inbox do not already hold (same words, or 70% of the key words). Pure. */
export function newWishes(wishes, frontierText, inboxText = '') {
  const have = [...openItems(frontierText).map((o) => o.title), ...inboxAsks(inboxText)];
  const out = [];
  for (const w of wishes) if (!have.some((h) => same(w, h)) && !out.some((o) => same(w, o))) out.push(w);
  return out;
}

/** the frontier text with each wish added to its open list, marked with where it came from. Pure. */
export const addWishes = (frontierText, wishes, from) => wishes.reduce((t, title) => addOpen(t, { title, from, why: "from a builder's note (tools/report-to-growth.mjs)" }), String(frontierText));

function main(argv) {
  const opt = (f) => { const i = argv.indexOf(f); return i >= 0 && argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[i + 1] : ''; };
  const text = opt('--text'), file = argv.find((a, i) => !a.startsWith('--') && argv[i - 1] !== '--text' && argv[i - 1] !== '--from');
  if (!text && !file) { console.error('usage: node tools/report-to-growth.mjs <file|-> | --text "a; b"  [--write] [--from "who and when"]'); return 2; }
  const source = text || readFileSync(file === '-' ? 0 : file, 'utf8');
  const wishes = wishlistOf(source, { bare: !!text });
  const frontier = readFileSync(FRONTIER, 'utf8'), inbox = readFileSync(inboxPath, 'utf8');
  const fresh = newWishes(wishes, frontier, inbox);
  console.log(wishes.length + ' wish' + (wishes.length === 1 ? '' : 'es') + ' in the note, ' + fresh.length + ' new');
  for (const w of wishes) console.log((fresh.includes(w) ? '  new   ' : '  known ') + w);
  if (fresh.length && argv.includes('--write')) {
    writeFileSync(FRONTIER, addWishes(frontier, fresh, opt('--from') || 'builder note ' + new Date().toISOString().slice(0, 10)));
    console.log('added ' + fresh.length + ' to the frontier open list (domains/void.frontier.md)');
  }
  return 0;
}

if (process.argv[1] && new URL(import.meta.url).pathname === new URL('file://' + process.argv[1]).pathname) process.exit(main(process.argv.slice(2)));
