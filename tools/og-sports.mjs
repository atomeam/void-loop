// Draws the share pictures of the sports pages (1200 x 630 PNG, no photos, no logos: text and colour only) with the browser that is already used for tests, into
// void-live-deploy/og/. Run by hand when a page's words change:  node tools/og-sports.mjs     (CHROME_PATH or /opt/pw-browsers/... or /usr/bin/google-chrome)
import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright-core';
import { shrinkFile } from './shrink-images.mjs';

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..', 'void-live-deploy', 'og');
const CARDS = {
  fantasy: { title: 'Fantasy tools', line: 'Your own sheet in, answers out, on your device', chips: ['Compare players', 'Start or sit', 'Trade value', 'Draft board', 'Mock draft', 'Box-score stats'], foot: 'No projections sold, nothing leaves your device.' },
  scores: { title: 'Scores', line: 'Live scores, schedules and standings', chips: ['Premier League', 'La Liga', 'Bundesliga', 'Serie A', 'NBA', 'NFL', 'MLB', 'NHL', 'Formula 1'], foot: 'No ads, no betting. Stories and pictures by Verse.' },
  sports: { title: 'Sports', line: 'Browse 42 sports and search teams, events, venues and players', chips: ['Soccer', 'Basketball', 'Tennis', 'Cricket', 'Golf', 'Rugby', 'Boxing', 'Cycling', 'Born on this day'], foot: 'One search across every sport. A free read-only API.' },
};
const page = (c) => `<html><body style="margin:0;width:1200px;height:630px;background:linear-gradient(135deg,#14121c 0%,#2a2150 100%);color:#ecebf5;font-family:system-ui,Segoe UI,Arial,sans-serif;position:relative;overflow:hidden">
<div style="position:absolute;left:64px;top:56px;font-size:30px;color:#a58bff;font-weight:700;letter-spacing:.04em">VERSE</div>
<div style="position:absolute;left:64px;top:120px;font-size:124px;font-weight:800;line-height:1">${c.title}</div>
<div style="position:absolute;left:64px;top:270px;width:1070px;font-size:42px;line-height:1.2;color:#d9d6e8">${c.line}</div>
<div style="position:absolute;left:64px;top:392px;width:1080px;display:flex;flex-wrap:wrap;gap:10px">${c.chips.map((x) => `<span style="border:2px solid #6d4aff;border-radius:999px;padding:6px 18px;font-size:25px;color:#ecebf5">${x}</span>`).join('')}</div>
<div style="position:absolute;left:64px;bottom:36px;width:800px;font-size:24px;color:#a3a0b3">${c.foot}</div>
<div style="position:absolute;right:64px;bottom:36px;font-size:26px;color:#a58bff;font-weight:700">a-to-mind.com</div></body></html>`;
const exe = process.env.CHROME_PATH || ['/opt/pw-browsers/chromium-1194/chrome-linux/chrome', '/usr/bin/google-chrome'].find((x) => fs.existsSync(x));
const b = await chromium.launch({ executablePath: exe, args: ['--no-sandbox'] }), p = await b.newPage({ viewport: { width: 1200, height: 630 } });
for (const [name, c] of Object.entries(CARDS)) { await p.setContent(page(c)); await p.screenshot({ path: path.join(root, name + '.png') }); const z = await shrinkFile(path.join(root, name + '.png')); console.log('wrote og/' + name + '.png (' + Math.round(z.after / 1024) + ' KB, Verse\'s own compressor)'); }
await b.close();
