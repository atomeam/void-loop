// The lab's tools on the Verse pages whose subject they serve (the owner asked on 2026-11-06 for each tool to go on any page it belongs on, too).
// A tool belongs on a page when a person on that page is doing the tool's job: colours from a photo on the colour page, a seamless pattern
// next to gradients, dictation and a mind map with notes, a file checksum next to Base64, a spirit level with the calculators. Never a page
// with room to spare, never the homepage. Each placement is one folded section above the page's related links (opening it loads the tool in a
// frame, nothing loads before), and the page's related row links the tool too (lib/toolkit.js RELATED). The tool's own page stays in the Lab.
//   node tools/lab-place.mjs           writes the sections between <!-- lab-tools --> markers
//   node tools/lab-place.mjs --check   exits 1 when a page's section differs from PLACES
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { toolOf } from './lab-grade.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const D = path.join(root, 'void-live-deploy');
export const MARK = ['<!-- lab-tools -->', '<!-- /lab-tools -->'];
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

// host page -> the tools that belong on it, each with the line that says what it does there
export const PLACES = Object.freeze({
  '/color/': [['palette', 'pull the colours out of a photo, as codes to copy']],
  '/color/gradient/': [['pattern', 'grow a seamless pattern that tiles, and download it']],
  '/notes/': [['dictation', 'speak, and get the words as text to copy into a note'], ['mindmap', 'lay your ideas out as a map, and save it']],
  '/base64/': [['checksum', 'check a downloaded file is the file it says it is, by its sha256 sum']],
  '/calculators/': [['level', 'level a shelf or a frame by rise and run (open it on its own page on a phone for the tilt sensor)']],
});

/** the section a host page wears for its tools. Pure. */
export function sectionOf(rows) {
  const items = rows.map(([key, line]) => {
    const t = toolOf(key); if (!t) throw new Error('lab-place: no tool for ' + key);
    return '<details class="lab-here"><summary><b>' + esc(t.tool) + '</b>: ' + esc(line) + '</summary>'
      + '<iframe src="' + esc(t.page) + '" title="' + esc(t.tool) + '" loading="lazy" allow="microphone; clipboard-write" style="display:block;width:100%;height:560px;margin-top:8px;border:1px solid rgba(127,127,127,.35);border-radius:10px;background:#fff"></iframe>'
      + '<p style="margin:6px 0 0"><a href="' + esc(t.page) + '">Open ' + esc(t.tool) + ' on its own page</a></p></details>';
  });
  return MARK[0] + '<section id="lab-here" aria-label="Tools from the Verse lab" style="margin:14px 0">' + items.join('') + '</section>' + MARK[1];
}
/** the page with its section written above <nav id="related"> (or replaced in place); null when the page has no related nav. Pure. */
export function placeIn(html, rows) {
  const s = sectionOf(rows), a = html.indexOf(MARK[0]), b = html.indexOf(MARK[1]);
  if (a >= 0 && b > a) return html.slice(0, a) + s + html.slice(b + MARK[1].length);
  const at = html.indexOf('<nav id="related"'); if (at < 0) return null;
  return html.slice(0, at) + s + '\n' + html.slice(at);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const check = process.argv.includes('--check'); let bad = 0;
  for (const [page, rows] of Object.entries(PLACES)) {
    const f = path.join(D, page, 'index.html'), was = fs.readFileSync(f, 'utf8'), now = placeIn(was, rows);
    if (now == null) { console.error('lab-place: ' + page + ' has no <nav id="related">'); bad++; continue; }
    if (now !== was) { if (check) { console.error('lab-place: ' + page + ' is stale (run node tools/lab-place.mjs)'); bad++; } else fs.writeFileSync(f, now); }
    console.log('lab-place: ' + page + ' <- ' + rows.map(([k]) => toolOf(k).tool).join(', '));
  }
  process.exit(bad ? 1 : 0);
}
