// Animated glitch titles stay ONE whole, evenly spaced word through the whole animation (owner, 2026-10-22: the films card read
// "VERSE F    I     LMS"; a card title is a flex row spread with space-between, so the loose text and the glitch span became three items).
// Every title in void-live-deploy that uses the glitch letter (<span class="gl ...">) is found in the source; each must sit inside one
// .glw word box, and each is rendered in a real browser inside a hostile card-title row (flex, space-between, wide) with the page's own
// styles, then sampled at several animation frames (the glitch frames included): the gap between neighbouring letters may never be more
// than a third of the font size, and the letters must stay on one line.
//   VOID_TEST_BROWSER=/usr/bin/google-chrome node tools/glitch-titles.mjs     exit 1 on any broken word
//   VOID_SITE=https://a-to-mind.com node tools/glitch-titles.mjs --live     also ask "films" on the live home page like a user (fresh, then returning)
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
    const an = h.getAnimations({ subtree: true }), dur = an.length ? an[0].effect.getComputedTiming().duration : 0; for (const a of an) { a.pause(); a.currentTime = t * dur; }
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
  const FRAMES = [0, 0.3, 0.6, 0.945, 0.955, 0.965, 0.97, 0.98, 0.99, 0.995]; // fractions of the cycle, the glitch window (94.5-99.5%) sampled closely
  // rare and slow (owner, 2026-10-22): one cycle lasts 8-12 s and the I shows as 1 for one eased stretch of 300-500 ms, not a strobe
  const rate = (page, sel) => page.evaluate((sel) => {
    const h = document.querySelector(sel), i = h && h.querySelector('.gl i'); if (!i) return { missing: true };
    const an = h.getAnimations({ subtree: true }), dur = an[0].effect.getComputedTiming().duration; let on = 0, runs = 0, prev = false;
    for (let t = 0; t < dur; t += 10) { for (const a of an) { a.pause(); a.currentTime = t; } const v = +getComputedStyle(i).opacity > 0.5; if (v) on += 10; if (v && !prev) runs++; prev = v; }
    return { dur: Math.round(dur), on, runs, easing: an[0].effect.getKeyframes()[0].easing };
  }, sel);
  const judgeRate = (name, r) => check(name, !r.missing && r.dur >= 8000 && r.dur <= 12000 && r.on >= 300 && r.on <= 500 && r.runs === 1 && r.easing !== 'linear' && !/steps/.test(r.easing), JSON.stringify(r));
  const judge = (name, r) => check(name, !r.missing && r.maxGap <= r.limit && r.lines <= 1, JSON.stringify(r));
  for (const t of found) {
    const styles = (t.src.match(/<style>[\s\S]*?<\/style>/g) || []).join('\n');
    const wrap = /vfilms/.test(styles) ? 'vfilms' : '';
    const page = await b.newPage({ viewport: { width: 900, height: 400 } });
    // the hostile row is lib/card-frame.js's .vc-title: flex, space-between, a cost mark after
    await page.setContent('<!doctype html><meta charset="utf-8">' + styles + '<style>body{background:#111;color:#fff;font:16px system-ui}.vc-title{display:flex;align-items:center;justify-content:space-between;gap:10px;width:640px;font-size:30px;padding:5px 12px;border:2px solid #888}.vc-title::after{content:"\\25C6"}</style><div class="' + wrap + '">' + t.html.replace(/^<(h[1-6])/, '<$1 class="vc-title" id="gt"') + '</div>');
    judgeRate(t.file + ' glitch is rare and slow', await rate(page, '#gt'));
    // the page re-rolls each cycle to 8-12 s: the swap must stay 300-500 ms at both ends
    for (const d of ['8s', '12s']) { await page.evaluate((d) => document.querySelector('#gt .glw').style.setProperty('--gl-d', d), d); judgeRate(t.file + ' glitch is rare and slow at ' + d, await rate(page, '#gt')); }
    for (const f of FRAMES) judge(t.file + ' word whole at ' + Math.round(f * 1000) / 10 + '%', await measure(page, '#gt', f));
    await page.close();
  }
  if (process.argv.includes('--live')) {
    // the exact user path (owner, 2026-10-22: the card in the main ask flow still broke after a pass here): a fresh browser with no cache
    // opens the home page and types "films"; then, in the same browser, a returning visit (reload, service worker in charge) asks again
    const SITE = process.env.VOID_SITE || 'https://a-to-mind.com';
    // the deployed code carries the fix (a stale or unshipped copy was one suspect; the deploy strips comments, so markers, not bytes)
    const MARKS = [['skills/films.js', 'class="glw"'], ['lib/card-frame.js', 'vc-tw'], ['sw.js', "cache: 'no-cache'"]];
    const bodies = await Promise.all(MARKS.map(([f]) => fetch(SITE + '/' + f + '?fresh=' + Date.now()).then((r) => r.text()).catch(() => '')));
    MARKS.forEach(([f, mark], k) => check('live ' + f + ' has the fix', bodies[k].includes(mark), bodies[k].length + ' bytes'));
    for (const [w, h] of [[1280, 800], [740, 700], [390, 700]]) {
      const ctx = await b.newContext({ viewport: { width: w, height: h } }), page = await ctx.newPage();
      for (const visit of ['fresh', 'returning']) {
        try {
          if (visit === 'fresh') await page.goto(SITE + '/', { waitUntil: 'load', timeout: 45000 }); else await page.reload({ waitUntil: 'load', timeout: 45000 });
          const input = page.locator('input, textarea').first(); await input.click(); await input.fill('films'); await input.press('Enter');
          await page.waitForSelector('.vcard h2[aria-label="VERSE FILMS"]', { timeout: 30000 }); await page.waitForTimeout(2500);
          await page.evaluate(() => { document.querySelectorAll('#gt').forEach((n) => n.removeAttribute('id')); document.querySelector('.vcard h2[aria-label="VERSE FILMS"]').id = 'gt'; });
          judgeRate('live card ' + visit + ' ' + w + 'x' + h + ' glitch is rare and slow', await rate(page, '#gt'));
          for (const f of FRAMES) {
            const r = await measure(page, '#gt', f); judge('live card ' + visit + ' ' + w + 'x' + h + ' at ' + Math.round(f * 1000) / 10 + '%', r);
            if (process.env.GLITCH_SHOTS && [0, 0.97].includes(f)) await page.screenshot({ path: process.env.GLITCH_SHOTS + '-' + visit + '-' + w + '-' + (f ? 'glitch' : 'calm') + '.png' });
          }
        } catch (e) { check('live card ' + visit + ' ' + w + 'x' + h + ' opened', false, e.message.split('\n')[0]); }
      }
      await ctx.close();
    }
  }
  await b.close();
}
console.log(pass + '/' + (pass + fail) + ' passed');
process.exit(fail ? 1 : 0);
