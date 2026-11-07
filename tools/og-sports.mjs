// Draws the share pictures of the sports pages (1200 x 630 PNG, no photos, no logos: text and colour only) with the browser that is already used for tests, into
// void-live-deploy/og/. Run by hand when a page's words change:  node tools/og-sports.mjs     (CHROME_PATH or /opt/pw-browsers/... or /usr/bin/google-chrome)
import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright-core';
import { shrinkFile } from './shrink-images.mjs';
import { ogPage } from './og-frame.mjs';

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..', 'void-live-deploy', 'og');
const CARDS = {
  fantasy: { title: 'Fantasy tools', line: 'Your own sheet in, answers out, on your device', chips: ['Compare players', 'Start or sit', 'Trade value', 'Draft board', 'Mock draft', 'Box-score stats'], foot: 'No projections sold, nothing leaves your device.' },
  scores: { title: 'Scores', line: 'Live scores, schedules and standings', chips: ['Premier League', 'La Liga', 'Bundesliga', 'Serie A', 'NBA', 'NFL', 'MLB', 'NHL', 'Formula 1'], foot: 'No ads, no betting. Stories and pictures by Verse.' },
  sports: { title: 'Sports', line: 'Browse 42 sports and search teams, events, venues and players', chips: ['Soccer', 'Basketball', 'Tennis', 'Cricket', 'Golf', 'Rugby', 'Boxing', 'Cycling', 'Born on this day'], foot: 'One search across every sport. A free read-only API.' },
};
const page = (c) => ogPage({ title: c.title, line: c.line, chips: c.chips, foot: c.foot, size: 116 });
const exe = process.env.CHROME_PATH || process.env.VOID_TEST_BROWSER || ['/opt/pw-browsers/chromium-1194/chrome-linux/chrome', '/usr/bin/google-chrome'].find((x) => fs.existsSync(x));
const b = await chromium.launch({ executablePath: exe, args: ['--no-sandbox'] }), p = await b.newPage({ viewport: { width: 1200, height: 630 } });
for (const [name, c] of Object.entries(CARDS)) { await p.setContent(page(c)); await p.screenshot({ path: path.join(root, name + '.png') }); const z = await shrinkFile(path.join(root, name + '.png')); console.log('wrote og/' + name + '.png (' + Math.round(z.after / 1024) + ' KB, Verse\'s own compressor)'); }
await b.close();
