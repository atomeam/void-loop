import { chromium } from 'playwright-core';
// node tools/video-live.mjs: load a YouTube link, a Rumble link and a search on live Verse in installed headless Chrome and save
// screenshots to /workspace/void-audit/video-player/ (VOID_SITE overrides the site, CHROME_PATH the browser). Prints each card's embed src.
import { mkdirSync } from 'node:fs';
const site = process.env.VOID_SITE || 'https://a-to-mind.com', out = process.env.VOID_SHOTS || '/workspace/void-audit/video-player/'; mkdirSync(out, { recursive: true });
const b = await chromium.launch({ executablePath: process.env.CHROME_PATH || '/usr/bin/google-chrome', headless: true, args: ['--autoplay-policy=no-user-gesture-required'] });
const asks = [['youtube', 'https://www.youtube.com/watch?v=aqz-KE-bpKQ'], ['rumble', 'https://rumble.com/v77xmv8-nasas-artemis-ii-launch.html'], ['search-dailymotion', 'show me the video of the moon landing']];
for (const [n, a] of asks) {
  const p = await b.newPage({ viewport: { width: 1280, height: 900 } });
  await p.goto(site + '/?q=' + encodeURIComponent(a), { waitUntil: 'load' });
  await p.waitForSelector('.video-card iframe', { timeout: 30000 }).catch(() => {});
  await p.waitForTimeout(8000);
  const info = await p.evaluate(() => { const f = document.querySelector('.video-card iframe'); return { src: f && f.src, now: (document.querySelector('.vd-now') || {}).innerText, hits: document.querySelectorAll('.vd-hit').length }; });
  console.log(n, JSON.stringify(info));
  await p.screenshot({ path: out + n + '.png' });
  await p.close();
}
await b.close();
