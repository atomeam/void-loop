// Card quality audit (owner, 2026-10-22: "make sure the cards are the best they can possibly be"): asks a spread of card kinds on the live site (or SITE)
// at several window sizes and reports any hidden or cut text, raw tags, empty bullets, text past the window, missing card buttons. Exit 1 on any.
//   CHROME_PATH=/usr/bin/google-chrome node tools/card-quality.mjs
// Sizes: 1280x800 at 100%, the 390x700 phone, and 1280x800 seen at 50% (2560x1600), 150% (853x533) and 200% (640x400) browser zoom.
import { chromium } from 'playwright-core';
const SITE = process.env.SITE || 'https://a-to-mind.com';
const ASKS = (process.env.ASKS || "what is the speed of light|tell me about tokyo|weather in boston|15% of 240|translate hello to spanish|recipe for pancakes|list of planets|what time is it in london|convert 5 miles to km|who wrote hamlet|what can you do|make a collectible card of a dragon").split('|');
const SIZES = (process.env.SIZES || '1280x800,390x700,2560x1600,853x533,640x400').split(',').map((s) => s.split('x').map(Number));
const b = await chromium.launch({ executablePath: process.env.CHROME_PATH || '/usr/bin/google-chrome', headless: true, args: ['--enable-unsafe-swiftshader','--use-angle=swiftshader'] });
const out = [];
for (const [w, h] of SIZES) for (const ask of ASKS) {
  const p = await b.newPage({ viewport: { width: w, height: h } });
  try {
    await p.goto(SITE + '/', { waitUntil: 'domcontentloaded', timeout: 45000 });
    const i = p.locator('input, textarea').first(); await i.click(); await i.fill(ask); await i.press('Enter');
    await p.waitForSelector('.vpage.on, .vcard', { timeout: 25000 }); await p.waitForTimeout(6000);
    const r = await p.evaluate(() => {
      const el = document.querySelector('.vpage.on') || [...document.querySelectorAll('.vcard')].pop(); if (!el) return { none: 1 };
      const box = el.getBoundingClientRect(), all = [...el.querySelectorAll('*')];
      const hidden = all.filter((n) => { const s = getComputedStyle(n); return s.textOverflow === 'ellipsis' && n.scrollWidth > n.clientWidth + 1 && n.textContent.trim(); }).map((n) => n.className + ':' + n.textContent.trim().slice(0, 50));
      const txt = el.innerText || '';
      const cut = (txt.match(/.{0,30}\S…(\s|$)/g) || []);
      const raw = (txt.match(/(<\/?[a-z]+[^>]*>|\{"|\bundefined\b|\bNaN\b|\[object|\bnull\b)/g) || []);
      const emptyLi = all.filter((n) => n.tagName === 'LI' && !n.textContent.trim()).length;
      const spill = all.filter((n) => { const r = n.getBoundingClientRect(); const s = getComputedStyle(n); return r.width > 0 && s.position !== 'fixed' && n.textContent.trim() && n.children.length === 0 && (r.right > innerWidth + 1 || r.left < -1); }).map((n) => n.tagName + '.' + n.className + ':' + n.textContent.trim().slice(0, 30));
      const btns = [...el.querySelectorAll('.vc-share button')].map((b) => b.textContent.trim());
      const lowc = []; // contrast
      const lum = (c) => { const m = c.match(/[\d.]+/g); if (!m) return null; const [r, g, bb] = m.slice(0, 3).map((v) => { v /= 255; return v <= .03928 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4; }); return .2126 * r + .7152 * g + .0722 * bb; };
      for (const n of all) { if (!n.children.length && n.textContent.trim()) { const s = getComputedStyle(n); const a = s.color.match(/[\d.]+/g); if (a && a[3] !== undefined && +a[3] < .5) continue; const L = lum(s.color); if (L !== null && L < .12 && !n.closest('svg')) lowc.push(n.className + ':' + s.color + ':' + n.textContent.trim().slice(0, 20)); } }
      return { cls: el.className.slice(0, 60), skill: el.dataset.skill, w: Math.round(box.width), hidden, cut, raw, emptyLi, spill: spill.slice(0, 5), btns, lowc: lowc.slice(0, 5), len: txt.length };
    });
    out.push({ w, h, ask, ...r });
    console.log(w + 'x' + h, ask, JSON.stringify(r));
    if (w === 1280 || w === 390) await p.screenshot({ path: '/tmp/cards-audit-' + w + '-' + ask.replace(/\W+/g, '_').slice(0, 30) + '.png' });
  } catch (e) { console.log(w + 'x' + h, ask, 'ERR', e.message.split('\n')[0]); }
  await p.close();
}
await b.close();
import('node:fs').then((fs) => fs.writeFileSync('/tmp/cards-audit-out.json', JSON.stringify(out, null, 1)));
const NEED = ['copy card', 'save card', 'copy text', 'save text'].concat(process.env.NEED_SHARE ? ['share'] : []);
const fails = out.filter((r) => r.none || (r.hidden || []).length || (r.cut || []).length || (r.raw || []).length || r.emptyLi || (r.spill || []).length || NEED.some((n) => !(r.btns || []).includes(n)));
for (const f of fails) console.log('FAIL', f.w + 'x' + f.h, f.ask);
process.exit(fails.length ? 1 : 0);
