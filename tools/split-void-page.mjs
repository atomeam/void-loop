// The home page is one HTML file of about 700 KB (about 220 KB compressed). Most of that is the style block and the
// main script, which the parser has to download before the ask bar can paint. The deploy pulls them out of the served
// copies (void-live-deploy/index.html and void.html) after tools/public-quotes.mjs. The repo's void.html stays the one
// file editors change. The later decorative scripts (sky, presence, synapses) are their own files and load with defer,
// so they do not hold up the first paint. The main script stays one file: its pieces share one scope (const and let),
// so they cannot be split into separate classic scripts without changing when they run.
//   node tools/split-void-page.mjs            rewrite the served copies and write the files
//   node tools/split-void-page.mjs --dry      print the sizes only
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const OPEN = { css: '  <style>\n', js: '  <script>\n' };

const BLOCKS = [
  { file: 'void-home.css', start: '  <style>\n    /* home polish:', end: '\n  </style>', kind: 'css', tag: '  <link rel="stylesheet" href="/void-home.css">\n' },
  { file: 'void-boot.js', start: '  <script>\n    // Private learning log', end: '\n  </script>', kind: 'js', tag: '  <script src="/void-boot.js"></script>\n' },
  { file: 'void-sky.js', start: '  <script>\n  // ---- The sky:', end: '\n  </script>', kind: 'js', tag: '  <script src="/void-sky.js" defer></script>\n' },
  { file: 'void-presence.js', start: '  <script>\n  // ---- Presence:', end: '\n  </script>', kind: 'js', tag: '  <script src="/void-presence.js" defer></script>\n' },
  { file: 'void-synapses.js', start: '  <script>\n  // ---- Synapses:', end: '\n  </script>', kind: 'js', tag: '  <script src="/void-synapses.js" defer></script>\n' },
];

/** pull the home style and scripts out of `html`. Null when the main script marker is not there (already split, or not the home page). Pure. */
export function splitHome(html) {
  const text = String(html || '');
  if (!text.includes('// Private learning log')) return null;
  let out = text;
  const files = {};
  for (const block of BLOCKS) {
    const s = out.indexOf(block.start);
    if (s < 0) return null;
    const e = out.indexOf(block.end, s + block.start.length);
    if (e < 0) return null;
    const open = OPEN[block.kind];
    let inner = out.slice(s + open.length, e);
    if (!inner.endsWith('\n')) inner += '\n';
    files[block.file] = inner;
    out = out.slice(0, s) + block.tag + out.slice(e + block.end.length);
  }
  if (!out.includes('rel="preload" href="/void-boot.js"')) {
    out = out.replace('</head>', '  <link rel="preload" href="/void-boot.js" as="script">\n</head>');
  }
  return { html: out, files };
}

/** rewrite the served home copies in `dir` and write the extracted files. Returns the byte sizes, or null when already split. */
export function splitServedHome(dir, { write = true } = {}) {
  const page = resolve(dir, 'index.html');
  if (!existsSync(page)) return null;
  const split = splitHome(readFileSync(page, 'utf8'));
  if (!split) return null;
  if (write) {
    for (const name of ['index.html', 'void.html']) {
      const p = resolve(dir, name);
      if (existsSync(p)) writeFileSync(p, split.html);
    }
    for (const [name, body] of Object.entries(split.files)) writeFileSync(resolve(dir, name), body);
  }
  return { html: Buffer.byteLength(split.html), files: Object.fromEntries(Object.entries(split.files).map(([k, v]) => [k, Buffer.byteLength(v)])) };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const dry = process.argv.includes('--dry');
  const sizes = splitServedHome(resolve(root, 'void-live-deploy'), { write: !dry });
  if (!sizes) { console.log('home split: the served page has no main script to pull out'); process.exit(0); }
  console.log('home split: html ' + sizes.html + ' bytes' + (dry ? ' (dry)' : '') + ', ' + Object.entries(sizes.files).map(([k, n]) => k + ' ' + n).join(', '));
}
