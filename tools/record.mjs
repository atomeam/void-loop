#!/usr/bin/env node
// Void records its own experiments (owner, 2026-10-14: "Void should use my Youtube channel to make its own Videos"; step 1 of
// the broadcast loop is teaching Void to record itself). One lab experiment (a page under void-live-deploy/fringe/) is opened in a
// real browser and filmed while it runs: the page's own demo() when it has one, otherwise its buttons pressed one after another.
// The narration is the run's own research notes from the fringe ledger (tools/fringe.json: behavior, hypothesis, findings),
// shown as a caption on the video (a headless browser has no speech voices) and written next to it as the title and
// description an upload will carry. Nothing is uploaded here: that is step 2, with the owner's YouTube credentials.
//   node tools/record.mjs [id] [--seconds 20] [--out media]   -> media/<id>.webm and media/<id>.json { title, description, tags, caption }
// id: a lab experiment such as attention-7 (default: the newest experiment in the lab).
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const site = path.resolve(here, '..', 'void-live-deploy');
const TITLE_MAX = 100, DESC_MAX = 4500; // YouTube allows 100 and 5,000

/** the run in the fringe ledger whose live page is fringe/<id>.html (the newest one when a draft was redone), or null */
export function runOf(ledger, id) {
  const runs = (Array.isArray(ledger) ? ledger : []).filter((r) => String(r.draft || '').split('/').pop() === id + '.html');
  return runs.length ? runs[runs.length - 1] : null;
}

/** the opening line: the experiment's own question when its lab line asks one ("How much does a hint steer you?"), else its
 *  behavior. A hook, never a promise the experiment does not keep. Pure. */
export function hookOf(tool, run) {
  const q = String(tool.sub || '').match(/[^.?!]*\?/);
  return (q ? q[0] : String((run && run.behavior) || tool.sub || tool.label || '')).trim();
}

/** what the video says, as an ad for Void (owner, 2026-10-14: "make each video into an awesomely epic ad for itself and reach as
 *  many viewers as possible"): { hook, caption, cta, title, description, tags } from the lab entry ({ id, label, sub }) and its
 *  ledger run. Everything in it is true of the experiment: what it is, what it found, what failed. Pure. */
// the name viewers see is V01D (owner, 2026-10-14: "it shoud say V01d everywhere"; "V01D FILMS"): the lab's and ledger's own words say Void
export const brand = (t) => String(t || '').replace(/\bVoid\b/g, 'V01D');
export function script(tool0, run0) {
  const tool = { ...tool0, label: brand(tool0.label), sub: brand(tool0.sub) };
  const run = run0 && { ...run0, behavior: brand(run0.behavior), hypothesis: brand(run0.hypothesis), findings: Array.isArray(run0.findings) ? run0.findings.map(brand) : run0.findings, failure_modes: Array.isArray(run0.failure_modes) ? run0.failure_modes.map((f) => (f && f.what ? { ...f, what: brand(f.what) } : brand(f))) : run0.failure_modes };
  const label = String(tool.label || tool.id), sub = String(tool.sub || '').trim();
  const behavior = run && run.behavior ? String(run.behavior).trim() : sub;
  const lines = (xs) => (Array.isArray(xs) ? xs : []).map((x) => '- ' + String(x).trim()).join('\n');
  const hook = hookOf(tool, run), link = 'https://a-to-mind.com/?q=' + encodeURIComponent(String(tool0.label || tool0.id).toLowerCase()); // the ask as the lab names it, so it still routes
  const tail = ' | an AI built this itself #Shorts';
  const title = (hook.length + tail.length <= TITLE_MAX ? hook + tail : label + tail).slice(0, TITLE_MAX);
  const parts = [
    hook + ' Try it free: ' + link, // the first lines are what a viewer sees before "more": the hook and the link
    'V01D, an AI at https://a-to-mind.com, built this experiment by itself, tested it, and filmed it in a real browser. Nothing was edited by hand.',
    behavior !== hook ? behavior : '',
    run && run.hypothesis ? 'What it set out to show: ' + String(run.hypothesis).trim() : '',
    run && Array.isArray(run.findings) && run.findings.length ? 'What it found:\n' + lines(run.findings) : '',
    run && Array.isArray(run.failure_modes) && run.failure_modes.length ? 'What failed:\n' + lines(run.failure_modes.map((f) => (f && f.what) || f)) : '',
    'Ask V01D for anything: https://a-to-mind.com',
    'V01D FILMS: a new one every day.',
    'Watch them all: https://www.youtube.com/@atombomb983',
    '#Shorts #AI #V01D',
  ].filter(Boolean);
  return { hook, caption: behavior || label, cta: 'Built by an AI, by itself.\nTry it free at\na\u2011to\u2011mind.com', title, description: parts.join('\n\n').slice(0, DESC_MAX),
    tags: ['V01D', 'V01D FILMS', 'Void', 'A-to-Mind', 'AI', 'AI experiment', 'interactive', 'Shorts', run ? run.family : 'lab'].filter(Boolean) };
}

function serve() {
  const types = { '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json', '.css': 'text/css', '.svg': 'image/svg+xml', '.png': 'image/png' };
  const server = http.createServer((req, res) => {
    let p; try { p = decodeURIComponent(new URL(req.url, 'http://x').pathname); } catch (_) { res.writeHead(400); return res.end(); }
    const f = path.join(site, p === '/' ? '/index.html' : p);
    if (!f.startsWith(site) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); return res.end(); }
    res.writeHead(200, { 'content-type': types[path.extname(f)] || 'application/octet-stream' }); fs.createReadStream(f).pipe(res);
  }).listen(0);
  return { server, base: 'http://127.0.0.1:' + server.address().port + '/' };
}

/** film one experiment: returns { video, meta } paths */
export async function record(id, { seconds = 20, out = path.resolve(here, '..', 'media') } = {}) {
  const { chromium } = await import('playwright-core');
  const { toolList } = await import('../void-live-deploy/skills/make.js');
  const tool = toolList().find((t) => t.id === id);
  if (!tool) throw new Error(id + ' is not a lab experiment (skills/make.js)');
  if (!fs.existsSync(path.join(site, 'fringe', id + '.html'))) throw new Error('no page at void-live-deploy/fringe/' + id + '.html');
  const ledger = JSON.parse(fs.readFileSync(path.join(here, 'fringe.json'), 'utf8'));
  const words = script(tool, runOf(ledger, id));
  fs.mkdirSync(out, { recursive: true });
  const exe = [process.env.VOID_TEST_BROWSER, '/opt/pw-browsers/chromium'].find((p) => p && fs.existsSync(p));
  const { server, base } = serve();
  const browser = await chromium.launch({ headless: true, ...(exe ? { executablePath: exe } : {}) });
  // a vertical Short (9:16, where new viewers find a channel), filmed sharp: the page laid out as on a 540 px phone and drawn at
  // about twice that, 1080 x 1920 (CSS zoom 2.3), so every pixel of the film is real. Playwright never scales a film up (asked for
  // 1080 x 1920 at a 540 viewport it put the page in the top-left quarter of a grey frame, every film before 2026-10-14).
  const ctx = await browser.newContext({ viewport: { width: 1080, height: 1920 }, recordVideo: { dir: out, size: { width: 1080, height: 1920 } } });
  const page = await ctx.newPage();
  try {
    await page.goto(base + 'fringe/' + id + '.html', { waitUntil: 'load' });
    // the edit (owner, 2026-10-14: "teach Void how to edit and make epic videos that are very entertaining"): a hook that slams in,
    // a progress bar, a punch-in on every action with a kinetic caption, and an ending that matches the first frame so it loops.
    await page.evaluate(({ title, caption, total }) => {
      document.documentElement.style.zoom = '2.3'; // the page laid out about 470 px wide, as on a phone, and big enough to read
      const css = document.createElement('style');
      css.textContent = `
        [data-v-fx] { position: fixed; z-index: 2147483647; pointer-events: none; font-family: system-ui, -apple-system, sans-serif; }
        [data-v-bar] { top: 0; left: 0; height: 5px; width: 0; background: linear-gradient(90deg, #ff3d7f, #7a5cff); box-shadow: 0 0 12px #ff3d7f; transition: width linear; }
        [data-v-cap] { left: 0; right: 0; bottom: 0; padding: 14px 20px 18px; background: linear-gradient(transparent, rgba(5,5,12,.92) 30%); color: #fff; }
        [data-v-cap] small { display: block; font: 700 11px/1 system-ui; letter-spacing: .2em; text-transform: uppercase; color: #ff9dbd; margin-bottom: 6px; }
        [data-v-cap] b { font: 800 21px/1.25 system-ui; }
        [data-v-chip] { top: 14px; left: 50%; transform: translate(-50%, -12px) scale(.9); opacity: 0; padding: 8px 14px; border-radius: 999px; color: #fff;
          font: 800 15px/1 system-ui; background: linear-gradient(90deg, #ff3d7f, #7a5cff); box-shadow: 0 8px 22px rgba(255,61,127,.45); transition: transform .18s ease, opacity .18s ease; }
        [data-v-chip].on { transform: translate(-50%, 0) scale(1); opacity: 1; }
        [data-v-card] { inset: 0; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 14px; padding: 28px; text-align: center; color: #fff;
          background: radial-gradient(80% 60% at 50% 40%, #1d1640, #050508 75%); }
        [data-v-card] .k { font: 800 12px/1 system-ui; letter-spacing: .3em; color: #ff9dbd; }
        [data-v-card] .h { font: 900 34px/1.08 system-ui; letter-spacing: -.02em; white-space: pre-line; animation: v-slam .45s cubic-bezier(.2,1.4,.4,1) both; }
        [data-v-card] .m { font: 200 44px/1 system-ui; letter-spacing: .06em; }
        @keyframes v-slam { from { transform: scale(1.6); opacity: 0; filter: blur(6px); } to { transform: none; opacity: 1; filter: none; } }
        [data-v-punch] { transition: transform .35s cubic-bezier(.2,.8,.2,1) !important; }`;
      document.head.appendChild(css);
      const fx = (attr, html) => { const e = document.createElement('div'); e.setAttribute('data-v-fx', ''); e.setAttribute(attr, ''); if (html != null) e.innerHTML = html; document.body.appendChild(e); return e; }; // void-review: ok: every caller passes esc()-escaped text
      const esc = (t) => String(t).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
      const cap = fx('data-v-cap', '<small>' + esc(title) + '</small><b>' + esc(caption) + '</b>');
      document.body.style.paddingBottom = (cap.offsetHeight + 40) + 'px'; // the caption never hides the end of the page
      const bar = fx('data-v-bar'); requestAnimationFrame(() => { bar.style.transitionDuration = total + 'ms'; bar.style.width = '100%'; });
      window.__vfx = {
        card(kicker, text, mark) { const c = fx('data-v-card', (kicker ? '<div class="k">' + esc(kicker) + '</div>' : '') + '<div class="h">' + esc(text) + '</div>' + (mark ? '<div class="m">V01D</div>' : '')); return c; },
        clear() { document.querySelectorAll('[data-v-card]').forEach((n) => n.remove()); },
        chip(text) { const c = fx('data-v-chip', esc(text)); requestAnimationFrame(() => c.classList.add('on')); setTimeout(() => { c.classList.remove('on'); setTimeout(() => c.remove(), 250); }, 1100); },
        punch(el) { // push in on what was pressed, then ease back: the camera follows the action
          // the origin as a share of the page, so the page zoom's units never matter (in px it swung the frame off-centre)
          const root = document.body, r = el.getBoundingClientRect(), b = root.getBoundingClientRect();
          const px = ((r.left + r.width / 2 - b.left) / b.width) * 100, py = ((r.top + r.height / 2 - b.top) / b.height) * 100;
          root.setAttribute('data-v-punch', ''); root.style.transformOrigin = px.toFixed(1) + '% ' + py.toFixed(1) + '%'; root.style.transform = 'scale(1.18)';
          setTimeout(() => { root.style.transform = ''; }, 700);
        },
      };
    }, { title: words.title, caption: words.caption, total: seconds * 1000 });
    const fx = (fn, ...args) => page.evaluate(({ fn, args }) => window.__vfx && window.__vfx[fn](...args), { fn, args });
    // the hook: the first second decides whether anyone stays
    await fx('card', 'an AI built this itself', words.hook, false);
    await page.waitForTimeout(1600);
    await fx('clear');
    const until = Date.now() + Math.max(4, seconds - 4) * 1000; // the demo, then the ending
    await page.waitForTimeout(300);
    // the page's own demo when it has one; then its buttons, one after another, as a person would try it: tight, no dead air
    await page.evaluate(() => { const h = Object.keys(window).filter((k) => /^__/.test(k) && k !== '__vfx').map((k) => window[k]).find((o) => o && typeof o.demo === 'function'); try { if (h) h.demo(); } catch (_) {} });
    const buttons = await page.$$('button:visible'), starts = [];
    for (const b of buttons) if (/\b(?:start|begin|play|go|run|try|demo|example|made-up|sample|new)\b/i.test(await b.innerText().catch(() => ''))) starts.push(b);
    for (const b of [...starts, ...buttons.filter((x) => !starts.includes(x))]) {
      if (Date.now() > until - 1200) break;
      const label = ((await b.innerText().catch(() => '')) || '').replace(/\s+/g, ' ').trim().slice(0, 28);
      await b.evaluate((el) => el.scrollIntoView({ block: 'center', behavior: 'instant' })).catch(() => {});
      if (label) await fx('chip', 'tap: ' + label);
      await b.click({ timeout: 1000 }).catch(() => {});
      await b.evaluate((el) => window.__vfx && window.__vfx.punch(el)).catch(() => {});
      await page.waitForTimeout(1100);
    }
    const left = until - Date.now(); if (left > 0) await page.waitForTimeout(left);
    // the ending: the call to action on the same card as the hook, so the last frame flows into the first and the Short loops
    await fx('card', 'try it free · a-to-mind.com', words.hook, true);
    await page.waitForTimeout(2600);
  } finally {
    await page.close(); // the video is written when its page closes
  }
  const raw = await page.video().path();
  await ctx.close(); await browser.close(); server.close();
  const video = path.join(out, id + '.webm');
  fs.renameSync(raw, video);
  const meta = path.join(out, id + '.json');
  fs.writeFileSync(meta, JSON.stringify({ id, ...words, video: path.basename(video), recorded: new Date().toISOString() }, null, 2) + '\n');
  return { video, meta };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const arg = (f) => { const i = process.argv.indexOf(f); return i > 0 ? process.argv[i + 1] : undefined; };
  const { toolList } = await import('../void-live-deploy/skills/make.js');
  const lab = toolList().filter((t) => /-\d+$/.test(t.id));
  const id = process.argv[2] && !process.argv[2].startsWith('--') ? process.argv[2] : lab[lab.length - 1].id;
  const { acquire } = await import('./heavy.mjs');
  const release = await acquire('recording ' + id + ' (tools/record.mjs)'); // one heavy browser job at a time on this machine
  try {
    const r = await record(id, { seconds: Number(arg('--seconds')) || 20, ...(arg('--out') ? { out: path.resolve(arg('--out')) } : {}) });
    console.log('recorded ' + path.relative(process.cwd(), r.video) + ' and ' + path.relative(process.cwd(), r.meta));
  } finally { release(); }
}
