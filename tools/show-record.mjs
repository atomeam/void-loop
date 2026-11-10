// Film the live stage answering one ask. The picture is the page, not a drawn gradient.
import { chromium } from 'playwright-core';
import { mkdirSync } from 'node:fs';

const ask = process.argv[2];
const dir = process.argv[3] || '/tmp/verse-rec';
if (!ask) { console.error('usage: node tools/show-record.mjs "ask" [dir]'); process.exit(2); }
mkdirSync(dir, { recursive: true });
const browser = await chromium.launch({
  executablePath: '/usr/bin/google-chrome',
  headless: true,
  args: ['--no-sandbox', '--disable-dev-shm-usage'],
});
const context = await browser.newContext({
  viewport: { width: 390, height: 844 },
  deviceScaleFactor: 2,
});
const page = await context.newPage();
const frames = dir + '/frames';
mkdirSync(frames, { recursive: true });
await page.goto('https://a-to-mind.com/', { waitUntil: 'domcontentloaded', timeout: 45000 });
await page.waitForTimeout(800);
let n = 0;
const shot = async () => { await page.screenshot({ path: frames + '/' + String(n).padStart(3, '0') + '.png' }); n += 1; };
await shot();
await page.fill('#input', ask);
for (let i = 0; i < 4; i++) { await shot(); await page.waitForTimeout(200); }
await page.click('#go');
const started = Date.now();
while (Date.now() - started < 14000) {
  await shot();
  const ready = await page.evaluate(() => {
    const stage = document.querySelector('#stage');
    return !!(stage && stage.innerText && stage.innerText.length > 40);
  }).catch(() => false);
  if (ready && Date.now() - started > 4000) break;
  await page.waitForTimeout(280);
}
await shot();
await page.waitForTimeout(600);
await shot();
const text = await page.locator('#stage').innerText().catch(() => '');
console.log(JSON.stringify(text.replace(/\s+/g, ' ').slice(0, 220)));
console.log('frames', n);
await context.close();
await browser.close();
