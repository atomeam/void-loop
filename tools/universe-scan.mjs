// A visitor's view of the site, scanned for the names of what the Tower measures against (lib/universe.js protectedNames).
//   node tools/universe-scan.mjs            the files a visitor is served (the repo's void-live-deploy, less the owner-only paths and the
//                                           four files the deploy scrubs: tools/public-sites.mjs), every protected name that shows
//   node tools/universe-scan.mjs --live     the same through the live site, signed out: the page list is the sitemap, plus the data files,
//                                           and every owner-only file must answer 404
// Exit 1 when a name shows or an owner-only file answers a visitor.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { SEEDS } from '../void-live-deploy/lib/universe-seeds.js';
import { protectedNames } from '../void-live-deploy/lib/universe.js';
import { ownerOnlyPath } from '../void-live-deploy/lib/owner-gate.js';
import { SERVED } from './public-sites.mjs';

const SITE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../void-live-deploy');
const TEXT = /\.(?:html|js|mjs|json|css|txt|xml|md|webmanifest|svg)$/;
export const namesNow = () => { let t = []; try { t = JSON.parse(fs.readFileSync(path.join(SITE, 'tower.universe.json'), 'utf8')).targets; } catch (_) { /* seeds only */ } return protectedNames(SEEDS.concat(t)); };
const re = (names) => new RegExp('(?<![\\w])(?:' + names.map((n) => n.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|') + ')(?![\\w])', 'i');
/** the served files that show a protected name: [{ file, name }]. Pure given the names and a file lister. */
export function scanFiles(files, read, names) {
  const rx = re(names), hits = [];
  for (const f of files) { const m = rx.exec(read(f) || ''); if (m) hits.push({ file: f, name: m[0] }); }
  return hits;
}
function walk(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) { if (!/^(?:node_modules|\.git)$/.test(e.name)) walk(p, out); } else if (TEXT.test(e.name)) out.push(p);
  }
  return out;
}
export const servedFiles = () => walk(SITE).map((p) => '/' + path.relative(SITE, p).split(path.sep).join('/')).filter((u) => !ownerOnlyPath(u) && !SERVED.includes(u.slice(1)));
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const names = namesNow();
  if (!process.argv.includes('--live')) {
    const hits = scanFiles(servedFiles(), (u) => { try { return fs.readFileSync(path.join(SITE, u), 'utf8'); } catch (_) { return ''; } }, names);
    for (const h of hits.slice(0, 40)) console.log('shows a name: ' + h.file + ' (' + h.name + ')');
    console.log(hits.length + ' file(s) show a name, of ' + servedFiles().length + ' served files and ' + names.length + ' names');
    process.exit(hits.length ? 1 : 0);
  }
  const base = (process.env.VERSE_SITE || 'https://a-to-mind.com').replace(/\/+$/, '');
  const get = async (u) => { try { const r = await fetch(base + u, { redirect: 'follow', headers: { 'user-agent': 'Mozilla/5.0 verse-scan' } }); return { status: r.status, text: r.ok ? await r.text() : '' }; } catch (_) { return { status: 0, text: '' }; } };
  const sm = (await get('/sitemap.xml')).text, pages = [...sm.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => new URL(m[1]).pathname);
  const list = [...new Set(['/', '/self.json', '/void.asks.json', '/void.growth.json', '/void.knowledge.json', '/exam/latest.json', '/progress/nightly.json', '/scoreboard/game-updates.json', '/llms.txt', ...pages])].slice(0, +process.env.SCAN_MAX || 600);
  const hits = []; let n = 0;
  for (let i = 0; i < list.length; i += 12) await Promise.all(list.slice(i, i + 12).map(async (u) => { const r = await get(u); n++; const m = re(names).exec(r.text); if (m) hits.push({ file: u, name: m[0] }); }));
  const openOwner = [];
  for (const u of ['/tower.universe.json', '/lib/universe.js', '/lib/universe-seeds.js', '/versus/universe.js', '/tower.evidence.json', '/lib/tower.js']) { const r = await get(u); if (r.status !== 404) openOwner.push(u + ' answered ' + r.status); }
  for (const h of hits) console.log('shows a name: ' + h.file + ' (' + h.name + ')');
  for (const o of openOwner) console.log('owner-only file open: ' + o);
  console.log('live signed-out scan: ' + n + ' pages and files, ' + names.length + ' names, ' + hits.length + ' show a name, ' + openOwner.length + ' owner-only files open');
  process.exit(hits.length || openOwner.length ? 1 : 0);
}
