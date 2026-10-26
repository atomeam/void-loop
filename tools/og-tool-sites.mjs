// Draws the share pictures of the PDF, Kanban, flights and shopping pages (1200 x 630 PNG, text and colour only, no logos) into void-live-deploy/og/, one per page of lib/tool-sites.js,
// with the browser already used for tests. Run by hand when a row's words change:  node tools/og-tool-sites.mjs     (CHROME_PATH or /opt/pw-browsers/...)
import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright-core';
import { SITE_PAGES } from '../void-live-deploy/lib/tool-sites.js';
import { TOOL_INFO } from '../void-live-deploy/lib/pdf-ui.js';
import { slug } from './tool-site-pages.mjs';

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..', 'void-live-deploy', 'og');
const KB = { boards: 'Several boards', wip: 'WIP limits', lanes: 'Swimlanes', labels: 'Labels', due: 'Due dates', checklist: 'Checklists', comments: 'Comments', assignee: 'Assignees', archive: 'Archive', filter: 'Search and filter', trello: 'Trello import', timer: 'Timer and Pomodoro', recur: 'Repeating cards', print: 'Print', csv: 'CSV export', share: 'Share link', colour: 'Card colours', templates: 'Templates' };
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;');
const line = (r) => r.tag || r.does.split(/\. /)[0].replace(/\.$/, '');
const FL = { controls: 'Airport search', providers: 'Six providers', facts: 'Route facts', tracker: 'Price tracker', trip: 'Itineraries', airports: 'Airport codes', time: 'Flight time', route: 'Great circle map', co2: 'CO2', routes: 'Where to fly' };
const SH = { lookup: 'Product lookup', stores: 'Store searches', cart: 'List and cart', track: 'Parcel tracking', prices: 'Price log', unit: 'Unit prices', wish: 'Wish lists', returns: 'Return windows' };
const SHX = { '/shop/track/': ['Carrier from the number', 'Calendar reminders'], '/shop/parcels/': ['International post', 'Many numbers'], '/shop/wishlist/': ['Share by link', 'Mark as bought'], '/shop/barcode/': ['UPC, EAN, ISBN', 'Check digits', 'Camera scanner'], '/shop/list/': ['Totals by store', 'CSV and share link'], '/shop/product/': ['Open product data', 'Camera scanner'] };
const chipsOf = (r) => (r.path.startsWith('/shop/') ? [...r.panels.map((k) => SH[k]), ...(SHX[r.path] || ['Barcode scanner', 'No account'])].slice(0, 10) : r.panels ? [...r.panels.map((k) => FL[k]), 'Distance', 'Time zones'].filter((x, i, a) => x && a.indexOf(x) === i) : r.tools ? [...r.tools, ...(r.also || [])].filter((t, i, a) => a.indexOf(t) === i).map((t) => TOOL_INFO[t][0]) : ['To do', 'Doing', 'Done', ...Object.keys(r.features).map((k) => KB[k]).filter(Boolean)]).slice(0, 10);
const html = (r) => `<html><body style="margin:0;width:1200px;height:630px;background:linear-gradient(135deg,#14121c 0%,#2a2150 100%);color:#ecebf5;font-family:system-ui,Segoe UI,Arial,sans-serif;position:relative;overflow:hidden">
<div style="position:absolute;left:64px;top:56px;font-size:30px;color:#a58bff;font-weight:700;letter-spacing:.04em">VERSE</div>
<div style="position:absolute;left:64px;top:120px;width:1070px;font-size:${r.name.length > 22 ? 84 : 112}px;font-weight:800;line-height:1.02">${esc(r.name)}</div>
<div style="position:absolute;left:64px;top:300px;width:1070px;font-size:38px;line-height:1.2;color:#d9d6e8">${esc(line(r))}</div>
<div style="position:absolute;left:64px;top:420px;width:1080px;display:flex;flex-wrap:wrap;gap:10px">${chipsOf(r).map((x) => `<span style="border:2px solid #6d4aff;border-radius:999px;padding:6px 18px;font-size:26px;color:#ecebf5">${esc(x)}</span>`).join('')}</div>
<div style="position:absolute;left:64px;bottom:36px;width:800px;font-size:24px;color:#a3a0b3">On your device. No account. Works offline.</div>
<div style="position:absolute;right:64px;bottom:36px;font-size:26px;color:#a58bff;font-weight:700">a-to-mind.com</div></body></html>`;
const exe = process.env.CHROME_PATH || ['/opt/pw-browsers/chromium', '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', '/usr/bin/google-chrome'].find((x) => fs.existsSync(x));
const b = await chromium.launch({ executablePath: exe, args: ['--no-sandbox'] }), p = await b.newPage({ viewport: { width: 1200, height: 630 } });
fs.mkdirSync(root, { recursive: true });
for (const r of SITE_PAGES) { if (process.argv[2] && !r.path.startsWith(process.argv[2])) continue; await p.setContent(html(r)); await p.screenshot({ path: path.join(root, slug(r.path) + '.png') }); console.log('wrote og/' + slug(r.path) + '.png'); }
await b.close();
