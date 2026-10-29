#!/usr/bin/env node
// Every Versus floor's own logo, kept in the repo (owner, 2026-10-25: "ive asked for the silly faces to be replaced by logos of the sites",
// "no faces logo only", "recreate the logos"). For each host in FLOORS (lanes included, one per host): GET the page with a normal browser
// User-Agent, take the largest icon it links (apple-touch-icon or sizes >= 96 first; png, jpg, webp, gif, ico or svg), else /favicon.ico,
// else Google's favicon cache for the host; keep 60 B - 200 KB, write void-live-deploy/tower.icons/<host>.<ext> and name it in
// tower.evidence.json `icons` (nothing else in the file changes). The card (skills/tower.js `logoUrl`) shows it.
// Plain fetch, no browser: runs on a GitHub runner (.github/workflows/site-icons.yml), since the session container cannot reach the sites.
//   node tools/site-icons.mjs            every host without a kept icon
//   node tools/site-icons.mjs --all      every host, refetching kept ones
//   node tools/site-icons.mjs --dry-run  fetch and report, write nothing
import fs from 'node:fs'; import path from 'node:path'; import { fileURLToPath } from 'node:url';
import { FLOORS, hostOf } from '../void-live-deploy/lib/tower.js';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const FILE = path.join(root, 'void-live-deploy', 'tower.evidence.json'), DIR = path.join(root, 'void-live-deploy', 'tower.icons');
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36';
export const MIN = 60, MAX = 200 * 1024;

const attrs = (tag) => { const o = {}; for (const m of tag.matchAll(/([\w:-]+)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/g)) o[m[1].toLowerCase()] = m[2] ?? m[3] ?? m[4] ?? ''; return o; };
const unent = (s) => String(s).replace(/&amp;/gi, '&').replace(/&#x2f;/gi, '/').replace(/&#47;/g, '/').replace(/&quot;/gi, '"');
/** how big an icon link says it is: its largest `sizes` entry, "any" (a vector) as 512, an apple-touch-icon without sizes as 180, else 16. Pure. */
export function iconSize(a) {
  const sizes = String(a.sizes || '').toLowerCase(), rel = String(a.rel || '').toLowerCase();
  if (/\bany\b/.test(sizes)) return 512;
  const n = Math.max(0, ...[...sizes.matchAll(/(\d+)\s*x\s*\d+/g)].map((m) => +m[1]));
  if (n) return n;
  if (/apple-touch-icon/.test(rel)) return 180;
  if (/\.svg(?:$|[?#])/i.test(a.href || '') || /svg/i.test(a.type || '')) return 256;
  return 16;
}
/** every icon a page links, best first (apple-touch-icon and sizes >= 96 ahead of the rest, then larger first), as absolute URLs. Pure. */
export function iconLinks(html, base) {
  const out = [], seen = new Set();
  let b = base; const bt = String(html || '').match(/<base\s[^>]*>/i); if (bt) { const h = attrs(bt[0]).href; if (h) try { b = new URL(unent(h), base).href; } catch (_) {} }
  for (const m of String(html || '').matchAll(/<link\s[^>]*>/gi)) {
    const a = attrs(m[0]), rel = String(a.rel || '').toLowerCase().split(/\s+/);
    if (!a.href || !rel.some((r) => r === 'icon' || r === 'apple-touch-icon' || r === 'apple-touch-icon-precomposed')) continue; // mask-icon is a one-colour stencil, not the logo
    let url; try { url = new URL(unent(a.href).trim(), b).href; } catch (_) { continue; }
    if (!/^https?:/.test(url) || seen.has(url)) continue; seen.add(url);
    const size = iconSize(a), apple = rel.some((r) => r.startsWith('apple-touch-icon'));
    out.push({ url, size, rank: (apple || size >= 96 ? 1000 : 0) + Math.min(size, 512) });
  }
  return out.sort((x, y) => y.rank - x.rank).map((x) => x.url);
}
/** the best icon a page links, or its /favicon.ico when it links none. Pure. */
export function pickIcon(html, base) { return iconLinks(html, base)[0] || new URL('/favicon.ico', base).href; }
/** an SVG that is only a picture: no script, no event handler, no javascript: link, no embedded HTML. Pure. */
export function safeSvg(text) {
  const t = String(text || '');
  return /<svg[\s>]/i.test(t) && !/<script/i.test(t) && !/\son\w+\s*=/i.test(t) && !/javascript:/i.test(t) && !/<foreignObject/i.test(t) && !/<!ENTITY/i.test(t);
}
/** what kind of image some bytes are, by their first bytes (servers often call an .ico octet-stream), '' when not a web image. Pure. */
export function sniff(buf) {
  const b = Buffer.from(buf || []); if (b.length < 4) return '';
  if (b[0] === 0x89 && b.toString('latin1', 1, 4) === 'PNG') return 'png';
  if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return 'jpg';
  if (b.toString('latin1', 0, 4) === 'GIF8') return 'gif';
  if (b.toString('latin1', 0, 4) === 'RIFF' && b.toString('latin1', 8, 12) === 'WEBP') return 'webp';
  if (b[0] === 0 && b[1] === 0 && (b[2] === 1 || b[2] === 2) && b[3] === 0) return 'ico';
  const head = b.toString('utf8', 0, Math.min(b.length, 2048)).replace(/^﻿/, '').trimStart();
  if (/^(?:<\?xml[^>]*>\s*)?(?:<!--[\s\S]*?-->\s*)*(?:<!DOCTYPE svg[^>]*>\s*)?<svg[\s>]/i.test(head)) return 'svg';
  return '';
}
/** an icon file's verdict: { ext } to keep, or { why } it is refused. Pure. */
export function judge(buf) {
  const n = buf ? buf.length : 0;
  if (n < MIN) return { why: 'too small (' + n + ' B)' };
  if (n > MAX) return { why: 'too big (' + Math.round(n / 1024) + ' KB)' };
  const ext = sniff(buf); if (!ext) return { why: 'not an image' };
  if (ext === 'svg' && !safeSvg(Buffer.from(buf).toString('utf8'))) return { why: 'svg with script or handlers' };
  return { ext };
}

const get = (url, accept) => fetch(url, { redirect: 'follow', signal: AbortSignal.timeout(15000), headers: { 'user-agent': UA, accept, 'accept-language': 'en-US,en;q=0.9' } });
async function iconBytes(url) {
  const r = await get(url, 'image/avif,image/webp,image/png,image/svg+xml,image/*,*/*;q=0.8').catch((e) => ({ err: e }));
  if (r.err) return { why: 'fetch failed: ' + (r.err.cause && r.err.cause.code || r.err.name || r.err.message) };
  if (!r.ok) return { why: 'HTTP ' + r.status };
  const buf = Buffer.from(await r.arrayBuffer()); const j = judge(buf); return j.ext ? { ext: j.ext, bytes: buf } : j;
}
/** one host's logo: { ext, bytes, from } or { why } */
async function logoOf(host, pageUrl) {
  const tried = [];
  let links = [];
  const r = await get(pageUrl, 'text/html,application/xhtml+xml,*/*;q=0.8').catch((e) => ({ err: e }));
  if (r.err) tried.push('page: ' + (r.err.cause && r.err.cause.code || r.err.name || r.err.message));
  else if (!r.ok) tried.push('page: HTTP ' + r.status);
  else links = iconLinks((await r.text().catch(() => '')).slice(0, 2e6), r.url || pageUrl);
  const origin = new URL(r.url || pageUrl).origin;
  const cands = [...links.slice(0, 4), origin + '/favicon.ico', 'https://' + host + '/favicon.ico', 'https://www.google.com/s2/favicons?sz=128&domain=' + encodeURIComponent(host)];
  for (const u of [...new Set(cands)]) {
    const x = await iconBytes(u); if (x.ext) return { ...x, from: u };
    tried.push(u.replace(/^https?:\/\//, '') + ': ' + x.why);
  }
  return { why: tried.join('; ') };
}
/** one host per floor, with the address to read it from (a lane's own url, else the floor's). Pure. */
export function hostsOf(floors = FLOORS) {
  const m = new Map();
  for (const f of floors) { const h = hostOf(f.url) || hostOf(f.site); if (h && !m.has(h)) m.set(h, /^https?:/.test(f.url || '') ? f.url : 'https://' + h + '/'); }
  return m;
}

async function main() {
  const argv = process.argv.slice(2), all = argv.includes('--all'), dry = argv.includes('--dry-run');
  const data = JSON.parse(fs.readFileSync(FILE, 'utf8')), icons = { ...(data.icons || {}) };
  const kept = (h) => icons[h] && /^tower\.icons\/[\w.-]+$/.test(icons[h]) && fs.existsSync(path.join(root, 'void-live-deploy', icons[h]));
  const todo = [...hostsOf()].filter(([h]) => all || !kept(h));
  console.log(hostsOf().size + ' hosts, ' + todo.length + ' to fetch' + (all ? ' (--all)' : ''));
  let got = 0, none = 0, i = 0;
  const work = async () => { while (i < todo.length) { const [h, url] = todo[i++];
    const x = await logoOf(h, url).catch((e) => ({ why: String(e && e.message || e) }));
    if (x.ext) { got++; const name = h + '.' + x.ext; if (!dry) { fs.mkdirSync(DIR, { recursive: true }); fs.writeFileSync(path.join(DIR, name), x.bytes); icons[h] = 'tower.icons/' + name; }
      console.log('kept  ' + h + '  ' + name + ' (' + x.bytes.length + ' B from ' + x.from + ')'); }
    else { none++; console.log('none  ' + h + '  (' + x.why + ')'); } } };
  await Promise.all(Array.from({ length: 6 }, work));
  if (!dry && got) { const fresh = JSON.parse(fs.readFileSync(FILE, 'utf8')); fresh.icons = { ...(fresh.icons || {}), ...icons }; fs.writeFileSync(FILE, JSON.stringify(fresh, null, 1) + '\n'); }
  console.log('site-icons: ' + got + ' kept, ' + none + ' none, ' + [...hostsOf().keys()].filter(kept).length + ' of ' + hostsOf().size + ' hosts have a logo');
  if (process.env.GITHUB_OUTPUT) fs.appendFileSync(process.env.GITHUB_OUTPUT, 'kept=' + got + '\n');
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
