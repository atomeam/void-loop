#!/usr/bin/env node
// Verse's studio (owner, 2026-11-20: nothing new since Nov 10; "what's already up is terrible quality"; keep the strict judge and make
// the work good enough to pass it). One true story a day, told by two hosts, judged before anyone hears it:
//   node tools/studio-make.mjs episode [--dry]              Verse Out Loud: mp3, transcript, episodes.json, rss.xml (only on a pass)
//   node tools/studio-make.mjs short --out media/shorts     a 30-60 s vertical film: <id>.mp4, .jpg, .json (gate.pass only on a pass)
//   node tools/studio-make.mjs calibrate                    does today's judge separate the bad fixtures from the good one
// 1. The story: Wikipedia's featured feed for today (the featured article and "on this day"; CC BY-SA 4.0, named in the notes), a topic
//    not told before (studio/scores.json), no deaths, wars, crime or politics. Facts come only from the article text.
// 2. The writer: a strong free model (Groq first, then Workers AI, then Gemini). Our own words and Wikipedia's only, never a visitor's.
// 3. The judge, unchanged in its bar (tools/show-judge.mjs): today the bad fixtures must score under 6 and the good one 6+, or nothing
//    publishes; then this show's minimum over the three blind questions must be 6+, the listener check 6+, and the hard checks
//    (lib/show-pipe.js hardShow) clean. A film must also pass tools/video-gate.mjs. Nothing fails open.
// 4. The craft: Kokoro voices (af_heart and am_michael), each line levelled, real gaps between turns, a piano bed from the CC0 Steinway
//    samples (tools/studio_mix.py) ducked under speech; a film adds a picture per line (Pollinations, free), slow push and pan, cross
//    fades, word-timed captions in the safe zone and an end card. Cost: $0 a run (free tiers; ffmpeg and Kokoro on the runner).
import { readFileSync, writeFileSync, mkdirSync, mkdtempSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { hardShow } from '../void-live-deploy/lib/show-pipe.js';
import { GEMINI_MODELS } from '../void-live-deploy/lib/models.js';
import { calibrate, blindMin } from './show-judge.mjs';
import { loadScores, saveScores } from './show-pipe.mjs';

const here = dirname(fileURLToPath(import.meta.url)), root = resolve(here, '..');
const POD = resolve(root, 'void-live-deploy/podcast');
const UA = 'VerseStudio/1.0 (https://a-to-mind.com; verse@a-to-mind.com)';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
export const VOICES = Object.freeze({ Verse: { id: 'af_heart', lang: 'en-us', speed: 1.0 }, Critic: { id: 'am_michael', lang: 'en-us', speed: 0.97 } });
export const WRITE_PREF = ['moonshotai/kimi-k2-instruct-0905', 'moonshotai/kimi-k2-instruct', 'openai/gpt-oss-120b', 'llama-3.3-70b-versatile'];
export const JUDGE_PREF = ['openai/gpt-oss-120b', 'llama-3.3-70b-versatile', 'moonshotai/kimi-k2-instruct-0905', 'moonshotai/kimi-k2-instruct'];
export const AVOID = /\b(died|death|killed|murder|massacre|war|battle|bomb|attack|terror|genocide|disaster|crash|shooting|election|president|party|abuse|sex|suicide|execution|riot|invasion|assassinat)/i;

const clean = (t) => String(t || '').replace(/<think>[\s\S]*?<\/think>/gi, '').trim();
let groqList = null;
/** one completion from the strongest free model that answers. Throws when none does: the studio never falls back to a weak one. */
export async function llm(messages, { max = 4000, temperature = 0.8, prefer = WRITE_PREF, env = process.env, fetchImpl = fetch } = {}) {
  const tried = [];
  if (env.GROQ_API_KEY) {
    const auth = { authorization: 'Bearer ' + env.GROQ_API_KEY, 'content-type': 'application/json' };
    if (!groqList) groqList = await fetchImpl('https://api.groq.com/openai/v1/models', { headers: auth }).then((r) => r.json()).then((j) => new Set((j.data || []).map((m) => m.id))).catch(() => null);
    for (const model of groqList ? prefer.filter((m) => groqList.has(m)) : prefer) {
      for (let t = 0; t < 4; t++) {
        const body = { model, messages, temperature, max_completion_tokens: max, ...(/gpt-oss/.test(model) ? { reasoning_effort: temperature === 0 ? 'low' : 'medium', include_reasoning: false } : {}) };
        const r = await fetchImpl('https://api.groq.com/openai/v1/chat/completions', { method: 'POST', headers: auth, body: JSON.stringify(body), signal: AbortSignal.timeout(180000) }).catch((e) => ({ ok: false, status: String(e.name) }));
        if (r.status === 429) { await sleep(1000 * Math.min(60, Number(r.headers.get('retry-after')) || 20)); continue; }
        const j = r.json ? await r.json().catch(() => ({})) : {};
        const text = clean(j.choices && j.choices[0] && j.choices[0].message && j.choices[0].message.content);
        if (r.ok && text) return { text, via: 'Groq ' + model };
        tried.push('Groq ' + model + ' ' + r.status); break;
      }
    }
  }
  for (const key of [env.CLOUDFLARE_AI_TOKEN, env.CLOUDFLARE_API_TOKEN2, env.CLOUDFLARE_API_TOKEN].filter(Boolean)) {
    if (!env.CLOUDFLARE_ACCOUNT_ID) break;
    const url = 'https://api.cloudflare.com/client/v4/accounts/' + encodeURIComponent(env.CLOUDFLARE_ACCOUNT_ID) + '/ai/run/@cf/openai/gpt-oss-120b';
    const r = await fetchImpl(url, { method: 'POST', headers: { authorization: 'Bearer ' + key, 'content-type': 'application/json' }, body: JSON.stringify({ messages, max_tokens: max, temperature }), signal: AbortSignal.timeout(180000) }).catch(() => ({ ok: false, status: 'net' }));
    const j = r.json ? await r.json().catch(() => ({})) : {}, res = j.result || {};
    const out = Array.isArray(res.output) ? res.output.filter((o) => o.type === 'message').flatMap((o) => o.content || []).map((c) => c.text).join('') : '';
    const text = clean(res.response || (res.choices && res.choices[0] && res.choices[0].message && res.choices[0].message.content) || out);
    if (r.ok && text) return { text, via: 'Workers AI gpt-oss-120b' };
    tried.push('Workers AI ' + r.status);
  }
  if (env.GEMINI_API_KEY) for (const model of GEMINI_MODELS) {
    const sys = messages.filter((m) => m.role === 'system').map((m) => m.content).join('\n');
    const body = { contents: messages.filter((m) => m.role !== 'system').map((m) => ({ role: m.role === 'assistant' ? 'model' : 'user', parts: [{ text: m.content }] })), ...(sys ? { systemInstruction: { parts: [{ text: sys }] } } : {}), generationConfig: { temperature, maxOutputTokens: max } };
    const r = await fetchImpl('https://generativelanguage.googleapis.com/v1beta/models/' + model + ':generateContent', { method: 'POST', headers: { 'x-goog-api-key': env.GEMINI_API_KEY, 'content-type': 'application/json' }, body: JSON.stringify(body), signal: AbortSignal.timeout(180000) }).catch(() => ({ ok: false, status: 'net' }));
    const j = r.json ? await r.json().catch(() => ({})) : {};
    const text = clean((((j.candidates || [])[0] || {}).content || { parts: [] }).parts.map((p) => p.text || '').join(''));
    if (r.ok && text) return { text, via: 'Gemini ' + model };
    tried.push('Gemini ' + model + ' ' + r.status);
  }
  throw new Error('no strong model answered (' + (tried.join('; ') || 'no model key set: GROQ_API_KEY, a Cloudflare AI token or GEMINI_API_KEY') + ')');
}
/** the first JSON object in a reply. Pure. */
export function jsonOf(text) {
  const t = String(text || ''), a = t.indexOf('{'), b = t.lastIndexOf('}');
  if (a < 0 || b < a) return null;
  try { return JSON.parse(t.slice(a, b + 1)); } catch (_) { return null; }
}

/** today's true-story candidates from Wikipedia's featured feed. */
export async function candidates(day = new Date(), fetchImpl = fetch) {
  const p = (n) => String(n).padStart(2, '0');
  const url = 'https://api.wikimedia.org/feed/v1/wikipedia/en/featured/' + day.getUTCFullYear() + '/' + p(day.getUTCMonth() + 1) + '/' + p(day.getUTCDate());
  const j = await fetchImpl(url, { headers: { 'user-agent': UA, 'api-user-agent': UA } }).then((r) => r.json());
  const title = (x) => x && (x.normalizedtitle || (x.titles && x.titles.normalized));
  const out = [];
  if (j.tfa) out.push({ kind: 'featured article', title: title(j.tfa), extract: j.tfa.extract, url: j.tfa.content_urls && j.tfa.content_urls.desktop.page });
  for (const e of j.onthisday || []) for (const pg of (e.pages || []).slice(0, 2)) out.push({ kind: 'on this day, ' + e.year, event: e.text, title: title(pg), extract: pg.extract, url: pg.content_urls && pg.content_urls.desktop.page });
  return out.filter((c) => c.title && c.url && String(c.extract || '').length > 200 && !AVOID.test(c.title + ' ' + (c.event || '') + ' ' + c.extract.slice(0, 300)));
}
/** the article's own text, up to 7000 characters: the only facts a script may use. */
export async function articleText(title, fetchImpl = fetch) {
  const u = 'https://en.wikipedia.org/w/api.php?action=query&prop=extracts&explaintext=1&exsectionformat=plain&exchars=7000&redirects=1&format=json&formatversion=2&titles=' + encodeURIComponent(title);
  const j = await fetchImpl(u, { headers: { 'user-agent': UA } }).then((r) => r.json());
  return String((((j.query || {}).pages || [])[0] || {}).extract || '').replace(/\n{2,}/g, '\n').trim();
}
export async function pickStory({ env, fetchImpl = fetch, used = new Set() } = {}) {
  const all = (await candidates(new Date(), fetchImpl)).filter((c) => !used.has(c.title)).slice(0, 24);
  if (!all.length) throw new Error('no new story in today\'s featured feed');
  const list = all.map((c, i) => (i + 1) + '. ' + c.title + ' (' + c.kind + '): ' + c.extract.slice(0, 220).replace(/\s+/g, ' ')).join('\n');
  const r = await llm([{ role: 'user', content: 'You pick the story for a short, funny two-host show for a general audience. Pick the one most people would find surprising, delightful and worth telling a friend about. Avoid tragedies, violence, politics, religion disputes and anything sad. Reply with the number only.\n\n' + list }], { max: 400, temperature: 0, prefer: JUDGE_PREF, env, fetchImpl });
  const n = Number((String(r.text).match(/\d+/) || [1])[0]);
  const c = all[Math.max(0, Math.min(all.length - 1, n - 1))];
  return { ...c, text: (await articleText(c.title, fetchImpl)) || c.extract };
}

const SHAPE = {
  episode: { lines: '30 to 38', words: '700 to 1000', min: 24 },
  short: { lines: '8 to 11', words: '100 to 140', min: 6 },
};
export function writerPrompt(kind, story, fix = '') {
  const s = SHAPE[kind];
  const sys = 'You write "Verse Out Loud", a two-host comedy show about one true story, in the spirit of the best panel and two-host shows: quick, warm, curious, genuinely funny. VERSE tells the story and loves the surprising details. CRITIC is dry, skeptical and funny; he doubts everything, guesses wrong, and has one running joke that pays off at the end. They talk like real people: short reactions, interruptions, a joke with a setup and a payoff, a twist the listener did not see coming. Every fact, name, date and number must come from the SOURCE text; never invent a quote or a number. Use at least three real numbers from the SOURCE. Plain everyday words, no lists, no narration, no stage directions, no sound effects, no emoji.';
  const rules = [
    'Exactly ' + s.lines + ' lines, ' + s.words + ' words in total, alternating speakers almost every line (both speak).',
    kind === 'short' ? 'Line 1 is a hook question of at most 8 words that uses the word "you", and does not say Verse or AI.' : 'Line 1 is a cold-open hook question of at most 20 words.',
    'Each line picks up at least one real word (4+ letters) from the line right before it, the way people answer each other.',
    'The last three lines call back to a word from line 1. The very last line, by VERSE, invites people to ask Verse for anything at a-to-mind.com.',
    kind === 'short' ? 'For each line also write "scene": a vivid, concrete picture for that moment (setting, subject, light), photographic, no text, no logos, no real living person\'s face.' : 'Give the episode a title of at most 6 words and a one-sentence summary.',
  ];
  const shape = kind === 'short' ? '{"title":"...","summary":"...","lines":[{"who":"Verse|Critic","text":"...","scene":"..."}]}' : '{"title":"...","summary":"...","lines":[{"who":"Verse|Critic","text":"..."}]}';
  const user = 'SOURCE (Wikipedia, "' + story.title + '"' + (story.event ? '; on this day: ' + story.event : '') + '):\n' + story.text.slice(0, 6500) + '\n\nRULES:\n- ' + rules.join('\n- ') + (fix ? '\n\nThe last draft failed these checks, fix them: ' + fix : '') + '\n\nReply with JSON only: ' + shape;
  return [{ role: 'system', content: sys }, { role: 'user', content: user }];
}
/** the hard checks this studio adds to hardShow, as words the writer can act on. Pure. */
export function draftIssues(show, kind) {
  const out = [...hardShow(show, { kind })];
  const lines = show.lines || [];
  if (kind === 'short') {
    const hook = (lines[0] || {}).text || '';
    if (!/\?\s*$/.test(hook) || hook.split(/\s+/).length > 8 || !/\byou\b/i.test(hook) || /\b(verse|ai)\b/i.test(hook)) out.push('line 1 must be a question of at most 8 words with "you" and without Verse or AI');
    if (lines.some((l) => !l.scene)) out.push('every line needs a scene');
  }
  if (!/a-to-mind\.com/.test((lines[lines.length - 1] || {}).text || '')) out.push('the last line must invite people to a-to-mind.com');
  if (lines.some((l) => !['Verse', 'Critic'].includes(l.who))) out.push('who must be Verse or Critic');
  return out;
}
export async function writeShow(kind, story, { env, fetchImpl } = {}) {
  let fix = '', last = null;
  for (let i = 0; i < 4; i++) {
    const r = await llm(writerPrompt(kind, story, fix), { max: kind === 'episode' ? 6000 : 3000, temperature: 0.85, env, fetchImpl });
    const j = jsonOf(r.text);
    if (!j || !Array.isArray(j.lines)) { fix = 'the reply was not the JSON asked for'; continue; }
    const show = { kind, title: String(j.title || story.title).slice(0, 80), summary: String(j.summary || ''), lines: j.lines.map((l) => ({ who: /critic/i.test(l.who) ? 'Critic' : 'Verse', text: String(l.text || '').replace(/\s+/g, ' ').trim(), ...(l.scene ? { scene: String(l.scene).slice(0, 300) } : {}) })).filter((l) => l.text), via: r.via };
    show.hook = show.lines[0] ? show.lines[0].text : '';
    const issues = draftIssues(show, kind);
    last = { show, issues };
    console.error('draft ' + (i + 1) + ' (' + r.via + '): ' + show.lines.length + ' lines' + (issues.length ? ', fix: ' + issues.join(', ') : ', clean'));
    if (!issues.length) return show;
    fix = issues.join('; ') + (issues.includes('does not follow') ? ' (lines must pick up a word from the line before)' : '') + (issues.includes('length') ? ' (stay inside the line and word counts)' : '');
  }
  throw new Error('not published: no draft passed the hard checks (' + (last ? last.issues.join(', ') : 'no draft') + ')');
}

/** the strict judge: calibration first, then the blind minimum and the listener, all on the whole script. */
export async function judge(show, kind, { env, fetchImpl, gap = 2500 } = {}) {
  let via = '';
  const askImpl = async (prompt) => { const r = await llm([{ role: 'user', content: prompt }], { max: 1500, temperature: 0, prefer: JUDGE_PREF, env, fetchImpl }); via = r.via; return r.text; };
  const cal = await calibrate({ askImpl, gap, maxChars: 24000 });
  const text = show.lines.map((l) => l.who + ': ' + l.text).join(' ');
  const out = { separated: cal.separated, calibration: cal.rows.map((r) => ({ id: r.id, kind: r.kind, min: r.min, scores: r.scores })), issues: hardShow(show, { kind }) };
  if (cal.separated) {
    const b = await blindMin(text, { askImpl, gap, maxChars: 24000 });
    out.blind = { min: b.min, scores: b.scores, notes: b.notes };
    const h = await askImpl('A normal listener. Human 2 only when a line does not answer the line before it. Human 7 when each line answers the last one and a real number is kept. Reply Human: N and Notes: one sentence. Show: ' + text);
    const m = String(h).match(/human\D{0,8}(10|[1-9])/i);
    out.human = m ? +m[1] : 0; out.humanNotes = String(h).replace(/\s+/g, ' ').slice(0, 220);
  }
  out.via = via;
  out.pass = !!(out.separated && out.blind && out.blind.min >= 6 && out.human >= 6 && !out.issues.length);
  return out;
}

const usedTitles = () => new Set((loadScores().shows || []).filter((s) => s.studio && s.pass).map((s) => s.source && s.source.title).filter(Boolean));
function keepScore(kind, show, story, verdict, extra = {}) {
  const data = loadScores();
  data.shows.push({ at: new Date().toISOString(), studio: true, kind, title: show ? show.title : '', source: story ? { title: story.title, url: story.url } : null, pass: !!(verdict && verdict.pass), writer: show && show.via, judge: verdict, ...extra });
  saveScores(data);
}
const credit = (story) => 'Facts from Wikipedia, "' + story.title + '" (' + story.url + '), CC BY-SA 4.0.';
async function makeEpisode({ dry = false, env = process.env } = {}) {
  const av = await import('./studio-av.mjs');
  const story = await pickStory({ env, used: usedTitles() });
  console.log('story: ' + story.title + ' (' + story.url + ')');
  const show = await writeShow('episode', story, { env });
  const verdict = await judge(show, 'episode', { env });
  console.log('judge: ' + JSON.stringify({ pass: verdict.pass, separated: verdict.separated, blind: verdict.blind && verdict.blind.scores, human: verdict.human, issues: verdict.issues, via: verdict.via }));
  if (!dry) keepScore('episode', show, story, verdict);
  if (!verdict.pass) { console.log('not published: the judge did not pass it'); return 1; }
  const data = JSON.parse(readFileSync(join(POD, 'episodes.json'), 'utf8'));
  const n = Math.max(0, ...data.episodes.map((e) => e.n)) + 1, base = 'verse-out-loud-' + String(n).padStart(3, '0');
  const dir = mkdtempSync(join(tmpdir(), 'studio-')), mp3 = join(dry ? dir : POD, base + '.mp3');
  const voiced = av.speak(show.lines, VOICES, dir);
  const mixed = av.mixShow(voiced, mp3, { kind: 'episode', dir, seed: n });
  if (dry) { console.log('dry: ' + mp3 + ' ' + Math.round(mixed.seconds) + ' s'); return 0; }
  const transcript = show.lines.map((l) => l.who + ': ' + l.text).join('\n\n') + '\n\n' + credit(story) + '\n';
  writeFileSync(join(POD, base + '.txt'), transcript);
  data.episodes.push({ n, title: 'Episode ' + n + ': ' + show.title, pub: new Date().toISOString(), file: base + '.mp3', transcript: base + '.txt', bytes: statSync(mp3).size, seconds: Math.round(mixed.seconds),
    summary: show.summary + ' ' + credit(story), source: { title: story.title, url: story.url, license: 'CC BY-SA 4.0' }, writer: show.via, voices: { Verse: VOICES.Verse.id, Critic: VOICES.Critic.id },
    scores: { pass: true, separated: verdict.separated, blind: verdict.blind, human: verdict.human, judge: verdict.via }, lines: mixed.lines.map((l) => ({ who: l.who, text: l.text, t: +l.at.toFixed(1) })) });
  writeFileSync(join(POD, 'episodes.json'), JSON.stringify(data, null, 1) + '\n');
  const { rss } = await import('./podcast.mjs');
  writeFileSync(join(POD, 'rss.xml'), rss(data.episodes));
  console.log('published: episode ' + n + ', ' + Math.round(mixed.seconds) + ' s, ' + base + '.mp3');
  return 0;
}
async function makeShort({ out = 'media/shorts', env = process.env } = {}) {
  const av = await import('./studio-av.mjs');
  const { gate } = await import('./video-gate.mjs');
  const story = await pickStory({ env, used: usedTitles() });
  console.log('story: ' + story.title + ' (' + story.url + ')');
  const show = await writeShow('short', story, { env });
  const verdict = await judge(show, 'short', { env });
  console.log('judge: ' + JSON.stringify({ pass: verdict.pass, separated: verdict.separated, blind: verdict.blind && verdict.blind.scores, human: verdict.human, issues: verdict.issues, via: verdict.via }));
  if (!verdict.pass) { keepScore('short', show, story, verdict); console.log('not filmed: the judge did not pass it'); return 1; }
  mkdirSync(out, { recursive: true });
  const day = new Date().toISOString().slice(0, 10).replace(/-/g, ''), slug = story.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40), id = 'studio-' + day + '-' + slug;
  const dir = mkdtempSync(join(tmpdir(), 'studio-')), wav = join(dir, 'final.wav'), mp4 = resolve(out, id + '.mp4');
  const voiced = av.speak(show.lines, VOICES, dir);
  const mixed = av.mixShow(voiced, wav, { kind: 'short', dir, seed: Number(day) % 1000 });
  const pics = await av.pictures(show, dir);
  const made = av.film(show, mixed.lines, mixed.seconds, pics, wav, mp4, dir);
  const meta = { filmId: id, kind: 'show', format: 'show', title: show.title, hook: show.hook, voice: true, captions: made.captions, speech: mixed.lines.map((l) => ({ from: l.at, to: l.end })),
    footage: { kind: 'studio', source: story.url }, description: show.summary + '\n\n' + credit(story) + ' Pictures made with Pollinations. Voices: Kokoro. Music: Verse, from CC0 Steinway samples.\n\nAsk Verse for anything, free: https://a-to-mind.com/',
    tags: ['Verse', 'true story', story.title], lines: show.lines, judge: verdict, writer: show.via };
  meta.gate = gate(mp4, meta);
  for (const c of meta.gate.checks) console.log((c.ok ? 'pass ' : 'FAIL ') + c.name.padEnd(9) + c.detail);
  meta.gate.pass = meta.gate.pass && verdict.pass;
  writeFileSync(resolve(out, id + '.json'), JSON.stringify(meta, null, 2) + '\n');
  keepScore('short', show, story, verdict, { film: id, gate: { pass: meta.gate.pass, failed: meta.gate.checks.filter((c) => !c.ok).map((c) => c.name) } });
  console.log((meta.gate.pass ? 'filmed and passed: ' : 'filmed, gate failed: ') + mp4 + ' (' + mixed.seconds.toFixed(1) + ' s, ' + made.bytes + ' bytes)');
  return meta.gate.pass ? 0 : 1;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const cmd = process.argv[2], arg = (k, d) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : d; };
  const go = cmd === 'episode' ? () => makeEpisode({ dry: process.argv.includes('--dry') })
    : cmd === 'short' ? () => makeShort({ out: arg('--out', 'media/shorts') })
    : cmd === 'calibrate' ? async () => { let via = ''; const c = await calibrate({ askImpl: async (p) => { const r = await llm([{ role: 'user', content: p }], { max: 1500, temperature: 0, prefer: JUDGE_PREF }); via = r.via; return r.text; }, gap: 2500, maxChars: 24000 }); console.log(JSON.stringify({ via, separated: c.separated, rows: c.rows.map((r) => ({ id: r.id, kind: r.kind, min: r.min, scores: r.scores })) })); return c.separated ? 0 : 1; }
    : null;
  if (!go) { console.error('usage: node tools/studio-make.mjs episode [--dry] | short [--out dir] | calibrate'); process.exit(2); }
  go().then((code) => process.exit(code), (e) => { console.log('not published: ' + (e && e.message || e)); process.exit(1); });
}
