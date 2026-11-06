#!/usr/bin/env node
// Verse's film studio: every kind of short video, about whatever people are watching today (tools/trends.mjs), never one format and
// never only about Verse. Each format is a way people already make Shorts and Reels, done as Verse's own parody of it:
//   news       a breaking-news parody: the desk, the red banner, the headline about today's trend, one real fact, the sign-off
//   trailer    a movie-trailer parody: "In a world..." title cards that build to the trend as the movie's title
//   explainer  "{topic} in 15 seconds": the trend's own Wikipedia facts, one card each
//   pov        a POV skit: the group chat finding out about the trend, bubble by bubble
//   countdown  "3 things to know about {topic}": three facts, counted down
//   nature     a nature-documentary parody: the narrator watching a human discover the trend
//   review     a product-review parody: the trend rated in stars, pros, cons and a verdict
//   lyric      a lyric music video: the trend's words popping on the beat of a Verse-made loop (no voice, the beat is the point)
// Every fact a film states is a sentence of the topic's Wikipedia summary, cited in the film's description; the jokes are the format's
// own lines and never claim anything about a real person (a person's topic gets the fact formats only, tools/topic-gate.mjs).
// The picture is drawn in a headless browser frame by frame (a moving full-bleed background, no bars), 1080x1920, 25 frames a second;
// the voice is Piper (PIPER and PIPER_VOICE, as the podcast uses) or espeak-ng when installed, otherwise the film has music only.
// Every render goes through tools/video-gate.mjs; only a pass is ever posted.
//   node tools/film-studio.mjs formats                                    the formats
//   node tools/film-studio.mjs script --format news --topic-file t.json   print the script a topic gets
//   node tools/film-studio.mjs render --trial trial.json --i 0 [--out media/shorts]   film the trial's i-th film -> <film>.mp4 + <film>.json
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { W, H, SAFE, gate } from './video-gate.mjs';
import { wrap, padExpr, BED_LUFS } from './shorts.mjs';

export const SITE = 'https://a-to-mind.com/';
export const FPS = 25, CSS_W = 432, CSS_H = 768, SCALE = W / CSS_W;
export const MAX_S = 19.5, MIN_S = 7;
const CTA = 'Make any video free\na-to-mind.com';

/** a topic's name as a film says it: its Wikipedia title when it has one, at most 40 characters at a word boundary. Pure. */
export function nameOf(t) {
  const n = String((t && (t.title || t.topic)) || '').replace(/\s*\([^)]*\)\s*/g, ' ').replace(/\s+/g, ' ').trim();
  if (n.length <= 40) return n;
  const cut = n.slice(0, 40); return cut.slice(0, cut.lastIndexOf(' ') > 20 ? cut.lastIndexOf(' ') : 40).trim();
}
/** the facts a film may state: summary sentences without brackets (pronunciations, dates), 20-120 characters. Pure. */
export function factsOf(t) {
  return (t && t.summary ? t.summary : []).map((s) => String(s).replace(/\s*\([^)]*\)/g, '').replace(/\s*\[[^\]]*\]/g, '').replace(/\s+/g, ' ').replace(/\s+([,.;])/g, '$1').trim())
    .filter((s) => s.length >= 20 && s.length <= 120);
}
const lower1 = (s) => String(s || '').replace(/^[A-Z](?=[a-z])/, (c) => c.toLowerCase());

// a beat: { kind, text, voice? } (voice: what is read aloud; the text when absent). kinds: kicker+title, title, fact, bubble-l, bubble-r,
// stars, card. Every format returns { hook, beats, mood, theme, voiced } or null when the topic cannot carry it.
export const FORMATS = {
  news: { label: 'Breaking-news parody', facts: 0, person: false, make(t) {
    const T = nameOf(t), f = factsOf(t)[0] || (t.news ? 'The headline: ' + t.news : t.description ? T + ': ' + t.description + '.' : null);
    if (!f) return null;
    return { hook: 'Why is everyone talking about ' + T + '?', mood: 'bright', theme: 'news', voiced: true, beats: [
      { kind: 'kicker', text: 'BREAKING', voice: 'Breaking news.' },
      { kind: 'title', text: 'The whole internet just found out about ' + T },
      { kind: 'title', text: 'We asked one question: what is ' + T + '?' },
      { kind: 'fact', text: f },
      { kind: 'title', text: 'More at 11. Or right now in your group chat.' }] };
  } },
  trailer: { label: 'Movie-trailer parody', facts: 0, person: false, make(t) {
    const T = nameOf(t);
    return { hook: 'What if ' + T + ' got a movie trailer?', mood: 'calm', theme: 'trailer', voiced: true, beats: [
      { kind: 'title', text: 'In a world...' },
      { kind: 'title', text: 'where everyone is searching for ' + T + '...' },
      { kind: 'title', text: 'one phone. One feed.' },
      { kind: 'title', text: 'And no way to scroll past it.' },
      { kind: 'card', text: T + '\nTHE MOVIE', voice: T + '. The movie.' },
      { kind: 'title', text: 'Coming to your feed today.' }] };
  } },
  explainer: { label: 'Explainer', facts: 2, person: true, make(t) {
    const T = nameOf(t), f = factsOf(t);
    if (f.length < 2) return null;
    return { hook: 'What is ' + T + ', and why now?', mood: 'warm', theme: 'explainer', voiced: true, beats: [
      { kind: 'title', text: T + ' in 15 seconds' }, ...f.slice(0, 3).map((x) => ({ kind: 'fact', text: x })),
      { kind: 'title', text: 'Now you know. Send it to someone who does not.' }] };
  } },
  pov: { label: 'POV skit', facts: 0, person: false, make(t) {
    const T = nameOf(t), d = t.description ? lower1(t.description) : null, f = factsOf(t)[0];
    const answer = d ? 'it is ' + d : f ? f : null;
    if (!answer) return null;
    return { hook: 'POV: your group chat hears about ' + T, mood: 'bright', theme: 'pov', voiced: true, beats: [
      { kind: 'title', text: 'POV: your group chat finds out about ' + T },
      { kind: 'bubble-l', text: 'wait what is ' + T },
      { kind: 'bubble-r', text: answer },
      { kind: 'bubble-l', text: 'since when??' },
      { kind: 'bubble-r', text: 'since today apparently' },
      { kind: 'bubble-l', text: 'ok I am looking it up' }] };
  } },
  countdown: { label: 'Top-3 countdown', facts: 3, person: true, make(t) {
    const T = nameOf(t), f = factsOf(t);
    if (f.length < 3) return null;
    return { hook: '3 facts you missed about ' + T, mood: 'bright', theme: 'countdown', voiced: true, beats: [
      { kind: 'title', text: '3 things to know about ' + T }, ...f.slice(0, 3).map((x, i) => ({ kind: 'fact', text: (3 - i) + '. ' + x, voice: 'Number ' + (3 - i) + '. ' + x })),
      { kind: 'title', text: 'Which one did you know?' }] };
  } },
  nature: { label: 'Nature-documentary parody', facts: 0, person: false, make(t) {
    const T = nameOf(t);
    return { hook: 'Nature documentary: you discovering ' + T + '?', mood: 'calm', theme: 'nature', voiced: true, beats: [
      { kind: 'title', text: 'Here, in its natural habitat...' },
      { kind: 'title', text: 'the human has just heard about ' + T + '.' },
      { kind: 'title', text: 'It types the words into a search bar.' },
      { kind: 'title', text: 'Then it tells every friend it has.' },
      { kind: 'title', text: 'Truly, nature is remarkable.' }] };
  } },
  review: { label: 'Product-review parody', facts: 0, person: false, make(t) {
    const T = nameOf(t), pro = t.description ? 'Pros: it is ' + lower1(t.description) : factsOf(t)[0] ? 'Pros: ' + factsOf(t)[0] : null;
    if (!pro) return null;
    return { hook: 'Rating ' + T + ' like a product: worth it?', mood: 'warm', theme: 'review', voiced: true, beats: [
      { kind: 'title', text: 'I rated ' + T + ' like a product' },
      { kind: 'stars', text: '★★★★☆', voice: 'Four stars.' },
      { kind: 'fact', text: pro },
      { kind: 'fact', text: 'Cons: you will see it in your feed all day' },
      { kind: 'title', text: 'Verdict: 4 out of 5. Would trend again.' }] };
  } },
  lyric: { label: 'Lyric music video', facts: 0, person: false, make(t) {
    const T = nameOf(t), d = t.description ? lower1(t.description) : null;
    return { hook: 'Is ' + T + ' the song of the day?', mood: 'beat', theme: 'lyric', voiced: false, beats: [
      { kind: 'card', text: T }, { kind: 'title', text: 'everybody is searching ' + T },
      ...(d ? [{ kind: 'title', text: d }] : []), { kind: 'title', text: 'on my phone, on my feed' },
      { kind: 'title', text: 'it is ' + T + ' tonight' }, { kind: 'card', text: T + '\n' + T + '\n' + T }] };
  } },
};
export const ORDER = Object.keys(FORMATS);
/** whether a topic can carry a format: enough facts, no parody of a real person, a short enough name for a title card. Pure. */
export function fits(format, t) {
  const F = FORMATS[format]; if (!F || !t) return false;
  if (t.person && !F.person) return false;
  if (factsOf(t).length < F.facts) return false;
  if (t.source === 'Hacker News' && format !== 'news' && format !== 'pov') return false; // a story title is a headline, not a name
  return !!F.make(t);
}
/** the script of one film. Pure. */
export function scriptOf(format, t) { const s = FORMATS[format] && FORMATS[format].make(t); return s ? { format, label: FORMATS[format].label, topic: t.topic, name: nameOf(t), ...s } : null; }

// the look of each format: the background's three colours, the text's backing, an accent
export const THEMES = {
  news: { bg: ['#0b2a6b', '#c4161c', '#13306e'], box: 'rgba(8,16,40,.86)', accent: '#e11d2e', font: 'DejaVu Sans' },
  trailer: { bg: ['#1a0f2e', '#3b1d0a', '#2a1240'], box: 'rgba(8,6,12,.82)', accent: '#e8b64c', font: 'DejaVu Serif' },
  explainer: { bg: ['#0e4d64', '#1d7a6e', '#203a72'], box: 'rgba(6,24,32,.84)', accent: '#5eead4', font: 'DejaVu Sans' },
  pov: { bg: ['#4c1d95', '#be185d', '#1e3a8a'], box: 'rgba(20,10,40,.8)', accent: '#f0abfc', font: 'DejaVu Sans' },
  countdown: { bg: ['#7c2d12', '#b45309', '#581c87'], box: 'rgba(30,10,5,.84)', accent: '#fde047', font: 'DejaVu Sans' },
  nature: { bg: ['#14532d', '#3f6212', '#134e4a'], box: 'rgba(6,20,10,.82)', accent: '#bef264', font: 'DejaVu Serif' },
  review: { bg: ['#1e293b', '#0f766e', '#7c3aed'], box: 'rgba(10,14,24,.84)', accent: '#facc15', font: 'DejaVu Sans' },
  lyric: { bg: ['#831843', '#1d4ed8', '#6d28d9'], box: 'rgba(20,6,30,.72)', accent: '#f9a8d4', font: 'DejaVu Sans' },
};
// sizes in output pixels: the gate wants 64+, and wraps keep every line inside the safe zone at the gate's own width estimate
export const SIZES = { kicker: 80, title: 84, fact: 70, 'bubble-l': 68, 'bubble-r': 68, stars: 120, card: 104 };
/** the characters a line may hold at a size: the safe width over the gate's estimate of a character (0.62 of the size). Pure. */
export const lineChars = (size) => Math.floor(((SAFE.x1 - SAFE.x0) * 0.86) / (size * 0.62));

/** the timeline: each beat's start and length in seconds, from its voice length when voiced (secs[i]) or its words, then the hook
 *  card first and the call to action last, trimmed to MAX_S by dropping middle beats. Pure. */
export function timeline(script, secs = []) {
  const len = (b, i) => Math.max(1.9, Math.min(4.2, secs[i] != null ? secs[i] + 0.45 : 1.3 + String(b.text).split(/\s+/).length * 0.2));
  let beats = script.beats.map((b, i) => ({ ...b, i, d: +len(b, i).toFixed(2) }));
  const hookD = 1.8, ctaD = 2.2, sum = () => hookD + ctaD + beats.reduce((a, b) => a + b.d, 0);
  while (sum() > MAX_S && beats.length > 2) beats.splice(Math.floor(beats.length / 2), 1);
  if (script.format === 'lyric') beats = beats.map((b) => ({ ...b, d: Math.max(2.4, Math.round(b.d / 1.2) * 1.2) })); // on the bar (1.2 s)
  while (sum() > MAX_S && beats.length > 2) beats.splice(Math.floor(beats.length / 2), 1);
  let t = hookD; const out = [{ kind: 'hook', text: script.hook, from: 0, to: hookD }];
  for (const b of beats) { out.push({ ...b, from: +t.toFixed(2), to: +(t + b.d).toFixed(2) }); t += b.d; }
  out.push({ kind: 'cta', text: CTA, from: +t.toFixed(2), to: +(t + ctaD).toFixed(2) });
  const total = +(t + ctaD).toFixed(2);
  return { beats: out, total: Math.max(MIN_S, total) };
}
/** the lines a beat is drawn in. Pure. */
export function linesOf(b) {
  const size = SIZES[b.kind] || (b.kind === 'hook' ? 88 : b.kind === 'cta' ? 80 : 76);
  return { size, text: String(b.text).split('\n').map((l) => wrap(l, lineChars(size))).join('\n') };
}

// the page: one canvas background drawn as a function of time, and the beats as absolutely placed boxes inside the safe zone.
// window.seek(t) draws the frame at t; nothing moves on its own, so every frame is the same on every machine.
export function pageHtml(script, tl) {
  const th = THEMES[script.theme] || THEMES.explainer, safe = { x0: SAFE.x0 / SCALE, x1: SAFE.x1 / SCALE, y0: SAFE.y0 / SCALE, y1: SAFE.y1 / SCALE };
  const beats = tl.beats.map((b) => ({ ...b, ...linesOf(b) }));
  return `<!doctype html><html><head><meta charset="utf-8"><style>
html,body{margin:0;width:${CSS_W}px;height:${CSS_H}px;overflow:hidden;background:${th.bg[0]};font-family:'${th.font}',sans-serif;font-weight:bold}
canvas{position:absolute;inset:0;width:${CSS_W}px;height:${CSS_H}px}
.b{position:absolute;left:${safe.x0}px;width:${safe.x1 - safe.x0}px;display:flex;justify-content:center;opacity:0}
.b span{display:inline-block;box-sizing:border-box;max-width:100%;white-space:pre-wrap;overflow-wrap:anywhere;text-align:center;color:#fff;background:${th.box};padding:10px 14px;border-radius:14px;line-height:1.22}
.kicker span{background:${th.accent};color:#fff;letter-spacing:2px}
.card span{color:${th.accent};background:${th.box};letter-spacing:1px}
.stars span{color:${th.accent}}
.bubble-l{justify-content:flex-start}.bubble-r{justify-content:flex-end}
.bubble-l span{background:#334155;border-radius:20px 20px 20px 4px;text-align:left}
.bubble-r span{background:#2563eb;border-radius:20px 20px 4px 20px;text-align:left}
.cta span{background:${th.accent};color:#111}
</style></head><body><canvas id="c" width="${W}" height="${H}"></canvas><div id="s"></div><script>
const B=${JSON.stringify(beats)},SAFE=${JSON.stringify(safe)},BG=${JSON.stringify(th.bg)},S=${SCALE};
const s=document.getElementById('s'),c=document.getElementById('c').getContext('2d');
for(const b of B){const d=document.createElement('div');d.className='b '+b.kind;const sp=document.createElement('span');sp.textContent=b.text;sp.style.fontSize=(b.size/S)+'px';d.appendChild(sp);s.appendChild(d);b.el=d;}
// bubbles stack: the newest at the bottom of the chat, the older ones pushed up; at most 3 shown
const place=(t)=>{const live=B.filter(b=>t>=b.from&&t<b.to);const chat=B.filter(b=>/bubble/.test(b.kind)&&t>=b.from&&t<B[B.length-1].from).slice(-3);
 for(const b of B){const on=live.includes(b)||chat.includes(b);const a=on?Math.min(1,(t-b.from)/0.25):0;b.el.style.opacity=a;b.el.style.transform='scale('+(0.92+0.08*a)+')';}
 let y=SAFE.y1-8;for(const b of chat.slice().reverse()){y-=b.el.offsetHeight+10;b.el.style.top=y+'px';}
 for(const b of live.filter(b=>!/bubble/.test(b.kind))){const h=b.el.offsetHeight;b.el.style.top=(chat.length?SAFE.y0+6:Math.max(SAFE.y0+6,(SAFE.y0+SAFE.y1)/2-h/2-(b.kind==='kicker'?120:0)))+'px';}};
const draw=(t)=>{const g=c.createLinearGradient(0,0,${W},${H});g.addColorStop(0,BG[0]);g.addColorStop(0.5+0.3*Math.sin(t*0.6),BG[1]);g.addColorStop(1,BG[2]);c.fillStyle=g;c.fillRect(0,0,${W},${H});
 for(let i=0;i<7;i++){const x=${W}*(0.5+0.45*Math.sin(t*0.35+i*1.9)),y=${H}*(0.5+0.45*Math.cos(t*0.27+i*2.3)),r=260+120*Math.sin(t*0.5+i);const rg=c.createRadialGradient(x,y,0,x,y,r);rg.addColorStop(0,'rgba(255,255,255,0.16)');rg.addColorStop(1,'rgba(255,255,255,0)');c.fillStyle=rg;c.fillRect(0,0,${W},${H});}
 c.fillStyle='rgba(255,255,255,0.35)';for(let i=0;i<70;i++){const x=((i*137.5+t*(20+i%5*9))%${W}),y=((i*263.1+t*(35+i%7*6))%${H});c.fillRect(x,y,3,3);}};
window.seek=(t)=>{draw(t);place(t);};
// each beat's boxes as the film shows them at their fullest, in output pixels (the gate checks these)
window.measure=()=>{const out=[];for(const b of B){const mid=Math.min(b.to-0.01,b.from+0.6);window.seek(mid);const r=b.el.firstChild.getBoundingClientRect();
 out.push({text:b.text,size:b.size,x:Math.round(r.left*S),y:Math.round(r.top*S),w:Math.round(r.width*S),h:Math.round(r.height*S),box:true,from:b.from,to:b.to,rect:true});}return out;};
window.seek(0);
</script></body></html>`;
}

/** the voice lines a timeline keeps, each at its beat's start in ms: the hook line, then the line of each beat the timeline kept (by
 *  its index in the script, since a long script loses middle beats), then the call to action. wavs = [hook, ...one per script beat, cta].
 *  Every delay is a whole number of 0 ms or more. Pure. */
export function voiceCues(tl, wavs) {
  const at = (s) => Math.max(0, Math.round(((Number.isFinite(s) ? s : 0) + 0.15) * 1000));
  const cues = [{ wav: wavs[0], ms: at(0) }];
  for (const b of tl.beats) if (b.kind !== 'hook' && b.kind !== 'cta' && wavs[b.i + 1]) cues.push({ wav: wavs[b.i + 1], ms: at(b.from) });
  const cta = tl.beats[tl.beats.length - 1];
  if (cta && cta.kind === 'cta' && wavs.length > 1) cues.push({ wav: wavs[wavs.length - 1], ms: at(cta.from) });
  return cues.filter((c) => c.wav);
}
const run = (cmd, args, opts = {}) => spawnSync(cmd, args, { encoding: 'utf8', maxBuffer: 64 << 20, ...opts });
const secsOf = (f) => Number(run('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', f]).stdout.trim()) || 0;
/** read one line aloud to a wav: Piper when PIPER_VOICE names a voice model, else espeak-ng, else null */
function say(text, file) {
  const voice = process.env.PIPER_VOICE;
  if (voice && fs.existsSync(voice)) {
    const [cmd, ...args] = (process.env.PIPER || 'python3 -m piper').split(/\s+/).filter(Boolean);
    const r = run(cmd, [...args, '-m', voice, '-f', file], { input: text });
    if (r.status === 0 && fs.existsSync(file)) return file;
  }
  if (run('which', ['espeak-ng']).status === 0 && run('espeak-ng', ['-v', 'en-us+m3', '-s', '160', '-w', file, text]).status === 0) return file;
  return null;
}
// the beat for the lyric video: an 8-step pentatonic pluck, 0.15 s a step (a bar of 1.2 s), and a soft kick on every other step
const beatExpr = () => { const notes = [261.63, 329.63, 392, 440, 392, 329.63, 293.66, 392], step = 0.15, bar = notes.length * step;
  const pl = notes.map((f, i) => `(between(mod(t,${bar}),${(i * step).toFixed(2)},${((i + 1) * step).toFixed(2)})*sin(2*PI*${f}*t)*exp(-9*(mod(t,${bar})-${(i * step).toFixed(2)})))`).join('+');
  return `0.22*(${pl})+0.35*sin(2*PI*55*t)*exp(-22*mod(t,0.3))`; };

/** film one script to <out>/<filmId>.mp4 and .json, then gate it */
export async function render(script, out, { filmId, topic } = {}) {
  fs.mkdirSync(out, { recursive: true });
  const dir = fs.mkdtempSync(path.join(path.resolve(out), '.take-'));
  // the voice first: its lengths set the timeline
  const lines = [script.hook, ...script.beats.map((b) => b.voice || String(b.text).replace(/\n/g, '. ')), 'Make any video free at a to mind dot com.'];
  const wavs = script.voiced ? lines.map((l, i) => say(l, path.join(dir, 'v' + i + '.wav'))) : [];
  const voiced = script.voiced && wavs.length && wavs.every(Boolean);
  const tl = timeline(script, voiced ? wavs.slice(1, -1).map(secsOf) : []);
  if (voiced) { tl.beats[0].to = Math.max(tl.beats[0].to, +(secsOf(wavs[0]) + 0.3).toFixed(2)); }
  const { chromium } = await import('playwright-core');
  const browser = await chromium.launch({ executablePath: process.env.CHROME || undefined });
  const page = await browser.newPage({ viewport: { width: CSS_W, height: CSS_H }, deviceScaleFactor: SCALE });
  await page.setContent(pageHtml(script, tl), { waitUntil: 'load' });
  await page.evaluate(() => document.fonts && document.fonts.ready);
  const captions = await page.evaluate(() => window.measure());
  const n = Math.round(tl.total * FPS);
  for (let i = 0; i < n; i++) {
    await page.evaluate((t) => window.seek(t), i / FPS);
    await page.screenshot({ path: path.join(dir, 'f' + String(i).padStart(5, '0') + '.jpg'), type: 'jpeg', quality: 90 });
  }
  await browser.close();
  // the sound: the voice lines at their beats over a bed ducked under them, or the beat alone for the lyric video
  const file = path.join(out, filmId + '.mp4'), T = tl.total;
  const mood = script.mood === 'beat' ? null : script.mood;
  const bed = mood ? `aevalsrc='${padExpr(mood)}':s=48000:d=${T},lowpass=f=1800,afade=t=in:d=0.6,afade=t=out:st=${(T - 1.2).toFixed(2)}:d=1.2,aformat=channel_layouts=stereo,loudnorm=I=${BED_LUFS}:TP=-6:LRA=5`
    : `aevalsrc='${beatExpr()}':s=48000:d=${T},afade=t=in:d=0.3,afade=t=out:st=${(T - 1.0).toFixed(2)}:d=1.0,aformat=channel_layouts=stereo,loudnorm=I=-20:TP=-3:LRA=7`;
  const args = ['-y', '-hide_banner', '-loglevel', 'error', '-framerate', String(FPS), '-i', path.join(dir, 'f%05d.jpg'), '-f', 'lavfi', '-i', bed];
  const vf = `scale=${W}:${H}:flags=lanczos,setsar=1,fps=30`;
  if (voiced) {
    const cues = voiceCues(tl, wavs);
    cues.forEach((c) => args.push('-i', c.wav));
    const parts = cues.map((c, i) => `[${i + 2}:a]aresample=48000,aformat=channel_layouts=stereo,adelay=${c.ms}|${c.ms}[v${i}]`);
    const fc = [`[0:v]${vf}[v]`, ...parts, `${cues.map((_, i) => `[v${i}]`).join('')}amix=inputs=${cues.length}:normalize=0,apad,atrim=duration=${T},asplit[vo][sc]`,
      `[1:a][sc]sidechaincompress=threshold=0.03:ratio=8:release=300[duck]`, `[vo][duck]amix=inputs=2:normalize=0,loudnorm=I=-14:TP=-1.5:LRA=7[a]`].join(';');
    args.push('-filter_complex', fc, '-map', '[v]', '-map', '[a]');
  } else args.push('-filter_complex', `[0:v]${vf}[v]`, '-map', '[v]', '-map', '1:a');
  args.push('-c:v', 'libx264', '-preset', 'medium', '-crf', '20', '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-b:a', '160k', '-movflags', '+faststart', '-t', String(T), file);
  const r = run('ffmpeg', args);
  if (r.status !== 0) throw new Error('ffmpeg: ' + String(r.stderr).slice(-800));
  const src = (topic && topic.page) || (topic && topic.url) || '';
  const link = SITE + 'c/' + filmId + '?p=films&q=' + encodeURIComponent('make a ' + FORMATS[script.format].label.toLowerCase() + ' about ' + script.name);
  const facts = script.beats.filter((b) => b.kind === 'fact').length;
  const meta = { id: filmId, filmId, video: path.basename(file), format: script.format, label: script.label, topic: script.topic, hook: script.hook, voice: !!voiced, music: mood || 'beat',
    captions, timing: { total: T, beats: tl.beats.map((b) => ({ kind: b.kind, from: b.from, to: b.to })) },
    footage: { kind: 'studio', frames: n, fps: FPS, source: src, trend: topic ? { source: topic.source, url: topic.url } : null },
    title: (script.hook + ' #Shorts').slice(0, 100),
    description: (script.label + ' about ' + script.name + ', trending today' + (topic && topic.source ? ' on ' + topic.source : '') + '.' + (facts && src ? '\n\nFacts from ' + src : '') + '\n\nMade by Verse. Make any kind of video yourself, free: ' + link + '\n\n#Shorts').slice(0, 4500),
    tags: ['Shorts', script.label, script.name, 'trending', 'parody', 'Verse'].join(', ') };
  meta.gate = gate(file, meta);
  fs.writeFileSync(path.join(out, filmId + '.json'), JSON.stringify(meta, null, 2) + '\n');
  fs.rmSync(dir, { recursive: true, force: true });
  return meta;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const arg = (k) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : undefined; };
  const cmd = process.argv[2];
  if (cmd === 'formats') { for (const k of ORDER) console.log(k + ': ' + FORMATS[k].label); process.exit(0); }
  if (cmd === 'script') { console.log(JSON.stringify(scriptOf(arg('--format'), JSON.parse(fs.readFileSync(arg('--topic-file'), 'utf8'))), null, 2)); process.exit(0); }
  if (cmd === 'render') {
    const trial = JSON.parse(fs.readFileSync(arg('--trial'), 'utf8')), f = (trial.films || [])[Number(arg('--i') || 0)];
    if (!f) { console.log('no film ' + arg('--i') + ' in the plan'); process.exit(0); }
    const m = await render(scriptOf(f.format, f.topicData), path.resolve(arg('--out') || 'media/shorts'), { filmId: f.film, topic: f.topicData });
    console.log((m.gate.pass ? 'GATE PASS ' : 'GATE FAIL ') + f.film + ' (' + m.label + ', ' + m.topic + '): ' + m.gate.checks.map((c) => (c.ok ? '' : 'FAIL ') + c.name + ' (' + c.detail + ')').join('; '));
    process.exit(0);
  }
  console.error('usage: node tools/film-studio.mjs formats | script --format F --topic-file t.json | render --trial trial.json --i N [--out dir]'); process.exit(2);
}
