// Writes void-live-deploy/lib/emoji-dict-data.js, the emoji the dictionary page (/emojis/dictionary/, emojigraph.org's tower lane) reads on the device:
// every fully qualified emoji of the Unicode list with its English name, its group and subgroup (the Unicode emoji-test order), the Emoji version
// it came in and its keywords. The source is the emojibase-data package (MIT, Miles Johnson; the CLDR names and keywords of the Unicode Consortium),
// read from a folder given on the command line, so nothing is fetched here and the page never fetches it either.
//   npm pack emojibase-data@16.0.3 && tar xzf emojibase-data-16.0.3.tgz && node tools/emoji-dict-data.mjs package
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'), OUT = path.join(ROOT, 'void-live-deploy/lib/emoji-dict-data.js');
// the nine groups, named as the Unicode list names them ("component", the skin tones and hair parts, is not an emoji of its own and is left out)
export const GROUP_NAMES = Object.freeze({ 'smileys-emotion': 'Smileys & Emotion', 'people-body': 'People & Body', 'animals-nature': 'Animals & Nature', 'food-drink': 'Food & Drink',
  'travel-places': 'Travel & Places', activities: 'Activities', objects: 'Objects', symbols: 'Symbols', flags: 'Flags' });
const clean = (s) => String(s).replace(/[\t\n|]/g, ' ').trim();
/** a subgroup key as words: "face-smiling" -> "Face smiling". Pure. */
export const subgroupName = (key) => { const s = String(key).replace(/-/g, ' '); return s.charAt(0).toUpperCase() + s.slice(1); };
/** the module text for emojibase's English data and its group table. Pure. */
export function moduleOf(data, meta, version) {
  const groupKeys = Object.keys(GROUP_NAMES), gIndex = new Map(groupKeys.map((k, i) => [k, i]));
  const subs = [], sIndex = new Map();
  for (const [g, list] of Object.entries(meta.hierarchy)) { const gk = meta.groups[g]; if (!gIndex.has(gk)) continue; for (const s of list) { sIndex.set(s, subs.length); subs.push([meta.subgroups[s], subgroupName(meta.subgroups[s]), gIndex.get(gk)]); } }
  const rows = data.filter((e) => e.group != null && sIndex.has(e.subgroup) && gIndex.has(meta.groups[e.group])).sort((a, b) => a.order - b.order)
    .map((e) => [e.emoji, clean(e.label), sIndex.get(e.subgroup), e.version, (e.tags || []).map(clean).filter(Boolean).join(' ')].join('|'));
  return '// Written by tools/emoji-dict-data.mjs from emojibase-data ' + version + ' (MIT, Miles Johnson; names and keywords from the Unicode CLDR). Do not edit by hand.\n'
    + '// One row an emoji, in the Unicode order: character|name|subgroup|Emoji version|keywords. Read by lib/emoji-dict.js. Pure data.\n'
    + 'export const SOURCE = ' + JSON.stringify('emojibase-data ' + version + ' (MIT), names and keywords from the Unicode CLDR') + ';\n'
    + 'export const GROUPS = Object.freeze(' + JSON.stringify(groupKeys.map((k) => [k, GROUP_NAMES[k]])) + ');\n'
    + 'export const SUBGROUPS = Object.freeze(' + JSON.stringify(subs) + ');\n'
    + 'export const ROWS = ' + JSON.stringify(rows.join('\n')) + ';\n';
}
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const dir = process.argv[2]; if (!dir) { console.error('usage: node tools/emoji-dict-data.mjs <emojibase-data package folder>'); process.exit(2); }
  const read = (f) => JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8')), pkg = read('package.json');
  const text = moduleOf(read('en/data.json'), read('meta/groups.json'), pkg.version);
  fs.writeFileSync(OUT, text); console.log('wrote ' + path.relative(ROOT, OUT) + ' (' + Math.round(text.length / 1024) + ' KB)');
}
