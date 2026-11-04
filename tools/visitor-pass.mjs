// A visitor pass: the everyday asks a person types, on the live site, the way they meet it.
//   node tools/visitor-pass.mjs                  the short list (what the clock reruns after a deploy)
//   node tools/visitor-pass.mjs --full           all fifty, desktop, phone, and a slow 3G phone
//   node tools/visitor-pass.mjs --full --only desktop
// Writes one JSON report (--out, default tools/visitor-pass.json is not written unless --write).
// It only reads the site. Posts to Verse's own /api are answered here with an empty 204, so a pass
// never lands in the miss board, the answer log or a view count. Outside GETs (the weather, the
// dictionary, a price) go through, because that is how the card gets its answer.
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
export const SITE = process.env.VOID_SITE || 'https://a-to-mind.com';

// The fifty. skill is who should answer (a loop-log note). good is what a right answer contains.
// A card that names the ask but not the thing asked is a miss (owner, 2026-10-23).
export const ASKS = [
  { ask: "what's the weather in Lakeland FL", skill: /weather/, good: /lakeland|°|degrees|temp/i },
  { ask: 'what time is it', skill: /clock|time|worldtime/, good: /\d{1,2}:\d{2}|o'clock|now/i },
  { ask: 'what time is it in Tokyo', skill: /worldtime|clock|time/, good: /tokyo|\d{1,2}:\d{2}/i },
  { ask: 'define serendipity', skill: /define/, good: /serendipit|happy accident|pleasant surprise|finding/i },
  { ask: 'what does ephemeral mean', skill: /define/, good: /ephemeral|lasting|short|fleeting|transitory/i },
  { ask: 'convert 5 miles to kilometers', skill: /calc|convert/, good: /8\.0|8 km|8\.05/ },
  { ask: '350 fahrenheit to celsius', skill: /calc|convert/, good: /176|177/ },
  { ask: 'convert 100 usd to eur', skill: /currency|calc|markets/, good: /€|eur|euro/i },
  { ask: 'what is 15% of 80', skill: /calc|tip/, good: /\b12\b/ },
  { ask: 'what is 2 + 2', skill: /calc/, good: /\b4\b/ },
  { ask: '20% tip on $45', skill: /tip|calc/, good: /\b9\b/ },
  { ask: 'recipe for scrambled eggs', skill: /recipe/, good: /egg/i },
  { ask: 'how do I make pasta', skill: /recipe/, good: /pasta|noodle|boil/i },
  { ask: 'news', skill: /news/, good: /news|headline|today/i },
  { ask: 'play music', skill: /local-stations|radio/, good: /radio|station|stream/i },
  { ask: 'tell me a joke', skill: /joke/, good: /joke|\?|!/ },
  { ask: 'tell me a riddle', skill: /joke|riddle/, good: /riddle|what|answer/i },
  { ask: 'directions from Lakeland FL to Tampa', skill: /distance|place|maps/, good: /tampa|lakeland|mile|km|route|map/i },
  { ask: 'sports scores', skill: /scores|sport/, good: /\d|no games|nfl|nba|mlb|live|final/i },
  { ask: 'bitcoin price', skill: /crypto|markets/, good: /\$|bitcoin|btc/i },
  { ask: 'translate hello to spanish', skill: /translate/, good: /hola/i },
  { ask: 'what can you do', skill: /self|menu|guide|voice/, good: /ask|clock|weather|anything|verse/i },
  { ask: 'who is the president of the United States', skill: /answer|article|self/, good: /president|united states/i },
  { ask: 'capital of France', skill: /country|answer|article|calc/, good: /paris/i },
  { ask: 'how many ounces in a cup', skill: /calc|convert/, good: /\b8\b/ },
  { ask: 'set a timer for 5 minutes', skill: /timer|time/, good: /5:00|5 min|timer/i },
  { ask: "what's the date today", skill: /today|clock|dates|time|calc/, good: /monday|tuesday|wednesday|thursday|friday|saturday|sunday|\d{4}/i },
  { ask: 'sunrise in Lakeland', skill: /weather|suntimes|time|clock/, good: /sunrise|sun|am|pm|:/i },
  { ask: 'flip a coin', skill: /coin/, good: /heads|tails|coin/i },
  { ask: 'roll a die', skill: /chance|random|dice/, good: /\b[1-6]\b|die|dice/i },
  { ask: 'random number between 1 and 10', skill: /chance|random/, good: /from 1 to 10|\b(?:[1-9]|10)\b/ },
  { ask: 'how tall is Mount Everest', skill: /answer|article/, good: /8,?84|29,?03|everest|metre|feet/i },
  { ask: 'population of Florida', skill: /country|answer|article/, good: /florida|million|\d/i },
  { ask: 'days until Christmas', skill: /dates|calc|calendar/, good: /\d|christmas|dec/i },
  { ask: 'what day is it', skill: /today|clock|dates|time/, good: /monday|tuesday|wednesday|thursday|friday|saturday|sunday/i },
  { ask: 'synonym for happy', skill: /words|define/, good: /glad|joyful|cheerful|happy|synonym/i },
  { ask: 'how do you spell recommendation', skill: /words|define|calc/, good: /recommendation/i },
  { ask: 'calories in a banana', skill: /nutrition|food/, good: /calor|banana|\d/i },
  { ask: 'how to boil an egg', skill: /calc|recipe/, good: /egg|boil|min/i },
  { ask: 'ethereum price', skill: /crypto|markets/, good: /\$|ethereum|ether/i },
  { ask: 'weather tomorrow in Lakeland Florida', skill: /weather/, good: /lakeland|tomorrow|°|rain|sun|cloud/i },
  { ask: 'map of Lakeland Florida', skill: /place/, good: /lakeland|map/i },
  { ask: 'hello in french', skill: /translate/, good: /bonjour/i },
  { ask: 'what is pi', skill: /calc|answer|article/, good: /3\.14/ },
  { ask: '12 inches in cm', skill: /calc|convert/, good: /30\.48|30\.5/ },
  { ask: 'apple stock price', skill: /stocks|markets/, good: /\$|apple|aapl/i },
  { ask: 'nfl scores', skill: /scores|sport/, good: /nfl|score|football/i },
  { ask: 'tell me a fun fact', skill: /answer|article|joke|fact/, good: /\w{4,}/ },
  { ask: '72 fahrenheit in celsius', skill: /calc|convert/, good: /22/ },
  { ask: 'help', skill: /self|menu|guide/, good: /ask|clock|help|anything|verse/i },
];

// The ones a person asks every day, rerun after a deploy. Short on purpose: the clock's job is 12 minutes
// and this shares it. Each one is a skill that answers without a model.
export const TOP = ['what\'s the weather in Lakeland FL', 'what time is it', 'define serendipity', 'convert 5 miles to kilometers', 'convert 100 usd to eur', 'what is 15% of 80', 'recipe for scrambled eggs', 'news', 'tell me a joke', 'directions from Lakeland FL to Tampa', 'bitcoin price', 'translate hello to spanish', 'what can you do', 'capital of France', 'flip a coin'];

export const REFUSAL = /\b(i cannot|i can't|i can not|don't know this yet|do not know this yet|couldn'?t find|isn'?t connected|something went wrong|didn'?t answer|unable to|missing: a source)\b/i;
const CHROME = /COPY CARD|SAVE CARD|SHARE ☆|COPY TEXT|SAVE TEXT|Reply to what I said|Kept on this device|Open the full|ANSWER —|SKILL —|EXAMINE|FROM VERSE|FROM \d+ SOURCES|NUMBERS AND MONEY|WORDS AND THE WORLD|SKY AND EARTH|PROVEN/gi;
/** the card's own words, with the frame (copy, save, share) taken off. Pure. */
export function bodyOf(text) {
  return String(text || '').replace(CHROME, ' ').replace(/\s+/g, ' ').trim();
}
const USEFUL = (t) => {
  const s = bodyOf(t);
  if (s.length < 8) return false;
  if (/^(…|\.\.\.|thinking…?|waking up|opening the book…?|looking…?)$/i.test(s)) return false;
  if (/[…]\s*$/.test(s) && s.length < 80) return false;
  return true;
};

/** One ask's verdict. Pure. row: { note, text, ms, layout }. A right answer counts even when a different skill wrote it. */
export function judgeAsk(spec, row) {
  const why = [];
  const text = bodyOf(row.text);
  const note = String(row.note || '');
  const refused = REFUSAL.test(text);
  if (refused) why.push('refused');
  if (!USEFUL(row.text) && !note) why.push('nothing useful');
  else if (!refused && spec.good && USEFUL(row.text) && !spec.good.test(text)) why.push('answer misses ' + spec.good);
  if (spec.skill && note && !spec.skill.test(note) && spec.good && !spec.good.test(text)) why.push('skill ' + note);
  if (row.layout) why.push('layout: ' + row.layout);
  if (row.ms > (row.slow ? 20000 : 8000) && why.length === 0) why.push('slow ' + row.ms + ' ms');
  return { ask: spec.ask, ok: why.length === 0, why, skill: note, ms: row.ms || 0 };
}

/** Median of a list of numbers. Pure. */
export function median(ns) {
  const s = (ns || []).filter((n) => Number.isFinite(n)).sort((a, b) => a - b);
  return s.length ? s[Math.floor(s.length / 2)] : null;
}

/** The queue jobs a pass files: one visible fix per failed ask, the visitor's own wording, never a second copy of one already open. Pure. */
export function wantsOf(results, openTargets = []) {
  const open = new Set(openTargets.map((t) => String(t)));
  const out = [];
  for (const r of results || []) {
    if (!r || r.ok) continue;
    const target = ('visit:' + String(r.ask || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 32));
    if (open.has(target) || out.some((j) => j.target === target)) continue;
    out.push({ target, ask: ('A visitor ask failed (' + (r.why || []).join('; ') + '): ' + r.ask).slice(0, 200), priority: 'visible' });
  }
  return out;
}

/** Counts for the report. Pure. */
export function tally(results) {
  const rows = results || [];
  const refused = rows.filter((r) => (r.why || []).some((w) => w === 'refused')).length;
  const correct = rows.filter((r) => r.ok).length;
  return { asks: rows.length, correct, refused, medianMs: median(rows.map((r) => r.ms)) };
}

const PROFILES = {
  desktop: { width: 1280, height: 800 },
  phone: { width: 390, height: 844, mobile: true },
  slow: { width: 390, height: 844, mobile: true, slow: true },
};

async function launch() {
  const { chromium } = await import('playwright-core');
  const { existsSync } = await import('node:fs');
  const exe = process.env.CHROME_PATH || ['/usr/bin/google-chrome', '/usr/local/bin/google-chrome', '/opt/pw-browsers/chromium'].find((p) => existsSync(p));
  return chromium.launch({ executablePath: exe, headless: true, args: ['--enable-unsafe-swiftshader', '--use-angle=swiftshader'] });
}

function readLoop(page, ask) {
  return page.evaluate((q) => {
    let log = []; try { log = JSON.parse(localStorage.getItem('a2m.void.loop.v1') || '[]'); } catch (_) {}
    const hit = [...log].reverse().find((e) => e && String(e.ask || '').trim().toLowerCase() === q.trim().toLowerCase());
    const pages = [...document.querySelectorAll('.vpage')];
    const pageEl = pages[pages.length - 1] || null;
    const card = pageEl ? (pageEl.innerText || '') : '';
    const things = [...document.querySelectorAll('#stage .thing')].map((e) => e.innerText || '').join('\n');
    const whisper = (document.querySelector('#whisper') || {}).textContent || '';
    const book = document.querySelector('.vtome, .tome') ? (document.body.innerText || '').slice(0, 500) : '';
    const text = [card, things, whisper, book].filter(Boolean).join('\n').replace(/\s+\n/g, '\n').slice(0, 1500);
    const de = document.documentElement;
    const input = document.querySelector('#input');
    const ir = input ? input.getBoundingClientRect() : null;
    let layout = '';
    if (de.scrollWidth > de.clientWidth + 8) layout = 'page scrolls sideways';
    else if (ir && (ir.width < 80 || ir.bottom > innerHeight + 4 || ir.top < -4)) layout = 'ask bar off the screen';
    else if (pageEl) { const r = pageEl.getBoundingClientRect(); if (r.width > 40 && (r.right > innerWidth + 12 || r.left < -12)) layout = 'card wider than the screen'; }
    return { note: hit ? String(hit.note || '') : '', text, layout };
  }, ask);
}

async function homeOf(page, axe) {
  const facts = await page.evaluate(() => {
    const input = document.querySelector('#input');
    const text = (document.body.innerText || '').replace(/\s+/g, ' ').trim().slice(0, 400);
    const broken = [];
    return {
      placeholder: input ? input.placeholder : '',
      label: input ? (input.getAttribute('aria-label') || '') : '',
      focused: document.activeElement === input,
      text,
      stageEmpty: !document.querySelector('#stage .thing, .vpage.on'),
      title: document.title,
    };
  });
  const errors = [];
  const cls = await page.evaluate(() => new Promise((ok) => {
    let n = 0; try {
      const o = new PerformanceObserver((l) => { for (const e of l.getEntries()) if (!e.hadRecentInput) n += e.value; });
      o.observe({ type: 'layout-shift', buffered: true });
      setTimeout(() => { try { o.disconnect(); } catch (_) {} ok(Math.round(n * 1000) / 1000); }, 600);
    } catch (_) { ok(null); }
  }));
  let axeHits = null;
  if (axe) {
    await page.addScriptTag({ content: axe }).catch(() => {});
    axeHits = await page.evaluate(async () => {
      if (!window.axe) return null;
      try {
        const r = await window.axe.run(document, { runOnly: ['wcag2a', 'wcag2aa'], resultTypes: ['violations'] });
        return r.violations.filter((v) => /serious|critical/.test(v.impact)).map((v) => v.id + ' ×' + v.nodes.length);
      } catch (_) { return null; }
    });
  }
  return { ...facts, cls, axe: axeHits, errors };
}

export async function pass({ asks, profiles, site = SITE, shots, axe = '' } = {}) {
  const list = (asks && asks.length ? asks : TOP).map((a) => (typeof a === 'string' ? ASKS.find((x) => x.ask === a) || { ask: a, skill: /./, good: /\w/ } : a));
  const names = profiles && profiles.length ? profiles : ['desktop'];
  const browser = await launch();
  const out = { at: new Date().toISOString(), site, home: {}, profiles: {} };
  try {
    for (const name of names) {
      const spec = PROFILES[name]; if (!spec) continue;
      const ctx = await browser.newContext(spec.mobile ? { viewport: { width: spec.width, height: spec.height }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 } : { viewport: { width: spec.width, height: spec.height } });
      // a pass never writes to Verse: posts stay in the browser. The card's own GETs (weather, dictionary, prices) go out.
      await ctx.route('**/*', (route) => {
        const req = route.request();
        if (req.method() !== 'GET' && req.method() !== 'HEAD') return route.fulfill({ status: 204, body: '' });
        return route.continue();
      });
      const page = await ctx.newPage();
      const errors = []; const failed = []; const pageErrors = [];
      page.on('pageerror', (e) => { const m = String(e.message).slice(0, 180); errors.push(m); pageErrors.push(m); });
      page.on('console', (m) => { if (m.type() === 'error' && !/favicon|404|net::ERR_|cloudflareinsights|Permissions policy/i.test(m.text())) errors.push(m.text().slice(0, 180)); });
      page.on('response', (res) => { const u = res.url(); if (res.status() >= 400 && /a-to-mind\.com/.test(u) && !/\/api\//.test(u)) failed.push(res.status() + ' ' + new URL(u).pathname); });
      const cdp = await ctx.newCDPSession(page);
      await cdp.send('Network.enable');
      let bytes = 0; cdp.on('Network.loadingFinished', (e) => { bytes += e.encodedDataLength || 0; });
      if (spec.slow) {
        await cdp.send('Network.emulateNetworkConditions', { offline: false, latency: 400, downloadThroughput: 50000, uploadThroughput: 50000 });
        await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
      }
      const t0 = Date.now();
      await page.goto(site + '/', { waitUntil: 'domcontentloaded', timeout: spec.slow ? 90000 : 45000 });
      const paint = await page.evaluate(() => { const p = performance.getEntriesByType('paint'); const f = p.find((e) => e.name === 'first-contentful-paint') || p[0]; return f ? Math.round(f.startTime) : null; });
      await page.waitForSelector('#input', { timeout: 20000 }).catch(() => {});
      const home = await homeOf(page, axe);
      home.errors = errors.slice(0, 8); home.failed = [...new Set(failed)].slice(0, 8);
      home.bytes = bytes; home.paintMs = paint; home.loadMs = Date.now() - t0;
      if (shots) { mkdirSync(shots, { recursive: true }); await page.screenshot({ path: resolve(shots, 'home-' + name + '.png') }).catch(() => {}); }
      out.home[name] = home;
      await page.waitForFunction(() => document.documentElement.dataset.skills === 'ready', null, { timeout: spec.slow ? 70000 : 25000 }).catch(() => {});
      const rows = [];
      for (const a of list) {
        errors.length = 0; pageErrors.length = 0;
        const start = Date.now();
        await page.fill('#input', a.ask).catch(() => {});
        await page.keyboard.press('Enter');
        let got = { note: '', text: '', layout: '' };
        const cap = spec.slow ? 22000 : 12000;
        while (Date.now() - start < cap) {
          await page.waitForTimeout(350);
          got = await readLoop(page, a.ask);
          const pending = /checking rates|thinking…?|\b…\b/.test(bodyOf(got.text));
          if (USEFUL(got.text) && !pending && (got.note || Date.now() - start > 1500)) break;
        }
        const row = judgeAsk(a, { ...got, ms: Date.now() - start, slow: !!spec.slow });
        row.profile = name; row.text = String(got.text || '').replace(/\s+/g, ' ').trim().slice(0, 220);
        if (pageErrors.length) { row.ok = false; row.why = row.why.concat('console: ' + pageErrors[0].slice(0, 100)); pageErrors.length = 0; }
        rows.push(row);
        console.log((row.ok ? 'ok   ' : 'FAIL ') + name.padEnd(7) + ' ' + row.ms + 'ms  ' + a.ask + (row.ok ? '' : '  · ' + row.why.join('; ')) + (row.skill ? '  [' + row.skill + ']' : ''));
        await page.keyboard.press('Escape').catch(() => {});
        await page.waitForTimeout(150);
      }
      out.profiles[name] = { ...tally(rows), bytes: home.bytes, rows };
      await ctx.close();
    }
  } finally { await browser.close(); }
  return out;
}

function arg(name) { const i = process.argv.indexOf(name); return i >= 0 ? process.argv[i + 1] : ''; }

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const full = process.argv.includes('--full');
  const only = arg('--only');
  const profiles = only ? only.split(',') : (full ? ['desktop', 'phone', 'slow'] : ['desktop']);
  const asks = full ? ASKS : TOP.map((ask) => ASKS.find((a) => a.ask === ask)).filter(Boolean);
  let axe = '';
  if (arg('--axe')) { try { axe = readFileSync(arg('--axe'), 'utf8'); } catch (_) {} }
  const report = await pass({ asks, profiles, shots: arg('--shots') || '', axe });
  const line = JSON.stringify(report);
  if (process.argv.includes('--write')) writeFileSync(resolve(here, 'visitor-pass.json'), line);
  const out = arg('--out'); if (out) { mkdirSync(dirname(out), { recursive: true }); writeFileSync(out, line); }
  for (const [k, v] of Object.entries(report.profiles)) console.log(k + ': ' + v.correct + '/' + v.asks + ' correct, refused ' + v.refused + ', median ' + v.medianMs + ' ms, home ' + Math.round((report.home[k] || {}).bytes / 1024) + ' KB');
  const worst = Object.values(report.profiles).flatMap((p) => p.rows).filter((r) => !r.ok);
  process.exit(worst.length ? 1 : 0);
}
