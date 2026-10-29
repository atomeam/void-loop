#!/usr/bin/env node
// Draws void-live-deploy/og.png, the card a shared link shows (iMessage, Discord, X, Slack): the VERSE wordmark inside its orbit, the ring
// of light (the same ring as the startup intro and the icon), the line, three answer cards and the ask pill. 1200 x 630.
//   node tools/og-image.mjs
import { chromium } from 'playwright-core';
import { existsSync } from 'node:fs';

const HTML = `<!doctype html><html><head><meta charset="utf-8"><style>
  * { box-sizing: border-box; margin: 0; }
  body { width: 1200px; height: 630px; overflow: hidden; color: #f2f0fa; font-family: system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
    background: radial-gradient(55% 70% at 78% 30%, rgba(122,92,255,.22), transparent 60%), radial-gradient(45% 60% at 8% 15%, rgba(255,61,127,.16), transparent 60%), radial-gradient(70% 90% at 50% 40%, #12102a, #050505 75%); }
  .mark { position: absolute; left: 80px; top: 120px; display: flex; align-items: center; gap: 6px; font-weight: 200; font-size: 132px; line-height: 1; letter-spacing: .03em; }
  .mark { position: absolute; } .mark svg { position: absolute; left: -6%; top: -12%; width: 112%; height: 122%; overflow: visible; }
  .mark ellipse { fill: none; stroke: #fff; stroke-width: 2; vector-effect: non-scaling-stroke; filter: drop-shadow(0 0 6px rgba(255,61,127,.9)) drop-shadow(0 0 16px rgba(122,92,255,.85)); }
  .line { position: absolute; left: 84px; top: 276px; font-size: 34px; color: #b8b3cf; }
  .rule { position: absolute; left: 84px; top: 262px; width: 300px; height: 1px; background: linear-gradient(90deg, #ff3d7f, #7a5cff, transparent); }
  .card { position: absolute; padding: 16px 22px; border-radius: 16px; background: rgba(255,255,255,.045); border: 1px solid rgba(255,255,255,.1); box-shadow: 0 18px 50px rgba(0,0,0,.45); }
  .card small { display: block; font-size: 14px; letter-spacing: .14em; color: #a4a0b8; text-transform: uppercase; margin-bottom: 6px; }
  .card b { font-weight: 400; font-size: 26px; }
  .pill { position: absolute; left: 80px; right: 80px; top: 456px; height: 84px; border-radius: 42px; display: flex; align-items: center; padding: 0 38px; font-size: 32px; color: #b8b3cf;
    background: rgba(10,10,22,.75); border: 1px solid rgba(143,123,255,.45); box-shadow: 0 0 0 1px rgba(255,61,127,.08), 0 16px 60px rgba(122,92,255,.18); }
  .pill i { width: 12px; height: 12px; border-radius: 50%; margin-right: 18px; background: linear-gradient(135deg, #ff3d7f, #7a5cff); box-shadow: 0 0 12px rgba(255,61,127,.8); }
</style></head><body>
  <div class="mark"><svg viewBox="0 0 200 60" preserveAspectRatio="none"><ellipse cx="100" cy="30" rx="96" ry="26"/></svg><span>VERSE</span></div>
  <div class="rule"></div>
  <div class="line">Ask, and it appears.</div>
  <div class="card" style="left:872px;top:84px"><small>Weather · Tokyo</small><b>18° · light rain</b></div>
  <div class="card" style="left:652px;top:220px"><small>Days until Christmas</small><b>82 days</b></div>
  <div class="card" style="left:1006px;top:250px"><small>12 × 7</small><b>84</b></div>
  <div class="pill"><i></i>ask anything · a-to-mind.com</div>
</body></html>`;

const exe = process.env.CHROME_PATH || (existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : undefined);
const browser = await chromium.launch({ executablePath: exe });
const page = await browser.newPage({ viewport: { width: 1200, height: 630 } });
await page.setContent(HTML);
await page.screenshot({ path: new URL('../void-live-deploy/og.png', import.meta.url).pathname });
await browser.close();
console.log('wrote void-live-deploy/og.png (1200 x 630)');
