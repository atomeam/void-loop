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
  // a vertical Short (9:16, where new viewers find a channel): the page laid out as on a phone and filmed at the page's own size,
  // 540 x 960. Playwright never scales a film up: asked for 1080 x 1920 it put the page in the top-left quarter of a grey frame
  // (every film before 2026-10-14). record.yml scales the film to 1080 x 1920 when it makes the MP4.
  const ctx = await browser.newContext({ viewport: { width: 540, height: 960 }, recordVideo: { dir: out, size: { width: 540, height: 960 } } });
  const page = await ctx.newPage();
  try {
    await page.goto(base + 'fringe/' + id + '.html', { waitUntil: 'load' });
    // the caption: what Void says it built, in its own ledger's words, over the bottom of the frame
    await page.evaluate(({ title, caption }) => {
      const c = document.createElement('div');
      c.setAttribute('data-void-caption', '');
      c.style.cssText = 'position:fixed;left:0;right:0;bottom:0;z-index:2147483647;padding:14px 22px;background:rgba(10,10,14,.82);color:#f4f4f6;font:600 20px/1.35 system-ui,sans-serif;pointer-events:none';
      const t = document.createElement('div'); t.textContent = title; t.style.cssText = 'font-size:14px;opacity:.7;margin-bottom:4px';
      const b = document.createElement('div'); b.textContent = caption;
      c.append(t, b); document.body.appendChild(c);
      document.body.style.paddingBottom = (c.offsetHeight + 40) + 'px'; // the caption never hides the end of the page
    }, { title: words.title, caption: words.caption });
    // the hook (the first two seconds decide whether anyone stays) and, at the end, the call to action: full-screen cards
    const card = (text, ms) => page.evaluate(({ text }) => {
      const c = document.createElement('div'); c.setAttribute('data-void-card', '');
      c.style.cssText = 'position:fixed;inset:0;z-index:2147483647;display:flex;align-items:center;justify-content:center;padding:36px;box-sizing:border-box;text-align:center;white-space:pre-line;background:radial-gradient(circle at 50% 40%,#2a1f55,#07070b 70%);color:#fff;font:800 38px/1.2 system-ui,sans-serif;letter-spacing:-.5px';
      c.textContent = text; document.body.appendChild(c);
    }, { text }).then(() => page.waitForTimeout(ms)).then(() => page.evaluate(() => document.querySelectorAll('[data-void-card]').forEach((n) => n.remove())));
    await card(words.hook, 2200);
    const until = Date.now() + Math.max(4, seconds - 5) * 1000; // the demo, then three seconds for the call to action
    await page.waitForTimeout(800);
    // the page's own demo when it has one; then its buttons, one after another, as a person would try it
    await page.evaluate(() => { const h = Object.keys(window).filter((k) => /^__/.test(k)).map((k) => window[k]).find((o) => o && typeof o.demo === 'function'); try { if (h) h.demo(); } catch (_) {} });
    // the button that starts things first (start, play, an example), so the film shows it running, then the rest in page order
    const buttons = await page.$$('button:visible'), starts = [];
    for (const b of buttons) if (/\b(?:start|begin|play|go|run|try|demo|example|made-up|sample|new)\b/i.test(await b.innerText().catch(() => ''))) starts.push(b);
    for (const b of [...starts, ...buttons.filter((x) => !starts.includes(x))]) {
      if (Date.now() > until - 1500) break;
      await b.click({ timeout: 1000 }).catch(() => {});
      await page.waitForTimeout(500);
      await b.evaluate((el) => el.scrollIntoView({ block: 'start', behavior: 'smooth' })).catch(() => {}); // what the press did, below it, in frame
      await page.waitForTimeout(1000);
    }
    const left = until - Date.now(); if (left > 0) await page.waitForTimeout(left);
    await page.evaluate(() => document.querySelectorAll('[data-void-card]').forEach((n) => n.remove()));
    await page.evaluate(({ cta }) => { const c = document.createElement('div'); c.setAttribute('data-void-card', ''); c.style.cssText = 'position:fixed;inset:0;z-index:2147483647;display:flex;align-items:center;justify-content:center;padding:36px;box-sizing:border-box;text-align:center;white-space:pre-line;background:radial-gradient(circle at 50% 40%,#2a1f55,#07070b 70%);color:#fff;font:800 36px/1.25 system-ui,sans-serif'; c.textContent = cta; document.body.appendChild(c); }, { cta: words.cta });
    await page.waitForTimeout(3000);
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
