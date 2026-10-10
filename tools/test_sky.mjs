// The sky world in a real browser: "sky" turns the stage into the real sky for a fixed place and time (London, with the clock held), the card sits on it,
// dragging looks around, a tap names a star, the chips run real skills, closing the card gives the void back, and it works at 375 px wide, with the
// keyboard alone, with reduced motion and on a low-power device. Screenshots of the sky at noon and at night go to docs/img/ with --shots.
//   node tools/test_sky.mjs [--shots]
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright-core';

const here = path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')), root = path.resolve(here, '..', 'void-live-deploy');
const shots = process.argv.includes('--shots');
let pass = 0, fail = 0;
const check = (name, ok, got) => { if (ok) pass++; else fail++; console.log((ok ? 'pass ' : 'FAIL ') + name + (ok ? '' : '  -> ' + got)); };

const types = { '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json', '.svg': 'image/svg+xml' };
const server = http.createServer((req, res) => {
  let p = decodeURIComponent(new URL(req.url, 'http://x').pathname); if (p === '/') p = '/index.html';
  const f = path.join(root, p);
  if (!f.startsWith(root) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { 'content-type': types[path.extname(f)] || 'text/plain' }); fs.createReadStream(f).pipe(res);
}).listen(0);
const base = 'http://127.0.0.1:' + server.address().port + '/';
const exe = [process.env.VOID_TEST_BROWSER, '/opt/pw-browsers/chromium', 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', 'C:/Program Files/Google/Chrome/Application/chrome.exe'].find((p) => p && fs.existsSync(p));
const browser = await chromium.launch({ executablePath: exe, headless: true });
const json = (b) => ({ contentType: 'application/json', body: JSON.stringify(b) });

async function open(opts = {}) {
  const ctx = await browser.newContext({ viewport: opts.viewport || { width: 1280, height: 800 }, reducedMotion: opts.reduced ? 'reduce' : 'no-preference', hasTouch: !!opts.touch });
  const errors = []; await ctx.route(/^https?:\/\/(?!127\.0\.0\.1)/, (r) => {
    const u = r.request().url();
    if (u.includes('geocoding-api.open-meteo.com')) { const q = decodeURIComponent((u.match(/name=([^&]+)/) || [])[1] || ''); return r.fulfill(json(/sydney/i.test(q) ? { results: [{ name: 'Sydney', country: 'Australia', latitude: -33.87, longitude: 151.2, timezone: 'Australia/Sydney' }] } : { results: [] })); }
    return r.fulfill({ status: 204, body: '' });
  });
  await ctx.route(/127\.0\.0\.1:\d+\/api\//, (r) => (/\/api\/where$/.test(r.request().url()) ? r.fulfill(json({ ok: true, lat: 51.5, lon: -0.1, city: 'London', country: 'GB', timezone: 'Europe/London' })) : r.fulfill({ status: 204, body: '' })));
  const page = await ctx.newPage(); page.on('pageerror', (e) => errors.push(e.message));
  if (opts.low) await page.addInitScript(() => { Object.defineProperty(navigator, 'hardwareConcurrency', { get: () => 2 }); });
  await page.addInitScript(() => { try { localStorage.removeItem('void.where.v1'); } catch (_) {} });
  await page.clock.setFixedTime(new Date(opts.at || '2026-06-21T11:00:00Z'));
  await page.goto(base);
  page._errors = errors; page._ctx = ctx;
  return page;
}
const ask = async (page, text) => { await page.fill('#input', text); await page.keyboard.press('Enter'); };
const openSky = async (page) => { await ask(page, 'sky'); await page.waitForSelector('#void-card-world.on', { timeout: 15000 }); await page.waitForFunction(() => window.__voidWorld && window.__voidWorld() && window.__voidWorld().items().length >= 0 && document.querySelector('.skyc .skynow'), null, { timeout: 15000 }); await page.waitForTimeout(250); };
// the brightest and the darkest of a few pixels from the world canvas, as [r, g, b]
const pixel = (page, fx, fy) => page.evaluate(([fx, fy]) => { const c = document.getElementById('void-card-world'), x = c.getContext('2d').getImageData(Math.floor(c.width * fx), Math.floor(c.height * fy), 1, 1).data; return [x[0], x[1], x[2]]; }, [fx, fy]);
const lit = (page) => page.evaluate(() => { const c = document.getElementById('void-card-world'), d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data; let n = 0; for (let i = 0; i < d.length; i += 4) if (d[i] > 170 && d[i + 1] > 170 && d[i + 2] > 170) n++; return n; });

// ---- noon ----
{
  const page = await open({ at: '2026-06-21T11:00:00Z' });
  check('before the sky is asked for, there is no world: the void is the void', await page.evaluate(() => !document.getElementById('void-card-world') && !document.documentElement.classList.contains('has-world')), '');
  await openSky(page);
  const card = await page.evaluate(() => { const c = document.querySelector('.vpage'); return { text: c.innerText, chips: [...c.querySelectorAll('.skychips a')].map((a) => a.getAttribute('data-ask')), form: !!c.querySelector('form.skyplace input'), sim: /simulation/i.test(c.innerText) }; });
  check('the card has the definition, the take, the live row and the chips', /everything you can see above the horizon/.test(card.text) && /A take\./.test(card.text) && /3 minutes 56 seconds/.test(card.text) && /Right now, where you are/.test(card.text) && card.chips.length === 7, JSON.stringify(card.chips));
  check('it says where and that it is a simulation, and offers to change location', card.sim && /London/.test(card.text) && card.form, card.text.slice(0, 200));
  check('the live row at noon in June says the sun is high and the moon and planets are not yet', /The sun is \d+° up, to the south[a-z-]* \(day\)/.test(card.text) && /sky is still too bright/.test(card.text), card.text);
  const top = await pixel(page, 0.5, 0.05), mid = await pixel(page, 0.9, 0.5);
  check('the stage is a blue sky at noon', top[2] > 150 && top[2] > top[0] + 40, JSON.stringify(top));
  check('no stars in a noon sky (none drawn, none to tap)', await page.evaluate(() => window.__voidWorld().items().every((i) => i.kind !== 'star')), '');
  check('the sun is in view, clear of the card', await page.evaluate(() => { const c = document.querySelector('.vpage').getBoundingClientRect(), s = window.__voidWorld().items().find((i) => i.kind === 'sun'); return !!s && (s.x < c.left - 10 || s.x > c.right + 10 || s.y < c.top - 10 || s.y > c.bottom + 10); }), JSON.stringify(await page.evaluate(() => window.__voidWorld().items().filter((i) => i.kind === 'sun'))));
  check('the void\'s own layers are still there under it (the world covers them, it does not remove them)', await page.evaluate(() => !!document.getElementById('void-stars') && getComputedStyle(document.getElementById('void-card-world')).zIndex === '0' && document.getElementById('void-card-world').nextElementSibling.id === 'stage'), '');
  if (shots) { fs.mkdirSync(path.resolve(here, '..', 'docs', 'img'), { recursive: true }); await page.screenshot({ path: path.resolve(here, '..', 'docs', 'img', 'sky-noon.png') }); }
  // dragging looks around: the view's azimuth changes by about the drag in degrees, and a tap on empty sky does NOT close the card after a drag
  const v0 = await page.evaluate(() => window.__voidWorld().view());
  await page.mouse.move(200, 300); await page.mouse.down(); await page.mouse.move(320, 330, { steps: 8 }); await page.mouse.up();
  const v1 = await page.evaluate(() => window.__voidWorld().view());
  check('dragging looks around the dome (drag right: the view turns left; drag down: it looks up)', v1.az0 < v0.az0 - 5 && v1.alt0 > v0.alt0 + 1 && await page.evaluate(() => !!document.querySelector('.vpage.on')), JSON.stringify([v0, v1]));
  // zoom: the wheel on the empty stage
  await page.mouse.move(150, 200); await page.mouse.wheel(0, 300);
  check('the wheel zooms out', (await page.evaluate(() => window.__voidWorld().view().fov)) > v1.fov + 3, '');
  // close: a tap on empty sky (no star under it) closes the card, and the stage goes back to the void
  await page.mouse.click(120, 560);
  await page.waitForFunction(() => !document.querySelector('.vpage'), null, { timeout: 5000 });
  await page.waitForFunction(() => !document.getElementById('void-card-world'), null, { timeout: 5000 });
  check('closing the card gives the void back: no world, no class, an empty stage', await page.evaluate(() => !document.getElementById('void-card-world') && !document.documentElement.classList.contains('has-world') && document.getElementById('stage').children.length === 0 && !window.__voidWorld()), '');
  check('no page errors at noon', page._errors.length === 0, page._errors.join(' | '));
  await page._ctx.close();
}

// ---- night, a star tapped, the chips ----
{
  const page = await open({ at: '2026-01-15T22:00:00Z' });
  await openSky(page);
  const dark = await pixel(page, 0.5, 0.05);
  check('the stage is dark at night', dark[0] + dark[1] + dark[2] < 160, JSON.stringify(dark));
  check('there are stars: many bright pixels in the sky', (await lit(page)) > 40, await lit(page));
  const rows = await page.evaluate(() => document.querySelector('.skynow').innerText);
  check('the live row at night: the sun is down and the moon has a phase', /below the horizon \(night\)/.test(rows) && /The moon is [a-z ]+, \d+% lit/.test(rows), rows);
  if (shots) await page.screenshot({ path: path.resolve(here, '..', 'docs', 'img', 'sky-night.png') });
  // tap a star: the card names it
  const star = await page.evaluate(() => window.__voidWorld().items().filter((i) => i.kind === 'star' && i.x > 40 && i.x < innerWidth - 40 && i.y > 40 && i.y < innerHeight - 100).sort((a, b) => a.name.localeCompare(b.name))[0]);
  if (star) {
    // find a star not under the card: the card is centred, so prefer one near an edge
    const edge = await page.evaluate(() => { const c = document.querySelector('.vpage').getBoundingClientRect(); return window.__voidWorld().items().filter((i) => i.kind === 'star' && i.x > 20 && i.x < innerWidth - 20 && i.y > 20 && i.y < innerHeight - 100 && (i.x < c.left - 6 || i.x > c.right + 6 || i.y < c.top - 6 || i.y > c.bottom + 6))[0]; });
    if (edge) { await page.mouse.click(edge.x, edge.y); await page.waitForTimeout(150); const said = await page.evaluate(() => document.querySelector('.skypick').textContent); check('tapping a star names it (and the card stays)', said.includes(edge.name) && await page.evaluate(() => !!document.querySelector('.vpage.on')), said + ' / ' + edge.name); }
    else check('tapping a star names it (a star clear of the card)', false, 'no star outside the card in view');
  } else check('there are tappable stars on screen', false, 'none');
  // the chips run real skills: the moon, and the world gives way to that card
  await page.click('.skychips a[data-ask="moon tonight"]');
  await page.waitForFunction(() => /The moon tonight/.test(document.querySelector('.vpage') ? document.querySelector('.vpage').innerText : ''), null, { timeout: 8000 });
  const moon = await page.evaluate(() => document.querySelector('.vpage').innerText);
  check('the "Tonight\'s moon" chip answers with the moon (phase, rise, set, next full moon)', /% of the moon is lit/.test(moon) && /rises|sets/.test(moon) && /Next full moon/.test(moon), moon);
  await page.waitForFunction(() => !document.getElementById('void-card-world'), null, { timeout: 4000 }).catch(() => {});
  check('that card does not own the stage: the world is gone, the void is back', await page.evaluate(() => !document.getElementById('void-card-world') && !document.documentElement.classList.contains('has-world')), '');
  for (const [chip, re] of [['sunrise and sunset', /Sunrise|Sunset/], ['next eclipse', /eclipse/i], ['meteor showers this month', /meteor|shower/i], ['what\'s that constellation', /constellation/i], ['aurora forecast', /aurora|northern lights/i], ['next full moon', /next full moon/i]]) {
    await ask(page, 'sky'); await page.waitForSelector('#void-card-world.on'); await page.waitForSelector('.skychips a');
    await page.click(`.skychips a[data-ask="${chip.replace(/"/g, '\\"')}"]`);
    await page.waitForFunction((r) => { const c = document.querySelector('.vpage'); return c && !c.classList.contains('skyc') && new RegExp(r, 'i').test(c.innerText); }, re.source, { timeout: 8000 }).catch(() => {});
    const t = await page.evaluate(() => (document.querySelector('.vpage') || {}).innerText || '');
    check(`the "${chip}" chip answers`, re.test(t) && !/^Sky\b/.test(t), t.slice(0, 160));
  }
  check('no page errors at night', page._errors.length === 0, page._errors.join(' | '));
  await page._ctx.close();
}

// ---- 375 px wide and the keyboard alone ----
{
  const page = await open({ at: '2026-01-15T22:00:00Z', viewport: { width: 375, height: 667 }, touch: true });
  await openSky(page);
  const m = await page.evaluate(() => { const c = document.querySelector('.vpage').getBoundingClientRect(); return { left: c.left, right: c.right, top: c.top, bottom: c.bottom, w: document.documentElement.scrollWidth, h: innerHeight, btn: [...document.querySelectorAll('.skyctl button')].every((b) => { const r = b.getBoundingClientRect(); return r.left >= 0 && r.right <= 375 && r.width >= 28 && r.height >= 28; }), chips: [...document.querySelectorAll('.skychips a')].every((a) => { const r = a.getBoundingClientRect(); return r.left >= 0 && r.right <= 375; }) }; });
  check('at 375 px the card fits the screen and nothing scrolls sideways', m.left >= 0 && m.right <= 375 && m.w <= 375, JSON.stringify(m));
  check('at 375 px the sky shows above and below the card (it does not fill the screen)', m.top > 20 && m.bottom < m.h - 20, JSON.stringify(m));
  const chipsVisible = await page.evaluate(() => { const card = document.querySelector('.vpage').getBoundingClientRect(), a = document.querySelector('.skychips a').getBoundingClientRect(); return a.top >= card.top && a.bottom <= card.bottom + 1; });
  check('at 375 px the chips are in the first screenful of the card, not below a scroll', chipsVisible, '');
  check('at 375 px the look buttons are big enough to touch and the chips wrap inside the card', m.btn && m.chips, JSON.stringify(m));
  if (shots) await page.screenshot({ path: path.resolve(here, '..', 'docs', 'img', 'sky-375.png') });
  // a touch drag on the empty sky looks around
  const v0 = await page.evaluate(() => window.__voidWorld().view());
  const empty = await page.evaluate(() => { const c = document.querySelector('.vpage').getBoundingClientRect(); return { x: 187, y: Math.max(30, c.top / 2) }; });
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: empty.x, y: empty.y }] });
  for (let i = 1; i <= 6; i++) await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: empty.x + i * 12, y: empty.y }] });
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  const v1 = await page.evaluate(() => window.__voidWorld().view());
  check('a finger dragging the sky looks around', Math.abs(v1.az0 - v0.az0) > 4, JSON.stringify([v0, v1]));
  await page._ctx.close();
}
{
  const page = await open({ at: '2026-01-15T22:00:00Z' });
  await openSky(page);
  // keyboard alone: focus the look buttons and the chips with Tab, press them with Enter / Space, look with the arrow keys, zoom with + and -, and dismiss with Escape
  await page.evaluate(() => document.activeElement && document.activeElement.blur());
  const order = [];
  for (let i = 0; i < 18; i++) { await page.keyboard.press('Tab'); order.push(await page.evaluate(() => { const a = document.activeElement; return a ? (a.getAttribute('data-ask') || a.getAttribute('data-look') || a.getAttribute('name') || a.tagName) : ''; })); }
  check('Tab reaches every chip, every look button and the location box', ['moon tonight', 'next full moon', 'sunrise and sunset', 'aurora forecast', 'meteor showers this month', 'next eclipse', 'left', 'right', 'up', 'down', 'in', 'out', 'where'].every((x) => order.includes(x)), order.join(','));
  const outline = await page.evaluate(() => { const a = document.querySelector('.skychips a'); a.focus(); const s = getComputedStyle(a); return s.outlineStyle !== 'none' && parseFloat(s.outlineWidth) >= 2; });
  check('a focused chip has a visible outline', outline, '');
  const v0 = await page.evaluate(() => window.__voidWorld().view());
  await page.focus('[data-look="right"]'); await page.keyboard.press('Enter'); await page.keyboard.press('Space');
  const v1 = await page.evaluate(() => window.__voidWorld().view());
  check('Enter and Space on "look right" turn the view (24 degrees for the two)', Math.abs(((v1.az0 - v0.az0 + 540) % 360) - 180) > 20, JSON.stringify([v0, v1]));
  await page.focus('[data-look="up"]'); await page.keyboard.press('ArrowLeft'); await page.keyboard.press('ArrowLeft');
  const v2 = await page.evaluate(() => window.__voidWorld().view());
  check('arrow keys on the card look around too', Math.abs(((v2.az0 - v1.az0 + 540) % 360) - 180) > 10, JSON.stringify([v1, v2]));
  await page.keyboard.press('-'); const v3 = await page.evaluate(() => window.__voidWorld().view());
  check('minus zooms out', v3.fov > v2.fov + 10, JSON.stringify([v2, v3]));
  // a star's name without a pointer: the constellation chip lists what is up, in words
  await page.focus('.skychips a[data-ask="what\'s that constellation"]'); await page.keyboard.press('Enter');
  await page.waitForFunction(() => /Constellations up now/.test((document.querySelector('.vpage') || {}).innerText || ''), null, { timeout: 8000 });
  const list = await page.evaluate(() => document.querySelector('.vpage').innerText);
  check('by keyboard the constellation chip names what is up, with directions', /Orion: Rigel is \d+° up, to the (south|southeast|south-southeast)/.test(list), list.slice(0, 300));
  // change location with the keyboard only: back to the sky, type Sydney, Enter
  await ask(page, 'sky'); await page.waitForSelector('.skyplace input');
  await page.focus('.skyplace input'); await page.keyboard.type('Sydney'); await page.keyboard.press('Enter');
  await page.waitForFunction(() => /Sydney/.test(document.querySelector('.vpage .sub').innerText), null, { timeout: 8000 });
  const south = await page.evaluate(() => ({ sub: document.querySelector('.vpage .sub').innerText, place: window.__voidWorld().state().place, take: document.querySelector('.skytake').innerText }));
  check('"change location" moves the sky to Sydney (south latitude, a south celestial pole in the take)', south.place.lat < -30 && /south horizon/.test(south.take), JSON.stringify(south));
  await page.keyboard.press('Escape'); await page.waitForFunction(() => !document.querySelector('.vpage'), null, { timeout: 4000 });
  check('Escape closes the card and the void comes back', await page.evaluate(() => new Promise((r) => setTimeout(() => r(!document.getElementById('void-card-world')), 800))), '');
  check('no page errors with the keyboard', page._errors.length === 0, page._errors.join(' | '));
  await page._ctx.close();
}

// ---- reduced motion holds the scene still; a low-power device gets the light sky ----
{
  const page = await open({ at: '2026-01-15T22:00:00Z', reduced: true });
  await openSky(page);
  const a = await page.evaluate(() => ({ mode: window.__voidWorld().mode, t: getComputedStyle(document.getElementById('void-card-world')).transitionDuration }));
  check('reduced motion: told to hold still, and the world appears without a fade', a.mode.reduced === true && /^0s$/.test(a.t), JSON.stringify(a));
  const before = await page.evaluate(() => document.getElementById('void-card-world').toDataURL().length);
  await page.waitForTimeout(1500);
  check('reduced motion: the scene does not change by itself', (await page.evaluate(() => document.getElementById('void-card-world').toDataURL().length)) === before, '');
  const vv = await page.evaluate(() => window.__voidWorld().view());
  await page.focus('[data-look="left"]'); await page.keyboard.press('Enter');
  check('reduced motion: it still redraws when asked (a look button)', (await page.evaluate(() => window.__voidWorld().view().az0)) !== vv.az0 && (await lit(page)) > 20, '');
  await page._ctx.close();
}
{
  const page = await open({ at: '2026-01-15T22:00:00Z', low: true });
  await openSky(page);
  const d = await page.evaluate(() => ({ mode: window.__voidWorld().mode, drawn: window.__voidWorld().drawn() }));
  check('a low-power device gets the light sky: the brightest 120 stars and no constellation figures', d.mode.low === true && d.drawn.stars === 120 && d.drawn.figures === 0, JSON.stringify(d));
  check('and it is still the night sky (stars on a dark gradient)', (await lit(page)) > 15 && (await pixel(page, 0.5, 0.05)).reduce((a, b) => a + b, 0) < 200, '');
  await page._ctx.close();
}

await browser.close(); server.close();
console.log(`\n${pass}/${pass + fail} passed`);
process.exit(fail ? 1 : 0);
