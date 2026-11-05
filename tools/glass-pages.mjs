// Tool pages opt into verse.css. The link is on the <html> line; the parser moves it into the head.
//   node tools/glass-pages.mjs --check
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { resolve, dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..'), site = join(root, 'void-live-deploy');
export const OLD = /#(?:6d4aff|a58bff|8b7bff|8f7bff|5b36f0|0b0a10|f7f6fb|07060d|07060b|0a0a0a)/i;

/** add class="vs-tool" and /verse.css. A page that already links the file is left alone. */
export function stamp(html) {
  const text = String(html || '');
  if (text.includes('/verse.css') || !/<html\b/i.test(text)) return text;
  return text.replace(/<html\b([^>]*)>/i, (_, attrs) => {
    let a = attrs || '';
    if (/class\s*=\s*"/.test(a)) a = a.replace(/class\s*=\s*"([^"]*)"/, 'class="$1 vs-tool"');
    else a += ' class="vs-tool"';
    return '<html' + a + '><link rel="stylesheet" href="/verse.css" media="screen">';
  });
}

export function gaps(read = (f) => readFileSync(f, 'utf8')) {
  const out = [];
  const walk = (d) => { for (const n of readdirSync(d)) { if (n === 'vendor' || n === 'node_modules' || n === 'lab') continue; const f = join(d, n); if (statSync(f).isDirectory()) walk(f); else if (n.endsWith('.html')) {
    const rel = '/' + relative(site, f).split('\\').join('/');
    if (rel === '/index.html' || rel === '/void.html') continue;
    const html = read(f);
    if (OLD.test(html) && !html.includes('class="vs-tool"') && !html.includes('/verse.css')) out.push(rel);
  } } };
  walk(site);
  return out.sort();
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const left = gaps();
  if (left.length) { console.error(left.join('\n')); process.exit(1); }
  console.log('ok: old-palette pages opt into /verse.css');
}
