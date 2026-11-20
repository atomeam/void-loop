// Verse's studio, the sound and the picture (tools/studio-make.mjs writes and judges; this voices and films what passed).
//   speak(lines, dir)          Kokoro voices (tools/kokoro_line.py), each line levelled to the same loudness, word times kept
//   mixShow(lines, out, kind)  the lines on one timeline with real turn-taking gaps over the piano bed (tools/studio_mix.py)
//   film(show, voiced, dir)    a 1080x1920 film: one picture per line, slow push and pan, cross fades, word-timed captions, end card
import { writeFileSync, mkdtempSync, existsSync, statSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { integratedLufs, measuredLoudness } from './show-pipe.mjs';
import { loudnormPass } from '../void-live-deploy/lib/show-pipe.js';

const here = dirname(fileURLToPath(import.meta.url)), root = resolve(here, '..');
const KOKORO = process.env.KOKORO_DIR || (process.env.HOME + '/kokoro');
const FONT_DIR = ['/usr/share/fonts/truetype/dejavu', '/usr/share/fonts/dejavu'].find((d) => existsSync(d)) || '/usr/share/fonts';
export const W = 1080, H = 1920, FPS = 30, XF = 0.35, CAP = { size: 74, maxChars: 16, bottom: 1300, left: 60, right: 940 };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const run = (cmd, args, opt = {}) => { const r = spawnSync(cmd, args, { encoding: 'utf8', maxBuffer: 256 << 20, ...opt }); if (r.status !== 0) throw new Error(cmd + ': ' + String(r.stderr || r.stdout).slice(-500)); return r; };
const ff = (args) => run('ffmpeg', ['-y', '-hide_banner', '-loglevel', 'error', ...args]);
const dur = (f) => parseFloat(run('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', f]).stdout) || 0;

/** the pause before a line: quick for a reaction, longer after a question, a breath between turns. Pure. */
export function gapBefore(prev, line) {
  if (!prev) return 0;
  const words = line.text.split(/\s+/).length;
  if (words <= 4 || /^[—–-]/.test(line.text)) return 0.1;
  if (/\?\s*$/.test(prev.text)) return 0.32;
  return prev.who === line.who ? 0.38 : 0.22;
}
export function speak(lines, voices, dir) {
  const jobs = lines.map((l, i) => ({ voice: voices[l.who].id, lang: voices[l.who].lang, speed: voices[l.who].speed, text: l.text, out: join(dir, 'raw' + i + '.wav') }));
  writeFileSync(join(dir, 'jobs.json'), JSON.stringify(jobs));
  const r = run('python3', [join(here, 'kokoro_line.py'), join(KOKORO, 'kokoro-v1.0.onnx'), '--batch', join(KOKORO, 'voices-v1.0.bin'), join(dir, 'jobs.json')]);
  const timed = JSON.parse(r.stdout.trim().split('\n').pop());
  return lines.map((l, i) => {
    const raw = jobs[i].out, out = join(dir, 'line' + i + '.wav');
    ff(['-i', raw, '-af', 'highpass=f=70,acompressor=threshold=-21dB:ratio=2.2:attack=6:release=140,aresample=44100', '-ac', '1', out]);
    const got = integratedLufs(out);
    if (got != null) { const fixed = out + '.lv.wav'; ff(['-i', out, '-af', 'volume=' + (-18 - got).toFixed(2) + 'dB,alimiter=limit=0.89:level=false', fixed]); run('mv', [fixed, out]); }
    const d = dur(out), scale = timed[i].seconds ? d / timed[i].seconds : 1;
    return { ...l, file: out, seconds: d, words: timed[i].words.map((w) => ({ w: w.w, from: w.from * scale, to: w.to * scale })) };
  });
}
/** places the voiced lines, mixes the bed, and sets the final loudness. Returns the lines with their times. */
export function mixShow(voiced, out, { kind = 'episode', dir, seed = 1 } = {}) {
  const intro = kind === 'episode' ? 2.6 : 0.5, outro = kind === 'episode' ? 4 : 2.6;
  let t = intro;
  const placed = voiced.map((l, i) => { t += gapBefore(voiced[i - 1], l); const p = { ...l, at: +t.toFixed(3), end: +(t + l.seconds).toFixed(3) }; t += l.seconds; return p; });
  const total = t + outro, wav = join(dir, 'mix.wav');
  writeFileSync(join(dir, 'mix.json'), JSON.stringify({ out: wav, total, intro, outro, seed, piano: resolve(root, 'void-live-deploy/sounds/piano'), voices: placed.map((p) => ({ file: p.file, at: p.at })) }));
  run('python3', [join(here, 'studio_mix.py'), join(dir, 'mix.json')]);
  const I = kind === 'episode' ? -16 : -14, m = measuredLoudness(wav);
  const pass2 = loudnormPass(m).replace(/I=-?\d+(\.\d+)?/, 'I=' + I);
  const enc = kind === 'episode' ? ['-c:a', 'libmp3lame', '-b:a', '128k'] : ['-c:a', 'pcm_s16le'];
  ff(['-i', wav, '-af', pass2, '-ar', '44100', '-ac', '2', ...enc, out]);
  return { lines: placed, seconds: total };
}

/** caption chunks of at most CAP.maxChars, breaking after punctuation, each on screen from its first word to the next chunk. Pure. */
export function chunks(lines) {
  const out = [];
  lines.forEach((l, li) => {
    let cur = [];
    const flush = () => { if (cur.length) out.push({ line: li, who: l.who, text: cur.map((w) => w.w).join(' '), from: l.at + cur[0].from, to: l.at + cur[cur.length - 1].to }); cur = []; };
    for (const w of l.words) {
      if (cur.length && (cur.map((x) => x.w).join(' ') + ' ' + w.w).length > CAP.maxChars) flush();
      cur.push(w);
      if (/[.,!?;:]$/.test(w.w)) flush();
    }
    flush();
  });
  for (let i = 0; i < out.length; i++) out[i].to = +Math.min(i + 1 < out.length ? out[i + 1].from : out[i].to + 0.3, out[i].to + 0.6).toFixed(3);
  return out;
}
const assTime = (s) => { const cs = Math.max(0, Math.round(s * 100)); return Math.floor(cs / 360000) + ':' + String(Math.floor(cs / 6000) % 60).padStart(2, '0') + ':' + String(Math.floor(cs / 100) % 60).padStart(2, '0') + '.' + String(cs % 100).padStart(2, '0'); };
const assEsc = (s) => String(s).replace(/[{}\\]/g, '');
/** wraps the hook into lines of at most CAP.maxChars. Pure. */
export function wrap(text, max = CAP.maxChars) { const out = []; let cur = ''; for (const w of String(text).split(/\s+/)) { if (cur && (cur + ' ' + w).length > max) { out.push(cur); cur = w; } else cur = cur ? cur + ' ' + w : w; } if (cur) out.push(cur); return out; }
/** the subtitle file and the caption list the video gate reads (every caption 64 px or more, on a box, in the safe zone). Pure. */
export function captionsOf(show, placed, total) {
  const size = CAP.size, mid = (CAP.left + CAP.right) / 2, box = (t, sz, y, from, to, raw) => { const lines = t.split('\n'); const w = Math.max(...lines.map((x) => x.length)) * sz * 0.62, h = lines.length * sz * 1.25; return { text: t, raw, size: sz, box: true, rect: true, x: Math.round(mid - w / 2), y: Math.round(y), w: Math.round(w), h: Math.round(h), from, to }; };
  // the hook is line 1 written big at the top, so line 1's own captions wait until the hook has gone
  const hookLines = wrap(show.hook), hookEnd = Math.min(placed[0].end, 3.2);
  const caps = chunks(placed).filter((c) => !(c.line === 0 && c.from < hookEnd)).map((c) => ({ ...box(c.text, size, CAP.bottom - size * 1.25, c.from, c.to, c.text), who: c.who }));
  const hook = box(hookLines.join('\n'), 84, 300, 0, hookEnd, hookLines.join(' '));
  const endA = box('Ask Verse anything', 64, 640, total - 2.4, total, 'Ask Verse anything'), endB = box('a-to-mind.com', 84, 760, total - 2.4, total, 'a-to-mind.com');
  const head = '[Script Info]\nScriptType: v4.00+\nPlayResX: ' + W + '\nPlayResY: ' + H + '\nWrapStyle: 2\n\n[V4+ Styles]\nFormat: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding\n'
    + 'Style: Verse,DejaVu Sans,' + size + ',&H0066D1FF,&H00FFFFFF,&H70000000,&H70000000,-1,0,0,0,100,100,0,0,3,14,0,2,' + CAP.left + ',' + (W - CAP.right) + ',' + (H - CAP.bottom) + ',1\n'
    + 'Style: Critic,DejaVu Sans,' + size + ',&H00FFFFFF,&H00FFFFFF,&H70000000,&H70000000,-1,0,0,0,100,100,0,0,3,14,0,2,' + CAP.left + ',' + (W - CAP.right) + ',' + (H - CAP.bottom) + ',1\n'
    + 'Style: Hook,DejaVu Sans,84,&H00FFFFFF,&H00FFFFFF,&H80000000,&H80000000,-1,0,0,0,100,100,0,0,3,18,0,8,' + CAP.left + ',' + (W - CAP.right) + ',300,1\n'
    + 'Style: End,DejaVu Sans,64,&H00FFFFFF,&H00FFFFFF,&H80000000,&H80000000,-1,0,0,0,100,100,0,0,3,16,0,8,' + CAP.left + ',' + (W - CAP.right) + ',640,1\n'
    + 'Style: EndBig,DejaVu Sans,84,&H0066D1FF,&H00FFFFFF,&H80000000,&H80000000,-1,0,0,0,100,100,0,0,3,18,0,8,' + CAP.left + ',' + (W - CAP.right) + ',760,1\n\n[Events]\nFormat: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text\n';
  const ev = (st, a, b, t, fx = '') => 'Dialogue: 0,' + assTime(a) + ',' + assTime(b) + ',' + st + ',,0,0,0,,' + fx + assEsc(t).replace(/\n/g, '\\N') + '\n';
  const ass = head + caps.map((c) => ev(c.who, c.from, c.to, c.text, '{\\fad(60,0)\\fscx104\\fscy104\\t(0,90,\\fscx100\\fscy100)}')).join('') + ev('Hook', hook.from, hook.to, hook.text, '{\\fad(150,200)}') + ev('End', endA.from, endA.to, endA.text, '{\\fad(250,0)}') + ev('EndBig', endB.from, endB.to, endB.text, '{\\fad(250,0)}');
  return { ass, captions: [...caps, hook, endA, endB] };
}

/** one picture per line from Pollinations (free, no account); a picture that does not come is tried again, then the run fails. */
export async function pictures(show, dir, { seed = Date.now() % 100000, fetchImpl = fetch } = {}) {
  const style = 'cinematic photograph, natural light, rich color, shallow depth of field, 35mm film look, vertical composition, highly detailed, no text, no watermark, no logo: ';
  const files = [];
  for (let i = 0; i < show.lines.length; i++) {
    const f = join(dir, 'pic' + i + '.jpg');
    for (let t = 0; ; t++) {
      const u = 'https://image.pollinations.ai/prompt/' + encodeURIComponent(style + show.lines[i].scene) + '?width=1080&height=1920&nologo=true&model=flux&seed=' + (seed + i * 7 + t * 1000);
      const r = await fetchImpl(u, { signal: AbortSignal.timeout(120000) }).catch(() => null);
      const b = r && r.ok && /image\//.test(r.headers.get('content-type') || '') ? Buffer.from(await r.arrayBuffer()) : null;
      if (b && b.length > 15000) { writeFileSync(f, b); break; }
      if (t >= 3) throw new Error('no picture for line ' + (i + 1));
      await sleep(8000 * (t + 1));
    }
    files.push(f);
    await sleep(3000);
  }
  return files;
}
/** the film: each picture pushed or panned over its line, cross faded, captions burned in, the mix under it. */
export function film(show, placed, total, pics, wav, out, dir) {
  const bounds = placed.map((p, i) => (i + 1 < placed.length ? placed[i + 1].at - 0.05 : total));
  const lens = placed.map((p, i) => (i ? bounds[i] - bounds[i - 1] : bounds[0]));
  const clips = pics.map((pic, i) => {
    const d = lens[i] + (i + 1 < pics.length ? XF : 0), n = Math.ceil(d * FPS), c = join(dir, 'clip' + i + '.mp4');
    const z = i % 2 ? "1.12-0.12*on/" + n : "1+0.12*on/" + n, x = ["iw/2-(iw/zoom/2)", "(iw-iw/zoom)*on/" + n, "(iw-iw/zoom)*(1-on/" + n + ")"][i % 3];
    ff(['-loop', '1', '-i', pic, '-vf', "crop=iw:ih*0.93:0:0,scale=2160:3840:force_original_aspect_ratio=increase,crop=2160:3840,zoompan=z='" + z + "':x='" + x + "':y='ih/2-(ih/zoom/2)':d=" + n + ':s=' + W + 'x' + H + ':fps=' + FPS + ',format=yuv420p', '-frames:v', String(n), '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '16', c]);
    return c;
  });
  const { ass, captions } = captionsOf(show, placed, total);
  writeFileSync(join(dir, 'subs.ass'), ass);
  let chain = '', last = '[0:v]', off = 0;
  for (let i = 1; i < clips.length; i++) { off += lens[i - 1]; chain += last + '[' + i + ':v]xfade=transition=fade:duration=' + XF + ':offset=' + off.toFixed(3) + '[v' + i + '];'; last = '[v' + i + ']'; }
  const endFx = 'fade=t=out:st=' + (total - 0.6).toFixed(2) + ':d=0.6';
  chain += last + "eq=brightness=-0.02:saturation=1.08,vignette=PI/5,ass='" + join(dir, 'subs.ass') + "':fontsdir='" + FONT_DIR + "'," + endFx + '[vout]';
  ff([...clips.flatMap((c) => ['-i', c]), '-i', wav, '-filter_complex', chain, '-map', '[vout]', '-map', clips.length + ':a', '-t', total.toFixed(3), '-c:v', 'libx264', '-preset', 'medium', '-crf', '20', '-pix_fmt', 'yuv420p', '-r', String(FPS), '-c:a', 'aac', '-b:a', '160k', '-movflags', '+faststart', out]);
  ff(['-ss', '1.2', '-i', out, '-frames:v', '1', '-q:v', '3', out.replace(/\.mp4$/, '.jpg')]);
  return { captions, bytes: statSync(out).size };
}
