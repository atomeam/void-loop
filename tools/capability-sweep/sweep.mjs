// Live first-time-visitor capability sweep for a-to-mind.com.
// Nightly in .github/workflows/capability-sweep.yml; writes tools/capability-sweep/results.json (no screenshots in git).
// Usage:
//   node sweep.mjs                # pages then asks, desktop + phone
//   node sweep.mjs --pages-only
//   node sweep.mjs --asks-only
//   node sweep.mjs --ids make-image,weather
//   node sweep.mjs --vp desktop
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright-core';

const here = path.dirname(fileURLToPath(import.meta.url));
const ORIGIN = process.env.SWEEP_ORIGIN || 'https://a-to-mind.com';
const CHROME = process.env.VOID_TEST_BROWSER || process.env.CHROME_PATH || chromium.executablePath();
const list = JSON.parse(fs.readFileSync(path.join(here, 'list.json'), 'utf8'));
const shots = path.join(here, 'shots');
fs.mkdirSync(shots, { recursive: true });

const args = process.argv.slice(2);
const pagesOnly = args.includes('--pages-only');
const asksOnly = args.includes('--asks-only');
const vpArg = (() => { const i = args.indexOf('--vp'); return i >= 0 ? args[i + 1] : null; })();
const idArg = (() => { const i = args.indexOf('--ids'); return i >= 0 ? new Set(args[i + 1].split(',')) : null; })();
const VIEWPORTS = (vpArg ? [vpArg] : ['desktop', 'phone']).filter(Boolean);
const items = list.items.filter((it) => !idArg || idArg.has(it.id));

const VP = {
  desktop: { viewport: { width: 1366, height: 768 }, isMobile: false, hasTouch: false, userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36' },
  phone: {
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
    userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
  },
};

function now() { return new Date().toISOString(); }

function judgeText(text, signals) {
  const t = String(text || '').toLowerCase();
  const hits = (signals || []).filter((s) => t.includes(String(s).toLowerCase()));
  const failBits = [
    '404', 'page not found', 'not found this page', "doesn't exist",
    'coming soon', 'not available yet', 'not hooked up', 'does not work',
    "i don't know how", "i can't do that", 'i cannot do that',
    'something went wrong', 'internal error', 'failed to',
  ];
  const gateBits = ['uni-verse', 'universe plan', 'sign in to keep going', 'verse-gate', 'choose a plan'];
  const stubBits = ['this page turns on only after', 'until then it says so', 'not ready'];
  const failed = failBits.filter((s) => t.includes(s));
  const gated = gateBits.filter((s) => t.includes(s));
  const stub = stubBits.filter((s) => t.includes(s));
  return { hits, failed, gated, stub, len: t.trim().length };
}

function scorePage(info, item) {
  const j = judgeText(info.text, item.signals);
  if (info.status >= 400) return { status: 'fail', reason: 'HTTP ' + info.status };
  if (info.gated) return { status: 'fail', reason: 'page is behind the Uni paywall for a first-time visitor' };
  if (j.failed.length && j.hits.length < 2) return { status: 'fail', reason: 'error or missing page: ' + j.failed[0] };
  if (info.notFound) return { status: 'fail', reason: '404 or missing tool page' };
  if (j.stub.length) return { status: 'partial', reason: 'page exists but says it is not ready: ' + j.stub[0] };
  if (info.interaction && info.interaction.ok) {
    return { status: 'pass', reason: 'page loaded and the tool did the job: ' + (info.interaction.detail || 'ok') };
  }
  if (info.interaction && info.interaction.tried && !info.interaction.ok) {
    if (j.hits.length >= 2 && info.hasToolUi) return { status: 'partial', reason: 'tool UI is there but the live action failed: ' + (info.interaction.detail || 'no output') };
    return { status: 'fail', reason: 'tool action failed: ' + (info.interaction.detail || 'no output') };
  }
  if (j.hits.length >= 2 && info.hasToolUi) return { status: 'pass', reason: 'working tool UI with expected copy (' + j.hits.slice(0, 4).join(', ') + ')' };
  if (info.hasToolUi) return { status: 'partial', reason: 'a tool UI loaded but expected signals were weak (' + j.hits.join(', ') + ')' };
  if (j.hits.length >= 1) return { status: 'partial', reason: 'page mentions the job but no clear working tool UI' };
  if (info.title && !/404/i.test(info.title) && j.len > 80) return { status: 'partial', reason: 'page loaded but does not clearly do this job' };
  return { status: 'fail', reason: 'no working tool found on the page' };
}

function scoreAsk(info, item) {
  const j = judgeText(info.text, item.signals);
  const note = String(info.note || '');
  const fallback = /article fallback/i.test(note);
  const gaveCodeOnly = /import matplotlib|plt\.bar|```|sudo |npm install/i.test(info.text || '') && !(info.cardWidget);
  const job = item.job || 'tool';
  if (info.timeout && j.hits.length < 1 && (info.added || 0) < 40) return { status: 'fail', reason: 'Ask anything did not answer in time' };
  if (j.failed.length && j.hits.length < 1) return { status: 'fail', reason: 'Ask failed or refused: ' + j.failed[0] };
  if (info.gated) return { status: 'fail', reason: 'Ask hit the paywall' };
  // A real skill card that does the job
  if (info.skill && j.hits.length >= 1) return { status: 'pass', reason: 'Ask opened the ' + info.skill + ' card (' + j.hits.slice(0, 4).join(', ') + ')' };
  if (job === 'tool' && (fallback || gaveCodeOnly) && !info.cardWidget) {
    if (gaveCodeOnly) return { status: 'fail', reason: 'Ask wrote code or instructions instead of actually doing the job' };
    if (j.hits.length >= 2) return { status: 'partial', reason: 'Ask wrote a text answer, not a working tool (' + j.hits.slice(0, 4).join(', ') + ')' };
    return { status: 'fail', reason: 'Ask fell back to a text article and did not do this job' };
  }
  if (job === 'write' && j.hits.length >= 2 && info.added > 80) {
    if (/\[your name\]|placeholder|lorem ipsum/i.test(info.text || '')) return { status: 'partial', reason: 'Ask drafted it, but with placeholders and no downloadable tool' };
    return { status: 'pass', reason: 'Ask wrote a real draft (' + j.hits.slice(0, 4).join(', ') + ')' };
  }
  if (j.hits.length >= 2 && (info.hasToolUi || info.added > 80)) return { status: 'pass', reason: 'Ask produced a real result (' + j.hits.slice(0, 4).join(', ') + ')' };
  if (j.hits.length >= 1 && info.added > 40) return { status: 'partial', reason: 'Ask replied and mentioned the job, but the working tool was thin (' + j.hits.join(', ') + ')' };
  if (info.added > 80) return { status: 'partial', reason: 'Ask replied, but not with a clear working tool for this job' };
  if (info.added > 0) return { status: 'fail', reason: 'Ask barely changed the page and did not do the job' };
  return { status: 'fail', reason: 'Ask anything did nothing' };
}

async function freshContext(browser, vp) {
  return browser.newContext({
    ...VP[vp],
    locale: 'en-US',
    timezoneId: 'America/New_York',
    colorScheme: 'dark',
    // first-time visitor: no storage, no permissions beyond defaults
  });
}

async function gotoRetry(page, url, timeout = 20000) {
  let last;
  for (let i = 0; i < 3; i++) {
    try {
      const res = await page.goto(url, { waitUntil: 'domcontentloaded', timeout });
      return res;
    } catch (e) {
      last = e;
      await page.waitForTimeout(800 * (i + 1));
    }
  }
  throw last;
}

async function snapshot(page) {
  return page.evaluate(() => {
    const text = (document.body && document.body.innerText) || '';
    const title = document.title || '';
    const h1 = (document.querySelector('h1') || {}).textContent || '';
    const gated = !!(document.querySelector('meta[name="verse-gate"]') || /x-verse-gate/i.test(document.documentElement.outerHTML));
    const notFound = /404|page not found/i.test(title + ' ' + h1 + ' ' + text.slice(0, 400));
    const inputs = [...document.querySelectorAll('input, textarea, select, [contenteditable="true"]')].filter((e) => e.offsetParent || e.type === 'hidden').length;
    const visibleInputs = [...document.querySelectorAll('input, textarea, select')].filter((e) => {
      const r = e.getBoundingClientRect();
      const s = getComputedStyle(e);
      return r.width > 0 && r.height > 0 && s.visibility !== 'hidden' && s.display !== 'none';
    }).length;
    const buttons = [...document.querySelectorAll('button, input[type="submit"]')].filter((e) => {
      const r = e.getBoundingClientRect();
      return r.width > 0 && r.height > 0;
    }).map((b) => (b.innerText || b.value || '').trim().slice(0, 40)).filter(Boolean).slice(0, 16);
    const canvases = [...document.querySelectorAll('canvas, svg')].filter((e) => {
      const r = e.getBoundingClientRect();
      return r.width > 40 && r.height > 40;
    }).length;
    const fileInputs = document.querySelectorAll('input[type="file"]').length;
    const hasToolUi = visibleInputs > 0 || buttons.length > 0 || canvases > 0 || fileInputs > 0;
    const ask = document.querySelector('#input');
    return {
      title, h1, text: text.slice(0, 4000), textLen: text.length, gated, notFound,
      visibleInputs, buttons, canvases, fileInputs, hasToolUi,
      hasAsk: !!(ask && ask.offsetParent !== null || ask),
      url: location.href,
    };
  });
}

const INTERACT = {
  async weather(page) {
    const box = page.locator('input[type="search"], input[name="q"], input[id*="place"], input[id*="city"], input[id*="q"], #q, #place, #where').first();
    if (await box.count()) {
      await box.fill('Lakeland, Florida');
      await box.press('Enter').catch(() => {});
      const go = page.locator('button[type="submit"], button:has-text("Go"), button:has-text("Search"), button:has-text("Show")').first();
      if (await go.count()) await go.click().catch(() => {});
    }
    await page.waitForTimeout(4000);
    const t = await page.locator('body').innerText();
    const ok = /lakeland/i.test(t) && (/°|forecast|humidity|wind|mph|km\/h/i.test(t));
    return { tried: true, ok, detail: ok ? 'forecast for Lakeland appeared' : 'no forecast after searching Lakeland' };
  },
  async qr(page) {
    await page.waitForTimeout(800);
    const svg = await page.locator('#out svg, svg').count();
    if (svg) return { tried: true, ok: true, detail: 'QR svg rendered' };
    const box = page.locator('#text, input[name="text"], textarea').first();
    if (await box.count()) {
      await box.fill('https://a-to-mind.com');
      await page.waitForTimeout(800);
    }
    const svg2 = await page.locator('#out svg, svg').count();
    return { tried: true, ok: svg2 > 0, detail: svg2 > 0 ? 'QR svg rendered after typing' : 'no QR svg' };
  },
  async calculator(page) {
    const display = page.locator('#display, #out, input[type="text"], textarea').first();
    // click 2 + 2 =
    const two = page.locator('button:has-text("2")').first();
    const plus = page.locator('button:has-text("+")').first();
    const eq = page.locator('button:has-text("=")').first();
    if (await two.count() && await plus.count() && await eq.count()) {
      await two.click(); await plus.click();
      const twos = page.locator('button:has-text("2")');
      await twos.first().click();
      await eq.click();
      await page.waitForTimeout(400);
      const t = await page.locator('body').innerText();
      const ok = /\b4\b/.test(t);
      return { tried: true, ok, detail: ok ? '2+2 showed 4' : 'keypad used but 4 not obvious' };
    }
    if (await display.count()) {
      await display.fill('2+2');
      await display.press('Enter').catch(() => {});
      await page.waitForTimeout(400);
      const t = await page.locator('body').innerText();
      return { tried: true, ok: /\b4\b/.test(t), detail: 'typed 2+2' };
    }
    return { tried: true, ok: false, detail: 'no calculator keypad or field' };
  },
  async convert(page) {
    const box = page.locator('#ask, #q, input[type="text"], textarea').first();
    if (!(await box.count())) return { tried: true, ok: false, detail: 'no convert field' };
    await box.fill('5 km in miles');
    await box.dispatchEvent('input').catch(() => {});
    await box.press('Enter').catch(() => {});
    await page.waitForTimeout(800);
    const t = await page.locator('body').innerText();
    const ok = /mile/i.test(t) && /3\.1|3,1|3.10|3.106/i.test(t);
    return { tried: true, ok, detail: ok ? '5 km in miles shown' : 'no mile result' };
  },
  async translate(page) {
    const box = page.locator('textarea, #from, #text, #src, [contenteditable="true"]').first();
    if (!(await box.count())) return { tried: true, ok: false, detail: 'no translate field' };
    await box.fill('hello, how are you');
    await box.dispatchEvent('input').catch(() => {});
    await page.waitForTimeout(2500);
    const t = await page.locator('body').innerText();
    const ok = /hola|cómo|como estas|qué tal|que tal/i.test(t);
    return { tried: true, ok, detail: ok ? 'Spanish translation appeared' : 'no Spanish result' };
  },
  async currency(page) {
    const box = page.locator('input[type="text"], input[type="number"], #amount, #from, #q').first();
    if (await box.count()) {
      await box.fill('100');
      await box.press('Enter').catch(() => {});
      await box.dispatchEvent('input').catch(() => {});
    }
    await page.waitForTimeout(2500);
    const t = await page.locator('body').innerText();
    const ok = /eur|euro/i.test(t) && /usd|dollar|100/i.test(t);
    return { tried: true, ok, detail: ok ? 'USD/EUR conversion present' : 'no currency result' };
  },
  async wordcount(page) {
    const box = page.locator('textarea, #text, #in').first();
    if (!(await box.count())) return { tried: true, ok: false, detail: 'no text field' };
    await box.fill('The quick brown fox jumps over the lazy dog');
    await box.dispatchEvent('input').catch(() => {});
    await page.waitForTimeout(500);
    const t = await page.locator('body').innerText();
    const ok = /\b9\b|\b10\b/.test(t) && /word/i.test(t);
    return { tried: true, ok, detail: ok ? 'word count updated' : 'count did not update' };
  },
  async textdiff(page) {
    const a = page.locator('#original, #a, textarea').nth(0);
    const b = page.locator('#changed, #b, textarea').nth(1);
    if (!(await a.count()) || !(await b.count())) return { tried: true, ok: false, detail: 'no two text fields' };
    await a.fill('one\ntwo');
    await b.fill('one\nthree');
    await page.waitForTimeout(600);
    const t = await page.locator('body').innerText();
    const ok = /removed|added|diff|three/i.test(t);
    return { tried: true, ok, detail: ok ? 'diff shown' : 'no diff' };
  },
  async password(page) {
    await page.waitForTimeout(400);
    const t0 = await page.locator('body').innerText();
    const go = page.locator('button:has-text("Generate"), button:has-text("New"), button:has-text("Make")').first();
    if (await go.count()) await go.click().catch(() => {});
    await page.waitForTimeout(400);
    const t = await page.locator('body').innerText();
    const ok = /password|strength|character/i.test(t) && t.length > 80;
    return { tried: true, ok, detail: ok ? 'password tool UI present' : 'no password output' };
  },
  async coinflip(page) {
    const go = page.locator('button:has-text("Flip"), button:has-text("Toss")').first();
    if (await go.count()) await go.click().catch(() => {});
    await page.waitForTimeout(800);
    const t = await page.locator('body').innerText();
    const ok = /heads|tails/i.test(t);
    return { tried: true, ok, detail: ok ? 'coin showed heads or tails' : 'no flip result' };
  },
  async timer(page) {
    const t = await page.locator('body').innerText();
    const ok = /timer|stopwatch|countdown|start|lap/i.test(t);
    const start = page.locator('button:has-text("Start")').first();
    if (await start.count()) {
      await start.click().catch(() => {});
      await page.waitForTimeout(1200);
      return { tried: true, ok: true, detail: 'timer/stopwatch start control worked' };
    }
    return { tried: true, ok, detail: ok ? 'timer UI present' : 'no timer UI' };
  },
  async calendar(page) {
    const t = await page.locator('body').innerText();
    const ok = /january|february|march|april|may|june|july|august|september|october|november|december/i.test(t);
    return { tried: true, ok, detail: ok ? 'month view visible' : 'no calendar month' };
  },
  async recipes(page) {
    const box = page.locator('input[type="search"], input[type="text"], #q, #ask').first();
    if (await box.count()) {
      await box.fill('banana bread');
      await box.press('Enter').catch(() => {});
    }
    await page.waitForTimeout(2500);
    const t = await page.locator('body').innerText();
    const ok = /banana/i.test(t) && /ingredient|flour|sugar|recipe|servings|steps/i.test(t);
    return { tried: true, ok, detail: ok ? 'banana bread recipe shown' : 'no recipe result' };
  },
  async image(page) {
    const box = page.locator('textarea, input[type="text"], #prompt, #q').first();
    const has = await box.count();
    const t = await page.locator('body').innerText();
    const ok = has > 0 && /image generator|text to image|styles|generate/i.test(t);
    return { tried: true, ok, detail: ok ? 'image generator prompt UI present (did not spend a generation in the sweep)' : 'no image generator UI' };
  },
  async video(page) {
    const t = await page.locator('body').innerText();
    const ready = /describe a short clip|text to video|generate/i.test(t) && !/turns on only after|not ready|until then/i.test(t);
    const stub = /turns on only after|not ready|until then/i.test(t);
    return { tried: true, ok: ready, detail: ready ? 'video generator UI looks ready' : (stub ? 'page says it is not ready' : 'no working video UI') };
  },
  async pdf(page) {
    const t = await page.locator('body').innerText();
    const files = await page.locator('input[type="file"]').count();
    const ok = files > 0 && /merge|split|compress|pdf/i.test(t);
    return { tried: true, ok, detail: ok ? 'PDF tools with file upload present' : 'no PDF tool upload' };
  },
  async photos(page) {
    const t = await page.locator('body').innerText();
    const files = await page.locator('input[type="file"]').count();
    const ok = files > 0 && /compress|convert|crop|photo|resize/i.test(t);
    return { tried: true, ok, detail: ok ? 'photo tools with file upload present' : 'no photo tool upload' };
  },
};

function interactFor(item) {
  const map = {
    weather: 'weather', qr: 'qr', math: 'calculator', 'unit-convert': 'convert',
    translate: 'translate', currency: 'currency', 'word-count': 'wordcount',
    'text-diff': 'textdiff', password: 'password', 'coin-flip': 'coinflip',
    timer: 'timer', 'event-countdown': 'timer', calendar: 'calendar',
    recipes: 'recipes', 'make-image': 'image', 'make-logo': 'image',
    'make-video': 'video', 'convert-pdf': 'pdf', 'summarize-pdf': 'pdf',
    'convert-image': 'photos', 'photo-edit': 'photos', 'compress-image': 'photos',
    'remove-bg': 'photos', upscale: 'photos', 'wifi-qr': 'qr',
  };
  return INTERACT[map[item.id]];
}

async function testPage(browser, item, vp) {
  if (!item.page) {
    return {
      kind: 'page', vp, url: null, skipped: true,
      status: 'fail', reason: 'no public tool page known for this job',
      shot: null, at: now(),
    };
  }
  const ctx = await freshContext(browser, vp);
  const page = await ctx.newPage();
  const url = item.page.startsWith('http') ? item.page : ORIGIN + item.page;
  const rec = { kind: 'page', vp, url, at: now() };
  try {
    const res = await gotoRetry(page, url, 20000);
    rec.statusCode = res ? res.status() : 0;
    rec.finalUrl = page.url();
    rec.gatedHeader = (res && (res.headers()['x-verse-gate'] || '')) || '';
    await page.waitForTimeout(900);
    const interact = interactFor(item);
    let interaction = null;
    if (interact) {
      try { interaction = await interact(page); }
      catch (e) { interaction = { tried: true, ok: false, detail: 'interaction error: ' + String(e).slice(0, 180) }; }
    }
    const snap = await snapshot(page);
    const info = {
      status: rec.statusCode,
      gated: !!(rec.gatedHeader || snap.gated),
      notFound: snap.notFound || rec.statusCode === 404,
      title: snap.title,
      hasToolUi: snap.hasToolUi,
      text: snap.text,
      interaction,
    };
    const scored = scorePage(info, item);
    // special case: remove-bg / upscale may have photo UI but not the feature
    if ((item.id === 'remove-bg' || item.id === 'upscale' || item.id === 'summarize-pdf') && scored.status === 'pass') {
      const t = (snap.text || '').toLowerCase();
      const need = item.id === 'remove-bg' ? /background/i : item.id === 'upscale' ? /upscale|higher resolution/i : /summar/i;
      if (!need.test(t)) {
        scored.status = 'partial';
        scored.reason = 'photo/PDF tools exist, but this specific job is not offered on the page';
      }
    }
    if (item.id === 'draw' && scored.status === 'pass') {
      const t = (snap.text || '').toLowerCase();
      if (/paint by number/.test(t) && !/brush|freehand|pencil|pen tool/.test(t)) {
        scored.status = 'partial';
        scored.reason = 'page is paint-by-number, not a free drawing canvas';
      }
    }
    Object.assign(rec, scored, {
      title: snap.title, h1: snap.h1, gated: info.gated,
      hasToolUi: snap.hasToolUi, buttons: snap.buttons,
      interaction, textSample: (snap.text || '').replace(/\s+/g, ' ').trim().slice(0, 400),
    });
    const shot = path.join(shots, `${item.id}-page-${vp}.png`);
    try { await page.screenshot({ path: shot, fullPage: false, timeout: 5000, animations: 'disabled' }); } catch (se) { rec.shotError = String(se).slice(0, 120); }
    rec.shot = shot;
  } catch (e) {
    rec.status = 'fail';
    rec.reason = 'page test error: ' + String(e).slice(0, 240);
    try {
      const shot = path.join(shots, `${item.id}-page-${vp}.png`);
      try { await page.screenshot({ path: shot, fullPage: false, timeout: 5000, animations: 'disabled' }); } catch (se) { rec.shotError = String(se).slice(0, 120); }
      rec.shot = shot;
    } catch {}
  } finally {
    await ctx.close().catch(() => {});
  }
  return rec;
}

async function testAsk(browser, item, vp) {
  const ctx = await freshContext(browser, vp);
  const page = await ctx.newPage();
  const rec = { kind: 'ask', vp, url: ORIGIN + '/', ask: item.ask, at: now() };
  try {
    await gotoRetry(page, ORIGIN + '/', 20000);
    await page.waitForSelector('#input', { timeout: 15000 });
    await page.waitForFunction(() => document.documentElement.dataset.skills === 'ready' || document.querySelector('#input'), null, { timeout: 15000 }).catch(() => {});
    await page.waitForTimeout(700);
    const before = await page.evaluate(() => (document.body && document.body.innerText) || '');
    await page.fill('#input', item.ask);
    await page.press('#input', 'Enter');
    const start = Date.now();
    let timeout = false;
    let lastLen = before.length;
    let stable = 0;
    for (let i = 0; i < 36; i++) {
      await page.waitForTimeout(500);
      const len = await page.evaluate(() => (document.body && document.body.innerText.length) || 0);
      if (len > lastLen + 20) { lastLen = len; stable = 0; }
      else if (len > before.length + 40) { stable++; }
      if (stable >= 4) break; // ~2s unchanged after growth
      if (Date.now() - start > 18000) { timeout = true; break; }
    }
    const extra = await page.evaluate(() => {
      const cards = [...document.querySelectorAll('#stage article, #stage .card, #board article, [data-kind], #stage > div')].filter((e) => e.offsetParent);
      const whisper = (document.querySelector('#whisper') || {}).textContent || '';
      let last = null;
      try {
        const l = JSON.parse(localStorage.getItem('a2m.void.loop.v1') || '[]');
        last = Array.isArray(l) && l.length ? l[l.length - 1] : null;
      } catch {}
      return {
        cardCount: cards.length,
        cardText: cards.slice(0, 3).map((c) => (c.innerText || '').slice(0, 400)).join(' \n '),
        whisper: whisper.trim().slice(0, 240),
        lastAsk: last && last.ask,
        lastNote: last && (last.note || last.skill || last.by || ''),
      };
    }).catch(() => ({}));
    const snap = await snapshot(page);
    const added = (snap.textLen || 0) - (before.length || 0);
    const skillNote = String(extra.lastNote || '');
    const skill = (skillNote.match(/skill:([a-z0-9-]+)/i) || [])[1] || '';
    const info = {
      text: (extra.cardText || '') + '\n' + snap.text + '\n' + (extra.whisper || '') + '\n' + skillNote,
      added, timeout, gated: snap.gated,
      hasToolUi: snap.hasToolUi || (extra.cardCount || 0) > 0, title: snap.title,
      note: skillNote, skill,
      cardWidget: !!(skill && !/fallback/i.test(skillNote)) || !!(extra.cardCount && !/article fallback/i.test(skillNote)),
    };
    const scored = scoreAsk(info, item);
    Object.assign(rec, scored, {
      timeout, added, title: snap.title, h1: snap.h1,
      hasToolUi: info.hasToolUi, buttons: snap.buttons,
      finalUrl: snap.url,
      cardCount: extra.cardCount || 0,
      whisper: extra.whisper || '',
      lastNote: extra.lastNote || '',
      textSample: ((extra.cardText || snap.text || '') + ' ' + (extra.whisper || '')).replace(/\s+/g, ' ').trim().slice(0, 500),
    });
    const shot = path.join(shots, `${item.id}-ask-${vp}.png`);
    try { await page.screenshot({ path: shot, fullPage: false, timeout: 5000, animations: 'disabled' }); } catch (se) { rec.shotError = String(se).slice(0, 120); }
    rec.shot = shot;
  } catch (e) {
    rec.status = 'fail';
    rec.reason = 'ask test error: ' + String(e).slice(0, 240);
    try {
      const shot = path.join(shots, `${item.id}-ask-${vp}.png`);
      try { await page.screenshot({ path: shot, fullPage: false, timeout: 5000, animations: 'disabled' }); } catch (se) { rec.shotError = String(se).slice(0, 120); }
      rec.shot = shot;
    } catch {}
  } finally {
    await ctx.close().catch(() => {});
  }
  return rec;
}

function rollup(results) {
  const byId = {};
  for (const it of items) byId[it.id] = { id: it.id, name: it.name, priority: it.priority, skip_build: !!it.skip_build, page: it.page, ask: it.ask, tests: [], overall: 'fail' };
  for (const r of results) {
    if (!byId[r.id]) continue;
    byId[r.id].tests.push(r);
  }
  const rank = { pass: 3, partial: 2, fail: 1 };
  for (const row of Object.values(byId)) {
    const tests = row.tests.filter((t) => !t.skipped || t.status);
    if (!tests.length) { row.overall = 'fail'; row.reason = 'not tested'; continue; }
    // overall: worst of (best page across vps, best ask across vps)?
    // A capability passes only if a first-time visitor can actually do it.
    // If the page works OR ask works fully, that's a pass.
    // If only partials, partial. If all fail (including missing page + failed ask), fail.
    const pages = tests.filter((t) => t.kind === 'page' && !t.skipped);
    const asks = tests.filter((t) => t.kind === 'ask');
    const skippedPages = tests.filter((t) => t.kind === 'page' && t.skipped);
    const gatedPages = pages.filter((t) => /paywall|gated|UniVerse/i.test(t.reason || '') || t.gated);
    row.pageAccess = skippedPages.length && !pages.length ? 'missing' : (gatedPages.length && gatedPages.length === pages.length ? 'gated' : (pages.length ? 'open' : 'unknown'));
    const bestPage = pages.sort((a, b) => rank[b.status] - rank[a.status])[0];
    const bestAsk = asks.sort((a, b) => rank[b.status] - rank[a.status])[0];
    // First-time visitors use Ask anything; full pages are Uni. Overall follows the best Ask when present.
    if (bestAsk) {
      row.overall = bestAsk.status;
      row.reason = bestAsk.reason;
      if (row.pageAccess === 'gated') row.reason = (row.reason || '') + ' (full tool page is Uni, $20/mo)';
      if (row.pageAccess === 'missing' && bestAsk.status !== 'pass') {
        if (bestAsk.status === 'fail') row.reason = 'no public tool page; ' + bestAsk.reason;
        else row.reason = bestAsk.reason + ' (no dedicated public page)';
      }
    } else if (skippedPages.length && !pages.length) {
      row.overall = 'fail';
      row.reason = 'no public tool page known for this job (Ask not tested yet)';
    } else if (gatedPages.length && gatedPages.length === pages.length) {
      row.overall = 'partial';
      row.reason = 'full tool page is behind UniVerse ($20/mo); cards on the home page are free — Ask not tested yet';
    } else if (bestPage) {
      row.overall = bestPage.status;
      row.reason = bestPage.reason + ' (Ask not tested yet)';
    }
    // phone/desktop disagreement: if one vp fails badly, cap at partial
    const vps = {};
    for (const t of tests) {
      if (t.skipped) continue;
      vps[t.vp] = vps[t.vp] || [];
      vps[t.vp].push(t);
    }
  }
  const counts = { pass: 0, partial: 0, fail: 0 };
  for (const row of Object.values(byId)) counts[row.overall] = (counts[row.overall] || 0) + 1;
  return { byId, counts };
}

async function pool(tasks, n) {
  const out = [];
  let i = 0;
  async function worker() {
    while (i < tasks.length) {
      const k = i++;
      out[k] = await tasks[k]();
    }
  }
  await Promise.all(Array.from({ length: Math.min(n, tasks.length) }, worker));
  return out;
}

const resultsPath = path.join(here, 'results.json');
const SLIM_DROP = new Set(['textSample', 'text', 'buttons', 'shot', 'shotError', 'interaction']);
function slim(row) {
  if (!row || typeof row !== 'object') return row;
  const out = {};
  for (const [k, v] of Object.entries(row)) {
    if (SLIM_DROP.has(k)) continue;
    out[k] = v;
  }
  return out;
}
function save(all, extra) {
  const { byId, counts } = rollup(all);
  const payload = {
    origin: ORIGIN,
    started: extra.started,
    updated: now(),
    zone: 'America/New_York',
    viewports: VIEWPORTS,
    itemCount: items.length,
    counts,
    items: Object.values(byId),
    raw: all,
  };
  const lean = {
    origin: payload.origin,
    started: payload.started,
    updated: payload.updated,
    zone: payload.zone,
    viewports: payload.viewports,
    itemCount: payload.itemCount,
    counts: payload.counts,
    items: payload.items.map((it) => ({
      id: it.id,
      name: it.name,
      priority: it.priority,
      overall: it.overall,
      reason: it.reason,
      tests: (it.tests || []).map((t) => slim(t)),
    })),
  };
  fs.writeFileSync(resultsPath, JSON.stringify(lean, null, 2));
  return payload;
}

const started = now();
console.log(`[sweep] ${items.length} items, vps=${VIEWPORTS.join(',')} pagesOnly=${pagesOnly} asksOnly=${asksOnly} at ${started}`);

function loadPrior() {
  try {
    const prev = JSON.parse(fs.readFileSync(resultsPath, 'utf8'));
    if (Array.isArray(prev.raw)) return prev.raw;
    if (Array.isArray(prev.items)) return prev.items.flatMap((it) => (it.tests || []).map((t) => ({ ...t, id: it.id })));
    return [];
  } catch { return []; }
}

const browser = await chromium.launch({
  executablePath: CHROME,
  headless: true,
  args: ['--no-sandbox', '--disable-dev-shm-usage'],
});

const prior = loadPrior();
const all = asksOnly ? prior.filter((r) => r.kind === 'page') : (pagesOnly ? prior.filter((r) => r.kind === 'ask') : []);
try {
  if (!asksOnly) {
    // replace prior page rows for the items/vps we are about to test
    const drop = new Set(items.flatMap((it) => VIEWPORTS.map((vp) => it.id + '|page|' + vp)));
    for (let i = all.length - 1; i >= 0; i--) {
      const r = all[i];
      if (r.kind === 'page' && drop.has(r.id + '|page|' + r.vp)) all.splice(i, 1);
    }
    const tasks = [];
    for (const it of items) {
      for (const vp of VIEWPORTS) {
        tasks.push(async () => {
          const r = await testPage(browser, it, vp);
          r.id = it.id;
          console.log(`[page ${vp}] ${it.id}: ${r.status} — ${r.reason}`);
          all.push(r);
          save(all, { started });
          return r;
        });
      }
    }
    await pool(tasks, 3);
  }
  if (!pagesOnly) {
    const dropA = new Set(items.flatMap((it) => VIEWPORTS.map((vp) => it.id + '|ask|' + vp)));
    for (let i = all.length - 1; i >= 0; i--) {
      const r = all[i];
      if (r.kind === 'ask' && dropA.has(r.id + '|ask|' + r.vp)) all.splice(i, 1);
    }
    const tasks = [];
    for (const it of items) {
      for (const vp of VIEWPORTS) {
        tasks.push(async () => {
          const r = await testAsk(browser, it, vp);
          r.id = it.id;
          console.log(`[ask ${vp}] ${it.id}: ${r.status} — ${r.reason}`);
          all.push(r);
          save(all, { started });
          return r;
        });
      }
    }
    // asks are heavier on the live site — keep concurrency modest
    await pool(tasks, 1);
  }
} finally {
  await browser.close().catch(() => {});
}

const payload = save(all, { started });
console.log('\n[sweep done] pass=%s partial=%s fail=%s  wrote %s', payload.counts.pass, payload.counts.partial, payload.counts.fail, resultsPath);
const fails = payload.items.filter((x) => x.overall === 'fail').sort((a, b) => a.priority - b.priority);
const parts = payload.items.filter((x) => x.overall === 'partial').sort((a, b) => a.priority - b.priority);
console.log('FAILS:');
for (const x of fails) console.log('  P' + x.priority, x.id, '—', x.reason);
console.log('PARTIALS:');
for (const x of parts) console.log('  P' + x.priority, x.id, '—', x.reason);
