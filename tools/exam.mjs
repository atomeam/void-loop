// The outcome exam (owner, 2026-11-03: judge Verse by what a visitor gets, not by how many skills or lessons it has).
//   node tools/exam.mjs                     16 public asks per domain on live https://a-to-mind.com, phone width
//   node tools/exam.mjs --against local     this tree, with /api proxied to the live site, so a change can be scored before it deploys
//   node tools/exam.mjs --domains songs     one domain
//   node tools/exam.mjs --no-holdout        public asks only
// A non-GET never leaves the browser. Holdout asks are read from tools/exam-holdout.json or EXAM_HOLDOUT, never written back,
// and the published run names them by id only. Results: void-live-deploy/exam/latest.json and history.json (the tool writes them).
// One run that falls by 5 points or more is recorded and exits 0. Two runs in a row that each fall by 5 or more
// exit 1 and set revert=yes (exam.yml rolls that deploy back; a crash, which never sets the output, does not).
import { readFileSync, writeFileSync, appendFileSync, mkdirSync, existsSync, createReadStream, statSync } from 'node:fs';
import http from 'node:http';
import { request as httpsRequest } from 'node:https';
import { resolve, dirname, extname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright-core';
import { spawnSync } from 'node:child_process';
import { DOMAINS, judge, domainScore, lowestDomain, compareRuns, revertAfter, isoWeek, holdoutSlice, askId, mediaLine, DROP, SCALE } from '../void-live-deploy/lib/exam.js';
import { songAskOf, findTrack } from '../void-live-deploy/lib/hear.js';
import { vatStateOf } from '../void-live-deploy/lib/vat-ask.js';
import { compute, money } from '../void-live-deploy/lib/vat.js';
import { EMOJI } from '../void-live-deploy/lib/emoji.js';
import translateSkill from '../void-live-deploy/skills/translate.js';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '..');
const site = join(root, 'void-live-deploy');
const PUBLIC = join(here, 'exam-public.json');
const HOLDOUT = join(here, 'exam-holdout.json');
const LATEST = join(site, 'exam', 'latest.json');
const HISTORY = join(site, 'exam', 'history.json');
const LIVE = 'https://a-to-mind.com';
const UA = 'VerseExam/1.0 (+https://a-to-mind.com/progress; outcome exam, reads only)';
const TYPES = { '.js': 'text/javascript', '.mjs': 'text/javascript', '.html': 'text/html', '.json': 'application/json', '.css': 'text/css', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.xml': 'application/xml', '.mp3': 'audio/mpeg', '.txt': 'text/plain' };

const arg = (k) => { const i = process.argv.indexOf(k); return i >= 0 ? process.argv[i + 1] : ''; };
const flag = (k) => process.argv.includes(k);

function readJson(path, fallback) { try { return JSON.parse(readFileSync(path, 'utf8')); } catch (_) { return fallback; } }

/** the week's holdout, public asks removed, or null when the sealed file is not here. */
export function holdoutOf(publicAsks, week, raw) {
  if (!raw) return null;
  let pool; try { pool = JSON.parse(raw); } catch (_) { return null; }
  const domains = pool.domains || pool;
  const out = {};
  for (const d of DOMAINS) {
    const pub = new Set((publicAsks[d] || []).map((a) => String(a.ask).toLowerCase()));
    const clean = (domains[d] || []).filter((a) => a && a.ask && !pub.has(String(a.ask).toLowerCase()));
    out[d] = holdoutSlice(clean, week, 4);
  }
  return out;
}

function percentNumbers(ask) {
  const m = String(ask).match(/(\d+(?:\.\d+)?)%\s*of\s+(\d+(?:\.\d+)?)/);
  if (!m) return null;
  const n = Math.round((Number(m[1]) / 100) * Number(m[2]) * 100) / 100;
  return [String(n)];
}
function vatNumbers(ask) {
  const s = vatStateOf(ask); if (!s) return null;
  const r = compute(s); if (!r || !r.ok) return null;
  return [money(r.vat, 'en')];
}

async function getJson(url, ms = 8000) {
  const c = new AbortController(), t = setTimeout(() => c.abort(), ms);
  try {
    const r = await fetch(url, { headers: { accept: 'application/json', 'user-agent': UA }, signal: c.signal });
    if (!r.ok) return null;
    return await r.json();
  } catch (_) { return null; } finally { clearTimeout(t); }
}

async function headOf(url) {
  if (!/^https?:\/\//.test(url || '')) return { status: 0, type: '' };
  const c = new AbortController(), t = setTimeout(() => c.abort(), 8000);
  try {
    const r = await fetch(url, { headers: { Range: 'bytes=0-16', 'user-agent': UA }, signal: c.signal, redirect: 'follow' });
    const type = String(r.headers.get('content-type') || '').split(';')[0].trim();
    try { await r.body?.cancel(); } catch (_) {}
    return { status: r.status, type };
  } catch (_) { return { status: 0, type: '' }; } finally { clearTimeout(t); }
}

/** enclosure addresses from a podcast feed, the first few items only. */
async function enclosuresOf(feedUrl) {
  if (!/^https:\/\//.test(feedUrl || '')) return [];
  const c = new AbortController(), t = setTimeout(() => c.abort(), 8000);
  try {
    const r = await fetch(feedUrl, { headers: { 'user-agent': UA, accept: 'application/rss+xml, application/xml, text/xml' }, signal: c.signal, redirect: 'follow' });
    if (!r.ok) return [];
    const xml = (await r.text()).slice(0, 400000);
    const urls = [...xml.matchAll(/<enclosure\b[^>]*\burl=["']([^"']+)["']/gi)].map((m) => m[1].replace(/&amp;/g, '&')).slice(0, 20);
    return urls;
  } catch (_) { return []; } finally { clearTimeout(t); }
}

const STOP = new Set('which their there about would could should these those other first after before under again while where when what with from that this have been were into your more most some than then also just only very'.split(' '));
function glossWords(html) {
  return String(html || '').replace(/<[^>]+>/g, ' ').toLowerCase().split(/[^a-z]+/).filter((w) => w.length > 4 && !STOP.has(w)).slice(0, 8);
}
async function googleTranslate(q, to) {
  const j = await getJson('https://translate.googleapis.com/translate_a/single?client=gtx&dt=t&sl=en&tl=' + encodeURIComponent(to) + '&q=' + encodeURIComponent(q));
  const parts = j && j[0];
  if (!Array.isArray(parts)) return '';
  return parts.map((p) => (p && p[0]) || '').join('').trim();
}
const LANG = { spanish: 'es', french: 'fr', german: 'de', japanese: 'ja', italian: 'it', portuguese: 'pt', korean: 'ko', arabic: 'ar', russian: 'ru' };
function unitRival(ask) {
  const t = String(ask).toLowerCase();
  let m = t.match(/(-?\d+(?:\.\d+)?)\s*(?:degrees?\s+)?(?:°\s*)?(celsius|fahrenheit|c|f)\b.*\b(?:in|to|as|en)\b.*\b(celsius|fahrenheit|c|f)\b/);
  if (m) {
    const n = Number(m[1]), fromC = m[2] === 'c' || m[2] === 'celsius', toC = m[3] === 'c' || m[3] === 'celsius';
    const v = fromC === toC ? n : fromC ? (n * 9 / 5 + 32) : ((n - 32) * 5 / 9);
    return { near: Math.round(v * 10) / 10, tol: 0.2 };
  }
  m = t.match(/(\d+)\s*(?:feet|foot|ft)\s+(\d+)\s*(?:inches|inch|in)\b.*\b(cm|centimet)/);
  if (m) return { near: Math.round((Number(m[1]) * 12 + Number(m[2])) * 2.54 * 10) / 10, tol: 0.2 };
  m = t.match(/(\d+(?:\.\d+)?)\s*bytes?\b.*\bbits?\b/);
  if (m) return { near: Number(m[1]) * 8, tol: 0 };
  m = t.match(/(\d+(?:\.\d+)?)\s*(?:km|kilometres?|kilometers?)\b.*\b(?:miles?|mi)\b/);
  if (m) return { near: Math.round(Number(m[1]) * 0.621371 * 10) / 10, tol: 0.2 };
  return null;
}
function wordRival(ask) {
  const t = String(ask);
  const m = t.match(/(\d+(?:\.\d+)?)\s+apples?\s+cost\s+\$?(\d+(?:\.\d+)?)[\s\S]*?(\d+(?:\.\d+)?)\s+(?:apples?\s+)?cost/i);
  if (m && Number(m[1])) return { near: Math.round(Number(m[3]) / Number(m[1]) * Number(m[2]) * 100) / 100, tol: 0.02 };
  const p = t.match(/(\d+(?:\.\d+)?)\s+percent\s+of\s+(\d+(?:\.\d+)?)/i);
  if (p) return { near: Math.round(Number(p[1]) / 100 * Number(p[2]) * 100) / 100, tol: 0.01 };
  const km = t.match(/(\d+(?:\.\d+)?)\s*km\b[\s\S]*?\b(\d+(?:\.\d+)?)\s*hours?/i);
  if (km && Number(km[2])) return { near: Math.round(Number(km[1]) / Number(km[2]) * 10) / 10, tol: 0.2 };
  const half = t.match(/have\s+(\d+(?:\.\d+)?)\b[\s\S]*\bhalf\b[\s\S]*\bfind\s+(\d+(?:\.\d+)?)/i);
  if (half) return { near: Number(half[1]) / 2 + Number(half[2]), tol: 0.01 };
  const es = t.match(/(\d+(?:\.\d+)?)\s+\S+\s+cuestan\s+(\d+(?:\.\d+)?)[\s\S]*?(\d+(?:\.\d+)?)/i);
  if (es && Number(es[1])) return { near: Math.round(Number(es[3]) / Number(es[1]) * Number(es[2]) * 100) / 100, tol: 0.02 };
  return null;
}
function emojiRival(ask) {
  const m = String(ask).toLowerCase().match(/(?:emoji\s+([a-z][a-z' -]{1,40})|([a-z][a-z' -]{1,40}?)\s+emoji)/);
  const name = (m && (m[1] || m[2]) || '').trim();
  const hit = EMOJI.find((e) => e.n === name);
  if (hit) return { emoji: hit.c };
  if (/\d+\s+(?:random\s+)?emojis?/.test(String(ask).toLowerCase())) return { phrase: /(?:\p{Extended_Pictographic}.*){2}/u };
  return null;
}
function codeRan(text, probe) {
  const raw = String(text);
  const fenced = raw.match(/```(?:python|py)?\s*([\s\S]*?)```/i);
  // the function only: indented lines after the def, not the sentence that follows it
  const loose = raw.match(/def\s+[A-Za-z_]\w*\s*\([^)]*\)\s*:(?:\r?\n[ \t]+.*)+/);
  const src = ((fenced && fenced[1]) || (loose && loose[0]) || '').trim();
  if (!src || /import|open\s*\(|exec\s*\(|eval\s*\(|__|subprocess|os\./.test(src)) return false;
  const r = spawnSync('python3', ['-c', src + '\n' + probe], { timeout: 3000, encoding: 'utf8' });
  return r.status === 0 && /\bok\b/.test(r.stdout || '');
}
async function rivalFor(domain, ask, obs) {
  if (ask.ambiguous) return { ambiguous: true };
  if (domain === 'emoji') return emojiRival(ask.ask);
  if (domain === 'units') return unitRival(ask.ask);
  if (domain === 'wordproblems' || (domain === 'calculator' && /percent|apples/i.test(ask.ask))) return wordRival(ask.ask) || (Array.isArray(ask.numbers) ? { any: ask.numbers } : null);
  if (domain === 'timers') return { any: String(ask.expect || '').split('|').filter(Boolean) };
  if (domain === 'maps' && ask.region) return { text: ask.region };
  if (domain === 'definitions' && ask.word) {
    const j = await getJson('https://en.wiktionary.org/api/rest_v1/page/definition/' + encodeURIComponent(ask.word) + '?redirect=true');
    const block = j && (j.en || j.English);
    const def = block && block[0] && block[0].definitions && block[0].definitions[0] && block[0].definitions[0].definition;
    const words = glossWords(def).filter((w) => w !== ask.word);
    return words.length ? { words, need: 2 } : null;
  }
  if (domain === 'translate') {
    const p = translateSkill.translateOf ? translateSkill.translateOf(ask.ask) : null;
    if (!p || !p.q) return null;
    const to = LANG[(p.to || '').toLowerCase()] || p.to;
    const line = to ? await googleTranslate(p.q, to) : '';
    return line ? { text: line } : null;
  }
  if (domain === 'prices' && ask.spot) {
    const j = await getJson('https://api.coinbase.com/v2/prices/' + ask.spot + '-USD/spot');
    const n = j && j.data && Number(j.data.amount);
    return Number.isFinite(n) ? { near: n, pct: 0.03 } : null;
  }
  if (domain === 'prices' && ask.fx) {
    const j = await getJson('https://api.frankfurter.app/latest?from=' + ask.fx.from + '&to=' + ask.fx.to + '&amount=' + ask.fx.amount);
    const n = j && j.rates && Number(j.rates[ask.fx.to]);
    return Number.isFinite(n) ? { near: n, pct: 0.02 } : null;
  }
  if (domain === 'code' && obs) {
    if (/factorial/i.test(ask.ask)) return { ok: codeRan(obs.text, 'print("ok" if factorial(5)==120 else "no")') };
    if (/reverse/i.test(ask.ask)) return { ok: codeRan(obs.text, 'print("ok" if reverse("ab")=="ba" else "no")') };
    if (ask.fact) return { text: ask.fact };
  }
  if (domain === 'images' && ask.url) return { text: ask.url.replace(/^https?:\/\//, '').slice(0, 24) };
  return null;
}

async function truthFor(domain, ask, obs) {
  const t = {};
  if (domain === 'songs') {
    const s = songAskOf(ask.ask);
    if (s) { const hit = await findTrack(s.title, s.artist).catch(() => null); if (hit) { t.track = hit.title; t.artist = hit.artist; } }
  } else if (domain === 'podcasts') {
    t.show = ask.show || '';
    if (/^play the podcast$/i.test(ask.ask)) {
      t.enclosures = await enclosuresOf(LIVE + '/podcast/rss.xml');
    } else if (t.show) {
      const j = await getJson('https://itunes.apple.com/search?entity=podcast&limit=5&term=' + encodeURIComponent(t.show));
      const hit = ((j && j.results) || []).find((r) => r.feedUrl);
      if (hit) { t.show = hit.collectionName || t.show; t.enclosures = await enclosuresOf(hit.feedUrl); }
    }
  } else if (domain === 'videos') t.topic = ask.topic || '';
  else if (domain === 'weather' && ask.place) {
    t.place = ask.place;
    const g = await getJson('https://geocoding-api.open-meteo.com/v1/search?count=1&name=' + encodeURIComponent(ask.place));
    const p = g && g.results && g.results[0];
    if (p) {
      const w = await getJson('https://api.open-meteo.com/v1/forecast?latitude=' + p.latitude + '&longitude=' + p.longitude + '&current=temperature_2m');
      const c = w && w.current && w.current.temperature_2m;
      if (Number.isFinite(c)) t.tempC = c;
    }
  } else if (domain === 'directions') t.dest = ask.dest || '';
  else if (domain === 'recipes') t.dish = ask.dish || '';
  else if (domain === 'calculator') t.numbers = vatNumbers(ask.ask) || percentNumbers(ask.ask);
  else if (domain === 'news') t.topic = ask.topic || '';
  else if (domain === 'sports') { t.team = ask.team || ''; t.league = ask.league || ''; }
  else if (domain === 'images') t.wantPicture = ask.picture !== false;
  if (ask.ambiguous) t.ambiguous = true;
  if (ask.slow) t.slow = true;
  if (ask.gap) t.gap = true;
  if (!t.ambiguous) {
    const rival = await rivalFor(domain, ask, obs);
    if (rival && !rival.ambiguous) t.rival = rival;
  }
  return t;
}

function chromePath() {
  const c = [process.env.CHROME_PATH, '/opt/google/chrome/chrome', '/usr/bin/google-chrome', '/usr/bin/chromium'].find((p) => p && existsSync(p));
  return c;
}

function serveLocal() {
  const server = http.createServer((req, res) => {
    const u = new URL(req.url, 'http://127.0.0.1');
    if (req.method !== 'GET' && req.method !== 'HEAD') { res.writeHead(204); return res.end(); }
    if (u.pathname.startsWith('/api/')) {
      const out = httpsRequest(LIVE + u.pathname + u.search, { headers: { 'user-agent': UA, accept: req.headers.accept || '*/*' } }, (up) => {
        res.writeHead(up.statusCode || 502, up.headers); up.pipe(res);
      });
      out.on('error', () => { res.writeHead(502); res.end(); });
      out.end();
      return;
    }
    let p = decodeURIComponent(u.pathname); if (p === '/') p = '/index.html';
    const f = join(site, p);
    if (!f.startsWith(site) || !existsSync(f) || !statSync(f).isFile()) { res.writeHead(404); return res.end(); }
    res.writeHead(200, { 'content-type': TYPES[extname(f)] || 'application/octet-stream' });
    createReadStream(f).on('error', () => res.end()).pipe(res);
  });
  return new Promise((ok) => server.listen(0, '127.0.0.1', () => ok(server)));
}

async function readCard(page, ask) {
  const t0 = Date.now();
  await page.fill('#input', ask);
  await page.keyboard.press('Enter');
  await page.waitForFunction((q) => {
    try { return JSON.parse(localStorage.getItem('a2m.void.loop.v1') || '[]').some((e) => e && e.ask === q); } catch (_) { return false; }
  }, ask, { timeout: 15000 }).catch(() => {});
  await page.waitForTimeout(2200);
  const obs = await page.evaluate(() => {
    // the answer's card, else the thing the ask made or changed (it is picked), else the first thing: an older timer on the
    // stage is not the answer to "set a timer for 45 seconds" (#2326)
    const card = document.querySelector('.vpage.on') || document.querySelector('.thing[data-picked]') || document.querySelector('.thing') || document.body;
    let note = '';
    try {
      const log = JSON.parse(localStorage.getItem('a2m.void.loop.v1') || '[]');
      const hit = [...log].reverse().find((e) => e && e.domain === 'void.page');
      note = hit ? String(hit.note || '') : '';
    } catch (_) {}
    // the media is the answer card's own: a card restored on the stage from an earlier ask (it sits before the answer in the page) is not this answer
    const audio = card.querySelector('audio[src]'), video = card.querySelector('video[src]'), frame = card.querySelector('iframe[src]');
    if (audio) audio.dataset.examAudio = '1';
    return {
      text: (card.innerText || '').slice(0, 4000),
      note,
      overflow: card.scrollWidth > card.clientWidth + 12,
      // the src attribute is the address the card chose (an RSS enclosure). currentSrc may be a redirect of that file.
      audio: audio ? { src: audio.getAttribute('src') || audio.currentSrc || audio.src, currentTime: audio.currentTime || 0 } : null,
      video: video ? { src: video.currentSrc || video.src, currentTime: video.currentTime || 0 } : null,
      frame: frame ? { src: frame.src, box: frame.getBoundingClientRect().height } : null,
      drawn: !!(document.querySelector('canvas, svg, img')),
      links: [...document.querySelectorAll('a[href]')].map((a) => a.href).filter((h) => /^https?:\/\//.test(h)).slice(0, 24),
    };
  });
  if (obs.audio) {
    const played = await page.evaluate(async () => {
      const a = document.querySelector('audio[data-exam-audio]'); if (!a) return null;
      a.muted = true;
      try { await a.play(); } catch (e) { return { currentTime: a.currentTime || 0 }; }
      await new Promise((r) => setTimeout(r, 1200));
      return { currentTime: a.currentTime || 0 };
    }).catch(() => null);
    if (played) obs.audio.currentTime = played.currentTime;
    Object.assign(obs.audio, await headOf(obs.audio.src));
  }
  if (obs.video) Object.assign(obs.video, await headOf(obs.video.src));
  if (obs.frame) Object.assign(obs.frame, await headOf(obs.frame.src));
  obs.ms = Date.now() - t0;
  return obs;
}

function publishRow(domain, ask, judged, holdout) {
  const base = { score: judged.score, failed: judged.failed, ms: ask.ms, note: ask.note };
  if (holdout) return { id: askId(ask.ask), ...base };
  return { ask: ask.ask, from: ask.from || '', ...base };
}

function summarise(rows) {
  const pub = rows.filter((r) => !r.holdout), hold = rows.filter((r) => r.holdout);
  const fails = pub.filter((r) => r.score !== null && r.score < 100).map((r) => ({ ask: r.ask, failed: r.failed, score: r.score }));
  const out = { score: domainScore(pub), of: pub.length, measured: pub.filter((r) => r.score !== null).length, fails };
  if (hold.length) out.holdout = { score: domainScore(hold), of: hold.length, fresh: true, fails: hold.filter((r) => r.score !== null && r.score < 100).map((r) => ({ id: r.id, failed: r.failed, score: r.score })) };
  return out;
}

export async function runExam({ against = 'live', domains = DOMAINS, holdout = true } = {}) {
  const pub = readJson(PUBLIC, {});
  const week = isoWeek(new Date());
  const sealed = holdout ? (process.env.EXAM_HOLDOUT || (existsSync(HOLDOUT) ? readFileSync(HOLDOUT, 'utf8') : '')) : '';
  const hidden = sealed ? holdoutOf(pub, week, sealed) : null;
  let server = null, origin = LIVE;
  if (against === 'local') { server = await serveLocal(); origin = 'http://127.0.0.1:' + server.address().port; }
  const exe = chromePath();
  const browser = await chromium.launch({ executablePath: exe, headless: true, args: ['--autoplay-policy=no-user-gesture-required'] });
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, userAgent: UA });
  await page.route('**/*', (route) => { if (route.request().method() !== 'GET') return route.fulfill({ status: 204, body: '' }); return route.continue(); });
  const rows = {};
  try {
    for (const d of domains) {
      const asks = (pub[d] || []).map((a) => ({ ...a, holdout: false })).concat(((hidden && hidden[d]) || []).map((a) => ({ ...a, holdout: true })));
      rows[d] = [];
      for (const a of asks) {
        const label = a.holdout ? d + ' holdout ' + askId(a.ask) : d + ' ' + a.ask;
        process.stdout.write('· ' + label.slice(0, 90) + '\n');
        await page.setViewportSize(a.narrow ? { width: 320, height: 700 } : { width: 390, height: 844 });
        const cdp = a.slow ? await page.context().newCDPSession(page) : null;
        if (cdp) await cdp.send('Network.emulateNetworkConditions', { offline: false, latency: 1200, downloadThroughput: 40 * 1024, uploadThroughput: 20 * 1024 }).catch(() => {});
        await page.goto(origin + '/', { waitUntil: 'domcontentloaded', timeout: a.slow ? 45000 : 30000 });
        await page.waitForFunction(() => document.documentElement.dataset.skills === 'ready', null, { timeout: 20000 }).catch(() => {});
        if (a.setup) await readCard(page, a.setup);
        const obs = await readCard(page, a.ask);
        if (cdp) await cdp.send('Network.emulateNetworkConditions', { offline: false, latency: 0, downloadThroughput: -1, uploadThroughput: -1 }).catch(() => {});
        const truth = await truthFor(d, a, obs);
        const judged = judge(d, obs, truth);
        if (judged.failed.includes('audio') || judged.failed.includes('episode')) process.stdout.write('  media: ' + mediaLine(obs.audio) + '\n');
        rows[d].push({ ...publishRow(d, { ...a, ms: obs.ms, note: obs.note }, judged, a.holdout), holdout: !!a.holdout });
      }
    }
  } finally {
    await browser.close();
    if (server) await new Promise((r) => server.close(r));
  }
  const prev = readJson(LATEST, null);
  const domainsOut = {};
  for (const d of DOMAINS) {
    if (!rows[d]) { if (prev && prev.domains && prev.domains[d]) domainsOut[d] = prev.domains[d]; continue; }
    domainsOut[d] = summarise(rows[d]);
    if (!domainsOut[d].holdout && prev && prev.domains && prev.domains[d] && prev.domains[d].holdout) {
      domainsOut[d].holdout = { ...prev.domains[d].holdout, fresh: false };
    }
  }
  const scores = Object.fromEntries(DOMAINS.map((d) => [d, domainsOut[d] && domainsOut[d].score]));
  const run = { at: new Date().toISOString(), against, week, scale: SCALE, domains: domainsOut, lowest: lowestDomain(scores) };
  if (domains.length < DOMAINS.length) run.note = 'Remeasured on this run: ' + domains.join(', ') + '. The other domains are the previous run\'s scores.';
  mkdirSync(dirname(LATEST), { recursive: true });
  const saved = readJson(HISTORY, []);
  const history = Array.isArray(saved) ? saved : [];
  history.push(run);
  writeFileSync(LATEST, JSON.stringify(run, null, 2) + '\n');
  writeFileSync(HISTORY, JSON.stringify(history, null, 2) + '\n');
  return { run, prev, history };
}

function table(run) {
  const lines = ['domain          public  holdout  measured  failing'];
  for (const d of DOMAINS) {
    const x = run.domains[d] || {};
    const h = x.holdout ? (x.holdout.fresh === false ? String(x.holdout.score) + '*' : String(x.holdout.score)) : '—';
    lines.push(d.padEnd(16) + String(x.score ?? '—').padEnd(8) + String(h).padEnd(9) + String((x.measured ?? '—') + '/' + (x.of ?? '—')).padEnd(10) + String((x.fails || []).length));
  }
  lines.push('lowest: ' + run.lowest.domain + ' ' + run.lowest.score + '  (' + run.against + ', ' + run.week + ')');
  return lines.join('\n');
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const only = arg('--domains');
  const domains = only ? only.split(',').filter((d) => DOMAINS.includes(d)) : DOMAINS;
  const against = arg('--against') || 'live';
  const { run, prev, history } = await runExam({ against, domains, holdout: !flag('--no-holdout') });
  console.log('\n' + table(run));
  if (prev && prev.domains) {
    const cmp = compareRuns(prev, run);
    if (cmp.rebaseline) console.log('rebaseline: scale ' + (prev.scale || 1) + ' → ' + run.scale + ' (a new scale is a new baseline, not a regression)');
    if (!cmp.ok) {
      const gate = revertAfter(history);
      const what = cmp.drops.map((x) => x.domain + ' ' + x.before + ' → ' + x.after).join('; ');
      if (gate.revert) {
        console.error('regression: ' + what + ' (two runs in a row each dropped by ' + DROP + ' or more; the deploy is reverted)');
        if (process.env.GITHUB_OUTPUT) appendFileSync(process.env.GITHUB_OUTPUT, 'revert=yes\n');
        process.exit(1);
      }
      console.error('regression: ' + what + ' (recorded; a second run in a row that drops by ' + DROP + ' or more reverts the deploy)');
    } else if (cmp.rises.length) console.log('up: ' + cmp.rises.map((x) => x.domain + ' ' + x.before + ' → ' + x.after).join('; '));
  }
}
