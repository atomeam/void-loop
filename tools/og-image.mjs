#!/usr/bin/env node
// Draws void-live-deploy/og.png, the card a shared link shows (iMessage, Discord, X, Slack), in the one Verse look (verse.css, 2026-10-30):
// the mark (void-live-deploy/icon.svg) and the wordmark, the line, three answer cards and the ask bar on deep space. 1200 x 630.
//   node tools/og-image.mjs
import { chromium } from 'playwright-core';
import { existsSync } from 'node:fs';

const HTML = `<!doctype html><html><head><meta charset="utf-8"><style>
  * { box-sizing: border-box; margin: 0; }
  body { width: 1200px; height: 630px; overflow: hidden; color: #f2f4fb; font-family: system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
    background: radial-gradient(900px 480px at 20% -10%, rgba(158,178,255,.16), transparent 70%), radial-gradient(700px 500px at 100% 110%, rgba(92,192,255,.08), transparent 70%), #050505; }
  .brand { position: absolute; left: 80px; top: 92px; display: flex; align-items: center; gap: 26px; }
  .logo { width: 104px; height: 104px; filter: drop-shadow(0 16px 40px rgba(0,0,0,.6)); }
  .word { font-size: 92px; font-weight: 650; letter-spacing: -.035em; line-height: 1; }
  .line { position: absolute; left: 84px; top: 236px; font-size: 38px; font-weight: 500; letter-spacing: -.01em; color: #c3c8d8; }
  .card { position: absolute; padding: 16px 22px; border-radius: 14px; background: #10121a; border: 1px solid #2d3244; box-shadow: 0 18px 50px -18px rgba(0,0,0,.8); }
  .card small { display: block; font-size: 13px; font-weight: 600; letter-spacing: .12em; color: #8e94a8; text-transform: uppercase; margin-bottom: 6px; }
  .card b { font-weight: 550; font-size: 26px; letter-spacing: -.01em; }
  .pill { position: absolute; left: 80px; right: 80px; top: 448px; height: 88px; border-radius: 18px; display: flex; align-items: center; padding: 0 34px; font-size: 30px; color: #8e94a8;
    background: #0b0d13; border: 1px solid #2d3244; box-shadow: 0 0 0 4px rgba(158,178,255,.10), 0 24px 60px -20px rgba(0,0,0,.8); }
  .pill i { width: 3px; height: 38px; border-radius: 2px; margin-right: 18px; background: #9eb2ff; }
  .pill span { margin-left: auto; font-size: 22px; font-weight: 600; color: #9eb2ff; }
</style></head><body>
  <div class="brand"><svg class="logo" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">    <defs>    <linearGradient id="s" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#141726"/><stop offset="1" stop-color="#050505"/></linearGradient>    <linearGradient id="v" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#f2f4fb"/><stop offset="1" stop-color="#9eb2ff"/></linearGradient>  </defs>  <rect width="512" height="512" rx="116" fill="url(#s)"/>  <rect x="2" y="2" width="508" height="508" rx="114" fill="none" stroke="#fff" stroke-opacity=".09" stroke-width="4"/>  <path d="M154 176 256 356 358 176" fill="none" stroke="url(#v)" stroke-width="48" stroke-linecap="round" stroke-linejoin="round"/>  <path d="M384 92c3 17 8 22 25 25-17 3-22 8-25 25-3-17-8-22-25-25 17-3 22-8 25-25z" fill="#fff"/></svg><div class="word">Verse</div></div>
  <div class="line">Ask, and it appears.</div>
  <div class="card" style="left:812px;top:84px"><small>Weather · Tokyo</small><b>18° · light rain</b></div>
  <div class="card" style="left:712px;top:236px"><small>Days until Christmas</small><b>56 days</b></div>
  <div class="card" style="left:1000px;top:236px"><small>12 × 7</small><b>84</b></div>
  <div class="pill"><i></i>Ask anything<span>a-to-mind.com</span></div>
</body></html>`;

const exe = process.env.CHROME_PATH || process.env.VOID_TEST_BROWSER || (existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : undefined);
const browser = await chromium.launch({ executablePath: exe });
const page = await browser.newPage({ viewport: { width: 1200, height: 630 } });
await page.setContent(HTML);
await page.screenshot({ path: new URL('../void-live-deploy/og.png', import.meta.url).pathname });
await browser.close();
console.log('wrote void-live-deploy/og.png (1200 x 630)');
