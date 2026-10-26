// "Link what works together" held (docs/RULES.md; owner, 2026-10-26: "and link them all if they are usable together"): fails when
//   - a sitemap page has no related row (lib/toolkit.js mountRelated, or the plain-links row a function renders), or no entry in RELATED;
//   - a page that makes a kind another page takes (MAKES in lib/toolkit.js) does not offer it ("Send to"), or a page that takes one
//     (RECEIVES, without a link of its own in lib/handoff.js) does not receive it;
//   - a sitemap page is missing from the index of everything (/tools/, tools/everything.mjs).
// The page's code is followed through its scripts and the modules they import, three files deep, so a page whose work is in a shared lib counts.
//   node tools/link-check.mjs     (checks.mjs 'links')
import { readFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { RELATED } from '../void-live-deploy/lib/toolkit.js';
import { PRODUCERS, RECEIVERS } from '../void-live-deploy/lib/handoff.js';
import { locsOf } from './sitemap.mjs';
import { missingFrom } from './everything.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..'), D = resolve(root, 'void-live-deploy');
// pages whose related row is not a page file of their own: the stage (it links everything by asks), a text file for agents, and the pages a
// function renders (their row is in the function); a page of a floor whose row is its leader's ('/photos/<site>/' shares /photos/app.js)
export const EXEMPT = Object.freeze({ '/': 'the stage itself: every ask is a link to the page that does it', '/llms.txt': 'plain text for agents, no page' });
export const RENDERED = Object.freeze([[/^\/is-it\//, 'functions/is-it/[what].js', '/is-it/'], [/^\/fix\/.+/, 'fix/index.html', '/fix/']]);

const read = (f) => { try { return readFileSync(f, 'utf8'); } catch (_) { return ''; } };
/** a page's code: its html and every script and module it loads, three files deep (only files under void-live-deploy). */
export function sourceOf(file, depth = 3) {
  let all = read(file), scan = all; const seen = new Set([file]);
  for (let d = 0; d < depth; d++) {
    let more = '';
    for (const m of scan.matchAll(/<script[^>]*\bsrc="(\/[^"]+\.m?js)"|\bimport\(\s*'(\.{0,2}\/[^']+\.m?js)'\s*\)|\bimport\s[^'"]*?from\s*'(\.{0,2}\/[^']+\.m?js)'|\bimport\s*'(\.{0,2}\/[^']+\.m?js)'/g)) {
      const u = m[1] || m[2] || m[3] || m[4], f = u.startsWith('/') ? resolve(D, '.' + u) : resolve(D, 'lib', u); // relative imports are the libs' own (lib/x.js imports ./y.js)
      if (seen.has(f) || !f.startsWith(D) || !existsSync(f)) continue; seen.add(f); more += '\n' + read(f);
    }
    all += more; scan = more; if (!more) break;
  }
  return all;
}
const fileOf = (path) => resolve(D, '.' + path + 'index.html');

/** every broken link rule, as lines; [] when all hold. */
export function problems({ locs = locsOf(read(resolve(D, 'sitemap.xml'))).map((u) => u.replace(/^https?:\/\/[^/]+/, '')), index = read(resolve(D, 'tools/index.html')) } = {}) {
  const out = [];
  for (const p of locs) {
    if (EXEMPT[p]) continue;
    const r = RENDERED.find(([re]) => re.test(p));
    if (r) { const src = read(resolve(D, r[1])); if (!RELATED[r[2]] || !/<nav id="related"/.test(src)) out.push(p + ': no related row (' + r[1] + ', RELATED[\'' + r[2] + '\'])'); continue; }
    const src = sourceOf(fileOf(p)); if (!src) { out.push(p + ': no page file'); continue; }
    const m = /mountRelated\([^,]+,\s*'((?:\/[a-z0-9-]+)*\/)'/.exec(src);
    if (!/<nav id="related"/.test(src) || !m) out.push(p + ': no related row (a <nav id="related"> and mountRelated(el, \'' + p + '\'))');
    else if (!(RELATED[m[1]] || []).length) out.push(p + ': mounts the row of ' + m[1] + ', which has no RELATED entry in lib/toolkit.js');
  }
  for (const [p, kinds] of Object.entries(PRODUCERS)) { const src = sourceOf(fileOf(p)); for (const k of kinds) if (!new RegExp("\\boffer(?:Out)?\\('" + k + "'").test(src)) out.push(p + ' makes ' + k + ' (MAKES in lib/toolkit.js) but offers no "Send to": call offer(\'' + k + '\', () => data)'); }
  for (const [p, r] of Object.entries(RECEIVERS)) { if (r.link) continue; const src = sourceOf(fileOf(p)); if (!new RegExp("\\breceive\\('" + p.replace(/\//g, '\\/') + "'").test(src)) out.push(p + ' takes ' + r.kinds.join(', ') + ' (RECEIVES in lib/toolkit.js) but never calls receive(\'' + p + '\', {...})'); }
  const miss = missingFrom(index, locs); if (miss.length) out.push('not in the index of everything (node tools/everything.mjs): ' + miss.join(', '));
  return out;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const bad = problems();
  if (bad.length) { console.error(bad.slice(0, 12).join('\n') + (bad.length > 12 ? '\nand ' + (bad.length - 12) + ' more' : '')); process.exit(1); }
  console.log('ok: every sitemap page has its related row and is in the index; every page that makes something another page takes offers it');
}
