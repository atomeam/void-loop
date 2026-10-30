// /video/'s code, kept out of the page so the page needs no inline-script CSP rule. The clip comes from /api/clip (functions/api/clip.js), which
// stays off until Verse has made a real test clip: while it is off this page says why and the button stays off, never a sample or a stand-in.
import { mountRelated } from '/lib/toolkit.js';
import { SECONDS, ASPECTS, PROMPT_MAX, secondsOf, shapeOf, sayOf } from '/lib/video-gen.js';

/** the key /image/'s Animate this writes: the picture itself, for the preview only (the server finds the picture by its words and seed) */
export const FROM_KEY = 'a2m.void.video.from';

addEventListener('load', () => {
  const $ = (id) => document.getElementById(id);
  const q = new URLSearchParams(location.search);
  const NAMES = { landscape: 'Landscape', portrait: 'Portrait', square: 'Square' };
  const state = { seconds: secondsOf(q.get('seconds')), shape: shapeOf(q.get('shape')), from: null, on: false, checks: 0 };
  if (q.get('prompt')) $('prompt').value = q.get('prompt').slice(0, PROMPT_MAX);
  // a picture from /image/: its words, style, shape and seed travel in the link; its pixels only in this tab, for the preview
  if (q.get('from') === 'image' && q.get('pic')) {
    const seed = Math.max(0, Math.min(999999999, Math.floor(+q.get('seed') || 0)));
    state.from = { prompt: q.get('pic').slice(0, 400), negative: (q.get('neg') || '').slice(0, 200), style: q.get('style') || 'none', shape: q.get('pshape') || 'square', seed };
    if (!$('prompt').value) $('prompt').value = state.from.prompt;
    const ps = state.from.shape === 'wide' ? 'landscape' : shapeOf(state.from.shape); if (ASPECTS[ps]) state.shape = ps;
    let img = ''; try { const kept = JSON.parse(sessionStorage.getItem(FROM_KEY) || 'null'); if (kept && kept.seed === seed && kept.prompt === state.from.prompt && /^data:image\/(?:jpeg|png);base64,/.test(kept.img || '')) img = kept.img; } catch (_) {}
    $('fromBox').hidden = false;
    if (img) { $('fromImg').src = img; $('fromImg').alt = state.from.prompt; $('fromImg').hidden = false; }
    $('fromNote').textContent = '"' + state.from.prompt + '", seed ' + seed + '. The clip starts from this picture and keeps its shape.';
  }
  $('fromDrop').addEventListener('click', () => { state.from = null; $('fromBox').hidden = true; try { sessionStorage.removeItem(FROM_KEY); } catch (_) {} drawChoices(); });

  const pressed = (box, key) => { for (const b of box.children) b.setAttribute('aria-pressed', String(b.dataset.k === String(key))); };
  function drawChoices() {
    $('lens').replaceChildren(...SECONDS.map((s) => { const b = document.createElement('button'); b.type = 'button'; b.dataset.k = String(s); b.textContent = s + ' seconds'; b.addEventListener('click', () => { state.seconds = s; pressed($('lens'), s); }); return b; }));
    $('shapes').replaceChildren(...Object.keys(ASPECTS).map((k) => { const b = document.createElement('button'); b.type = 'button'; b.dataset.k = k; b.textContent = NAMES[k] + ' ' + ASPECTS[k]; b.disabled = !!state.from; b.addEventListener('click', () => { state.shape = k; pressed($('shapes'), k); }); return b; }));
    pressed($('lens'), state.seconds); pressed($('shapes'), state.shape);
  }
  drawChoices();
  const say = (t) => { $('note').textContent = t || ''; };

  // whether video is on: the server's own word, read each visit; while Verse is testing it, read again a few times
  async function check() {
    let j = null; try { j = await (await fetch('/api/clip', { cache: 'no-store' })).json(); } catch (_) { j = null; }
    if (!j) { $('state').textContent = navigator.onLine ? 'The video maker did not answer just now. Try again in a minute.' : 'Video needs the internet.'; return; }
    state.on = !!j.on; $('state').classList.toggle('on', state.on); $('make').disabled = !state.on || going;
    $('state').textContent = state.on ? 'Video is on. ' + j.clipsLeft + ' short clips left today for everyone, ' + j.perConnection + ' a day each.' : (j.say || sayOf(j.why));
    $('left').textContent = '';
    if (j.checking && state.checks++ < 4) setTimeout(check, 20000);
  }

  let going = false;
  async function make() {
    if (going || !state.on) return;
    const prompt = $('prompt').value.trim(); if (!prompt) { say(sayOf('empty')); $('prompt').focus(); return; }
    if (!navigator.onLine) { say('Video needs the internet.'); return; }
    going = true; $('make').disabled = true; say('');
    const [w, h] = ASPECTS[state.shape].split(':').map(Number);
    const f = document.createElement('figure'), fr = document.createElement('div'); fr.className = 'frame busy'; fr.style.aspectRatio = w + ' / ' + h; fr.setAttribute('aria-busy', 'true'); fr.textContent = 'Making a ' + state.seconds + ' second clip. This takes a minute or two…'; f.append(fr);
    $('out').replaceChildren(f);
    let j = null;
    try { const ctl = new AbortController(), t = setTimeout(() => ctl.abort(), 300000); j = await (await fetch('/api/clip', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ prompt, seconds: state.seconds, shape: state.shape, ...(state.from ? { from: state.from } : {}) }), signal: ctl.signal })).json(); clearTimeout(t); } catch (_) { j = null; }
    if (j && j.state === 'video' && /^https:\/\//.test(j.url || '')) {
      const v = document.createElement('video'); v.controls = true; v.playsInline = true; v.loop = true; v.muted = true; v.autoplay = true; v.src = j.url; v.setAttribute('aria-label', prompt);
      fr.classList.remove('busy'); fr.removeAttribute('aria-busy'); fr.textContent = ''; fr.append(v);
      const cap = document.createElement('figcaption'), pp = document.createElement('div'), acts = document.createElement('div');
      pp.className = 'p'; pp.textContent = prompt; acts.className = 'acts';
      const open = document.createElement('a'); open.href = j.url; open.target = '_blank'; open.rel = 'noopener noreferrer'; open.textContent = 'Open or save the clip'; acts.append(open);
      cap.append(pp, Object.assign(document.createElement('div'), { textContent: j.seconds + ' seconds · ' + NAMES[j.shape || state.shape] + (j.ms ? ' · made in ' + Math.round(j.ms / 1000) + ' s' : '') }), acts); f.append(cap);
    } else {
      const why = (j && (j.say || sayOf(j.why))) || (navigator.onLine ? sayOf('busy') : 'Video needs the internet.');
      fr.classList.remove('busy'); fr.removeAttribute('aria-busy'); fr.textContent = why; fr.style.padding = '12px';
      if (j && ['credits', 'off', 'unchecked', 'failed'].includes(j.why)) { state.on = false; check(); }
    }
    going = false; $('make').disabled = !state.on; check();
  }
  $('make').addEventListener('click', make);
  $('prompt').addEventListener('keydown', (e) => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) make(); });
  mountRelated($('related'), '/video/');
  check();
});
if ('serviceWorker' in navigator) addEventListener('load', () => { navigator.serviceWorker.register('/sw.js').catch(() => {}); }); // opens offline after one visit (sw.js TOOLS)
