#!/usr/bin/env node
// Verse records its own experiments (owner, 2026-10-14: "Verse should use my Youtube channel to make its own Videos"; step 1 of
// the broadcast loop is teaching Verse to record itself). One lab experiment (a page under void-live-deploy/fringe/) is opened in a
// real browser and filmed while it runs: the page's own demo() when it has one, otherwise its buttons pressed one after another.
// The narration is the run's own research notes from the fringe ledger (tools/fringe.json: behavior, hypothesis, findings),
// shown as a caption on the video (a headless browser has no speech voices) and written next to it as the title and
// description an upload will carry. Nothing is uploaded here: that is step 2, with the owner's YouTube credentials.
//   node tools/record.mjs [id] [--seconds 20] [--out media]   -> media/<id>.webm and media/<id>.json { title, description, tags, caption }
// id: a lab experiment such as attention-7 (default: the newest one not filmed yet, from VOID_FILMED, the film release tags).
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import { fileURLToPath } from 'node:url';
import { scoreOf, takeBeatMs, toBeat } from './film-sound.mjs'; // the film's score and its tempo: scene changes land on its beats

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

/** what the video says, as an ad for Verse (owner, 2026-10-14: "make each video into an awesomely epic ad for itself and reach as
 *  many viewers as possible"): { hook, caption, cta, title, description, tags } from the lab entry ({ id, label, sub }) and its
 *  ledger run. Everything in it is true of the experiment: what it is, what it found, what failed. Pure. */
// the name viewers see is Verse (owner, 2026-10-14: "it shoud say Verse everywhere"; "Verse FILMS"): the lab's and ledger's own words say Verse
export const brand = (t) => String(t || '').replace(/\b(?:Void|V01D|Verse)\b/g, 'Verse'); // both older names (owner, 2026-10-18: "rename void to verse")
// the code a film shows: its lab page in the repository (asked by Verse, 2026-10-15: "Create an automated link between a recorded
// experiment video and its corresponding skill file in the repository"). Pure.
export const REPO = 'https://github.com/atomeam/void-loop/blob/main/';
export const sourceOf = (id) => String(id).startsWith('ship-') ? REPO + 'void-live-deploy/void.growth.json' : REPO + 'void-live-deploy/fringe/' + String(id) + '.html';
// a film of something Verse shipped (owner, 2026-10-17: "i noticed v01d stopped making videos"; frontier #26 step 4): the lab ran out of
// experiments never filmed (all were by 2026-10-15, after which every deploy filmed nothing and the daily run repeated the same three).
// Each growth-ledger entry with a "show" and a "try" is a film: the ask opened on the live site. ship-<yyyymmddhhmm of the entry>. Pure.
export const shipId = (e) => 'ship-' + String(e.at).replace(/\D/g, '').slice(0, 12);
export function shipsOf(growth, n = 50) {
  const a = Array.isArray(growth) ? growth : (growth && growth.entries) || [];
  return a.filter((e) => e && e.at && e.show && e.try && String(e.try).length < 120).slice(-n).reverse().map((e) => ({ id: shipId(e), label: String(e.show), sub: '', ask: String(e.try) }));
}
// the payoff a viewer can check (2026-10-15): before the ending, one card with the run's own first finding from the fringe ledger,
// shortened to what fits on the card (the first sentence when it fits, else cut at a word with "…"); none when the ledger has none.
// Never a word or a number the ledger does not hold. Pure.
export const FINDING_MAX = 90, FINDING_MS = 2400;
// never cut (owner, 2026-10-22: "the shorts cut off words"): a long finding is split at word boundaries into pages of at most
// FINDING_MAX characters, each shown in turn, never ended with "…". findingOf keeps the whole text; findingPages splits it. Pure.
export function findingOf(run) {
  return run && Array.isArray(run.findings) && run.findings.length ? String(run.findings[0] || '').replace(/\s+/g, ' ').trim() : '';
}
export function findingPages(text, max = FINDING_MAX) {
  const pages = []; let cur = '';
  for (const w of String(text || '').split(' ').filter(Boolean)) {
    if (cur && (cur + ' ' + w).length > max) { pages.push(cur); cur = w; } else cur = cur ? cur + ' ' + w : w;
  }
  if (cur) pages.push(cur);
  return pages;
}
export function script(tool0, run0) {
  const tool = { ...tool0, label: brand(tool0.label), sub: brand(tool0.sub) };
  const run = run0 && { ...run0, behavior: brand(run0.behavior), hypothesis: brand(run0.hypothesis), findings: Array.isArray(run0.findings) ? run0.findings.map(brand) : run0.findings, failure_modes: Array.isArray(run0.failure_modes) ? run0.failure_modes.map((f) => (f && f.what ? { ...f, what: brand(f.what) } : brand(f))) : run0.failure_modes };
  const label = String(tool.label || tool.id), sub = String(tool.sub || '').trim();
  const behavior = run && run.behavior ? String(run.behavior).trim() : sub;
  const lines = (xs) => (Array.isArray(xs) ? xs : []).map((x) => '- ' + String(x).trim()).join('\n');
  const hook = hookOf(tool, run), link = 'https://a-to-mind.com/?q=' + encodeURIComponent(String(tool0.ask || tool0.label || tool0.id).toLowerCase()); // the ask as the lab names it, so it still routes
  const tail = ' | an AI built this itself #Shorts';
  const title = (hook.length + tail.length <= TITLE_MAX ? hook + tail : label + tail).slice(0, TITLE_MAX);
  const parts = [
    hook + ' Try it free: ' + link, // the first lines are what a viewer sees before "more": the hook and the link
    'Verse, an AI at https://a-to-mind.com, built this experiment by itself, tested it, and filmed it in a real browser. Nothing was edited by hand.',
    'How it is built: ' + sourceOf(tool0.id), // the film and the code it shows, linked (asked by Verse, 2026-10-15)
    behavior !== hook ? behavior : '',
    run && run.hypothesis ? 'What it set out to show: ' + String(run.hypothesis).trim() : '',
    run && Array.isArray(run.findings) && run.findings.length ? 'What it found:\n' + lines(run.findings) : '',
    run && Array.isArray(run.failure_modes) && run.failure_modes.length ? 'What failed:\n' + lines(run.failure_modes.map((f) => (f && f.what) || f)) : '',
    'Ask Verse for anything: https://a-to-mind.com',
    'VERSE FILMS: a new one every day.',
    'Watch them all: https://www.youtube.com/@atombomb983',
    '#Shorts #AI #Verse',
  ].filter(Boolean);
  return { source: sourceOf(tool0.id), hook, finding: findingOf(run), caption: behavior || label, cta: 'Built by an AI, by itself.\nTry it free at\na\u2011to\u2011mind.com', title, description: parts.join('\n\n').slice(0, DESC_MAX),
    tags: ['Verse', 'VERSE FILMS', 'Verse', 'A-to-Mind', 'AI', 'AI experiment', 'interactive', 'Shorts', run ? run.family : 'lab'].filter(Boolean) };
}

/** which lab experiment each film was, from the film release tags (film-<yyyymmdd>-<id>-r<run>), oldest first: [{ id, day }] */
export function filmedOf(tags) {
  return (Array.isArray(tags) ? tags : String(tags || '').split(/[\s,]+/)).map((t) => String(t).match(/^film-(\d{8})-(.+)-r\d+$/))
    .filter(Boolean).map((m) => ({ id: m[2], day: m[1] })).sort((a, b) => a.day.localeCompare(b.day));
}
/** the experiment to film next (owner, 2026-10-15: "these 3 are the same vid and nothing special"): the newest one in the lab not
 *  filmed yet; when every one has been, the one filmed longest ago. Never the same film twice while another is waiting. Pure. */
export function pickFilm(labIds, filmed) {
  const last = new Map(); for (const f of filmed || []) last.set(f.id, f.day); // filmed is oldest first, so this keeps each id's latest day
  const fresh = labIds.filter((id) => !last.has(id));
  if (fresh.length) return fresh[fresh.length - 1];
  return labIds.slice().sort((a, b) => last.get(a).localeCompare(last.get(b)) || labIds.indexOf(b) - labIds.indexOf(a))[0];
}

/** n films in one run, each a different experiment: pickFilm again with each pick counted as filmed today. Pure. */
export function picksOf(labIds, filmed, n) {
  const out = [], seen = [...(filmed || [])];
  for (let i = 0; i < Math.min(Math.max(1, n | 0), labIds.length); i++) { const id = pickFilm(labIds, seen); out.push(id); seen.push({ id, day: '99999999' }); }
  return out;
}

/** what to film: lab experiments never filmed (newest last in labIds), then the newest shipped changes never filmed; only when
 *  there is nothing new and this is not a deploy's run, the lab experiment filmed longest ago. Pure. */
export function unfilmed(labIds, shipIds, done, n, onlyNew, filmed) {
  const fresh = [...labIds.filter((id) => !done.has(id)).reverse(), ...shipIds.filter((id) => !done.has(id))].slice(0, Math.max(1, n | 0));
  return fresh.length || onlyNew ? fresh : picksOf(labIds, filmed, n);
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
  const ship = String(id).startsWith('ship-');
  const tool = ship ? shipsOf(JSON.parse(fs.readFileSync(path.join(site, 'void.growth.json'), 'utf8')), 400).find((t) => t.id === id) : toolList().find((t) => t.id === id);
  if (ship && !tool) throw new Error(id + ' is not in the growth ledger with a show and a try');
  if (!tool) throw new Error(id + ' is not a lab experiment (skills/make.js)');
  if (!ship && !fs.existsSync(path.join(site, 'fringe', id + '.html'))) throw new Error('no page at void-live-deploy/fringe/' + id + '.html');
  const ledger = ship ? [] : JSON.parse(fs.readFileSync(path.join(here, 'fringe.json'), 'utf8'));
  const words = script(tool, runOf(ledger, id));
  fs.mkdirSync(out, { recursive: true });
  const exe = [process.env.VOID_TEST_BROWSER, '/opt/pw-browsers/chromium'].find((p) => p && fs.existsSync(p));
  const { server, base } = serve();
  const browser = await chromium.launch({ headless: true, ...(exe ? { executablePath: exe } : {}) });
  // a vertical Short (9:16, where new viewers find a channel), filmed sharp: the page laid out as on a 540 px phone and drawn at
  // about twice that, 1080 x 1920 (CSS zoom 2.3), so every pixel of the film is real. Playwright never scales a film up (asked for
  // 1080 x 1920 at a 540 viewport it put the page in the top-left quarter of a grey frame, every film before 2026-10-14).
  const ctx = await browser.newContext({ viewport: { width: 1080, height: 1920 }, recordVideo: { dir: out, size: { width: 1080, height: 1920 } } });
  // beat-locked cuts: the film's own score (tools/film-sound.mjs, picked by the film's id) has a tempo, and the take's clock starts when the page is made (that is when the
  // video starts); every change of scene waits for the next beat of the score, in the take's time (the cut is 15% faster)
  let tookMs = 0, syncAt = 0; const score = scoreOf(id), beat = takeBeatMs(score), tick = [], t0 = Date.now();
  const page = await ctx.newPage(), cutsSeen = [];
  const onBeat = async (minMs, every = 1) => { await page.waitForTimeout(toBeat(Date.now() - t0, beat, minMs, every)); tick.push(Date.now() - t0); }; // tick: when each scene change was let go, for the trace
  try {
    await page.goto(ship ? 'https://a-to-mind.com/?q=' + encodeURIComponent(tool.ask) : base + 'fringe/' + id + '.html', { waitUntil: 'load' });
    // the edit (owner, 2026-10-14: "teach Verse how to edit and make epic videos that are very entertaining"): a hook that slams in,
    // a progress bar, a punch-in on every action with a kinetic caption, and an ending that matches the first frame so it loops.
    await page.evaluate(({ title, caption, total }) => {
      document.documentElement.style.zoom = '2.3'; // the page laid out about 470 px wide, as on a phone, and big enough to read
      const css = document.createElement('style');
      css.textContent = `
        [data-v-fx] { position: fixed; z-index: 2147483647; pointer-events: none; font-family: system-ui, -apple-system, sans-serif; }
        [data-v-bar] { top: 0; left: 0; height: 5px; width: 0; background: linear-gradient(90deg, #ff3d7f, #7a5cff); box-shadow: 0 0 12px #ff3d7f; transition: width linear; }
        [data-v-cap] { left: 0; right: 0; bottom: 0; padding: 14px 20px 18px; background: linear-gradient(transparent, rgba(5,5,12,.92) 30%); color: #fff; }
        [data-v-cap] small { display: block; font: 700 11px/1 system-ui; letter-spacing: .2em; text-transform: uppercase; color: #ff9dbd; margin-bottom: 6px; }
        [data-v-cap] b { display: block; font: 800 21px/1.25 system-ui; overflow-wrap: anywhere; }
        [data-v-cap] small { overflow-wrap: anywhere; line-height: 1.3; }
        [data-v-chip] { top: 14px; left: 50%; transform: translate(-50%, -12px) scale(.9); opacity: 0; padding: 8px 14px; border-radius: 999px; color: #fff;
          font: 800 15px/1.2 system-ui; max-width: calc(100vw / 2.3 - 28px); width: max-content; text-align: center; overflow-wrap: anywhere; background: linear-gradient(90deg, #ff3d7f, #7a5cff); box-shadow: 0 8px 22px rgba(255,61,127,.45); transition: transform .18s ease, opacity .18s ease; }
        [data-v-chip].on { transform: translate(-50%, 0) scale(1); opacity: 1; }
        [data-v-card] { inset: 0; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 14px; padding: 28px; text-align: center; color: #fff;
          background: radial-gradient(80% 60% at 50% 40%, #1d1640, #050508 75%); }
        [data-v-card] .k { font: 800 12px/1 system-ui; letter-spacing: .3em; color: #ff9dbd; }
        [data-v-card] .h { font: 900 34px/1.08 system-ui; letter-spacing: -.02em; white-space: pre-line; overflow-wrap: anywhere; max-width: 100%; animation: v-slam .45s cubic-bezier(.2,1.4,.4,1) both; }
        [data-v-card] .m { font: 200 44px/1 system-ui; letter-spacing: .06em; }
        @keyframes v-slam { from { transform: scale(1.6); opacity: 0; filter: blur(6px); } to { transform: none; opacity: 1; filter: none; } }
        [data-v-punch] { transition: transform .35s cubic-bezier(.2,.8,.2,1) !important; }`;
      document.head.appendChild(css);
      const fx = (attr, html) => { const e = document.createElement('div'); e.setAttribute('data-v-fx', ''); e.setAttribute(attr, ''); if (html != null) e.innerHTML = html; document.documentElement.appendChild(e); return e; }; // void-review: ok: every caller passes esc()-escaped text
      const esc = (t) => String(t).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
      const cap = fx('data-v-cap', '<small>' + esc(title) + '</small><b>' + esc(caption) + '</b>');
      document.body.style.paddingBottom = (cap.offsetHeight + 40) + 'px'; // the caption never hides the end of the page
      const bar = fx('data-v-bar'); requestAnimationFrame(() => { bar.style.transitionDuration = total + 'ms'; bar.style.width = '100%'; });
      window.__vfx = {
        card(kicker, text, mark) { const c = fx('data-v-card', (kicker ? '<div class="k">' + esc(kicker) + '</div>' : '') + '<div class="h">' + esc(text) + '</div>' + (mark ? '<div class="m">Verse</div>' : ''));
          const h = c.querySelector('.h'); for (let px = 34; px > 16 && (c.scrollHeight > c.clientHeight || h.scrollWidth > h.clientWidth); px -= 2) h.style.fontSize = px + 'px'; return c; }, // shrink to fit, never clip
        cuts() { // the text-bounds check: every overlay word inside the frame and its box (no clipped line, no hidden overflow)
          const W = innerWidth, H = innerHeight, bad = [];
          for (const e of document.querySelectorAll('[data-v-fx], [data-v-fx] *')) { const t = (e.innerText || '').trim(); if (!t || e.closest('[data-v-bar]')) continue;
            const r = e.getBoundingClientRect(); if (!r.width) continue;
            if (e.scrollWidth > e.clientWidth + 1 || r.left < -1 || r.right > W + 1 || r.top < -1 || r.bottom > H + 1 || /\u2026|\.\.\.$/.test(t)) bad.push(t.slice(0, 60)); }
          return bad; },
        clear() { document.querySelectorAll('[data-v-card]').forEach((n) => n.remove()); },
        sync() { const e = fx('data-v-sync'); e.style.cssText = 'inset:0;background:#ff00ff'; setTimeout(() => e.remove(), 90); }, // the film's sync mark: one pure magenta frame pair, so the score can be lined up with the video's own clock (tools/film-sound.mjs findSync)
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
    await onBeat(300); syncAt = Date.now() - t0; await fx('sync'); await page.waitForTimeout(110); // the sync mark, on a beat
    await fx('card', 'an AI built this itself', words.hook, false);
    await onBeat(1400, 2); cutsSeen.push(...(await fx('cuts')) || []);
    await fx('clear');
    // the demo, then the finding (when the ledger has one, its seconds taken from the demo so the film stays as long), then the ending
    const until = Date.now() + Math.max(4, seconds - 4 - (words.finding ? FINDING_MS / 1000 : 0)) * 1000;
    await page.waitForTimeout(300);
    // the page's own demo when it has one; then its buttons, one after another, as a person would try it: tight, no dead air
    await page.evaluate(() => { const h = Object.keys(window).filter((k) => /^__/.test(k) && k !== '__vfx').map((k) => window[k]).find((o) => o && typeof o.demo === 'function'); try { if (h) h.demo(); } catch (_) {} });
    const buttons = ship ? [] : await page.$$('button:visible'), starts = []; // a shipped ask is filmed answering itself, nothing to press
    for (const b of buttons) if (/\b(?:start|begin|play|go|run|try|demo|example|made-up|sample|new)\b/i.test(await b.innerText().catch(() => ''))) starts.push(b);
    for (const b of [...starts, ...buttons.filter((x) => !starts.includes(x))]) {
      if (Date.now() > until - 1200) break;
      const label = ((await b.innerText().catch(() => '')) || '').replace(/\s+/g, ' ').trim(); // the whole label, wrapped, never cut
      await b.evaluate((el) => el.scrollIntoView({ block: 'center', behavior: 'instant' })).catch(() => {});
      if (label) await fx('chip', 'tap: ' + label);
      await b.click({ timeout: 1000 }).catch(() => {});
      await b.evaluate((el) => window.__vfx && window.__vfx.punch(el)).catch(() => {});
      await onBeat(1000);
    }
    const left = until - Date.now(); if (left > 0) await page.waitForTimeout(left);
    if (words.finding) { // the payoff a viewer can check: what this run found, in the ledger's own words, a page at a time
      const pages = findingPages(words.finding);
      for (const [i, p] of pages.entries()) {
        await fx('card', 'what it found' + (pages.length > 1 ? ' ' + (i + 1) + '/' + pages.length : ''), p, false);
        await onBeat(Math.max(1400, FINDING_MS / pages.length) | 0, 2); cutsSeen.push(...(await fx('cuts')) || []);
        await fx('clear');
      }
    }
    // the ending: the call to action on the same card as the hook, so the last frame flows into the first and the Short loops
    await fx('card', 'try it free · a-to-mind.com', words.hook, true);
    await onBeat(500); cutsSeen.push(...(await fx('cuts')) || []);
    await onBeat(1800, 2);
    if (cutsSeen.length && process.env.VOID_FILM_CUTS !== 'warn') throw new Error('film text cut off: ' + [...new Set(cutsSeen)].join(' | '));
  } finally {
    tookMs = Date.now() - t0; // by the take's own clock; the video is a little shorter (its first frame comes after the page is made): the difference skews the score (tools/film-sound.mjs skewSeconds)
    await page.close(); // the video is written when its page closes
  }
  const raw = await page.video().path();
  await ctx.close(); await browser.close(); server.close();
  const video = path.join(out, id + '.webm');
  fs.renameSync(raw, video);
  const meta = path.join(out, id + '.json');
  fs.writeFileSync(meta, JSON.stringify({ id, ...words, video: path.basename(video), bpm: score.bpm, beatMs: beat, beatLocked: true, syncAt, tookMs, ...(process.env.VOID_FILM_TRACE ? { trace: tick.map((t) => ({ at: t, offBeat: Math.min(t % beat, beat - (t % beat)) | 0 })) } : {}), recorded: new Date().toISOString() }, null, 2) + '\n');
  return { video, meta };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const arg = (f) => { const i = process.argv.indexOf(f); return i > 0 ? process.argv[i + 1] : undefined; };
  const { toolList } = await import('../void-live-deploy/skills/make.js');
  const lab = toolList().filter((t) => /-\d+$/.test(t.id));
  const ships = shipsOf(JSON.parse(fs.readFileSync(path.join(site, 'void.growth.json'), 'utf8'))).map((t) => t.id);
  // the films already made, as their release tags (record.yml passes them in VOID_FILMED), so a new film is a new experiment
  // --count N: N films in one run, each a different experiment (owner, 2026-10-15: "Verse can make as many videos as it wants and
  // is encouraged to use it as its voice to the world")
  // --only-new (after a deploy): only experiments never filmed, possibly none
  const filmed = filmedOf(process.env.VOID_FILMED || ''), done = new Set(filmed.map((f) => f.id));
  const ids = process.argv[2] && !process.argv[2].startsWith('--') ? [process.argv[2]]
    : unfilmed(lab.map((t) => t.id), ships, done, Number(arg('--count')) || 1, process.argv.includes('--only-new'), filmed);
  if (!ids.length) console.log('nothing new to film: every lab experiment and shipped change has a film already');
  const { acquire } = await import('./heavy.mjs');
  for (const id of ids) {
    const release = await acquire('recording ' + id + ' (tools/record.mjs)'); // one heavy browser job at a time on this machine
    try {
      const r = await record(id, { seconds: Number(arg('--seconds')) || 20, ...(arg('--out') ? { out: path.resolve(arg('--out')) } : {}) });
      console.log('recorded ' + path.relative(process.cwd(), r.video) + ' and ' + path.relative(process.cwd(), r.meta));
    } finally { release(); }
  }
}
