// The home page is one HTML file of about 700 KB. The deploy pulls the style and the scripts out of the served
// copies after tools/public-quotes.mjs. The repo's void.html stays the file editors change.
// The served page paints from the HTML and a small critical style that stays inline. The rest of the style loads
// without blocking. The main script is added on the frame after the first paint. The sky, the presence rim, the
// synapse canvas, the command palette and the WebGL wash are fetched only after the largest paint, or after four seconds,
// and never before the main script has run (they read its globals).
// The ask engine stays one file: its parts share one scope. Skill modules start on a key, a tap, or an idle callback.
//   node tools/split-void-page.mjs            rewrite the served copies and write the files
//   node tools/split-void-page.mjs --dry      print the sizes only
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const OPEN = { css: '  <style>\n', js: '  <script>\n' };
// The hero uses the system font. Caveat is the handwriting on a note, fetched when a note is shown, not for the first paint.
const CSS_TAG = '  <link rel="stylesheet" href="/void-home.css" media="print" onload="this.media=\'all\'">\n  <noscript><link rel="stylesheet" href="/void-home.css"></noscript>\n';
const AFTER = [
  '<script>',
  '(function(){',
  '  var bootDone = false, booted = false, decorWanted = false, decorDone = false;',
  '  function add(src, type){ var s = document.createElement("script"); if (type) s.type = type; s.src = src; document.body.appendChild(s); return s; }',
  // the decor scripts read the main script's globals (the sky reads things), and an added script runs when its download ends,
  // so the small sky file used to run before the big main one: decor is asked for at the largest paint and starts once boot has run
  // an ask typed before the main script has run (the box is in the HTML from the first paint) is kept and asked once it has run,
  // so an Enter on a fast reload is never lost (Site test, tools/glitch-titles.mjs --live: the returning visit's "films" never opened)
  '  var early = null, input0 = document.getElementById("input"), go0 = document.getElementById("go");',
  '  function keep(){ if (booted || !input0 || !input0.value.trim()) return; early = input0.value; boot(); }',
  '  if (input0) input0.addEventListener("keydown", function(e){ if (e.key === "Enter" && !e.isComposing) keep(); });',
  '  if (go0) go0.addEventListener("click", keep);',
  '  function ready(){ booted = true; if (early !== null && input0 && go0) { input0.value = early; early = null; go0.click(); } if (decorWanted) decor(); }',
  '  function boot(){ if (bootDone) return; bootDone = true; var s = add("/void-boot.js"); s.onload = ready; s.onerror = ready; }',
  '  function decor(){',
  '    decorWanted = true; if (!booted) { boot(); return; }',
  '    if (decorDone) return; decorDone = true;',
  '    var l = document.createElement("link"); l.rel = "stylesheet"; l.href = "/verse.css"; document.head.appendChild(l);',
  '    add("/void-sky.js"); add("/void-presence.js"); add("/void-synapses.js");',
  '    add("/verse-shell.js", "module"); add("/verse-field.js", "module");',
  '  }',
  '  function frame(){ requestAnimationFrame(function(){ requestAnimationFrame(boot); }); }',
  '  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", frame); else frame();',
  '  try { var po = new PerformanceObserver(function(list, obs){ if (list.getEntries().length) { obs.disconnect(); decor(); } }); po.observe({ type: "largest-contentful-paint", buffered: true }); } catch (e) {}',
  '  setTimeout(decor, 4000);',
  '  var install = document.getElementById("verse-install"), promptEv = null;',
  '  window.addEventListener("beforeinstallprompt", function(e){ e.preventDefault(); promptEv = e; if (install) install.hidden = false; });',
  '  if (install) install.addEventListener("click", function(){ if (!promptEv) return; promptEv.prompt(); promptEv = null; install.hidden = true; });',
  '})();',
  '</script>',
].join('\n');

const BLOCKS = [
  { file: 'void-home.css', start: '  <style>\n    /* home polish:', end: '\n  </style>', kind: 'css', tag: CSS_TAG },
  { file: 'void-boot.js', start: '  <script>\n    // Private learning log', end: '\n  </script>', kind: 'js', tag: '' },
  { file: 'void-sky.js', start: '  <script>\n  // ---- The sky:', end: '\n  </script>', kind: 'js', tag: '' },
  { file: 'void-presence.js', start: '  <script>\n  // ---- Presence:', end: '\n  </script>', kind: 'js', tag: '' },
  { file: 'void-synapses.js', start: '  <script>\n  // ---- Synapses:', end: '\n  </script>', kind: 'js', tag: '' },
];

/** pull the home style and scripts out of `html`. Null when the main script marker is not there. Pure. */
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
  if (!out.includes('void-boot.js')) out = out.replace('</body>', AFTER + '\n</body>');
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
