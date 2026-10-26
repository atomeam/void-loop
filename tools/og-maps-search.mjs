// Draws the share pictures of the maps and search pages (1200 x 630 PNG, text and colour only, no logos) into void-live-deploy/og/, one per row of
// lib/maps-sites.js, with the browser already used for tests. Run by hand when a row's words change:  node tools/og-maps-search.mjs   (CHROME_PATH or /opt/pw-browsers/...)
import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright-core';
import { FLOOR_SITES } from '../void-live-deploy/lib/maps-sites.js';
import { slug } from './maps-search-pages.mjs';

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..', 'void-live-deploy', 'og');
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;');
const CHIP = { search: 'Place search', map: 'Real map', directions: 'Car, bike, walk', traffic: 'Honest about traffic', saved: 'Saved places', coords: 'Coordinates', where: 'Where am I', measure: 'Radius, distance, area', plan: 'Route planner + GPX',
  box: 'Bangs on device', answer: 'Answers with sources', wiki: 'Wikipedia', wikidata: 'Wikidata', engines: 'Google, Bing, DDG, Brave', history: 'History on device', bangs: '!bangs', allbangs: 'Every bang', from: 'Any country', multi: 'Many engines at once', reader: 'Wikipedia reader', share: 'Share link' };
const html = (r) => `<html><body style="margin:0;width:1200px;height:630px;background:linear-gradient(135deg,#14121c 0%,#2a2150 100%);color:#ecebf5;font-family:system-ui,Segoe UI,Arial,sans-serif;position:relative;overflow:hidden">
<div style="position:absolute;left:64px;top:56px;font-size:30px;color:#a58bff;font-weight:700;letter-spacing:.04em">VERSE</div>
<div style="position:absolute;left:64px;top:120px;width:1070px;font-size:${r.name.length > 22 ? 84 : 112}px;font-weight:800;line-height:1.02">${esc(r.name)}</div>
<div style="position:absolute;left:64px;top:300px;width:1070px;font-size:38px;line-height:1.2;color:#d9d6e8">${esc(r.tag)}</div>
<div style="position:absolute;left:64px;top:430px;width:1080px;display:flex;flex-wrap:wrap;gap:10px">${r.panels.map((k) => CHIP[k]).filter(Boolean).map((x) => `<span style="border:2px solid #6d4aff;border-radius:999px;padding:6px 18px;font-size:26px;color:#ecebf5">${esc(x)}</span>`).join('')}</div>
<div style="position:absolute;left:64px;bottom:36px;width:800px;font-size:24px;color:#a3a0b3">Free. No account. Kept on your device.</div>
<div style="position:absolute;right:64px;bottom:36px;font-size:26px;color:#a58bff;font-weight:700">a-to-mind.com</div></body></html>`;
const exe = process.env.CHROME_PATH || ['/opt/pw-browsers/chromium-1194/chrome-linux/chrome', '/usr/bin/google-chrome'].find((x) => fs.existsSync(x));
const b = await chromium.launch({ executablePath: exe, args: ['--no-sandbox'] }), p = await b.newPage({ viewport: { width: 1200, height: 630 } });
fs.mkdirSync(root, { recursive: true });
const only = process.argv.slice(2);
for (const r of FLOOR_SITES.filter((x) => !only.length || only.includes(x.path))) { await p.setContent(html(r)); const f = path.join(root, slug(r.path) + '.png'); await p.screenshot({ path: f }); console.log('wrote og/' + slug(r.path) + '.png'); }
await b.close();
