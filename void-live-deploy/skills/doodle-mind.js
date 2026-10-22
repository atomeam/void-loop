/**
 * doodle-mind skill — Mind Field's Doodle Mind mode: draw on the living field and it guesses your next stroke; drag its orbs, tilt it or let it listen.
 * Combined from the best parts of
 * frontier drafts F-224 (thought-trace lattice: your last strokes rewrite the lattice's rule and it guesses your next stroke as oracle
 * nodes), F-225 (acoustic causal lattice: sound feeds the field, only after you press Listen, as a level number never a recording) and
 * F-229 (causal attention probes: a small attention head over tilt, field energy and sound moves orbs you can drag, and they feed back;
 * its mood sets the card's colours). The law is lib/field-doodle.js (pure, tested); the card is lib/field-stage.js, which also puts the
 * Mind Field mode switcher on it. Canvas2D: the lattice is 48x36 cells, about 0.2 ms a step, so a GPU would add a round trip, not speed.
 * Contract: { name, examples, nearMisses, match(lower, text), run(text, api) }
 */
import { fieldSkill } from '../lib/field-stage.js';
import * as D from '../lib/field-doodle.js';

const SAY = 'Mind Field, Doodle Mind mode: draw on it and it guesses your next stroke; drag the orbs, tap Tilt or Listen to feed it, Mode for the other eight modes';

/** the Listen button (the mic only after a press, a level number in memory only), the draggable orbs and the oracle nodes. */
export function mount({ el, q, th, input, cv }) {
  const btns = q('.ff-btns'), listen = document.createElement('button');
  listen.type = 'button'; listen.className = 'g-btn mf-listen'; listen.textContent = 'Listen'; listen.setAttribute('aria-pressed', 'false');
  listen.title = 'feed the field with the sound level around you (asks for the microphone; only a number is used, nothing is recorded or sent)';
  listen.addEventListener('pointerdown', (e) => e.stopPropagation());
  btns.insertBefore(listen, q('.ff-reset'));
  let mic = null, an = null, ctx = null, buf = null;
  const stop = () => { try { mic && mic.getTracks().forEach((t) => t.stop()); ctx && ctx.close(); } catch (_) { /* gone */ } mic = an = ctx = null; input.audio = 0; listen.textContent = 'Listen'; listen.setAttribute('aria-pressed', 'false'); el.dataset.listening = '0'; };
  if (!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia) || !(window.AudioContext || window.webkitAudioContext)) { listen.disabled = true; listen.textContent = 'Listen unavailable'; }
  listen.addEventListener('click', async () => {
    if (mic) { stop(); return; }
    try {
      mic = await navigator.mediaDevices.getUserMedia({ audio: true }); const AC = window.AudioContext || window.webkitAudioContext;
      ctx = new AC(); an = ctx.createAnalyser(); an.fftSize = 256; ctx.createMediaStreamSource(mic).connect(an); buf = new Uint8Array(an.frequencyBinCount);
      listen.textContent = 'Stop listening'; listen.setAttribute('aria-pressed', 'true'); el.dataset.listening = '1';
    } catch (_) { stop(); listen.textContent = 'Microphone not allowed'; }
  });
  const hear = setInterval(() => { if (!an) return; an.getByteFrequencyData(buf); let s = 0; for (const v of buf) s += v; input.audio = Math.min(1, s / buf.length / 90); }, 50);

  // the orbs and oracle nodes are DOM, over the canvas: drag an orb and it holds there and feeds the field where it sits
  const frame = q('.ff-frame'); frame.style.position = 'relative';
  const node = (cls, label) => { const d = document.createElement('div'); d.className = cls; d.setAttribute('aria-label', label); frame.appendChild(d); return d; };
  const orbs = th.state.orbs.map((o, i) => { const d = node('mf-orb', 'orb ' + (i + 1) + ' (drag me)'); d.setAttribute('role', 'button'); d.tabIndex = 0; d.style.cssText = 'position:absolute;width:18px;height:18px;margin:-9px 0 0 -9px;border-radius:50%;cursor:grab;touch-action:none;background:radial-gradient(circle,#fff 0,hsl(var(--mf-hue,200),90%,65%) 45%,transparent 72%);box-shadow:0 0 12px hsl(var(--mf-hue,200),90%,60%)'; return d; });
  const oracles = Array.from({ length: D.ORACLES }, (_, i) => { const d = node('mf-oracle', 'a guess of where your stroke goes next'); d.style.cssText = 'position:absolute;width:12px;height:12px;margin:-6px 0 0 -6px;border-radius:3px;border:1.5px solid rgba(255,255,255,.8);pointer-events:none;transition:opacity .2s;opacity:0'; return d; });
  orbs.forEach((d, i) => {
    d.addEventListener('pointerdown', (e) => { e.stopPropagation(); e.preventDefault(); const o = th.state.orbs[i]; if (!o) return; o.held = true; d.style.cursor = 'grabbing'; try { d.setPointerCapture(e.pointerId); } catch (_) { /* fine */ } });
    d.addEventListener('pointermove', (e) => { const o = th.state.orbs[i]; if (!o || !o.held) return; const r = cv.getBoundingClientRect(); o.x = Math.min(0.98, Math.max(0.02, (e.clientX - r.left) / r.width)); o.y = Math.min(0.98, Math.max(0.02, (e.clientY - r.top) / r.height)); el.dataset.dragged = String((+el.dataset.dragged || 0) + 1); });
    const up = () => { const o = th.state.orbs[i]; if (o) o.held = false; d.style.cursor = 'grab'; };
    d.addEventListener('pointerup', up); d.addEventListener('pointercancel', up);
    d.addEventListener('keydown', (e) => { const o = th.state.orbs[i], k = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }[e.key]; if (!o || !k) return; e.preventDefault(); o.x = Math.min(0.98, Math.max(0.02, o.x + k[0] * 0.04)); o.y = Math.min(0.98, Math.max(0.02, o.y + k[1] * 0.04)); });
  });
  let raf = 0;
  const place = () => {
    raf = 0; if (!el.isConnected) return; const s = th.state;
    s.orbs.forEach((o, i) => { orbs[i].style.left = (o.x * 100).toFixed(2) + '%'; orbs[i].style.top = (o.y * 100).toFixed(2) + '%'; });
    oracles.forEach((d, i) => { const p = s.oracles[i]; d.style.opacity = p ? String(0.3 + 0.6 * p.s) : '0'; if (p) { d.style.left = (p.x * 100).toFixed(2) + '%'; d.style.top = (p.y * 100).toFixed(2) + '%'; d.style.transform = 'rotate(' + Math.round(s.t * 90 + i * 30) + 'deg) scale(' + (0.8 + p.s * 0.6).toFixed(2) + ')'; } });
    el.dataset.oracles = String(s.oracles.length); el.dataset.latent = s.latent.map((v) => v.toFixed(2)).join(',');
    raf = requestAnimationFrame(place);
  };
  raf = requestAnimationFrame(place);
  return { dispose() { clearInterval(hear); stop(); if (raf) cancelAnimationFrame(raf); } };
}

const idea = {
  id: 'doodle-mind', title: 'Mind Field', sub: 'Doodle Mind · it guesses your next stroke', W: 360, H: 270, warm: 10, trails: false,
  how: 'Draw on it: your last strokes set how the field spreads, fades and grows, and the squares show where it thinks you will go next. Drag the orbs, tap Tilt or Listen to feed it. Nothing you draw is kept; Seal keeps only the numbers.',
  create(seed) { return D.create(seed); },
  step(s, dt, input) { D.step(s, dt, input); },
  metrics: (s) => D.metrics(s),
  vars: (s) => D.mood(s),
  params: (s) => D.params(s),
  status: (s) => 'speed ' + s.latent[0].toFixed(2) + ' · unevenness ' + s.latent[1].toFixed(2) + ' · curve ' + s.latent[2].toFixed(2) + ' · energy ' + s.thought[3].toFixed(2),
  mount,
  draw(g, s, W, H) {
    g.fillStyle = '#05040c'; g.fillRect(0, 0, W, H);
    const cw = W / D.GW, ch = H / D.GH, hue = Math.round(s.thought[0] * 360);
    for (let k = 0; k < s.a.length; k++) { const v = s.a[k]; if (v < 0.03) continue; g.fillStyle = 'hsla(' + ((hue + Math.round(v * 80)) % 360) + ',85%,' + Math.round(35 + v * 35) + '%,' + Math.min(1, v * 1.4).toFixed(2) + ')'; g.fillRect((k % D.GW) * cw, Math.floor(k / D.GW) * ch, cw + 0.5, ch + 0.5); }
    if (s.oracles.length && s.trace.length) { const p = s.trace[s.trace.length - 1]; g.setLineDash([4, 4]); g.strokeStyle = 'rgba(255,255,255,.45)'; g.lineWidth = 1.2; g.beginPath(); g.moveTo(p.x * W, p.y * H); for (const o of s.oracles) g.lineTo(o.x * W, o.y * H); g.stroke(); g.setLineDash([]); }
  }
};

export { idea };
export default fieldSkill({
  name: 'doodle-mind',
  words: '(?:mind ?field|living field|(?:thought[- ]trace|doodle) (?:lattice|mind)|doodle mind|mind (?:to draw with|i can draw (?:on|with))|draw with (?:a |the )?mind)',
  examples: ['mind field', 'show me the mind field', 'living field', 'draw with a mind', 'doodle mind', 'thought trace lattice'],
  nearMisses: ['what is a mind field', 'mind your manners', 'never mind', 'draw a circle', 'a mind of its own'],
  idea, say: SAY
});
