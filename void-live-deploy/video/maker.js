// The video maker on /video/: a topic or a script in, a 1080x1920 short out, made on this device. The script is the visitor's own, or
// lines picked from the Wikipedia article (lib/video-maker.js); the pictures are that article's photos on Wikimedia Commons, credited on
// screen; the voice is Kokoro (open weights, Apache-2.0, vendor/kokoro-js-1.2.1) run in this browser; the music is the site's own piano
// (sounds/piano, CC0). Nothing typed is sent anywhere but Wikipedia's search; the film never leaves the device unless it is shared.
import { scriptFrom, scriptOwn, isScript, chunks, chunkAt, timeline, keywords, photoOk, creditOf } from '../lib/video-maker.js';

const $ = (id) => document.getElementById(id);
const W = 1080, H = 1920, FPS = 30;
const WIKI = 'https://en.wikipedia.org/w/api.php?format=json&origin=*&';
const say = (t) => { $('mkNote').textContent = t; };

async function json(url) {
  const r = await fetch(url);
  if (!r.ok) throw new Error('Wikipedia said ' + r.status);
  return r.json();
}

/** the article for a topic: its title, plain text and photos */
async function article(topic) {
  const found = await json(WIKI + 'action=query&list=search&srlimit=1&srsearch=' + encodeURIComponent(topic));
  const hit = found.query && found.query.search && found.query.search[0];
  if (!hit) throw new Error('Wikipedia has no article on that. Try other words, or write your own script.');
  const t = encodeURIComponent(hit.title);
  const [ex, im] = await Promise.all([
    json(WIKI + 'action=query&prop=extracts&explaintext=1&exsectionformat=plain&exchars=9000&redirects=1&titles=' + t),
    json(WIKI + 'action=query&generator=images&gimlimit=40&prop=imageinfo&iiprop=url|size|extmetadata&iiurlwidth=1080&redirects=1&titles=' + t),
  ]);
  const page = Object.values((ex.query && ex.query.pages) || {})[0] || {};
  const photos = Object.values((im.query && im.query.pages) || {}).map((p) => p.imageinfo && p.imageinfo[0]).filter(photoOk)
    .map((i) => ({ src: i.thumburl || i.url, credit: creditOf(i.extmetadata) }));
  return { title: hit.title, text: String(page.extract || '').split(/\n\s*(See also|References|Notes|External links)\s*\n/)[0], photos };
}

/** more photos from Commons for words the article had no picture of */
async function commons(words, n = 6) {
  const j = await json('https://commons.wikimedia.org/w/api.php?format=json&origin=*&action=query&generator=search&gsrnamespace=6&gsrlimit=' + n * 2
    + '&prop=imageinfo&iiprop=url|size|extmetadata&iiurlwidth=1080&gsrsearch=' + encodeURIComponent(words + ' filetype:bitmap'));
  return Object.values((j.query && j.query.pages) || {}).map((p) => p.imageinfo && p.imageinfo[0]).filter(photoOk).slice(0, n)
    .map((i) => ({ src: i.thumburl || i.url, credit: creditOf(i.extmetadata) }));
}

const load = (src) => new Promise((ok) => { const im = new Image(); im.crossOrigin = 'anonymous'; im.onload = () => ok(im); im.onerror = () => ok(null); im.src = src; });

let worker = null;
/** the voice lines, recorded by Kokoro in a worker (video/voice-worker.js) */
function voices(lines, voiceName) {
  worker = worker || new Worker('/video/voice-worker.js', { type: 'module' });
  return new Promise((ok, no) => {
    const end = () => { worker.terminate(); worker = null; }; // the model's memory goes back before filming (phones)
    worker.onmessage = ({ data }) => { if (data.progress) say(data.progress); else if (data.error) { end(); no(new Error(data.error)); } else { end(); ok(data.clips); } };
    worker.onerror = (e) => no(new Error('The voice could not start in this browser' + (e && e.message ? ': ' + e.message : '')));
    worker.postMessage({ lines, voice: voiceName });
  });
}

/** the voice from the site's own text-to-speech (MeloTTS on Workers AI, /api/rapvoice): fast on any phone. null when it is resting. */
async function serverVoices(lines) {
  const ctx = new OfflineAudioContext(1, 1, 44100);
  say('Recording the voice…');
  const parts = lines.map((l) => l.match(/.{1,138}(?:[,;:.!?]\s|$)|.{1,138}\s/g) || [l]);
  const bufs = await Promise.all(parts.map((ps) => Promise.all(ps.map((p) => fetch('/api/rapvoice?t=' + encodeURIComponent(p.trim())).then((r) => { if (!r.ok) throw new Error('voice ' + r.status); return r.arrayBuffer(); }).then((a) => ctx.decodeAudioData(a))))));
  return bufs.map((list) => {
    const rate = list[0].sampleRate, n = list.reduce((a, b) => a + b.length, 0), audio = new Float32Array(n);
    let at = 0; for (const b of list) { audio.set(b.getChannelData(0), at); at += b.length; }
    return { audio, rate };
  });
}

/** the piano bed: I-vi-IV-V in C at 80 beats a minute, from the site's own samples, quiet under the voice */
async function piano(ctx, total, scenes) {
  const notes = [[48, 52, 55], [45, 48, 52], [41, 45, 48], [43, 47, 50]], beat = 60 / 80, bases = [36, 40, 44, 48, 52, 56, 60, 64, 68], bufs = {};
  const got = await Promise.all(bases.map((b) => fetch('/sounds/piano/' + b + '-soft.wav').then((r) => (r.ok ? r.arrayBuffer() : null)).then((a) => (a ? ctx.decodeAudioData(a) : null)).catch(() => null)));
  bases.forEach((b, i) => { bufs[b] = got[i]; });
  const bus = ctx.createGain(); bus.connect(ctx.destination); bus.gain.setValueAtTime(0.22, 0);
  for (const s of scenes) { bus.gain.setTargetAtTime(0.07, Math.max(0, s.start - 0.15), 0.08); bus.gain.setTargetAtTime(0.16, s.end + 0.05, 0.15); }
  for (let t = 0, bar = 0; t < total - 1; t += beat * 4, bar++) {
    for (const m of notes[bar % 4]) for (const off of [0, beat * 2]) {
      const n = m + (off ? 12 : 0), base = Math.max(36, Math.min(68, Math.floor(n / 4) * 4)), buf = bufs[base]; if (!buf) continue;
      const src = ctx.createBufferSource(); src.buffer = buf; src.playbackRate.value = Math.pow(2, (n - base) / 12);
      const g = ctx.createGain(); g.gain.value = off ? 0.25 : 0.4; src.connect(g); g.connect(bus); src.start(t + off);
    }
  }
  bus.gain.setTargetAtTime(0.0001, total - 1.2, 0.3);
}

/** the whole soundtrack, mixed offline: the voice lines at their times over the piano */
async function soundtrack(lines, voiceName) {
  const clips = await serverVoices(lines).catch(() => null) || await voices(lines, voiceName);
  const plan = timeline(clips.map((c) => c.audio.length / c.rate));
  const ctx = new OfflineAudioContext(2, Math.ceil(plan.total * 44100), 44100);
  await piano(ctx, plan.total, plan.scenes);
  clips.forEach((c, i) => {
    const b = ctx.createBuffer(1, c.audio.length, c.rate); b.copyToChannel(c.audio, 0);
    const src = ctx.createBufferSource(); src.buffer = b; const g = ctx.createGain(); g.gain.value = 1.15; src.connect(g); g.connect(ctx.destination); src.start(plan.scenes[i].start);
  });
  return { audio: await ctx.startRendering(), plan };
}

function cover(g, im, k, dir) {
  const s = Math.max(W / im.width, H / im.height) * (1.06 + 0.12 * k), w = im.width * s, h = im.height * s;
  const x = (W - w) / 2 + (dir ? 1 : -1) * 60 * (k - 0.5), y = (H - h) / 2 + 40 * (0.5 - k);
  g.drawImage(im, x, y, w, h);
}
function box(g, text, y, size, fill = '#fff') {
  g.font = '700 ' + size + 'px system-ui, -apple-system, "Segoe UI", sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
  const w = g.measureText(text).width + 56, h = size * 1.45;
  g.fillStyle = 'rgba(10,10,16,.72)'; g.beginPath(); g.roundRect(W / 2 - w / 2, y - h / 2, w, h, 22); g.fill();
  g.fillStyle = fill; g.fillText(text, W / 2, y + 2);
}

/** one frame at time t */
function frame(g, t, film) {
  const { plan, pics, lines } = film, sc = plan.scenes;
  g.fillStyle = '#0b0a10'; g.fillRect(0, 0, W, H);
  if (t < plan.voiceEnd + 0.4) {
    let i = sc.findIndex((s, j) => t < (sc[j + 1] ? sc[j + 1].start : Infinity)); if (i < 0) i = sc.length - 1;
    const from = i ? sc[i].start - 0.2 : 0, to = sc[i + 1] ? sc[i + 1].start : plan.voiceEnd + 0.4, k = Math.min(1, Math.max(0, (t - from) / (to - from)));
    const p = pics[i % pics.length];
    if (p && p.im) cover(g, p.im, k, i % 2);
    const prev = i && pics[(i - 1) % pics.length], fade = i ? Math.min(1, (t - sc[i].start + 0.2) / 0.45) : 1;
    if (prev && prev.im && fade < 1) { g.globalAlpha = 1 - fade; cover(g, prev.im, 1, (i - 1) % 2); g.globalAlpha = 1; }
    const shade = g.createLinearGradient(0, H * 0.45, 0, H); shade.addColorStop(0, 'rgba(0,0,0,0)'); shade.addColorStop(1, 'rgba(0,0,0,.75)'); g.fillStyle = shade; g.fillRect(0, 0, W, H);
    const top = g.createLinearGradient(0, 0, 0, 300); top.addColorStop(0, 'rgba(0,0,0,.55)'); top.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = top; g.fillRect(0, 0, W, 300);
    if (film.heading) { g.font = '600 40px system-ui, sans-serif'; g.textAlign = 'center'; g.fillStyle = 'rgba(255,255,255,.92)'; g.fillText(film.heading.slice(0, 34), W / 2, 200); }
    const s = sc[i];
    if (t >= s.start && t <= s.end + 0.25) box(g, chunkAt(chunks(lines[i]), t - s.start, s.end - s.start), 1340, 70, i === lines.length - 1 ? '#ffd166' : '#fff');
    if (p && p.credit) { g.font = '400 26px system-ui, sans-serif'; g.fillStyle = 'rgba(255,255,255,.7)'; g.fillText(p.credit.slice(0, 64), W / 2, 1770); }
  } else {
    const a = Math.min(1, (t - plan.voiceEnd - 0.4) / 0.6); g.globalAlpha = a;
    g.font = '800 150px system-ui, sans-serif'; g.textAlign = 'center'; g.fillStyle = '#ecebf5'; g.fillText('Verse', W / 2, H / 2 - 30);
    g.fillStyle = '#a58bff'; g.fillRect(W / 2 - 70, H / 2 + 40, 140, 6);
    g.font = '500 46px system-ui, sans-serif'; g.fillStyle = 'rgba(236,235,245,.75)'; g.fillText('a-to-mind.com', W / 2, H / 2 + 120); g.globalAlpha = 1;
  }
  if (t < 0.7) { g.fillStyle = 'rgba(11,10,16,' + (1 - t / 0.7) + ')'; g.fillRect(0, 0, W, H); }
}

/** plays the soundtrack and records the canvas with it, in real time */
async function record(film, canvas) {
  const g = canvas.getContext('2d'), ctx = new AudioContext(), dest = ctx.createMediaStreamDestination();
  const src = ctx.createBufferSource(); src.buffer = film.audio; src.connect(dest);
  const stream = new MediaStream([...canvas.captureStream(FPS).getVideoTracks(), ...dest.stream.getAudioTracks()]);
  const type = ['video/mp4;codecs=avc1.42E01F,mp4a.40.2', 'video/mp4', 'video/webm;codecs=vp9,opus', 'video/webm'].find((m) => MediaRecorder.isTypeSupported(m)) || '';
  const rec = new MediaRecorder(stream, { mimeType: type, videoBitsPerSecond: 6e6 }), parts = [];
  rec.ondataavailable = (e) => e.data.size && parts.push(e.data);
  const done = new Promise((ok) => { rec.onstop = ok; });
  frame(g, 0, film); rec.start(500); const t0 = ctx.currentTime + 0.1; src.start(t0);
  await new Promise((ok) => { const tick = () => { const t = ctx.currentTime - t0; frame(g, Math.max(0, t), film); say('Filming… ' + Math.min(100, Math.round(t / film.plan.total * 100)) + '% (keep this tab open)'); if (t < film.plan.total) requestAnimationFrame(tick); else ok(); }; tick(); });
  rec.stop(); await done; ctx.close();
  return new Blob(parts, { type: (type || 'video/webm').split(';')[0] });
}

async function make() {
  const text = $('mkText').value.trim();
  if (!text) { say('Type a topic or your own script first.'); return; }
  $('mkGo').disabled = true; $('mkOut').hidden = true;
  try {
    say('Reading Wikipedia…');
    let script, photos = [];
    if (isScript(text)) {
      script = scriptOwn(text);
      photos = (await Promise.all(script.lines.slice(0, 6).map((l) => commons(keywords(l).join(' ') || script.title, 2).catch(() => [])))).flat();
    } else {
      const a = await article(text); script = scriptFrom(a.title, a.text); photos = a.photos;
      if (!script) throw new Error('That article is too short to make a video from. Try a bigger topic, or write your own script.');
      if (photos.length < 4) photos.push(...await commons(a.title, 6).catch(() => []));
    }
    if (!photos.length) throw new Error('No free photos found for that. Try other words.');
    say('Fetching the photos…');
    const pics = (await Promise.all(photos.slice(0, 7).map(async (p) => ({ ...p, im: await load(p.src) })))).filter((p) => p.im);
    if (!pics.length) throw new Error('The photos would not load. Try again.');
    const { audio, plan } = await soundtrack(script.lines, $('mkVoice').value);
    const canvas = $('mkCanvas'); canvas.width = W; canvas.height = H; canvas.hidden = false;
    const blob = await record({ audio, plan, pics, lines: script.lines, heading: isScript(text) ? '' : script.title }, canvas);
    canvas.hidden = true;
    const url = URL.createObjectURL(blob), ext = blob.type.includes('mp4') ? 'mp4' : 'webm', name = script.title.replace(/[^\w]+/g, '-').toLowerCase().slice(0, 40) + '.' + ext;
    $('mkVideo').src = url; $('mkDl').href = url; $('mkDl').download = name; $('mkOut').hidden = false;
    $('mkCredits').textContent = 'Words: ' + (isScript(text) ? 'yours' : 'Wikipedia, "' + script.title + '" (CC BY-SA 4.0)') + '. ' + [...new Set(pics.map((p) => p.credit))].join('; ') + '. Voice: Kokoro. Music: Verse piano.';
    const file = new File([blob], name, { type: blob.type });
    $('mkShare').hidden = !(navigator.canShare && navigator.canShare({ files: [file] }));
    $('mkShare').onclick = () => navigator.share({ files: [file], title: script.title }).catch(() => {});
    say('Done: ' + Math.round(plan.total) + ' seconds. Download it or share it.');
  } catch (e) {
    say(String((e && e.message) || e));
  } finally { $('mkGo').disabled = false; }
}

$('mkGo').addEventListener('click', make);
const q = new URLSearchParams(location.search).get('topic'); if (q) $('mkText').value = q;
if (!window.MediaRecorder || !HTMLCanvasElement.prototype.captureStream) { $('mkGo').disabled = true; say('This browser cannot record video. Try a recent Chrome, Edge, Firefox or Safari.'); }
