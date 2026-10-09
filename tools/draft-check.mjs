// node tools/draft-check.mjs [draft.html …]   (no files: the fringe drafts this branch adds or changes against origin/main)
// Opens each fringe draft in a headless browser and checks what every draft must be: noindex, no page errors on load or on
// its first button press, nothing fetched from outside (everything stays in the browser), and a window.__name hook for checks.
// A hook may carry selftest(): it runs in the page and returns true, or a string saying what is wrong (the draft's own maths).
// Prints one line per draft; exit 1 if any fails.
import fs from 'node:fs'; import path from 'node:path'; import { execFileSync } from 'node:child_process'; import { chromium } from 'playwright-core';

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
let files = process.argv.slice(2);
if (!files.length) {
  try { files = execFileSync('git', ['diff', '--name-only', '--diff-filter=AM', 'origin/main...HEAD', '--', 'drafts/fringe/'], { cwd: root, encoding: 'utf8' }).split('\n'); } catch (_) { files = []; }
  try { files = files.concat(execFileSync('git', ['status', '--porcelain', '--', 'drafts/fringe/'], { cwd: root, encoding: 'utf8' }).split('\n').map((l) => l.slice(3))); } catch (_) {}
  files = [...new Set(files.filter((f) => /\.html$/.test(f)))];
}
if (!files.length) { console.log('no changed drafts'); process.exit(0); }

const exe = process.env.CHROME_PATH || (fs.existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : undefined);
const browser = await chromium.launch({ executablePath: exe, headless: true });
let bad = 0;
for (const f of files) {
  const abs = path.resolve(root, f), html = fs.readFileSync(abs, 'utf8'), problems = [];
  if (!/<meta\s+name="robots"\s+content="noindex/i.test(html)) problems.push('no noindex');
  const ctx = await browser.newContext(), page = await ctx.newPage(), outside = [];
  page.on('pageerror', (e) => problems.push('page error: ' + e.message));
  await ctx.route(/^https?:\/\//, (r) => { outside.push(r.request().url()); r.abort(); });
  await page.goto('file://' + abs);
  const btn = await page.$('button:not([disabled])');
  if (btn) { await btn.click().catch(() => {}); await page.waitForTimeout(300); }
  const hooks = await page.evaluate(() => Object.keys(window).filter((k) => /^__\w+$/.test(k)));
  if (!hooks.length) problems.push('no window.__name hook for checks');
  const selfs = await page.evaluate((hs) => hs.filter((h) => window[h] && typeof window[h].selftest === 'function').map((h) => {
    try { const r = window[h].selftest(); return [h, r === true ? true : String(r || 'returned false')]; } catch (e) { return [h, 'threw ' + e.message]; }
  }), hooks).catch((e) => [['selftest', 'could not run: ' + e.message]]);
  for (const [h, r] of selfs) if (r !== true) problems.push(h + '.selftest: ' + r);
  if (outside.length) problems.push('fetches from outside: ' + outside.slice(0, 2).join(', '));
  await ctx.close();
  if (problems.length) bad++;
  console.log((problems.length ? 'FAIL ' : 'ok   ') + f + (problems.length ? ': ' + problems.join('; ') : ' (' + hooks.join(', ') + (selfs.length ? ', selftest passed' : '') + ')'));
}
await browser.close();
process.exit(bad ? 1 : 0);
