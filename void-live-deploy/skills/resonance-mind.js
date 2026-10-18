/**
 * resonance-mind skill — the spectral / resonance / sound field minds of Grok's drafts on V01D's shared engine (asked by Owner,
 * 2026-10-18: "all of groks builds should be what v01ds engine is built on"): one card, six laws from lib/field-resonance.js, each
 * citing its draft: F-034 spectral resonance (the default), F-027 spectral phase, F-044 resonance lattice (band portals), F-037 resonant
 * voice, F-048 spatial audio, F-042 predictive audio. The pointer plucks the lattice (move to stir it, press to pluck); a small
 * evolutionary mind (6 genomes, one generation every 1.2 s, in a Worker via lib/field-worker.js, on the page when Workers are blocked)
 * keeps the genome that resonates best. Sound stays off until "Sound on" (the kit's quiet drone, lib/field-stage.js); the microphone is
 * used ONLY after the person presses "Use microphone (asks permission)", feeds the voice and predictive laws its spectrum as numbers in
 * memory (never kept, never sealed, never sent), and every law runs fully without it. Canvas2D.
 * Contract: { name, examples, nearMisses, match(lower, text), run(text, api) }
 */
import { fieldSkill } from '../lib/field-stage.js';
import { spawnMind } from '../lib/field-worker.js';
import * as R from '../lib/field-resonance.js';

let chosen = R.DEFAULT; // the variant the next card (or Reset) starts with; an ask that names one sets it

const CSS = '.rm-row{display:flex;gap:4px;flex-wrap:wrap;margin-top:6px}.rm-row .g-btn{font-size:11.5px;padding:3px 7px}.rm-row .g-btn[aria-pressed="true"]{outline:2px solid currentColor}'
  + '.rm-mic{font-size:11.5px;color:var(--muted,#8a8a8a);min-height:1.3em}';

/** the variant chips, the microphone button, and the mind thinking in the background (lib/field-stage.js idea.mount). */
function mount({ el, q, th, input, still, redraw }) {
  if (!document.getElementById('rm-css')) { const st = document.createElement('style'); st.id = 'rm-css'; st.textContent = CSS; document.head.appendChild(st); }
  const row = document.createElement('div'); row.className = 'rm-row'; row.setAttribute('role', 'group'); row.setAttribute('aria-label', 'which law runs the lattice');
  const chips = R.ORDER.map((v) => {
    const b = document.createElement('button'); b.type = 'button'; b.className = 'g-btn rm-variant'; b.dataset.variant = v; b.textContent = R.VARIANTS[v].fid + ' ' + R.VARIANTS[v].title;
    b.title = R.VARIANTS[v].how + ' (Grok\'s draft ' + R.VARIANTS[v].draft + ')';
    b.addEventListener('click', () => use(v)); row.appendChild(b); return b;
  });
  const micRow = document.createElement('div'); micRow.className = 'rm-row';
  const mic = document.createElement('button'); mic.type = 'button'; mic.className = 'g-btn rm-mic-btn'; mic.setAttribute('aria-pressed', 'false'); mic.textContent = 'Use microphone (asks permission)';
  const micSay = document.createElement('div'); micSay.className = 'rm-mic'; micSay.setAttribute('aria-live', 'polite');
  micRow.appendChild(mic); q('.ff-btns').after(row, micRow, micSay);
  for (const b of [...chips, mic]) b.addEventListener('pointerdown', (e) => e.stopPropagation()); // a press on a button is not a drag of the card

  // the mind: one generation every MIND_EVERY seconds, judged on what the field hears and where the pointer is; never while the card is still
  const mind = spawnMind(new URL('../lib/field-resonance.js', import.meta.url).href, 'evolveResonance', R.evolveResonance);
  let pop = null, busy = false, epoch = 0;
  const say = () => { const s = th.state; s.minded = mind.mode === 'worker' ? 'thinking in a Worker' : 'thinking on the page'; el.dataset.mind = mind.mode; el.dataset.variant = s.variant; el.dataset.fid = s.fid; chips.forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.variant === s.variant))); };
  const use = (v) => { chosen = v; const s = R.create(th.state.seed || 1, v); s.gen = 0; s.fit = 0; th.state = s; pop = null; epoch++; say(); redraw(); };
  const think = () => {
    if (busy || still() || document.hidden || !el.isConnected) return; busy = true; const s = th.state, mine = epoch;
    mind.call({ variant: s.variant, pop, ctx: R.contextOf(s, input), seed: s.seed, gen: s.gen || 0 })
      .then((o) => { if (mine !== epoch || !o || !o.best || o.variant !== th.state.variant) return; pop = o.pop; R.setGenome(th.state, o.best); th.state.gen = o.gen; th.state.fit = o.fitness; el.dataset.gen = String(o.gen); say(); })
      .catch(() => {}).finally(() => { busy = false; });
  };
  const timer = setInterval(() => { if (!el.isConnected) { dispose(); return; } think(); }, R.MIND_EVERY * 1000);

  // the microphone: nothing is asked for until this button is pressed; its spectrum lives in memory only, as numbers
  let ms = null; const AC = window.AudioContext || window.webkitAudioContext;
  const canMic = !!(AC && navigator.mediaDevices && navigator.mediaDevices.getUserMedia);
  if (!canMic) { mic.disabled = true; mic.textContent = 'Microphone unavailable'; }
  const stopMic = () => { if (!ms) return; clearInterval(ms.timer); try { ms.stream.getTracks().forEach((t) => t.stop()); } catch (_) { /* gone */ } try { ms.ctx.close(); } catch (_) { /* gone */ } ms = null; input.spectrum = null; mic.setAttribute('aria-pressed', 'false'); mic.textContent = 'Use microphone (asks permission)'; el.dataset.mic = 'off'; };
  mic.addEventListener('click', async () => {
    if (ms) { stopMic(); micSay.textContent = 'Microphone off.'; return; }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true }), ctx = new AC(), an = ctx.createAnalyser(); an.fftSize = 64; an.smoothingTimeConstant = 0.6;
      ctx.createMediaStreamSource(stream).connect(an); // to the analyser only: nothing is played back and nothing is recorded
      const buf = new Uint8Array(an.frequencyBinCount);
      ms = { stream, ctx, timer: setInterval(() => { an.getByteFrequencyData(buf); input.spectrum = Array.from(buf, (v) => v / 255); }, 50) };
      mic.setAttribute('aria-pressed', 'true'); mic.textContent = 'Stop microphone'; el.dataset.mic = 'on';
      micSay.textContent = th.state.variant === 'voice' || th.state.variant === 'predict' ? 'Listening: hum or speak. Nothing is recorded or sent.' : 'Listening. The voice (F-037) and predictive (F-042) laws hear it. Nothing is recorded or sent.';
    } catch (_) { stopMic(); micSay.textContent = 'No microphone here (or not allowed): the lattice runs on your pointer.'; }
  });

  say();
  function dispose() { clearInterval(timer); stopMic(); try { mind.close(); } catch (_) { /* gone */ } }
  return { dispose };
}

const BG = '#05040c';
const idea = {
  id: 'resonance-mind', title: 'Resonance mind', sub: 'F-034 · F-027 · F-044 · F-037 · F-048 · F-042', W: 360, H: 270, warm: 30,
  how: 'A resonant lattice: move over it to stir it, press to pluck it. Pick a law below (each is one of Grok\'s drafts); the mind keeps the genome that resonates best. Sound on is a quiet drone; the microphone is only used if you press its button.',
  create(seed) { const s = R.create(seed, chosen); s.gen = 0; s.fit = 0; return s; },
  step(s, dt, input) { R.step(s, dt, input); },
  metrics: (s) => R.metrics(s),
  params: (s) => ({ ...R.params(s), gen: s.gen || 0 }),
  status: (s, m) => R.VARIANTS[s.variant].fid + ' ' + R.VARIANTS[s.variant].title.toLowerCase() + ' · resonance ' + m.resonance.toFixed(2) + ' · gen ' + (s.gen || 0) + ' · fitness ' + (s.fit || 0).toFixed(2)
    + (s.variant === 'phase' ? ' · rhythm ' + (m.rhythm == null ? '-' : m.rhythm.toFixed(2) + ' Hz') : s.variant === 'bands' ? ' · ' + m.band + ' band, ' + m.portals + ' portals' : s.variant === 'spatial' ? ' · base ' + m.base + ' Hz' : (s.variant === 'voice' || s.variant === 'predict') ? (m.listening ? ' · listening' : ' · pointer') : '') + ' · ' + (s.minded || 'starting'),
  mount,
  draw(g, s, W, H) {
    const SH = H - 26; g.fillStyle = BG; g.fillRect(0, 0, W, H);
    if (s.theta) { // the oscillator lattices: each cell's phase is its hue, its plucked energy its light
      const gw = s.variant === 'phase' ? 16 : 8, gh = s.variant === 'phase' ? 12 : 6, cw = W / gw, ch = SH / gh;
      for (let j = 0; j < gh; j++) for (let i = 0; i < gw; i++) { const k = j * gw + i; g.fillStyle = 'hsla(' + Math.round(180 + (s.theta[k] / R.TAU) * 160) + ',70%,' + Math.round(22 + s.amp[k] * 45) + '%,' + (0.45 + s.amp[k] * 0.5).toFixed(2) + ')'; g.fillRect(i * cw, j * ch, cw - 1, ch - 1); }
    }
    if (s.f) { // the voice lattice
      const vw = 40, vh = 25, cw = W / vw, ch = SH / vh;
      for (let j = 0; j < vh; j++) for (let i = 0; i < vw; i++) { const v = s.f[j * vw + i]; if (v < 0.04) continue; g.fillStyle = 'hsla(' + Math.round(180 + v * 120) + ',70%,' + Math.round(25 + v * 50) + '%,' + (0.5 + v * 0.5).toFixed(2) + ')'; g.fillRect(i * cw, j * ch, cw - 0.5, ch - 0.5); }
    }
    if (s.p) { const p = s.p; for (let i = 0; i < p.n; i++) { const e = s.e ? s.e[i] : 0.5; g.fillStyle = 'hsla(' + Math.round(190 + e * 120) + ',80%,' + Math.round(55 + e * 20) + '%,.85)'; g.fillRect(p.x[i] * W - 1, p.y[i] * SH - 1, 2.2, 2.2); } }
    if (s.portals) for (const o of s.portals) { g.strokeStyle = 'rgba(200,255,220,' + Math.min(1, o.ttl / 2).toFixed(2) + ')'; g.lineWidth = 1.5; g.beginPath(); g.arc(o.x * W, o.y * SH, 12, 0, R.TAU); g.stroke(); g.fillStyle = 'rgba(220,255,230,.9)'; g.font = '10px system-ui,sans-serif'; g.fillText(R.BANDS[o.band], o.x * W - 10, o.y * SH + 3); }
    // the spectrum strip: what the field sounds like (and, faint, what it is reaching for: the target, the prediction)
    const sp = R.spectrumOf(s), bw = W / (sp.length || 1), want = s.target ? Array.from(s.target) : s.pred ? Array.from(s.pred) : null;
    g.fillStyle = 'rgba(0,0,0,.5)'; g.fillRect(0, SH, W, H - SH);
    sp.forEach((v, i) => { g.fillStyle = 'hsl(' + Math.round(190 + (i / sp.length) * 140) + ',75%,60%)'; g.fillRect(i * bw + 1, H - 2 - v * 22, bw - 2, v * 22); });
    if (want) { g.strokeStyle = 'rgba(255,255,255,.55)'; g.lineWidth = 1; g.beginPath(); want.forEach((v, i) => { const x = (i + 0.5) * (W / want.length), y = H - 2 - Math.min(1, v) * 22; if (i) g.lineTo(x, y); else g.moveTo(x, y); }); g.stroke(); }
  }
};

const base = fieldSkill({
  name: 'resonance-mind',
  words: '(?:spectral|resonance|resonant)(?: (?:phase|resonance|voice|spatial audio))?(?: lattice mind| lattice| mind)|predictive audio(?: particle)?(?: anticipation)? mind|spatial audio mind',
  examples: ['resonance mind', 'spectral mind', 'resonant lattice', 'show me the spectral phase mind', 'spectral resonance lattice', 'resonant voice lattice mind', 'predictive audio mind', 'spatial audio mind'],
  nearMisses: ['what is resonance', 'resonance breathing', 'spectral analysis of a signal', 'what is a resonant frequency'],
  idea, say: 'Resonance mind: a lattice you pluck, on six of Grok\'s sound drafts (F-034, F-027, F-044, F-037, F-048, F-042) · press to pluck, tap Sound on for the drone; the microphone only if you press its button'
});

export default {
  ...base,
  /** an ask that names a law (voice, phase, predictive, ...) starts the card on it, or switches the card that is already up. */
  async run(text, api) {
    if (!base.match(String(text || '').toLowerCase(), text)) return 'none';
    const v = R.variantOf(text); if (v) chosen = v;
    const up = Object.values(api.stage.things()).find((t) => t.kind === 'resonance-mind');
    if (up && v && up.state && up.state.variant !== v) { const el = document.querySelector('.ff-resonance-mind .rm-variant[data-variant="' + v + '"]'); if (el) el.click(); }
    return base.run(text, api);
  }
};
