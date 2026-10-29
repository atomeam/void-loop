// Draws the share pictures of the AI model and assistant pages (1200 x 630 PNG, text and colour only, no logos) into void-live-deploy/og/, one per row of
// lib/tool-sites.js AI_SITES, named after its path (/models/leaderboard/ -> og/models-leaderboard.png), with the browser already used for tests.
// Run by hand when a row's words change:  node tools/og-ai-pages.mjs     (CHROME_PATH or /opt/pw-browsers/...)
import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright-core';
import { AI_SITES } from '../void-live-deploy/lib/tool-sites.js';
import { ogName } from './ai-pages.mjs';

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..', 'void-live-deploy', 'og');
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;');
// the chips each picture shows: what the page does, in two or three words each
const CHIPS = {
  '/models/': ['Search', 'Task filter', 'Licence filter', 'Size', 'Model cards', 'Compare', 'Try it free', 'Datasets'],
  '/models/leaderboard/': ['IFEval', 'BBH', 'MATH', 'GPQA', 'MuSR', 'MMLU-PRO', 'Sort any column', 'CSV'],
  '/models/local/': ['GGUF files', 'Run command', 'Will it fit?', 'Quantization', 'Offline'],
  '/models/prices/': ['$ per million tokens', 'Context', 'Free models', 'Compare', 'Cost calculator'],
  '/models/arena/': ['Blind battle', 'Vote', 'Elo ratings', 'Side by side', 'Categories'],
  '/assistant/': ['Chats on your device', 'Templates', 'Run JavaScript', 'Text tools', 'Share a chat', 'Notes offline'],
  '/assistant/workspace/': ['Folders', 'Pinned chats', 'Search every message', 'Prompt library', 'Characters'],
  '/assistant/voice/': ['Speak', 'Read aloud', 'Choose a voice', 'Hands-free'],
  '/assistant/quick/': ['No sign-in', 'Chat styles', 'Longer answers', 'Copy and share'],
  '/assistant/private/': ['No account', 'No log', 'Choose the model', 'Burn all'],
  '/assistant/sources/': ['Numbered sources', 'Source cards', 'Follow-up questions', 'Threads kept'],
};
const tag = (r) => r.does.split(/(?<=[.:])\s/)[0].replace(/[.:]$/, '').replace(/\s*\([^)]*\)/g, '');
const html = (r) => `<html><body style="margin:0;width:1200px;height:630px;background:linear-gradient(135deg,#14121c 0%,#2a2150 100%);color:#ecebf5;font-family:system-ui,Segoe UI,Arial,sans-serif;overflow:hidden">
<div style="box-sizing:border-box;height:630px;padding:52px 64px 36px;display:flex;flex-direction:column;gap:18px">
<div style="font-size:30px;color:#a58bff;font-weight:700;letter-spacing:.04em">VERSE</div>
<div style="font-size:${r.h1.length > 18 ? 76 : 100}px;font-weight:800;line-height:1.02">${esc(r.h1)}</div>
<div style="font-size:31px;line-height:1.25;color:#d9d6e8;max-height:120px;overflow:hidden">${esc(tag(r))}</div>
<div style="display:flex;flex-wrap:wrap;gap:10px;margin-top:auto">${(CHIPS[r.path] || []).map((x) => `<span style="border:2px solid #6d4aff;border-radius:999px;padding:5px 16px;font-size:24px;color:#ecebf5">${esc(x)}</span>`).join('')}</div>
<div style="display:flex;justify-content:space-between;font-size:24px;color:#a3a0b3"><span>Free. No account. ${r.path.startsWith('/assistant/') ? 'Your chats stay on your device.' : 'Every model linked to its source.'}</span><span style="color:#a58bff;font-weight:700;font-size:26px">a-to-mind.com</span></div>
</div></body></html>`;
const exe = process.env.CHROME_PATH || ['/opt/pw-browsers/chromium-1194/chrome-linux/chrome', '/opt/pw-browsers/chromium', '/usr/bin/google-chrome'].find((x) => fs.existsSync(x) && fs.statSync(x).isFile());
const b = await chromium.launch({ executablePath: exe, args: ['--no-sandbox'] }), p = await b.newPage({ viewport: { width: 1200, height: 630 } });
fs.mkdirSync(root, { recursive: true });
for (const r of AI_SITES) { if (process.argv[2] && !r.path.startsWith(process.argv[2])) continue; await p.setContent(html(r)); await p.screenshot({ path: path.join(root, ogName(r.path) + '.png') }); console.log('wrote og/' + ogName(r.path) + '.png'); }
await b.close();
