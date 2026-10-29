// CSP hashes (docs/secrets.md): drops 'unsafe-inline' for scripts on every page that has inline scripts. For each static
// page it hashes the inline executable <script> blocks (sha256) and adds a per-page rule to _headers that sets one more
// CSP, `script-src 'self' 'sha256-…' …`. Browsers enforce every CSP a response carries, so the page then runs only its own
// inline scripts; the /* policy keeps 'unsafe-inline' as the fallback for a deploy that skipped this step (the laptop).
// Run at deploy time (deploy.yml, just before wrangler), so a hash is never stale: nothing generated is committed.
//   node tools/csp-hashes.mjs           print the rules
//   node tools/csp-hashes.mjs --write   append them to void-live-deploy/_headers (deploy only)
import { readFileSync, writeFileSync, readdirSync, statSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join, relative } from 'node:path';

const root = new URL('../void-live-deploy/', import.meta.url).pathname;
export const MARK = '# csp-hashes (generated at deploy, tools/csp-hashes.mjs)';
export const REST = "'self' 'wasm-unsafe-eval' blob: https://static.cloudflareinsights.com";

/** html -> the sha256 sources of its inline scripts that run (JSON-LD and other data blocks do not) */
export function inlineHashes(html) {
  const out = [];
  for (const m of String(html).matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)) {
    const attrs = m[1];
    if (/\bsrc\s*=/.test(attrs)) continue;
    const t = (/\btype\s*=\s*["']?([^"'\s>]+)/i.exec(attrs) || [])[1];
    if (t && !/^(module|text\/javascript|application\/javascript)$/i.test(t)) continue;
    out.push("'sha256-" + createHash('sha256').update(m[2], 'utf8').digest('base64') + "'");
  }
  return [...new Set(out)];
}
function pages(dir = root, acc = []) {
  for (const n of readdirSync(dir)) { const p = join(dir, n); if (/\/(vendor|models|functions|node_modules)$/.test(p)) continue; if (statSync(p).isDirectory()) pages(p, acc); else if (n.endsWith('.html')) acc.push(p); }
  return acc;
}
/** the path a static page is served on (Pages redirects /x, /x/index.html and /x.html to it) */
export function pathsOf(rel) {
  if (rel === 'index.html') return ['/'];
  if (rel.endsWith('/index.html')) return ['/' + rel.slice(0, -'index.html'.length)];
  return ['/' + rel.replace(/\.html$/, '')];
}
/** Pages in one directory share one splat rule (/fix/*, /fringe/*): Cloudflare caps _headers at 100 rules, and a family of pages
 *  otherwise costs a rule per page. The shared rule lists every inline script of every page under the directory (the union), since a
 *  second CSP on a page that lacks one of its own scripts would block it; a page still runs no inline script that is not one of its
 *  directory's own. A directory whose union would make the header longer than Cloudflare takes (2,000 characters) keeps a rule per page. */
export const VALUE_MAX = 2000;
export function rules() {
  const per = [];
  for (const f of pages()) {
    const h = inlineHashes(readFileSync(f, 'utf8')); if (!h.length) continue;
    for (const p of pathsOf(relative(root, f))) per.push({ p, h: h.join(' ') });
  }
  const dirOf = (p) => (p.match(/^\/([^/]+)\/./) || p.match(/^\/([^/]+)\/$/) || [])[1]; // a directory's own index counts in it: /x/* covers /x/, so a page there with other scripts must stop the sharing
  const allPages = pages().flatMap((f) => pathsOf(relative(root, f)));
  const sets = new Map(); // directory -> every inline-script hash of every page under it (a directory's own index counts in it)
  for (const p of allPages) { const d = dirOf(p); if (!d) continue; const e = per.find((x) => x.p === p); const u = sets.get(d) || sets.set(d, new Set()).get(d); if (e) for (const h of e.h.split(' ')) u.add(h); }
  const value = (h) => 'script-src ' + REST + ' ' + h;
  const shared = new Map(); // directory -> the union of its hashes, when it fits in one header
  for (const [d, set] of sets) { const h = [...set].join(' '); if (h && value(h).length <= VALUE_MAX) shared.set(d, h); }
  const rule = (p, h) => p + '\n  Content-Security-Policy: ' + value(h);
  const out = [];
  for (const [d, h] of shared) if (per.filter((x) => dirOf(x.p) === d).length >= 3) out.push(rule('/' + d + '/*', h)); else shared.delete(d);
  for (const x of per) { const d = dirOf(x.p); if (d && shared.has(d)) continue; out.push(rule(x.p, x.h)); }
  return out;
}
if (import.meta.url === 'file://' + process.argv[1]) {
  const r = rules(), text = MARK + '\n' + r.join('\n\n') + '\n';
  if (r.length > 90) { console.error('csp-hashes: ' + r.length + ' rules, over Cloudflare\'s 100-rule budget; not written'); process.exit(1); }
  if (process.argv.includes('--write')) {
    const file = join(root, '_headers'), cur = readFileSync(file, 'utf8');
    if (cur.includes(MARK)) { console.log('csp-hashes: already written'); process.exit(0); }
    writeFileSync(file, cur.replace(/\n*$/, '\n\n') + text); console.log('csp-hashes: ' + r.length + ' page rules written');
  } else process.stdout.write(text);
}
