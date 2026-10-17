#!/usr/bin/env node
// Typo audit (asked by Void: "a 'typo-audit' linting step in the builder's CI that specifically checks skill files and metadata for common
// character reversals"). A word in the skills' metadata (each skill's name, examples and near misses; the book's titles, lines and lore; the
// families' names and blurbs) is flagged when it is rarer than a word it becomes by swapping two neighbouring letters ("teh" beside "the",
// "convetr" beside "convert"): a reversal, the commonest slip of a typing hand. A real word that happens to sit one swap from another
// ("form" and "from") is never flagged when lib/fuzzy.js COMMON knows it, or when tools/typo-audit.json allows it. Run by tools/checks.mjs.
//   node tools/typo-audit.mjs           every flagged word, with where it came from
//   node tools/typo-audit.mjs --check   exit 1 when anything is flagged
import { readFileSync, readdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url)), root = resolve(here, '..'), site = resolve(root, 'void-live-deploy');
const words = (t) => String(t || '').toLowerCase().match(/[a-z]{4,}/g) || [];

/** reversals in texts [{ text, from }]: a word w is flagged when swapping two neighbouring letters makes a word seen more often than w (and at
 *  least twice), and w is neither in `known` nor in `allow`. [{ word, likely, from }], one per word, sorted. Pure. */
export function reversals(texts, known = new Set(), allow = new Set()) {
  const count = new Map(), where = new Map();
  for (const { text, from } of texts || []) for (const w of words(text)) { count.set(w, (count.get(w) || 0) + 1); if (!where.has(w)) where.set(w, from); }
  const out = [];
  for (const [w, n] of count) {
    if (known.has(w) || allow.has(w)) continue;
    for (let i = 0; i < w.length - 1; i++) {
      if (w[i] === w[i + 1]) continue;
      const s = w.slice(0, i) + w[i + 1] + w[i] + w.slice(i + 2), m = count.get(s) || 0;
      if (m >= 2 && m > n) { out.push({ word: w, likely: s, from: where.get(w) }); break; }
    }
  }
  return out.sort((a, b) => a.word.localeCompare(b.word));
}

/** the metadata texts: every skill file's name, examples and near misses; the book's page titles, lines and lore; the families' names and blurbs. */
export async function metadataTexts() {
  const texts = [], add = (text, from) => { if (typeof text === 'string' && text) texts.push({ text, from }); };
  for (const f of readdirSync(resolve(site, 'skills')).filter((n) => n.endsWith('.js'))) {
    let s = null; try { s = (await import(pathToFileURL(resolve(site, 'skills', f)).href)).default; } catch (_) { continue; } // a skill that needs a browser to load is read through the book instead
    if (!s || typeof s !== 'object') continue;
    for (const k of ['examples', 'nearMisses']) for (const t of Array.isArray(s[k]) ? s[k] : []) add(t, 'skills/' + f + ' ' + k);
  }
  const guide = JSON.parse(readFileSync(resolve(site, 'skills', 'guide.json'), 'utf8'));
  for (const p of guide.pages || []) { for (const k of ['title', 'line', 'flavor']) add(p[k], 'guide.json ' + (p.name || p.kind)); for (const t of p.examples || []) add(t, 'guide.json ' + (p.name || p.kind)); }
  const fam = JSON.parse(readFileSync(resolve(site, 'skills', 'families.json'), 'utf8'));
  for (const f of fam.families || []) { add(f.name, 'families.json'); add(f.for, 'families.json ' + f.name); }
  return texts;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const { COMMON } = await import(pathToFileURL(resolve(site, 'lib', 'fuzzy.js')).href);
  const allow = new Set(Object.keys(JSON.parse(readFileSync(resolve(here, 'typo-audit.json'), 'utf8')).allow || {}));
  const hits = reversals(await metadataTexts(), COMMON, allow);
  for (const h of hits) console.log(h.word + ' (likely "' + h.likely + '") in ' + h.from);
  console.log(hits.length ? hits.length + ' possible reversal(s): fix the word, or add it to tools/typo-audit.json "allow" if it is right' : 'ok: no letter reversals in the skills\' metadata');
  if (process.argv.includes('--check') && hits.length) process.exit(1);
}
