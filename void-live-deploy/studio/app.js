// /studio/: play a two-voice short. One caption. The next voice starts when the last one ends.
import { parseShow } from '/lib/show-pipe.js';

const cap = document.getElementById('cap');
const canvas = document.getElementById('c');
const ctx = canvas.getContext('2d');
const status = document.getElementById('status');
let stop = false;
let t0 = performance.now();

function frame(now) {
  const t = (now - t0) / 1000;
  const g = ctx.createLinearGradient(0, 0, 540, 960);
  g.addColorStop(0, '#1a1040');
  g.addColorStop(0.5 + 0.2 * Math.sin(t * 0.7), '#0e3a66');
  g.addColorStop(1, '#3a1248');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 540, 960);
  for (let i = 0; i < 28; i++) {
    const x = (i * 90 + t * (30 + i % 4 * 12)) % 540;
    const y = (i * 130 + t * (40 + i % 5 * 8)) % 960;
    ctx.fillStyle = 'rgba(255,255,255,0.35)';
    ctx.fillRect(x, y, 3, 3);
  }
  const bar = (t * 180) % 960;
  ctx.fillStyle = 'rgba(255,255,255,0.16)';
  ctx.fillRect(0, bar, 540, 16);
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

function linesOf(text) {
  const parsed = parseShow(text);
  return parsed.lines.length ? parsed.lines : [{ who: 'Verse', text: 'Ask Verse for anything at a-to-mind.com.' }];
}

function voiceFor(who) {
  const all = window.speechSynthesis ? speechSynthesis.getVoices() : [];
  const en = all.filter((v) => /en/i.test(v.lang));
  if (who === 'Critic') return en[1] || en[0] || all[0] || null;
  return en[0] || all[0] || null;
}

function say(line) {
  return new Promise((resolve) => {
    if (stop || !window.speechSynthesis) { resolve(); return; }
    const u = new SpeechSynthesisUtterance(line.text);
    const v = voiceFor(line.who);
    if (v) u.voice = v;
    u.rate = line.who === 'Critic' ? 0.92 : 1.02;
    u.pitch = line.who === 'Critic' ? 0.7 : 1.15;
    cap.textContent = (line.who === 'Critic' ? 'CRITIC' : 'VERSE') + '\n' + line.text;
    cap.classList.add('on');
    u.onend = () => resolve();
    u.onerror = () => resolve();
    speechSynthesis.speak(u);
  });
}

document.getElementById('play').onclick = async () => {
  stop = false;
  window.speechSynthesis && speechSynthesis.cancel();
  const lines = linesOf(document.getElementById('script').value);
  status.textContent = 'Playing ' + lines.length + ' lines, one after another.';
  for (const line of lines) {
    if (stop) break;
    await say(line);
    cap.classList.remove('on');
    await new Promise((r) => setTimeout(r, 180));
  }
  if (!stop) status.textContent = 'Done. Ask Verse for anything at a-to-mind.com.';
};

document.getElementById('stop').onclick = () => {
  stop = true;
  window.speechSynthesis && speechSynthesis.cancel();
  cap.classList.remove('on');
  status.textContent = 'Stopped.';
};

async function load() {
  try {
    const shows = await fetch('/studio/shows.json', { cache: 'no-cache' }).then((r) => r.json());
    const box = document.getElementById('films');
    const shorts = shows.shorts || [];
    if (shorts.length) {
      box.innerHTML = '';
      for (const s of shorts) {
        const v = document.createElement('video');
        v.controls = true;
        v.playsInline = true;
        v.src = '/studio/' + s.file;
        v.setAttribute('aria-label', s.title || s.id);
        box.append(v);
      }
    }
  } catch (_) {}
  try {
    const scores = await fetch('/studio/scores.json', { cache: 'no-cache' }).then((r) => r.json());
    const rows = (scores.shows || []).slice(-6);
    document.getElementById('marks').textContent = rows.length
      ? rows.map((r) => r.kind + ' ' + (r.title || '').slice(0, 42) + ' · ' + [r.clarity, r.originality, r.entertainment, r.impressive].join('/') + ' · ' + (r.notes || '')).join('\n')
      : 'No scores yet.';
  } catch (_) {}
}
load();
