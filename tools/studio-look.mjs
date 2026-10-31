#!/usr/bin/env node
// The studio from GitHub's network (.github/workflows/studio-look.yml), for builders whose machine can't reach a-to-mind.com: runs the bench
// or makes a clip on the live site with the owner key, and writes what came back to a folder (default out/) so the workflow can put it on the
// studio-look branch, where a builder looks at every picture and frame themselves (owner, 2026-10-23: check the result itself, not its name).
//   node tools/studio-look.mjs bench [--models a,b] [--prompts fox,sign] [--size 512] [--cap 3000]
//   node tools/studio-look.mjs video --prompt "..." [--model p-video] [--seconds 5] [--draft true] [--image out/fox/klein-4b.jpg]
//   node tools/studio-look.mjs board
//   node tools/studio-look.mjs clip      (no key: what /api/clip says about video, and whether /video/ is served with its state line and hand-off tag)
// Video: the clip is downloaded, four frames are taken out with ffmpeg, Verse's judge scores each (op judge), how much they change is measured
// here (mean pixel change on small grey frames), whether they stay one scene is asked (op steady), and the clip's score is lib/studio.js
// videoScoreOf. Env: READ_TOKEN (the owner key), SITE (default https://a-to-mind.com), OUT (default out). Never prints the key.
import fs from 'node:fs'; import path from 'node:path'; import { execFileSync } from 'node:child_process';
import { BENCH, videoScoreOf } from '../void-live-deploy/lib/studio.js';

const args = process.argv.slice(2), op = args[0] || 'board';
const opt = (k, d = '') => { const i = args.indexOf('--' + k); return i >= 0 && i + 1 < args.length ? args[i + 1] : d; };
const SITE = (process.env.SITE || 'https://a-to-mind.com').replace(/\/$/, ''), OUT = process.env.OUT || 'out', KEY = process.env.READ_TOKEN || '';
fs.mkdirSync(OUT, { recursive: true });
const post = async (body, ms = 300000) => {
  const r = await fetch(SITE + '/api/studio', { method: 'POST', headers: { 'content-type': 'application/json', origin: SITE, authorization: 'Bearer ' + KEY }, body: JSON.stringify(body), signal: AbortSignal.timeout(ms) });
  const t = await r.text(); try { return { status: r.status, ...JSON.parse(t) }; } catch (_) { return { status: r.status, ok: false, error: t.slice(0, 300) }; }
};
const save = (file, dataUrl) => { const m = String(dataUrl).match(/^data:image\/([a-z]+);base64,(.+)$/); if (!m) return ''; const f = file + '.' + (m[1] === 'jpeg' ? 'jpg' : m[1]); fs.writeFileSync(f, Buffer.from(m[2], 'base64')); return f; };
const dataUrlOf = (file) => 'data:image/' + (/\.png$/.test(file) ? 'png' : /\.webp$/.test(file) ? 'webp' : 'jpeg') + ';base64,' + fs.readFileSync(file).toString('base64');

if (op === 'board') {
  const r = await fetch(SITE + '/api/studio').then((x) => x.json());
  fs.writeFileSync(path.join(OUT, 'board.json'), JSON.stringify(r, null, 2)); console.log(JSON.stringify(r, null, 2));
} else if (op === 'bench') {
  const prompts = (opt('prompts') || BENCH.map((b) => b.id).join(',')).split(',').filter(Boolean), models = opt('models') ? opt('models').split(',') : undefined;
  const size = Number(opt('size', '1024')), cap = Number(opt('cap', '3000')), all = [];
  for (const id of prompts) { // one reference prompt a call, so one call stays short; the cap is per call
    const r = await post({ op: 'bench', prompts: [id], models, size, cap, images: true });
    if (!r.ok) { console.log(id, 'failed', r.status, r.error); all.push({ bench: id, error: r.error, status: r.status }); continue; }
    fs.mkdirSync(path.join(OUT, id), { recursive: true });
    for (const run of r.runs) { if (run.img) run.file = save(path.join(OUT, id, run.model), run.img); delete run.img; all.push(run);
      console.log([id, run.model, run.score ?? '-', run.ms ? run.ms + 'ms' : '', run.w ? run.w + 'x' + run.h : '', run.worst || run.error || run.judgeError || ''].join(' | ')); }
  }
  fs.writeFileSync(path.join(OUT, 'bench.json'), JSON.stringify(all, null, 2));
} else if (op === 'video') {
  const prompt = opt('prompt', 'a red fox trotting through fresh snow in a pine forest, golden hour, the camera follows it');
  const image = opt('image') ? dataUrlOf(opt('image')) : undefined;
  const r = await post({ op: 'video', prompt, model: opt('model', 'p-video'), seconds: Number(opt('seconds', '5')), draft: opt('draft', 'true') !== 'false', resolution: opt('resolution', '720p'), aspect: opt('aspect', '16:9'), image });
  const meta = { ...r, prompt }; console.log(JSON.stringify(meta));
  if (r.state === 'video') {
    const clip = path.join(OUT, 'clip.mp4'); fs.writeFileSync(clip, Buffer.from(await (await fetch(r.url)).arrayBuffer()));
    const probe = execFileSync('ffprobe', ['-v', 'error', '-select_streams', 'v:0', '-show_entries', 'stream=width,height,nb_frames,r_frame_rate:format=duration', '-of', 'json', clip]).toString();
    meta.probe = JSON.parse(probe); const dur = Number(meta.probe.format && meta.probe.format.duration) || r.seconds;
    const frames = [], grey = [];
    for (let i = 0; i < 4; i++) {
      const t = (dur * (i + 0.5)) / 4, f = path.join(OUT, 'frame' + i + '.jpg');
      execFileSync('ffmpeg', ['-v', 'error', '-y', '-ss', String(t), '-i', clip, '-frames:v', '1', '-q:v', '3', f]); frames.push(f);
      grey.push(execFileSync('ffmpeg', ['-v', 'error', '-ss', String(t), '-i', clip, '-frames:v', '1', '-vf', 'scale=64:36,format=gray', '-f', 'rawvideo', '-']));
    }
    let change = 0; for (let i = 1; i < grey.length; i++) { let d = 0; for (let k = 0; k < grey[i].length; k++) d += Math.abs(grey[i][k] - grey[i - 1][k]); change += d / grey[i].length / 255; }
    meta.motion = Math.round((change / (grey.length - 1)) * 1000) / 1000;
    meta.frames = [];
    for (const f of frames) { const j = await post({ op: 'judge', image: dataUrlOf(f), prompt, checks: [prompt] }, 90000); meta.frames.push({ file: f, ...j }); }
    const st = await post({ op: 'steady', frames: frames.map(dataUrlOf), prompt }, 90000); meta.steady = st.steady ?? null; meta.steadyError = st.error;
    meta.score = videoScoreOf(meta.frames.filter((j) => j.ok), meta.motion, meta.steady);
    console.log('video score', meta.score, 'motion', meta.motion, 'steady', meta.steady);
  }
  fs.writeFileSync(path.join(OUT, 'video.json'), JSON.stringify(meta, null, 2));
} else if (op === 'clip') {
  const api = await fetch(SITE + '/api/clip', { cache: 'no-store' }).then(async (x) => ({ status: x.status, ...(await x.json().catch(() => ({}))) }));
  const page = await fetch(SITE + '/video/', { cache: 'no-store' }); const html = await page.text();
  const r = { api, page: { status: page.status, state: html.includes('id="state"'), make: html.includes('id="make"'), handoff: /<meta name="verse-handoff"/.test(html), bytes: html.length } };
  fs.writeFileSync(path.join(OUT, 'clip.json'), JSON.stringify(r, null, 2)); console.log(JSON.stringify(r, null, 2));
} else { console.error('op is bench, video, clip or board'); process.exit(2); }
