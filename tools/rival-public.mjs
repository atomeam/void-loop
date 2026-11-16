// Public pages do not name or link the rival. The link and the side-by-side compare stay on /versus/ and the owner elevator.
import { readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { SITES } from '../void-live-deploy/lib/versus-floor.js';

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')), '..');
export const SITE = path.join(root, 'void-live-deploy');

/** host labels a floor's public page must not contain. Pure. */
export function rivalLabels(site) {
  const out = new Set();
  const add = (s) => {
    const h = String(s || '').trim().toLowerCase().replace(/^www\./, '');
    if (h) out.add(h);
  };
  if (site) { add(site.rival); try { add(new URL(site.url).hostname); } catch (_) { /* a bad url adds nothing */ } }
  return [...out];
}

/** labels that appear anywhere in the html, links included. Pure. */
export function namesRival(html, labels) {
  const lower = String(html || '').toLowerCase();
  return (labels || []).filter((l) => l && lower.includes(String(l).toLowerCase()));
}

function htmlFiles(dir, acc = []) {
  for (const n of readdirSync(dir)) {
    if (n === 'node_modules' || n === 'vendor') continue;
    const p = path.join(dir, n);
    if (statSync(p).isDirectory()) htmlFiles(p, acc);
    else if (n.endsWith('.html')) acc.push(p);
  }
  return acc;
}

/** public html that credits a rival: a "The original" line anywhere but /versus/, or a floor page that contains its rival's host. */
export function publicRivalHits(dir = SITE, sites = SITES) {
  const hits = [];
  const byPage = new Map((sites || []).filter((s) => s && s.page).map((s) => [s.page.endsWith('/') ? s.page : s.page + '/', s]));
  for (const file of htmlFiles(dir)) {
    const rel = '/' + path.relative(dir, file).split(path.sep).join('/');
    if (rel === '/versus/index.html' || rel.startsWith('/versus/')) continue;
    const html = readFileSync(file, 'utf8');
    const route = rel.endsWith('/index.html') ? rel.slice(0, -'index.html'.length) : rel;
    if (/the original\s*:/i.test(html) || /class="original"/.test(html)) hits.push(route + ' credits another site');
    const site = byPage.get(route.endsWith('/') ? route : route + '/');
    if (!site) continue;
    const named = namesRival(html, rivalLabels(site));
    if (named.length) hits.push(route + ' names ' + named.join(', '));
  }
  return hits;
}
