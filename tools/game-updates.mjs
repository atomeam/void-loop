// The game lap: play the round the book names, then write the row. node tools/game-updates.mjs play <id>
import { createServer } from 'node:http';
import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync } from 'node:fs';
import { dirname, extname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { tmpdir } from 'node:os';
import { BOOK, PUBLIC_BOOK, BAR_ID, CATALOG, applyUpdate, bornFrom, decide, emptyBook, funOf, gamesOf, gapOf, inventPrompt, nextTask, promptFor, readWhatsNew, scoreFrom, withBar, PARTS } from '../void-live-deploy/lib/game-updates.js';
import { models, VISION_FALLBACK } from '../void-live-deploy/lib/models.js';
import { askFree } from './judgment.mjs';
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png' };
const NOISE = /favicon|AudioContext|net::ERR|Failed to load resource|404/;
export const loadBook = (cwd = root) => { try { return JSON.parse(readFileSync(join(cwd, BOOK), 'utf8')); } catch (_) { return emptyBook(); } };
export function saveBook(book, cwd = root) {
  const text = JSON.stringify(book, null, 1) + '\n';
  for (const p of [BOOK, PUBLIC_BOOK]) { mkdirSync(dirname(join(cwd, p)), { recursive: true }); writeFileSync(join(cwd, p), text); }
}
export function gameTask(cwd = root) {
  const task = nextTask(loadBook(cwd));
  if (task.kind === 'invent') return { kind: 'invent', title: 'Game update: a new original game, Update 1', text: inventPrompt(), update: 1 };
  return task;
}
const serve = (dir) => new Promise((ok) => {
  const server = createServer((req, res) => {
    let path = decodeURIComponent(new URL(req.url, 'http://127.0.0.1').pathname);
    if (path.endsWith('/')) path += 'index.html';
    const abs = join(dir, path.replace(/^\/+/, ''));
    if (!abs.startsWith(dir + '/') || !existsSync(abs)) { res.writeHead(404); res.end('missing'); return; }
    res.writeHead(200, { 'content-type': TYPES[extname(abs)] || 'application/octet-stream' });
    res.end(readFileSync(abs));
  });
  server.listen(0, '127.0.0.1', () => ok(server));
});
// playwright-core loads only when a lap plays. Tests of the book import this file and have no browser.
export async function playGame(game, { cwd = root, ms = 70000, outDir = '' } = {}) {
  const dir = outDir || join(tmpdir(), 'game-play-' + game.id);
  mkdirSync(dir, { recursive: true });
  const server = await serve(join(cwd, 'void-live-deploy'));
  const origin = 'http://127.0.0.1:' + server.address().port;
  const file = '/skills/' + String(game.file).split('/').pop();
  const url = game.play === 'arcade' ? origin + '/arcade/?play=' + encodeURIComponent(game.id) : game.play === 'harness' ? origin + '/arcade/harness.html?file=' + encodeURIComponent(file) : origin + '/?q=' + encodeURIComponent(game.ask);
  let browser, context; const errors = [];
  try {
    const { chromium } = await import('playwright-core');
    browser = await chromium.launch({ headless: true, executablePath: process.env.VOID_TEST_BROWSER || undefined, args: ['--no-sandbox'] });
    context = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, recordVideo: { dir, size: { width: 390, height: 844 } } });
    const page = await context.newPage();
    page.on('pageerror', (e) => errors.push(String(e.message || e)));
    page.on('console', (m) => { if (m.type() === 'error' && !NOISE.test(m.text())) errors.push(m.text()); });
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 45000 });
    await page.screenshot({ path: join(dir, 'start.png') }).catch(() => {});
    for (let t = Date.now() + ms; Date.now() < t;) { await page.keyboard.press('Space').catch(() => {}); await page.keyboard.press('ArrowRight').catch(() => {}); await page.touchscreen.tap(80, 600).catch(() => {}); await page.waitForTimeout(500); }
    await page.screenshot({ path: join(dir, 'end.png') }).catch(() => {});
    return { broken: errors.length ? errors[0].slice(0, 180) : '', text: String(await page.locator('body').innerText().catch(() => '')).slice(0, 400), shots: [join(dir, 'start.png'), join(dir, 'end.png')], video: page.video() ? await page.video().path() : '', dir };
  } catch (e) { return { broken: String(e.message || e).slice(0, 180), text: '', shots: [], video: '', dir }; }
  finally { if (context) await context.close().catch(() => {}); if (browser) await browser.close().catch(() => {}); server.close(); }
}
export function readScore(raw) {
  let o = null; try { o = JSON.parse((String(raw || '').match(/\{[\s\S]*\}/) || [])[0]); } catch (_) { return null; }
  if (!o) return null;
  const parts = {}; for (const k of PARTS) if (o[k] != null) parts[k] = o[k];
  return Object.keys(parts).length ? { score: scoreFrom(parts), why: String(o.why || '').slice(0, 160), parts } : null;
}
const textOf = (j) => { if (!j || typeof j !== 'object') return ''; const choice = j.choices && j.choices[0] && j.choices[0].message && j.choices[0].message.content; const nested = j.result && (typeof j.result === 'string' ? j.result : j.result.response || j.result.description); const t = j.response || nested || choice || ''; return typeof t === 'string' ? t.trim() : ''; };
async function askVision(prompt, shots, { env, fetchFn }) {
  const token = env.CLOUDFLARE_AI_TOKEN || env.CLOUDFLARE_API_TOKEN;
  if (!token || !env.CLOUDFLARE_ACCOUNT_ID) return { text: '', frames: 0 };
  const frames = [];
  for (const p of (shots || []).slice(0, 2)) { try { const b = readFileSync(p); if (b.length && b.length < 500000) frames.push(b); } catch (_) { /* a missing frame is not a picture */ } }
  if (!frames.length) return { text: '', frames: 0 };
  const base = 'https://api.cloudflare.com/client/v4/accounts/' + encodeURIComponent(env.CLOUDFLARE_ACCOUNT_ID) + '/ai/run/';
  const headers = { authorization: 'Bearer ' + token, 'content-type': 'application/json' };
  const ask = async (model, body) => {
    const r = await fetchFn(base + model, { method: 'POST', headers, body: JSON.stringify(body) });
    let j = {}; try { j = await r.json(); } catch (_) { j = {}; }
    return r && r.ok ? textOf(j) : '';
  };
  const content = [{ type: 'text', text: prompt }, ...frames.map((b) => ({ type: 'image_url', image_url: { url: 'data:image/png;base64,' + b.toString('base64') } }))];
  let text = '';
  try { text = await ask(models('vision'), { messages: [{ role: 'user', content }], max_tokens: 300, temperature: 0, chat_template_kwargs: { enable_thinking: false } }); } catch (_) { text = ''; }
  if (!text) { try { text = await ask(VISION_FALLBACK, { image: frames[0].toString('base64'), prompt, max_tokens: 300 }); } catch (_) { text = ''; } }
  return { text, frames: frames.length };
}
export async function judgePlay(play, { env = process.env, fetchFn = fetch, game, note } = {}) {
  const prompt = 'Score this play of ' + (game ? game.title : 'a game') + ' from 0 to 10: danger, goal, boss, juice, phone, fair, end, fun, polish. JSON only. A Debris Field bar is a phone game with a goal, danger, and an ending. New: ' + (note || '') + '. Console: ' + ((play && play.broken) || 'quiet') + '.';
  const seen = await askVision(prompt, (play && play.shots) || [], { env, fetchFn });
  let raw = seen.text;
  if (!raw && seen.frames) raw = await askFree(prompt + ' Screen: ' + ((play && play.text) || '').slice(0, 300), { env, fetchFn });
  const read = readScore(raw);
  return read ? { hold: false, score: read.score, why: read.why || 'scored from the play', cents: 0, frames: seen.frames, parts: read.parts } : { hold: true, score: null, why: 'no score came back', cents: 0, frames: seen.frames, parts: null };
}
/** The play-bot has to run and a model has to score a real frame. A missing score is not a pass. Pure. */
export function gatePlay({ played, judged, before = null, attempt = 1 } = {}) {
  if (!played || played.broken) return { ship: false, retry: attempt < 2, why: played && played.broken ? 'the play broke: ' + played.broken : 'the play-bot did not run' };
  if (!judged || !judged.frames) return { ship: false, retry: attempt < 2, why: 'the play-bot saved no picture' };
  if (judged.hold || !Number.isFinite(+judged.score)) return { ship: false, retry: attempt < 2, why: judged.why || 'no score came back' };
  return decide({ before, score: +judged.score, attempt, hold: false });
}
export function playLink(env = process.env) {
  const repo = String(env.GITHUB_REPOSITORY || ''), run = String(env.GITHUB_RUN_ID || '');
  return /^[\w.-]+\/[\w.-]+$/.test(repo) && /^\d+$/.test(run) ? 'https://github.com/' + repo + '/actions/runs/' + run : '';
}
function newRules(cwd) {
  const dir = join(cwd, 'void-live-deploy/skills');
  return readdirSync(dir).filter((n) => n.endsWith('-rules.js')).map((n) => join(dir, n));
}
export async function acceptGame({ cwd = root, task, attempt = 1, coder = {}, play = playGame, judge = judgePlay, env = process.env } = {}) {
  const known = new Set(gamesOf(loadBook(cwd)).map((g) => g.id));
  let game = task.game, note = '', born = false;
  if (task.kind === 'invent') {
    const found = newRules(cwd).map((f) => bornFrom(readFileSync(f, 'utf8'), f, known)).find((x) => x.game);
    if (!found) return { ship: false, retry: attempt < 2, why: 'no new original game file' };
    game = found.game; note = found.note; born = true;
  } else {
    try { note = readWhatsNew(readFileSync(join(cwd, game.file), 'utf8'), task.update); } catch (_) { note = ''; }
    if (!note) return { ship: false, retry: attempt < 2, why: 'Update ' + task.update + ' is not on the start screen' };
  }
  const played = await play(game, { cwd, ms: Number(env.GAME_PLAY_MS) || 75000, outDir: env.GAME_PLAY_DIR || '' });
  const judged = await judge(played, { env, game, note });
  const before = funOfBook(loadBook(cwd), game.id);
  const d = gatePlay({ played, judged, before, attempt });
  const cents = (+coder.cents || 0) + (+judged.cents || 0);
  return { ...d, game, note, born, cents, paid: !!(coder.paid || cents > 0), provider: coder.provider || '', cursor: task.nextCursor || 0, video: playLink(env), parts: judged.parts || null };
}
const funOfBook = (book, id) => { const s = book.scores && book.scores[id]; return s && Number.isFinite(+s.fun) ? +s.fun : null; };
export function gameDueNow(book, now = Date.now(), everyMs = 50 * 60 * 1000) {
  const last = book && Array.isArray(book.log) && book.log.length ? Date.parse(book.log[book.log.length - 1].at) : 0;
  return !(last > 0) || now - last >= everyMs;
}
export function recordGame(cwd, gate, at = new Date().toISOString()) {
  const book = applyUpdate(loadBook(cwd), gate.game, { fun: gate.score, note: gate.note, at, cents: gate.cents, paid: gate.paid, provider: gate.provider, dropped: !gate.ship, cursor: gate.cursor, born: gate.born, video: gate.video, parts: gate.parts });
  saveBook(book, cwd); return book;
}
/** Play Debris Field once when it has no fun, then name the weakest mark so the coder prompt aims at it. */
export async function aimGame(cwd, task, { env = process.env, play = playGame, judge = judgePlay } = {}) {
  let book = loadBook(cwd);
  let fun = funOf(book, BAR_ID);
  if (!(fun > 0)) {
    const barGame = CATALOG.find((g) => g.id === BAR_ID);
    const played = await play(barGame, { cwd, ms: Number(env.GAME_PLAY_MS) || 75000, outDir: env.GAME_PLAY_DIR || '' });
    const judged = await judge(played, { env, game: barGame, note: 'the public bar' });
    if (played && !played.broken && judged && judged.frames && Number.isFinite(+judged.score)) {
      book = withBar(book, +judged.score, judged.parts);
      saveBook(book, cwd);
      fun = +judged.score;
    }
  }
  let parts = (book.scores[task.game.id] || {}).parts;
  if (!gapOf(parts) && task.game) {
    const played = await play(task.game, { cwd, ms: Number(env.GAME_PLAY_MS) || 75000, outDir: env.GAME_PLAY_DIR || '' });
    const judged = await judge(played, { env, game: task.game, note: '' });
    if (judged && judged.parts) parts = judged.parts;
  }
  const gap = gapOf(parts);
  return { fun, gap: gap ? gap.words : '', text: promptFor(task.game, task.update, parts) };
}
if (process.argv[1] && process.argv[1].endsWith('game-updates.mjs') && process.argv[2] === 'play') {
  const game = CATALOG.find((g) => g.id === (process.argv[3] || 'null-waves'));
  const r = await playGame(game, { ms: Number(process.env.GAME_PLAY_MS) || 70000, outDir: process.env.GAME_PLAY_DIR || join(tmpdir(), 'game-play') });
  console.log(JSON.stringify({ id: game.id, broken: r.broken, video: r.video }));
  process.exit(r.broken ? 1 : 0);
}
