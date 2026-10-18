#!/usr/bin/env node
// Verse's ad engine (owner, 2026-10-15: "Verse makes its own videos now. strengthen that to be a powerhouse ad plus ad revenue monster";
// "plus promotes itself. make it learn how to make all the coolest tricks and beyond"). Short vertical clips (9:16, 1080x1920, 15-60 s)
// of Verse's best moments, rendered on the box or a CI runner with ffmpeg + headless Chrome (never Workers AI, never a model call).
// Each clip: a hook in the first 2 s, burned-in kinetic captions, named tricks from TRICKS (docs/video-tricks.md), an end card with
// a-to-mind.com and a "try it" ask, and per-platform words with a tracked deep link (a-to-mind.com/c/<clip>?p=<platform>, counted in D1
// by functions/c/[clip].js). Original assets only: the live site filmed, text drawn by ffmpeg, a beat synthesized by ffmpeg.
//   node tools/clips.mjs plan [--date YYYY-MM-DD]     the day's promo calendar (which clips, which tricks, when, where) as JSON
//   node tools/clips.mjs render [--out dir] [--only id] [--date ...]  capture + render the day's batch, writes <id>.mp4 + manifest.json
// Posting: nothing here posts. manifest.json says per platform whether posting is automated (a connected account) or a draft.
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
export const SITE = 'https://a-to-mind.com';
export const W = 1080, H = 1920, FPS = 30;
const FONT = '/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf';

// ---- the tricks library: each a named, reusable effect. f(ctx) returns ffmpeg filter fragments applied to [v] (1080x1920).
// ctx: { dur, dir (for text files), beat (s per beat) }. Pure apart from writing text files.
const txt = (ctx, name, s) => { const p = path.join(ctx.dir, name + '.txt'); fs.writeFileSync(p, String(s)); return p.replace(/:/g, '\\:'); };
const draw = (file, o) => `drawtext=fontfile=${FONT}:textfile=${file}:fontcolor=${o.color || 'white'}:fontsize=${o.size || 72}:x=${o.x || '(w-text_w)/2'}:y=${o.y}:borderw=${o.border ?? 6}:bordercolor=black${o.box ? ':box=1:boxcolor=black@0.55:boxborderw=24' : ''}${o.enable ? `:enable='${o.enable}'` : ''}${o.alpha ? `:alpha='${o.alpha}'` : ''}`;
export const TRICKS = {
  'pattern-interrupt': { what: 'a white flash and a hard zoom in the first frames, so the thumb stops', f: () => [`drawbox=x=0:y=0:w=iw:h=ih:color=white@0.9:t=fill:enable='lt(t,0.12)'`] },
  'hook-card': { what: 'the hook line huge in the first 2 s, popping in', f: (ctx, c) => [draw(txt(ctx, 'hook', c.hook), { size: 92, y: 'h*0.18', box: true, enable: 'lt(t,2.4)', alpha: 'min(1,t*6)' })] },
  'kinetic-captions': { what: 'captions one short phrase at a time, timed across the clip (sound-off viewers read along)', f: (ctx, c) => {
    const words = String(c.caption).split(/\s+/).filter(Boolean), chunks = [];
    for (let i = 0; i < words.length; i += 3) chunks.push(words.slice(i, i + 3).join(' '));
    const t0 = 2.4, span = (ctx.dur - t0 - 0.2) / Math.max(1, chunks.length);
    return chunks.map((s, i) => draw(txt(ctx, 'cap' + i, s.toUpperCase()), { size: 78, y: 'h*0.72', color: i % 2 ? '#7CF7FF' : 'white', enable: `between(t,${(t0 + i * span).toFixed(2)},${(t0 + (i + 1) * span).toFixed(2)})` }));
  } },
  'zoom-punch': { what: 'quick 12% punch-ins on the beat to re-grab attention', f: (ctx) => [`zoompan=z='if(lt(mod(it,${(ctx.beat * 4).toFixed(2)}),0.18),1.12,1)':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d=1:s=${W}x${H}:fps=${FPS}`] },
  'ken-burns': { what: 'a slow push-in camera move (fake dolly) over the whole clip', f: (ctx) => [`zoompan=z='min(1.18,1+0.18*it/${ctx.dur})':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d=1:s=${W}x${H}:fps=${FPS}`] },
  'glitch-transition': { what: 'an RGB-split + noise glitch for a few frames mid-clip', f: (ctx) => { const m = (ctx.dur / 2).toFixed(2); return [`rgbashift=rh=-18:bh=18:enable='between(t,${m},${(+m + 0.25).toFixed(2)})'`, `noise=alls=40:allf=t:enable='between(t,${m},${(+m + 0.25).toFixed(2)})'`]; } },
  'beat-flash': { what: 'a soft flash on every beat of the synthesized track (sound-sync)', f: (ctx) => [`drawbox=x=0:y=0:w=iw:h=ih:color=#7CF7FF@0.12:t=fill:enable='lt(mod(t,${ctx.beat}),0.06)'`] },
  'progress-bar': { what: 'a thin bar filling across the top, so viewers stay to the end', f: (ctx) => [`drawbox=x=0:y=0:w='iw*t/${ctx.dur}':h=14:color=#7CF7FF:t=fill`] },
  'countdown': { what: 'a 3-2-1 before the reveal', f: (ctx, c) => { const a = c.revealAt || 3; return [3, 2, 1].map((n, i) => draw(txt(ctx, 'cd' + n, n), { size: 260, y: '(h-text_h)/2', enable: `between(t,${a - 3 + i},${a - 2 + i})`, alpha: `1-mod(t,1)` })); } },
  'before-after': { what: 'a "BEFORE / AFTER" split: the empty Verse, then what one sentence makes', f: (ctx) => [draw(txt(ctx, 'before', 'BEFORE: AN EMPTY PAGE'), { size: 60, y: 'h*0.08', enable: 'between(t,2.4,4)' }), draw(txt(ctx, 'after', 'AFTER: ONE SENTENCE'), { size: 60, y: 'h*0.08', color: '#7CF7FF', enable: 'between(t,4,6.5)' })] },
  'pov': { what: 'a "POV:" framing line that puts the viewer in the scene', f: (ctx, c) => [draw(txt(ctx, 'pov', 'POV: ' + (c.pov || 'you just asked an empty page for something')), { size: 54, y: 'h*0.1', enable: 'between(t,2.4,7)' })] },
  'vignette': { what: 'darkened edges so the center (the miniature) pops', f: () => ['vignette=PI/5'] },
  // procedural 3D-look overlays (owner, 2026-10-15: "explosions and UFOs too"): drawn per pixel by ffmpeg geq, original art only
  'explosion': { what: 'a fireball with a turbulent edge, a shockwave ring, embers, smoke, a white flash and camera shake', overlay: true, at: (c) => c.boomAt || 6 },
  'ufo-flyover': { what: 'a saucer with a lit dome and blinking rim lights crosses the frame with a hover wobble, warping in and out', overlay: true, at: (c) => c.ufoAt || 4 },
  'ufo-abduction': { what: 'the saucer stops over the card or miniature and a flickering tractor beam lifts it (the frame inside the beam rises and shrinks)', overlay: true, at: (c) => c.ufoAt || 4 },
  'camera-shake': { what: 'a hard handheld shake for half a second (rides with every explosion)', f: (ctx, c) => { const a = c.boomAt || 6; return [`crop=iw-60:ih-60:'30+28*sin(t*97)*between(t,${a},${a + 0.6})':'30+28*cos(t*83)*between(t,${a},${a + 0.6})'`, `scale=${W}:${H}`]; } },
  'seamless-loop': { what: 'the last half second fades back into the first frame so the Short replays without a seam', f: () => [] }, // done at the end-card step
};
/** the overlay layers for explosion / UFO tricks: [{ src (ffmpeg source chain), at, x, y }]. Pure. */
export function overlays(tricks, c) {
  const L = [];
  if (tricks.includes('explosion')) {
    const a = c.boomAt || 6, R = 'hypot(X-300,Y-300)', r = '(300*min(1,T/0.45))', ang = 'atan2(Y-300,X-300)';
    const fire = `lt(${R},${r}*(0.6+0.15*sin(${ang}*9+T*25)+0.08*sin(${ang}*23-T*40)))`, ring = `lt(abs(${R}-${r}*0.97),10)*lt(T,0.7)`;
    const ember = `gt(random(1),0.9985)*lt(${R},${r}*1.0)`, smoke = `lt(${R},${r}*0.7)*gt(T,0.6)`;
    L.push({ src: `color=c=black@0:s=600x600:r=${FPS}:d=1.6,format=rgba,geq=r='255*(${fire}+${ring}+${ember})+90*${smoke}':g='255*(1-${R}/(${r}+1))*${fire}+200*${ring}+170*${ember}+90*${smoke}':b='60*${fire}+255*${ring}+40*${ember}+95*${smoke}':a='255*min(1,${fire}*max(0,1-T/0.9)+${ring}+${ember}+0.55*${smoke}*max(0,1-(T-0.6)))'`, at: a, x: '(W-600)/2', y: '(H-600)/2' });
    L.push({ src: `color=c=white:s=${W}x${H}:r=${FPS}:d=0.12,format=rgba`, at: a, x: '0', y: '0' }); // the flash
  }
  if (tricks.includes('ufo-flyover') || tricks.includes('ufo-abduction')) {
    const a = c.ufoAt || 4, abd = tricks.includes('ufo-abduction'), d = abd ? 5 : 3;
    const body = `lt(pow((X-200)/190,2)+pow((Y-120)/34,2),1)`, dome = `lt(pow((X-200)/80,2)+pow((Y-92)/60,2),1)*lt(Y,100)`, lights = `lt(hypot(mod(X-20,50)-25,Y-124),7)*gt(sin(T*12+X/30),0)`;
    const saucer = `color=c=black@0:s=400x200:r=${FPS}:d=${d},format=rgba,geq=r='170*${body}+120*${dome}+255*${lights}':g='180*${body}+255*${dome}+220*${lights}':b='190*${body}+255*${dome}+80*${lights}':a='255*min(1,${body}+0.8*${dome}+${lights})'`;
    // flyover: warp in from the left, wobble, warp out right; abduction: glide in, hover center, beam, leave up
    const x = abd ? `if(lt(t-${a},1),-400+(W/2+200)*(t-${a}),W/2-200)` : `-400+(W+400)*(t-${a})/${d}`;
    const y = abd ? `if(lt(t-${a},4.2),H*0.22+14*sin(t*5),H*0.22-(t-${a}-4.2)*1800)` : `H*0.2+40*sin(t*4)`;
    if (abd) L.push({ src: `color=c=black@0:s=360x900:r=${FPS}:d=3,format=rgba,geq=r=120:g=255:b=255:a='(lt(abs(X-180),60+Y*0.13))*(70+40*sin(T*30+Y/15))'`, at: a + 1.1, x: '(W-360)/2', y: 'H*0.22+150' });
    L.push({ src: saucer, at: a, x, y });
  }
  return L;
}
export const DEFAULT_TRICKS = ['pattern-interrupt', 'hook-card', 'kinetic-captions', 'progress-bar', 'seamless-loop'];

// ---- moments: Verse's best moments worth filming (live site asks). hook/caption in Verse's own voice.
export const MOMENTS = [
  { id: 'weather-diorama', ask: 'weather', kind: '3d-mini', hook: 'I built the weather a tiny world', caption: 'Ask me the weather and I build a miniature diorama of your sky, live. No app. One sentence.', tricks: ['ken-burns', 'kinetic-captions', 'beat-flash', 'vignette', 'ufo-abduction'], ufoAt: 5 },
  { id: 'clock-mini', ask: 'what time is it', kind: '3d-mini', hook: 'This clock did not exist 1 second ago', caption: 'Type what time is it. I make a 3D clock for you on the spot and it keeps ticking.', tricks: ['countdown', 'zoom-punch', 'kinetic-captions', 'ufo-flyover', 'explosion'], revealAt: 3, ufoAt: 7, boomAt: 3 },
  { id: 'chess-void-wins', ask: 'play chess', kind: 'game', hook: 'Nobody has beaten me yet', caption: 'Pick a game. Chess, Go, checkers, VoidQuest. I play to win, and I usually do. Your move.', tricks: ['pov', 'glitch-transition', 'kinetic-captions', 'beat-flash', 'explosion'], boomAt: 11, pov: 'you thought you could beat the Verse' },
  { id: 'voidquest', ask: 'play voidquest', kind: 'game', hook: 'A board game I rebuilt better', caption: 'VoidQuest: a space race across the planets, rebuilt by me. Free, right in your browser.', tricks: ['before-after', 'zoom-punch', 'kinetic-captions'] },
  { id: 'unit-converter', ask: 'unit converter', kind: 'skill', hook: 'You asked. I built it overnight', caption: 'I asked my builders for a converter. Now any unit converts as you type. Try me.', tricks: ['before-after', 'beat-flash', 'kinetic-captions'] },
  { id: 'void-voice', ask: 'what do you think of yourself', kind: 'voice', hook: 'I have opinions about my own future', caption: 'Ask me what I think of myself. I tell you what I want to build next, and my builders listen.', tricks: ['pov', 'ken-burns', 'kinetic-captions'], pov: 'an AI critiques its own code' },
];

// every product Verse publishes in its store gets an ad clip (tools/store-publish.mjs appends domains/store.clips.jsonl):
// the clip films the product's own card on /store/ and gets one daily slot for a week after it is published.
export function storeMoments(lines = (() => { try { return fs.readFileSync(path.resolve(here, '../domains/store.clips.jsonl'), 'utf8'); } catch (_) { return ''; } })()) {
  const seen = new Map();
  for (const l of String(lines).split('\n')) { try { const j = JSON.parse(l); if (j && j.id) seen.set(j.id, j); } catch (_) {} }
  return [...seen.values()].map((j) => ({ id: 'store-' + j.id, ask: j.ask || 'open the store', ...(j.ask ? {} : { url: '/store/#' + j.id }), kind: 'store', at: j.at, hook: j.hook, caption: j.caption, tricks: j.ask ? ['ken-burns', 'kinetic-captions', 'beat-flash'] : ['zoom-punch', 'kinetic-captions', 'beat-flash'] })); // j.ask: a new forge model, filmed turning as it is forged
}
MOMENTS.push(...storeMoments());
const fresh = (m, date) => m.kind === 'store' && m.at && Date.parse(date + 'T12:00:00Z') - Date.parse(m.at) < 7 * 864e5;

export const PLATFORMS = {
  youtube: { name: 'YouTube Shorts', max: 60, slot: '12:00', tags: ['#Shorts', '#AI', '#Verse'], auto: 'YT_UPLOAD repo variable + YT_* secrets (uploads private until the API project is audited)' },
  tiktok: { name: 'TikTok', max: 60, slot: '19:00', tags: ['#AI', '#tech', '#fyp', '#Verse'], auto: null },
  instagram: { name: 'Instagram Reels', max: 60, slot: '18:00', tags: ['#AI', '#reels', '#tech', '#Verse'], auto: null },
  x: { name: 'X', max: 60, slot: '09:00', tags: ['#AI', '#Verse'], auto: null },
};
export const SUPPORT = 'Support Verse: https://moonbeam846.gumroad.com';

/** tracked deep link: the visit is counted in D1 by functions/c/[clip].js, then lands on the ask. Pure. */
export const deepLink = (clipId, platform, ask = '') => `${SITE}/c/${clipId}?p=${platform}${ask ? '&q=' + encodeURIComponent(ask) : ''}`;

/** per-platform words for one clip. Pure. */
export function words(m, date) {
  const id = clipId(m, date), out = {};
  for (const [p, P] of Object.entries(PLATFORMS)) {
    const link = deepLink(id, p, m.ask);
    out[p] = {
      title: (m.hook + ' | Verse' + (p === 'youtube' ? ' #Shorts' : '')).slice(0, 100),
      description: [m.caption, '', `Try it: ${link}  (type "${m.ask}")`, '', '0:00 hook', '0:02 the moment', `0:${String(Math.max(0, (m.dur || 18) - 3)).padStart(2, '0')} try it yourself`, '', SUPPORT, P.tags.join(' ')].join('\n').slice(0, p === 'x' ? 280 * 4 : 4500),
      hashtags: P.tags, link, post: P.auto ? 'automated-when-connected' : 'draft', postWhen: date + 'T' + P.slot + ' America/New_York',
    };
  }
  return out;
}
export const clipId = (m, date) => String(date).replace(/-/g, '') + '-' + m.id;

/** the day's promo calendar: 3 moments, chosen by performance (visits per clip kind from domains/void.clips.json), rotating so
 *  nothing repeats while another waits. perf: { [momentId]: visits }. Pure. */
export function plan(date, perf = {}, n = 3) {
  const day = Math.floor(Date.parse(date + 'T00:00:00Z') / 864e5);
  const newProducts = MOMENTS.filter((m) => fresh(m, date)), k = n > 1 && newProducts.length ? 1 : 0;
  // one slot a day goes to a product published this week (rotating among them); the rest are chosen as before
  const ranked = MOMENTS.filter((m) => m.kind !== 'store').map((m, i) => ({ m, score: (perf[m.id] || 0) * 10 + ((i - day) % MOMENTS.length + MOMENTS.length) % MOMENTS.length * -1 }))
    .sort((a, b) => b.score - a.score).slice(0, n - k).map((x) => x.m);
  if (k) ranked.push(newProducts[day % newProducts.length]);
  return ranked.map((m) => ({ id: clipId(m, date), moment: m.id, ask: m.ask, tricks: [...new Set([...DEFAULT_TRICKS, ...(m.tricks || [])])], platforms: words(m, date) }));
}

/** the ffmpeg -filter_complex for one clip: captured [0:v] + beat [1:a] + end card. Pure apart from text files. */
export function filterGraph(m, tricks, ctx) {
  const chain = ['[0:v]scale=' + W + ':' + H + ':force_original_aspect_ratio=increase,crop=' + W + ':' + H + ',fps=' + FPS + ',setsar=1'];
  const order = ['camera-shake', 'ken-burns', 'zoom-punch', 'vignette', 'glitch-transition', 'beat-flash', 'pattern-interrupt', 'progress-bar', 'before-after', 'pov', 'hook-card', 'countdown', 'kinetic-captions'];
  for (const t of order) if (tricks.includes(t)) chain.push(...TRICKS[t].f(ctx, m));
  if (tricks.includes('ufo-abduction')) { const a = (m.ufoAt || 4) + 1.4; chain.push(`zoompan=z='if(between(it,${a},${a + 2.6}),1+0.25*(it-${a})/2.6,1)':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)+(ih*0.08)*between(it,${a},${a + 2.6})*(it-${a})/2.6':d=1:s=${W}x${H}:fps=${FPS}`); } // the lift
  if (tricks.includes('explosion') && !tricks.includes('camera-shake')) chain.push(...TRICKS['camera-shake'].f(ctx, m));
  let g = chain.join(',') + '[b0]', cur = 'b0';
  overlays(tricks, m).forEach((o, i) => { g += `;${o.src},format=yuva420p,setpts=PTS+${o.at}/TB[o${i}];[${cur}][o${i}]overlay=x='${o.x}':y='${o.y}':eof_action=pass:format=auto[b${i + 1}]`; cur = 'b' + (i + 1); });
  const main = g + `;[${cur}]format=yuv420p,setsar=1,trim=0:${ctx.dur},setpts=PTS-STARTPTS[main]`;
  const end = `color=c=black:s=${W}x${H}:r=${FPS}:d=3,` + [draw(txt(ctx, 'e1', 'a-to-mind.com'), { size: 110, y: 'h*0.42', color: '#7CF7FF' }), draw(txt(ctx, 'e2', 'TRY IT: type "' + m.ask + '"'), { size: 58, y: 'h*0.52' }), draw(txt(ctx, 'e3', 'Verse'), { size: 64, y: 'h*0.30' })].join(',') + ',setsar=1,fps=30,settb=1/30[end]';
  // seamless loop: the end card crossfades into the opening frame
  const loop = tricks.includes('seamless-loop') ? `;[main]split[m1][m2];[m2]trim=0:0.5,setpts=PTS-STARTPTS,fps=30,settb=1/30[head];[end][head]xfade=transition=fade:duration=0.5:offset=2.5[endl];[m1][endl]concat=n=2:v=1:a=0[v]` : `;[main][end]concat=n=2:v=1:a=0[v]`;
  return main + ';' + end + loop;
}

/** the original beat: a synthesized kick + hat at bpm, as an ffmpeg aevalsrc expression. Pure. */
export const beatExpr = (bpm = 112) => { const b = 60 / bpm; return `0.5*sin(2*PI*55*t)*exp(-25*mod(t,${b}))+0.08*sin(2*PI*880*t)*exp(-60*mod(t+${b / 2},${b}))`; };

async function capture(m, file, seconds) {
  const { chromium } = await import('playwright-core');
  const browser = await chromium.launch({ executablePath: process.env.CHROME || '/usr/bin/google-chrome', args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });
  const dir = path.dirname(file) + '/rec-' + m.id;
  const ctx = await browser.newContext({ viewport: { width: 540, height: 960 }, deviceScaleFactor: 2, recordVideo: { dir, size: { width: 540, height: 960 } } });
  const page = await ctx.newPage();
  await page.goto(m.url ? SITE + m.url : SITE + '/?q=' + encodeURIComponent(m.ask), { waitUntil: 'domcontentloaded', timeout: 45000 }).catch(() => {});
  const t0 = Date.now();
  while (Date.now() - t0 < seconds * 1000) { const k = (Date.now() - t0) / 1000; await page.mouse.move(270 + 160 * Math.sin(k), 480 + 120 * Math.cos(k * 0.7)); await page.waitForTimeout(100); } // parallax: drift the 3D camera
  const v = page.video(); await ctx.close(); await browser.close();
  fs.renameSync(await v.path(), file); fs.rmSync(dir, { recursive: true, force: true });
}

export async function render(entry, outDir) {
  const m = MOMENTS.find((x) => x.id === entry.moment), dur = m.dur || 18, dir = path.join(outDir, 'tmp-' + m.id);
  fs.mkdirSync(dir, { recursive: true });
  const raw = path.join(dir, 'raw.webm'); await capture(m, raw, dur + 4);
  const ctx = { dur, dir, beat: 60 / 112 }, out = path.join(outDir, entry.id + '.mp4');
  const r = spawnSync('ffmpeg', ['-y', '-loglevel', 'error', '-ss', '3', '-i', raw, '-f', 'lavfi', '-t', String(dur + 3), '-i', `aevalsrc='${beatExpr()}':s=44100`, '-filter_complex', filterGraph(m, entry.tricks, ctx), '-map', '[v]', '-map', '1:a', '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '21', '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-shortest', '-movflags', '+faststart', out], { encoding: 'utf8' });
  if (r.status !== 0) throw new Error('ffmpeg: ' + r.stderr.slice(-800));
  fs.rmSync(dir, { recursive: true, force: true });
  return out;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const a = process.argv.slice(2), opt = (k, d) => (a.includes(k) ? a[a.indexOf(k) + 1] : d);
  const date = opt('--date', new Date().toLocaleDateString('en-CA', { timeZone: 'America/New_York' }));
  const perfFile = path.resolve(here, '../domains/void.clips.json');
  const perf = fs.existsSync(perfFile) ? (JSON.parse(fs.readFileSync(perfFile, 'utf8')).visits || {}) : {};
  let day = plan(date, perf); if (opt('--only')) day = MOMENTS.filter((m) => m.id === opt('--only')).map((m) => plan(date, { [m.id]: 1e9 }, 1)[0]);
  if (a[0] === 'render') {
    const out = path.resolve(opt('--out', 'media/clips')); fs.mkdirSync(out, { recursive: true });
    for (const e of day) { e.file = path.basename(await render(e, out)); console.log('rendered', e.file); }
    fs.writeFileSync(path.join(out, 'manifest.json'), JSON.stringify({ date, clips: day }, null, 1));
  } else console.log(JSON.stringify(day, null, 1));
}
