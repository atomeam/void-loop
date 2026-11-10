// A free model writes. Hard checks and a listener's scores both have to pass, or nothing is published.
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { FREE_MODEL } from '../void-live-deploy/lib/models.js';
import { featsFrom, parseShow, scriptIssues, parseScores, trendLine } from '../void-live-deploy/lib/show-pipe.js';
import { hookScore } from './video-gate.mjs';
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const SITE = 'https://a-to-mind.com';
export const SCORE_FILE = resolve(root, 'void-live-deploy/studio/scores.json');
const readJson = (p, d) => { try { return JSON.parse(readFileSync(p, 'utf8')); } catch (_) { return d; } };
export const loadScores = () => readJson(SCORE_FILE, { shows: [] });
export const saveScores = (data) => { mkdirSync(dirname(SCORE_FILE), { recursive: true }); writeFileSync(SCORE_FILE, JSON.stringify(data, null, 2) + '\n'); };

async function post(url, body, headers) {
  const r = await fetch(url, { method: 'POST', signal: AbortSignal.timeout(90000), headers: { 'content-type': 'application/json', ...headers }, body: JSON.stringify(body) });
  const j = await r.json().catch(() => ({}));
  return { ok: r.ok, status: r.status, j };
}
async function workers(prompt, env) {
  const key = env.CLOUDFLARE_AI_TOKEN || env.CLOUDFLARE_API_TOKEN;
  if (!key || !env.CLOUDFLARE_ACCOUNT_ID) return null;
  const url = 'https://api.cloudflare.com/client/v4/accounts/' + encodeURIComponent(env.CLOUDFLARE_ACCOUNT_ID) + '/ai/run/' + FREE_MODEL;
  const { ok, status, j } = await post(url, { messages: [{ role: 'user', content: prompt }], max_tokens: 900, chat_template_kwargs: { enable_thinking: false } }, { authorization: 'Bearer ' + key });
  const text = j.result && (j.result.response || (j.result.choices && j.result.choices[0] && j.result.choices[0].message && j.result.choices[0].message.content));
  if (!ok || !text) throw new Error('workers model ' + status);
  return String(text);
}
/** one free completion. Tests pass fetchImpl. */
export async function ask(prompt, { judge = false, env = process.env, fetchImpl = fetch, seed = Date.now() } = {}) {
  const local = await workers(prompt, env).catch(() => null);
  if (local) return local;
  const body = judge
    ? { mode: 'aitext', prompt: prompt.slice(0, 400), seed: seed % 4294967295 }
    : { mode: 'story', length: 'long', genre: 'funny', premise: prompt.slice(0, 600), steer: 'Lines only. Each line starts with Verse: or Critic:. No narrator. Stick to the fact.' };
  const r = await fetchImpl(SITE + '/api/answer', { method: 'POST', signal: AbortSignal.timeout(90000), headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
  const got = await r.json().catch(() => ({}));
  if (!got.text) throw new Error(got.note || got.say || (judge ? 'judge empty' : 'story model empty'));
  return got.text;
}
const SAFE_HOOK = 'What if you could ask for this today?';
export function shortScript(text) {
  const parsed = parseShow(text);
  const lines = parsed.lines.slice(0, 4);
  let hook = lines[0] ? lines[0].text : SAFE_HOOK;
  let beats = lines.slice(1);
  if (hookScore(hook) < 60 || /\bverse\b/i.test(hook)) { hook = SAFE_HOOK; beats = lines.slice(0, 3); }
  const show = { kind: 'short', title: parsed.title || hook.replace(/\?$/, ''), hook, lines: beats };
  const issues = scriptIssues(show, { min: 2, max: 4 });
  if (beats.some((l) => l.text.split(/\s+/).length > 16)) issues.push('too many words');
  return { show, issues };
}
export function episodeScript(text, n) {
  const parsed = parseShow(text);
  let lines = parsed.lines;
  if (lines.length > 10) lines = [...lines.slice(0, 4), ...lines.slice(-6)];
  const show = { kind: 'episode', title: 'Episode ' + n + ': ' + (parsed.title || 'A thing Verse actually did'), hook: lines[0] ? lines[0].text : '', lines };
  return { show, issues: scriptIssues(show, { min: 8, max: 14 }) };
}

function writerPrompt(kind, fact, trend) {
  const rules = ' Do not mention podcasts, microphones, seconds, blood, desks, or leather. The Critic is silly, never cruel. No new scenery. Everyday words.';
  const fix = trend ? ' Fix this: ' + trend.slice(0, 90) : '';
  if (kind === 'short') return ('Exactly four lines. Each starts with Verse: or Critic:. Each line is at most twelve words. Line one is a question of at most eight words and does not say Verse. The Critic guesses wrong. Verse explains this in everyday words: ' + fact + ' Last line, Verse invites people to ask for anything.' + rules + fix).slice(0, 600);
  return ('Title: four plain words. Then exactly eight lines. Each starts with Verse: or Critic:. The Critic scoffs at the idea. Verse explains this true thing as a short story: ' + fact + ' One line is a chapter title. The Critic admits he was wrong. Verse invites people to ask for anything at a-to-mind.com.' + rules + fix).slice(0, 600);
}
function judgePrompt(show) {
  const bit = [show.hook, ...show.lines.map((l) => l.who + ': ' + l.text)].join(' ').slice(0, 160);
  return ('Rate the show as a curious listener. Four lines, each a label, a colon, and a whole number from one to ten. Labels are Clarity, Originality, Entertainment, Impressive. Then Notes and a colon and one honest sentence. Show: ' + bit).slice(0, 400);
}
/** write once, judge, rewrite once if it fails. Returns { show, scores }. */
export async function writeShow(kind, fact, { n = 1, trend = '', env, fetchImpl, seed } = {}) {
  let last = '';
  for (let i = 0; i < 2; i++) {
    const prompt = writerPrompt(kind, fact, i ? last : trend);
    const text = await ask(prompt, { env, fetchImpl, seed: (seed || Date.now()) + i });
    const made = kind === 'short' ? shortScript(text) : episodeScript(text, n);
    if (made.issues.length) { last = made.issues.join(', '); continue; }
    const judged = parseScores(await ask(judgePrompt(made.show), { judge: true, env, fetchImpl, seed: (seed || Date.now()) + 20 + i }));
    if (!judged.pass) { last = judged.notes || 'too thin'; continue; }
    return { show: made.show, scores: judged, fact };
  }
  throw new Error('not published: ' + (last || 'the model missed'));
}

export function recordScore(kind, title, scores, fact) {
  const data = loadScores();
  data.shows.push({ at: new Date().toISOString(), kind, title, fact, ...scores });
  saveScores(data);
  return data;
}

export async function filmShort(made, out, filmId) {
  const { render } = await import('./film-studio.mjs');
  const beats = made.show.lines.map((l) => ({ kind: 'title', who: l.who, text: (l.who === 'Critic' ? 'CRITIC' : 'VERSE') + '\n' + l.text, voice: l.text }));
  const script = { format: 'explainer', label: 'Verse short', topic: made.show.title, name: made.show.title.slice(0, 40), hook: made.show.hook, mood: 'bright', theme: 'explainer', voiced: true, beats };
  const meta = await render(script, out, { filmId, topic: { page: SITE + '/', source: 'Verse', url: SITE + '/' } });
  spawnSync('ffmpeg', ['-y', '-loglevel', 'error', '-ss', '1', '-i', resolve(out, filmId + '.mp4'), '-frames:v', '1', resolve(out, filmId + '.jpg')]);
  return meta;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const arg = (k) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : ''; };
  const growth = readJson(resolve(root, 'void-live-deploy/void.growth.json'), []);
  const feats = featsFrom(growth);
  if (!feats.length) { console.error('no plain feat to tell'); process.exit(1); }
  if (process.argv[2] === 'shorts') {
    const out = resolve(arg('--out') || resolve(root, 'void-live-deploy/studio/media'));
    mkdirSync(out, { recursive: true });
    const made = [];
    for (let i = 0; i < 2; i++) {
      const trend = trendLine(loadScores().shows);
      const one = await writeShow('short', feats[i % feats.length], { trend });
      const id = new Date().toISOString().slice(0, 10).replace(/-/g, '') + '-verse-' + (i + 1);
      const meta = await filmShort(one, out, id);
      if (!meta.gate.pass) { console.error('GATE FAIL ' + id + ' ' + meta.gate.checks.filter((c) => !c.ok).map((c) => c.name + ': ' + c.detail).join(' | ')); process.exit(1); }
      recordScore('short', one.show.title, one.scores, one.fact);
      made.push({ id, title: one.show.title, file: id + '.mp4', scores: one.scores, fact: one.fact });
      console.log('SHORT ' + id + ' ' + JSON.stringify(one.scores));
    }
    writeFileSync(resolve(root, 'void-live-deploy/studio/shows.json'), JSON.stringify({ shorts: made }, null, 2) + '\n');
  } else if (process.argv[2] === 'feats') console.log(feats.join('\n'));
  else { console.error('usage: node tools/show-pipe.mjs shorts [--out dir] | feats'); process.exit(2); }
}
