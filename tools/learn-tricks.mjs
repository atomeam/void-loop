// The video-tricks learner (owner, 2026-10-15: "Verse was already supposed to be learning from YouTube videos anyway"):
// finds editing tutorials on PeerTube (Sepia Search) and the Internet Archive that carry open captions, reads the captions
// (functions/api/digest.js captionsOf, lib/digest.js trickLines), and writes one line per new technique into
// docs/video-tricks.md under "## Learned from open videos": the technique, a short paraphrase-length excerpt (at most
// 14 words, the creator's words never copied whole) and the source link. YouTube is not read (its captions are owner-only).
// Run: node tools/learn-tricks.mjs [--dry] [query]. Builders' loop on the box or CI; no model, no key.
import { readFileSync, writeFileSync } from 'node:fs';
import { captionsOf } from '../void-live-deploy/functions/api/digest.js';
import { trickLines, TRICK_WORDS } from '../void-live-deploy/lib/digest.js';

const DOC = new URL('../docs/video-tricks.md', import.meta.url), HEAD = '## Learned from open videos';
export function excerpt(s, n = 14) { const w = String(s).split(/\s+/); return w.slice(0, n).join(' ') + (w.length > n ? ' …' : ''); }
export function addLearned(doc, rows) {
  const have = new Set((doc.match(/^- \*\*([^*]+)\*\*/gm) || []).map((x) => x.slice(4, -2).toLowerCase()));
  const fresh = rows.filter((r) => !have.has(r.trick.toLowerCase()) && have.add(r.trick.toLowerCase()));
  if (!fresh.length) return doc;
  const lines = fresh.map((r) => '- **' + r.trick + '**: "' + r.quote + '" (' + r.title + ', ' + r.url + ', learned ' + r.at + ')').join('\n');
  if (!doc.includes(HEAD)) doc = doc.replace(/\n## Queue \(not built yet\)/, '\n' + HEAD + '\nTechniques Verse read in openly captioned tutorials (tools/learn-tricks.mjs). Each is a lead for a new entry in `TRICKS`, not a built trick.\n\n\n## Queue (not built yet)');
  const intro = doc.indexOf('\n\n', doc.indexOf(HEAD)) + 2;
  return doc.slice(0, intro) + lines + '\n' + doc.slice(intro);
}
async function main() {
  const dry = process.argv.includes('--dry'), q = process.argv.slice(2).filter((a) => a !== '--dry').join(' ') || 'video editing tutorial';
  const found = [];
  const s = await (await fetch('https://sepiasearch.org/api/v1/search/videos?count=25&nsfw=false&search=' + encodeURIComponent(q))).json();
  const urls = (s.data || []).map((v) => ({ url: v.url, title: v.name }));
  const a = await (await fetch('https://archive.org/advancedsearch.php?q=' + encodeURIComponent('(' + q + ') AND mediatype:movies AND format:(SubRip OR "Web Video Text Tracks")') + '&fl[]=identifier&fl[]=title&rows=10&output=json')).json();
  for (const d of ((a.response && a.response.docs) || []).filter((d) => !/^youtube-/i.test(d.identifier))) urls.push({ url: 'https://archive.org/details/' + d.identifier, title: String(d.title || d.identifier) });
  for (const v of urls) {
    let c; try { c = await captionsOf(v.url); } catch (_) { continue; }
    if (!c || !c.text) continue;
    for (const line of trickLines(c.text, 3)) { const m = line.match(TRICK_WORDS); found.push({ trick: m[0].toLowerCase(), quote: excerpt(line).replace(/"/g, "'"), title: v.title.slice(0, 80).replace(/[()"]/g, ''), url: v.url, at: new Date().toISOString().slice(0, 10) }); }
  }
  const doc = readFileSync(DOC, 'utf8'), next = addLearned(doc, found);
  console.log(found.length + ' technique mentions read; ' + (next === doc ? 'nothing new' : 'new lines added'));
  if (!dry && next !== doc) writeFileSync(DOC, next);
}
if (import.meta.url === 'file://' + process.argv[1]) main();
