// Animated glitch titles stay ONE whole, evenly spaced word through the whole animation (owner, 2026-10-22: the films card read
// "VERSE F    I     LMS"; a card title is a flex row spread with space-between, so the loose text and the glitch span became three items).
// Every title in void-live-deploy that uses the glitch letter (<span class="gl ...">) is found in the source; each must sit inside one
// .glw word box, and each is rendered in a real browser inside a hostile card-title row (flex, space-between, wide) with the page's own
// styles, then sampled at several animation frames (the glitch frames included): the gap between neighbouring letters may never be more
// than a third of the font size, and the letters must stay on one line.
//   VOID_TEST_BROWSER=/usr/bin/google-chrome node tools/glitch-titles.mjs     exit 1 on any broken word
//   VOID_SITE=https://a-to-mind.com node tools/glitch-titles.mjs --live     also sample the live films card ("verse films")
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { resolve, dirname, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..'), live = resolve(root, 'void-live-deploy');
let pass = 0, fail = 0;
const check = (name, ok, got) => { if (ok) pass++; else fail++; console.log((ok ? 'pass ' : 'FAIL ') + name + (ok ? '' : '  -> ' + got)); };

// 1. find every glitch title in the live code
const walk = (d) => readdirSync(d).flatMap((n) => { const p = resolve(d, n); if (n === 'node_modules' || n.startsWith('.')) return []; return statSync(p).isDirectory() ? walk(p) : /\.(js|html|mjs)$/.test(n) && !/\.min\./.test(n) ? [p] : []; });
const found = [];
for (const f of walk(live)) {
  const src = readFileSync(f, 'utf8');
  for (const m of src.matchAll(/<(h[1-6])\b[^>]*>(.*?)<\/\1>/g)) if (/class="gl[ "]/.test(m[2])) found.push({ file: relative(root, f), html: m[0], src });
}
check('glitch titles found', found.length > 0, 'none');
for (const t of found) check(t.file + ' title is one .glw word box', /^<h[1-6][^>]*><span class="glw">.*<\/span><\/h[1-6]>$/.test(t.html), t.html);

// 2. render each with its page's own <style> inside a hostile card-title row and sample frames
const { chromium } = await import('playwright-core');
const exe = [process.env.VOID_TEST_BROWSER, process.env.CHROME_PATH, '/usr/bin/google-chrome', '/opt/pw-browsers/chromium'].find((p) => p && existsSync(p));
if (exe && !process.argv.includes('--no-browser')) {
  const { acquire } = await import('./heavy.mjs'); await acquire('glitch titles (glitch-titles.mjs)');
  const b = await chromium.launch({ executablePath: exe, headless: true });
  // the letters' boxes and gaps at one frame: every glitch animation is paused at t ms into its cycle
  const measure = (page, sel, t) => page.evaluate(([sel, t]) => {
    const h = document.querySelector(sel); if (!h) return { missing: true };
    for (const a of h.getAnimations({ subtree: true })) { a.pause(); a.currentTime = t; }
    const fs = parseFloat(getComputedStyle(h).fontSize), boxes = [];
    const tw = document.createTreeWalker(h, NodeFilter.SHOW_TEXT);
    for (let n; (n = tw.nextNode());) {
      const p = n.parentElement; if (p.closest('i') && p.closest('.gl')) continue; // the stand-in glyph sits on top of its letter
      const s = getComputedStyle(p); if (s.visibility === 'hidden' && !p.closest('.gl')) continue;
      for (let i = 0; i < n.length; i++) { if (!n.data[i].trim()) { boxes.push(null); continue; } const r = document.createRange(); r.setStart(n, i); r.setEnd(n, i + 1); const q = r.getBoundingClientRect(); boxes.push({ l: q.left, r: q.right, top: Math.round(q.top) }); }
    }
    let maxGap = 0, lines = new Set();
    for (let i = 1; i < boxes.length; i++) { const a = boxes[i - 1], c = boxes[i]; if (!a || !c) continue; lines.add(a.top); lines.add(c.top); maxGap = Math.max(maxGap, c.l - a.r); }
    return { maxGap: Math.round(maxGap * 10) / 10, limit: Math.round(fs / 3 * 10) / 10, lines: lines.size, text: h.textContent };
  }, [sel, t]);
  const FRAMES = [0, 500, 1200, 2280, 2320, 2400, 2450, 2500, 2600, 3500, 5340, 5400];
  const judge = (name, r) => check(name, !r.missing && r.maxGap <= r.limit && r.lines <= 1, JSON.stringify(r));
  for (const t of found) {
    const styles = (t.src.match(/<style>[\s\S]*?<\/style>/g) || []).join('\n');
    const wrap = /vfilms/.test(styles) ? 'vfilms' : '';
    const page = await b.newPage({ viewport: { width: 900, height: 400 } });
    // the hostile row is lib/card-frame.js's .vc-title: flex, space-between, a cost mark after
    await page.setContent('<!doctype html><meta charset="utf-8">' + styles + '<style>body{background:#111;color:#fff;font:16px system-ui}.vc-title{display:flex;align-items:center;justify-content:space-between;gap:10px;width:640px;font-size:30px;padding:5px 12px;border:2px solid #888}.vc-title::after{content:"\\25C6"}</style><div class="' + wrap + '">' + t.html.replace(/^<(h[1-6])/, '<$1 class="vc-title" id="gt"') + '</div>');
    for (const f of FRAMES) judge(t.file + ' word whole at ' + f + 'ms', await measure(page, '#gt', f));
    await page.close();
  }
  if (process.argv.includes('--live')) {
    const SITE = process.env.VOID_SITE || 'https://a-to-mind.com';
    for (const [w, h] of [[1280, 800], [390, 700]]) {
      const page = await b.newPage({ viewport: { width: w, height: h } });
      try {
        await page.goto(SITE + '/', { waitUntil: 'domcontentloaded', timeout: 45000 });
        const input = page.locator('input, textarea').first(); await input.click(); await input.fill('verse films'); await input.press('Enter');
        await page.waitForSelector('.vfilms h2', { timeout: 30000 }); await page.waitForTimeout(3000);
        await page.evaluate(() => { document.querySelector('.vfilms h2').id = 'gt'; });
        for (const f of FRAMES) {
          const r = await measure(page, '#gt', f); judge('live ' + w + 'x' + h + ' at ' + f + 'ms', r);
          if (process.env.GLITCH_SHOTS) await page.locator('.vfilms .poster').screenshot({ path: process.env.GLITCH_SHOTS + '-' + w + '-' + f + 'ms.png' });
        }
      } catch (e) { check('live ' + w + 'x' + h + ' opened', false, e.message.split('\n')[0]); }
      await page.close();
    }
  }
  await b.close();
}
console.log(pass + '/' + (pass + fail) + ' passed');
process.exit(fail ? 1 : 0);
