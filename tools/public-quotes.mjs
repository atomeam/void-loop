// Only Verse's words are served, never the owner's quoted ones (the owner, 2026-10-18). The deploy runs this on its own copy of
// void-live-deploy/ just before upload: in every served code file the comments lose any quote credited to the owner (tools/private.mjs
// quoteFree), and every served JSON file loses them from its strings. Code itself is never changed: only comment text, which a
// visitor sees with view-source. The repo keeps the quotes (build notes, append-only records); this never runs on a commit.
//   node tools/public-quotes.mjs          rewrite the deploy copy (deploy.yml)
//   node tools/public-quotes.mjs --dry    print what it would change
import { readFileSync, writeFileSync, readdirSync, statSync } from 'node:fs';
import { join, extname } from 'node:path';
import { spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { quoteFree, quotesOwner, deepQuoteFree } from './private.mjs';

const CODE = new Set(['.js', '.mjs', '.html', '.css', '.svg', '.txt', '.xml', '.md', '.webmanifest']);
/** a code file's text with the owner's quotes left out of its comments only (//, /* … *\/, <!-- … -->); code and strings unchanged. Pure. */
export function commentsQuoteFree(text, ext) {
  const block = (t) => t.replace(/\/\*[\s\S]*?\*\//g, (c) => (quotesOwner(c) ? quoteFree(c) : c)).replace(/<!--[\s\S]*?-->/g, (c) => (quotesOwner(c) ? quoteFree(c) : c));
  let out = block(text);
  if (ext === '.js' || ext === '.mjs' || ext === '.html') {
    // a run of // lines is one comment: a quote may wrap from one line to the next, so the run is cleaned as one
    const lines = out.split('\n'), res = [];
    for (let i = 0; i < lines.length;) {
      if (/^\s*\/\//.test(lines[i])) { let j = i; while (j < lines.length && /^\s*\/\//.test(lines[j])) j++; const run = lines.slice(i, j).join('\n'); res.push(...(quotesOwner(run) ? quoteFree(run) : run).split('\n')); i = j; continue; }
      // a comment after code on the same line ("code; // … (owner: "…")"): only the part after the //
      const m = /^(.*[;)},{]\s*)(\/\/.*)$/.exec(lines[i]) || /^(.*?\s)(\/\/.*)$/.exec(lines[i]); // or after any code and a space ("let x = 5 // …"); a "://" has no space before it
      if (!m) { res.push(lines[i]); i++; continue; }
      let j = i + 1; while (j < lines.length && /^\s*\/\//.test(lines[j])) j++; // the comment may go on over the // lines below it
      const run = [m[2], ...lines.slice(i + 1, j)].join('\n');
      res.push(...(m[1] + (quotesOwner(run) ? quoteFree(run) : run)).split('\n')); i = j;
    }
    out = res.join('\n');
  }
  if (ext === '.txt' || ext === '.md') out = quoteFree(out); // plain served text (llms.txt): all of it is shown
  return out;
}

function* walk(dir) { for (const n of readdirSync(dir)) { const p = join(dir, n); if (statSync(p).isDirectory()) yield* walk(p); else yield p; } }

if (process.argv[1] && new URL(import.meta.url).pathname === new URL('file://' + process.argv[1]).pathname) {
  const root = new URL('../void-live-deploy/', import.meta.url).pathname, dry = process.argv.includes('--dry');
  let files = 0;
  for (const f of walk(root)) {
    const ext = extname(f).toLowerCase(); if (ext !== '.json' && !CODE.has(ext)) continue;
    const src = readFileSync(f, 'utf8'); if (!quotesOwner(ext === '.json' ? src.replace(/\\"/g, '"') : src)) continue; // in raw JSON a quote is \"
    let out = src;
    if (ext === '.json') { try { out = JSON.stringify(deepQuoteFree(JSON.parse(src)), null, 1) + '\n'; } catch (_) { continue; } }
    else out = commentsQuoteFree(src, ext);
    // never ship code that no longer parses: a script whose cleaned copy fails `node --check` keeps its comments as they were
    if (out !== src && (ext === '.js' || ext === '.mjs')) { const t = join(tmpdir(), 'pq-' + process.pid + '.mjs'); writeFileSync(t, out); if (spawnSync(process.execPath, ['--check', t]).status !== 0) { console.log('kept as is (would not parse): ' + f); out = src; } }
    if (out !== src) { files++; if (!dry) writeFileSync(f, out); }
  }
  console.log(`public quotes: ${files} served file${files === 1 ? '' : 's'} ${dry ? 'would lose' : 'lost'} the owner's quoted words`);
}
