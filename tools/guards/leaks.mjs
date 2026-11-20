// Leak sweep: signed out, open the public face of a-to-mind.com and look for the names of the sites the Tower measures against (those names are for the
// owner-only Versus). A hit is fixed in the same run: a file the repo holds is added to the deploy-time scrub (void-live-deploy/lib/scrub-extra.json, read by
// tools/public-sites.mjs: the host becomes "another site" in the deploy copy, #3062); a page or answer that code builds is a heal job for the coder.
import { readdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { studiedIn, scrubCode } from '../../void-live-deploy/lib/scrub-sites.js';
import { ownerOnlyPath } from '../../void-live-deploy/lib/owner-gate.js';

export const CORE = ['/', '/self.json', '/void.asks.json', '/void.growth.json', '/void.knowledge.json', '/void.better.json', '/llms.txt', '/sitemap.xml', '/tools.json', '/openapi.json', '/incidents.json',
  '/progress/', '/progress/nightly.json', '/scoreboard/', '/tools/', '/credits/', '/api/will', '/api/reflect', '/api/treasury'];
export const ASKS = ['what is next', 'what are you working on', 'what is still open', 'what do you want next', 'which sites do you measure against', 'who are your rivals'];
const PAGES_PER_RUN = 120, FOLLOW_MAX = 150, POOL = 10;

/** the same-origin files a page or script points at (scripts, data, imports). Pure. */
export function refsIn(text) {
  const out = new Set();
  for (const m of String(text || '').matchAll(/["'`(](\/[A-Za-z0-9_\-./]+\.(?:js|mjs|json|txt|xml))(?:\?[^"'`)\s]*)?["'`)]/g)) out.add(m[1]);
  return [...out];
}
/** a rotating slice of a long list: the same hour reads the same slice, the next hour the next, so the whole list is read in a day. Pure. */
export function sliceOf(list, now, size = PAGES_PER_RUN, everyMs = 2 * 3600e3) {
  if (list.length <= size) return list.slice();
  const start = (Math.floor(now / everyMs) * size) % list.length;
  return list.concat(list).slice(start, start + size);
}
/** the repo file a served path comes from, or '' when code builds it. Pure given `exists`. */
export function fileOf(path, exists) {
  const p = String(path || '').split(/[?#]/)[0];
  if (/^\/api\//.test(p)) return '';
  const cands = p.endsWith('/') ? [p + 'index.html'] : [p, p + '/index.html'];
  const hit = cands.find((c) => exists('void-live-deploy' + c));
  return hit ? 'void-live-deploy' + hit : '';
}
/** what to do about one leak: scrub a static file, lock nothing the gate already locks, or hand dynamic output to the coder. Pure. */
export const WAIT_DEPLOY_MS = 12 * 3600e3; // a file just put through the scrub is not a failure until a deploy has had this long to carry it
export function planFor(path, hosts, { exists, listed, at = {}, now = Date.now(), text = '' }) {
  const file = fileOf(path, exists), rel = file.replace(/^void-live-deploy\//, '');
  if (ownerOnlyPath(path)) return { kind: 'heal', why: 'the owner gate lets ' + path + ' through' };
  if (file && /\.m?js$/.test(file)) { // a script: its comments are scrubbed; a site its code really uses (a link, a feed) stays, and is only counted
    const rest = studiedIn(scrubCode(text));
    if (!listed.includes(rel) && scrubCode(text) !== text) return { kind: 'scrub', file: rel, rest };
    if (rest.length) return { kind: 'code', file: rel, rest };
  }
  if (file && !listed.includes(rel)) return { kind: 'scrub', file: rel };
  if (file && now - Date.parse(at[rel] || 0) < WAIT_DEPLOY_MS) return { kind: 'wait', file: rel };
  return { kind: 'heal', why: file ? 'the deploy scrub is on for ' + path + ' and it still names ' + hosts.join(', ') : path + ' is built by code' };
}
export const healTarget = (path) => ('heal:leak-' + path.replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '')).slice(0, 40).toLowerCase();

function routesOf(root) {
  const base = join(root, 'void-live-deploy'), out = [];
  const walk = (d, route) => { let ents = []; try { ents = readdirSync(d, { withFileTypes: true }); } catch { return; } for (const e of ents) { if (!e.isDirectory() || /^(node_modules|lib|functions|vendor|api|history|rivals)$/.test(e.name) || e.name.startsWith('.')) continue; if (existsSync(join(d, e.name, 'index.html'))) out.push(route + e.name + '/'); walk(join(d, e.name), route + e.name + '/'); } };
  walk(base, '/');
  return out.filter((r) => !ownerOnlyPath(r));
}
async function pool(items, n, fn) { const out = []; let i = 0; await Promise.all(Array.from({ length: Math.min(n, items.length) }, async () => { while (i < items.length) { const k = i++; out[k] = await fn(items[k]); } })); return out; }

export async function run(ctx) {
  const { root, hit, now } = ctx;
  const exists = (rel) => existsSync(join(root, rel));
  const skillFiles = (() => { try { return readdirSync(join(root, 'void-live-deploy/skills')).filter((n) => n.endsWith('.json')).map((n) => '/skills/' + n); } catch { return []; } })();
  const first = [...new Set([...CORE, ...skillFiles, ...sliceOf(routesOf(root), now)])];
  const seen = new Map(); // path -> hosts
  const read = async (p) => { const r = await hit(p); if (r.status === 200 && r.text) seen.set(p, studiedIn(r.text)); return r; };
  const bodies = await pool(first, POOL, async (p) => ({ p, r: await read(p) }));
  const follow = [...new Set(bodies.flatMap(({ r }) => refsIn(r.text)))].filter((p) => !seen.has(p) && !first.includes(p) && !ownerOnlyPath(p)).slice(0, FOLLOW_MAX);
  await pool(follow, POOL, read);
  let asked = 0;
  for (const ask of ASKS) {
    const r = await hit('/api/answer', { init: { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ ask }) } });
    if (r.status === 200) { asked++; const h = studiedIn(r.text); if (h.length) seen.set('/api/answer ask "' + ask + '"', h); }
  }
  const leaks = [...seen].filter(([, h]) => h.length);
  const codeNote = (n) => (n ? ' ' + n + ' script' + (n === 1 ? '' : 's') + ' name' + (n === 1 ? 's' : '') + ' a site in code the page really uses (a link or a feed), which stays.' : '');
  const read1 = 'Read the public pages, data files and answers signed out.'; // no counts: a figure that changes every run would ship a pull request every run
  if (!leaks.length) return { last: read1 + ' None names a site the Tower measures against.', ok: true, note: 'No model call. Plain page reads.' };
  const extraFile = join(root, 'void-live-deploy/lib/scrub-extra.json');
  let extra = { files: [], at: {} }; try { extra = JSON.parse(ctx.read(extraFile)); } catch { /* none yet */ }
  extra.files = extra.files || []; extra.at = extra.at || {};
  const done = [], queued = [], waiting = [], code = [];
  for (const [path, hosts] of leaks) {
    const f = fileOf(path, exists);
    const plan = planFor(path, hosts, { exists, listed: extra.files, at: extra.at, now, text: f ? ctx.read(join(root, f)) : '' });
    if (plan.kind === 'code') { code.push(plan.file); continue; }
    if (plan.kind === 'scrub') { extra.files.push(plan.file); extra.at[plan.file] = new Date(now).toISOString(); done.push(path); }
    else if (plan.kind === 'wait') waiting.push(path);
    else { const q = await ctx.queueJob('Names on a public path: ' + path + ' shows ' + hosts.slice(0, 3).join(', ') + '. ' + plan.why + '. Scrub with lib/scrub-sites.js or the owner gate.', healTarget(path)); queued.push(path + (q.queued ? '' : ' (' + q.why + ')')); }
  }
  if (done.length) ctx.save(extraFile, JSON.stringify({ about: 'Public files the deploy copy runs through the scrub (tools/public-sites.mjs): a studied site named in one becomes "another site". Written by the leak guard.', files: [...new Set(extra.files)].sort(), at: extra.at }, null, 1) + '\n');
  const named = leaks.filter(([p]) => !code.includes(fileOf(p, exists)));
  const found = named.length ? 'Found a studied site named on ' + named.length + ' path' + (named.length === 1 ? '' : 's') + ': ' + named.slice(0, 4).map(([p, h]) => p + ' (' + h[0] + ')').join(', ') + '.' : '';
  const parts = [read1, found, done.length ? 'Put ' + done.length + ' file' + (done.length === 1 ? '' : 's') + ' through the deploy scrub.' : '', waiting.length ? waiting.length + ' already in the scrub, waiting for a deploy.' : '', queued.length ? 'Handed ' + queued.length + ' to the coder.' : '', codeNote(code.length).trim()];
  return { last: parts.filter(Boolean).join(' '), ok: true, note: 'No model call. Plain page reads.' };
}
