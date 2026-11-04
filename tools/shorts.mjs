#!/usr/bin/env node
// Verse's Shorts, remade (owner, 2026-11-03: "verses videos are bad, its not framed properly the music is bad and they are meaningless
// to most people even me"). Each Short is an everyday problem a stranger has, typed into the live a-to-mind.com and answered on
// camera: full bleed 1080x1920 (the phone-sized page filmed at 9:16, never a 16:9 frame in bars), the hook in the first two seconds,
// the real answer on screen with a big caption, then "Try it free" over the last frame. No music. A voice reads it when espeak-ng is
// installed (loudness-normalized to -14 LUFS); otherwise the film is silent. 6-20 s.
// Every render goes through tools/video-gate.mjs; only a pass is ever posted.
//   node tools/shorts.mjs list                         the scenes
//   node tools/shorts.mjs render [--out dir] [--only id] [--no-voice]   <id>.mp4 + <id>.json (+ gate) per scene
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { W, H, SAFE, gate } from './video-gate.mjs';

export const SITE = 'https://a-to-mind.com/';
const FONT = '/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf';
// a scene: the hook a person would stop for, what they type, the answer the page must show (checked in the browser), the caption
export const SCENES = [
  { id: 'split-dinner-bill', hook: 'Splitting a $84 dinner bill 3 ways?', ask: 'split a $84 dinner bill 3 ways with 20% tip', answer: /\$33\.60/, says: '$33.60 each, tip included', voice: 'Splitting an 84 dollar dinner bill three ways? 33 dollars 60 each, tip included.' },
  { id: 'tip-on-47', hook: 'How much do you tip on $47.50?', ask: 'what is a 18% tip on $47.50', answer: /\$8\.55/, says: '18% tip = $8.55\nTotal $56.05', voice: 'How much do you tip on 47 fifty? 8 dollars 55. Total, 56 oh 5.' },
];
export const CTA = 'Ask yours free\na-to-mind.com';

/** wrap text to lines of at most n characters, at word boundaries. Pure. */
export function wrap(s, n = 18) {
  const out = []; let cur = '';
  for (const w of String(s).split(/\s+/).filter(Boolean)) { if (cur && (cur + ' ' + w).length > n) { out.push(cur); cur = w; } else cur = cur ? cur + ' ' + w : w; }
  if (cur) out.push(cur);
  return out.join('\n');
}
/** the captions a scene burns in, each { text, size, x, y, box, from, to } in px and seconds. Centered, inside the safe zone. Pure. */
export function captionsOf(scene, t) {
  const at = (text, size, y, from, to) => { const lines = text.split('\n'), wide = Math.max(...lines.map((l) => l.length)) * size * 0.62;
    return { text, size, x: Math.round(SAFE.x0 + (SAFE.x1 - SAFE.x0 - wide) / 2), y, box: true, from, to }; };
  return [
    at(wrap(scene.hook, 16), 88, SAFE.y0 + 30, 0, t.answer),
    at(scene.says.split('\n').map((l) => wrap(l, 18)).join('\n'), 80, Math.round(H * 0.56), t.answer + 0.2, t.end),
    at(CTA, 84, Math.round(H * 0.4), t.end, t.total),
  ];
}

/** film the live site answering the scene's question: a phone-sized page (432x768 CSS px, 9:16) at 2.5x pixel density, captured
 *  frame by frame with Chrome's screencast at full 1080x1920 (Playwright's recordVideo draws the page at CSS size on a bigger grey
 *  canvas: the bars the owner saw), typed like a person would. Returns the frames as an ffmpeg concat list with real timing. */
async function film(scene, dir) {
  const { chromium } = await import('playwright-core');
  const browser = await chromium.launch({ executablePath: process.env.CHROME || undefined });
  const ctx = await browser.newContext({ viewport: { width: 432, height: 768 }, deviceScaleFactor: W / 432, isMobile: true, hasTouch: true });
  const page = await ctx.newPage();
  await page.goto(SITE, { waitUntil: 'networkidle' }).catch(() => {});
  await page.waitForSelector('#input', { timeout: 20000 });
  await page.waitForTimeout(400);
  const cdp = await ctx.newCDPSession(page), frames = [];
  cdp.on('Page.screencastFrame', async (f) => {
    const file = path.join(dir, 'f' + String(frames.length).padStart(5, '0') + '.jpg');
    fs.writeFileSync(file, Buffer.from(f.data, 'base64')); frames.push({ file, ts: f.metadata.timestamp });
    await cdp.send('Page.screencastFrameAck', { sessionId: f.sessionId }).catch(() => {});
  });
  await cdp.send('Page.startScreencast', { format: 'jpeg', quality: 92, maxWidth: W, maxHeight: H, everyNthFrame: 1 });
  const now = () => Date.now() / 1000, t0 = now();
  await page.waitForTimeout(300);
  await page.click('#input');
  await page.keyboard.type(scene.ask, { delay: 38 });
  await page.waitForTimeout(250);
  await page.keyboard.press('Enter');
  let answerSeen = false;
  try { await page.waitForFunction((re) => new RegExp(re).test(document.body.innerText), scene.answer.source, { timeout: 15000 }); answerSeen = true; } catch (_) {} // void-review: ok: the pattern is a constant in SCENES, never user input
  const answer = now() - t0;
  await page.waitForTimeout(4200);
  const end = now() - t0;
  await cdp.send('Page.stopScreencast').catch(() => {});
  await browser.close();
  if (frames.length < 10) throw new Error('the screencast caught only ' + frames.length + ' frames');
  // each frame shown until the next one arrived (screencast sends frames only when the page changes)
  const first = frames[0].ts, lines = ['ffconcat version 1.0'];
  frames.forEach((fr, i) => { lines.push("file '" + fr.file + "'", 'duration ' + Math.max(0.001, ((frames[i + 1] ? frames[i + 1].ts : t0 + end) - fr.ts)).toFixed(4)); });
  lines.push("file '" + frames[frames.length - 1].file + "'");
  const list = path.join(dir, 'frames.txt'); fs.writeFileSync(list, lines.join('\n') + '\n');
  const lag = first - t0; // the screencast's first frame came this long after t0
  return { list, start: 0, answer: answer - lag, end: end - lag, answerSeen };
}

function voiceTrack(text, dir) {
  if (spawnSync('which', ['espeak-ng']).status !== 0) return null;
  const wav = path.join(dir, 'voice.wav');
  return spawnSync('espeak-ng', ['-v', 'en-us+f3', '-s', '165', '-w', wav, text]).status === 0 ? wav : null;
}

/** render one scene to <out>/<id>.mp4 and <id>.json, then gate it */
export async function render(scene, out, { voice = true } = {}) {
  const dir = fs.mkdtempSync(path.join(out, '.take-'));
  const f = await film(scene, dir);
  const HOLD = 2.6, t = { answer: +(f.answer - f.start).toFixed(2), end: +(f.end - f.start).toFixed(2) };
  t.total = +(t.end + HOLD).toFixed(2);
  const caps = captionsOf(scene, t), esc = (s) => s.replace(/\\/g, '\\\\').replace(/:/g, '\\:').replace(/'/g, '\u2019').replace(/%/g, '\\%');
  const draws = caps.map((c, i) => { const file = path.join(dir, 'c' + i + '.txt'); fs.writeFileSync(file, c.text);
    return `drawtext=fontfile=${FONT}:textfile=${esc(file)}:fontsize=${c.size}:fontcolor=white:line_spacing=${Math.round(c.size * 0.25)}:x=(w-text_w)/2:y=${c.y}:box=1:boxcolor=0x0b0b14@0.82:boxborderw=28:enable='between(t,${c.from},${c.to})'`; });
  const vf = [`fps=30`, `scale=${W}:${H}:flags=lanczos,setsar=1`, `tpad=stop_mode=clone:stop_duration=${HOLD}`,
    `drawbox=x=0:y=0:w=iw:h=ih:color=black@0.55:t=fill:enable='gte(t,${t.end})'`, ...draws, `trim=duration=${t.total}`].join(',');
  const wav = voice ? voiceTrack(scene.voice, dir) : null;
  const file = path.join(out, scene.id + '.mp4');
  const args = ['-y', '-hide_banner', '-loglevel', 'error', '-f', 'concat', '-safe', '0', '-i', f.list];
  if (wav) args.push('-i', wav, '-filter_complex', `[0:v]${vf}[v];[1:a]adelay=300|300,loudnorm=I=-14:TP=-1.5:LRA=7,apad,atrim=duration=${t.total}[a]`, '-map', '[v]', '-map', '[a]');
  else args.push('-f', 'lavfi', '-i', 'anullsrc=r=48000:cl=stereo', '-filter_complex', `[0:v]${vf}[v]`, '-map', '[v]', '-map', '1:a', '-shortest');
  args.push('-c:v', 'libx264', '-preset', 'medium', '-crf', '19', '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-b:a', '160k', '-movflags', '+faststart', '-t', String(t.total), file);
  const r = spawnSync('ffmpeg', args, { encoding: 'utf8' });
  if (r.status !== 0) throw new Error('ffmpeg: ' + r.stderr.slice(-800));
  const link = SITE + '?q=' + encodeURIComponent(scene.ask);
  const meta = { id: scene.id, video: path.basename(file), hook: scene.hook, voice: !!wav, captions: caps, timing: t,
    footage: { url: SITE, ask: scene.ask, answer: scene.answer.source.replace(/\\/g, ''), answerSeen: f.answerSeen },
    title: (scene.hook + ' #Shorts').slice(0, 100), description: scene.hook + ' ' + scene.says.replace(/\n/g, '. ') + '.\n\nAsk it yourself, free: ' + link + '\n\n#Shorts', tags: ['Shorts', 'money', 'life hacks', 'A-to-Mind'] };
  meta.gate = gate(file, meta);
  fs.writeFileSync(path.join(out, scene.id + '.json'), JSON.stringify(meta, null, 2) + '\n');
  fs.rmSync(dir, { recursive: true, force: true });
  return meta;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const arg = (k) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : undefined; };
  if (process.argv[2] === 'list') { for (const s of SCENES) console.log(s.id + ': ' + s.hook); process.exit(0); }
  const out = path.resolve(arg('--out') || 'media/shorts'); fs.mkdirSync(out, { recursive: true });
  let failed = 0;
  for (const s of SCENES.filter((x) => !arg('--only') || x.id === arg('--only'))) {
    const m = await render(s, out, { voice: !process.argv.includes('--no-voice') });
    console.log((m.gate.pass ? 'GATE PASS ' : 'GATE FAIL ') + m.video + ': ' + m.gate.checks.map((c) => (c.ok ? '' : 'FAIL ') + c.name + ' (' + c.detail + ')').join('; '));
    if (!m.gate.pass) failed++;
  }
  process.exit(failed ? 1 : 0);
}
