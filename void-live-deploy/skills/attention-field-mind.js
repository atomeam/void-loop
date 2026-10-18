/**
 * attention-field-mind skill — ATTENTION as a field mind (asked by Owner, 2026-10-18: "all of groks builds should be what v01ds engine is
 * built on"). Four of Grok's drafts in one card, each a named law in lib/field-attention.js (pure, tested by tools/field-attention.test.mjs):
 *   affinity (frontier-webgpu-attention-field, the default): labelled particles carry hashed feature vectors; type a word and it becomes
 *     an attractor that pulls the particles whose features look like it; like clusters with like; the pointer pulls, pressing pushes.
 *   heads (F-032): two-head scaled dot-product attention is the force; its temperature drifts toward a middling attention entropy.
 *   lattice (F-029): a grid updated by 3x3 attention, the attention evolved by a 6-genome mind; a word is a lasting energy source.
 *   causal (F-047): a grid that attends to the pointer's recent path; thought nodes ride its gradient; a word is a new node; press to hold one.
 * The slow thought (clusters, or one generation) runs in a Worker via lib/field-worker.js, on the page when Workers are blocked. Canvas2D;
 * WebGPU compute is the drafts' next step and is not used here. Typed words stay on this card: never sealed, stored or sent.
 * Contract: { name, examples, nearMisses, match(lower, text), run(text, api) }, made with lib/field-stage.js fieldSkill.
 */
import { fieldSkill } from '../lib/field-stage.js';
import { spawnMind } from '../lib/field-worker.js';
import * as A from '../lib/field-attention.js';

const NAMES = { affinity: 'affinity', heads: 'two heads', lattice: 'lattice', causal: 'causal' };
const hues = new Map();
const hueOf = (label) => { let h = hues.get(label); if (h == null) { h = A.fnv(label) % 360; if (hues.size < 512) hues.set(label, h); } return h; };
const offs = new WeakMap(); // an offscreen canvas per lattice state, kept off the state (the stage saves its things)
function offFor(s, w, h) { let o = offs.get(s); if (!o) { o = Object.assign(document.createElement('canvas'), { width: w, height: h }); offs.set(s, o); } return o; }

function drawParticles(g, s, W, H) {
  g.fillStyle = 'rgba(5,4,12,0.32)'; g.fillRect(0, 0, W, H);
  const p = s.p;
  if (s.variant === 'heads' && s.edges.length) { // the strongest attention: who is looking at whom
    g.lineWidth = 1; g.beginPath(); g.strokeStyle = 'rgba(170,190,255,.22)';
    for (let e = 0; e < s.edges.length; e += 3) { const a = s.edges[e], b = s.edges[e + 1]; g.moveTo(p.x[a] * W, p.y[a] * H); g.lineTo(p.x[b] * W, p.y[b] * H); }
    g.stroke();
  }
  for (let i = 0; i < p.n; i++) { g.fillStyle = 'hsl(' + hueOf(p.label[i]) + ',75%,62%)'; g.beginPath(); g.arc(p.x[i] * W, p.y[i] * H, 2.4, 0, 6.2832); g.fill(); }
  g.font = '600 11px system-ui,sans-serif'; g.textBaseline = 'middle';
  for (const q of s.queries) { // each word: a ring where it pulls, in its own colour, and the word
    const x = q.x * W, y = q.y * H; g.strokeStyle = 'hsla(' + hueOf(q.word) + ',90%,70%,.9)'; g.lineWidth = 2; g.beginPath(); g.arc(x, y, 9, 0, 6.2832); g.stroke();
    g.fillStyle = '#fff'; g.fillText(q.word, Math.min(W - 60, x + 12), y);
  }
}
function drawGrid(g, s, W, H, f, gw, gh, tint) {
  const off = offFor(s, gw, gh), og = off.getContext('2d'); if (!og) return;
  const img = og.createImageData(gw, gh), d = img.data;
  for (let i = 0; i < f.length; i++) { const [r, gg, b] = tint(i); d[i * 4] = r; d[i * 4 + 1] = gg; d[i * 4 + 2] = b; d[i * 4 + 3] = 255; }
  og.putImageData(img, 0, 0); g.imageSmoothingEnabled = s.variant === 'lattice'; g.drawImage(off, 0, 0, W, H);
}
function draw(g, s, W, H) {
  if (s.variant === 'affinity' || s.variant === 'heads') return drawParticles(g, s, W, H);
  g.font = '600 11px system-ui,sans-serif'; g.textBaseline = 'middle';
  if (s.variant === 'lattice') {
    drawGrid(g, s, W, H, s.f, A.LG, A.LG, (i) => { const v = s.f[i]; return [10 + v * 90, 8 + v * 170, 30 + v * 225]; });
    for (const o of s.sources) { const x = o.x * W, y = o.y * H; g.strokeStyle = 'rgba(255,255,255,.75)'; g.lineWidth = 1.5; g.beginPath(); g.arc(x, y, 8, 0, 6.2832); g.stroke(); g.fillStyle = '#fff'; g.fillText(o.word, Math.min(W - 60, x + 11), y); }
    return;
  }
  drawGrid(g, s, W, H, s.f, A.CW, A.CH, (i) => { const v = s.f[i], a = Math.min(1, s.attn[i]); return [v * 255, v * 150 + a * 70, v * 75 + a * 180]; });
  s.nodes.forEach((n, j) => { // thought nodes, brighter when the field is sure of itself; a held one has a white ring
    const x = n.x * W, y = n.y * H; g.fillStyle = 'hsla(' + n.hue + ',75%,55%,' + (0.55 + s.conf * 0.4).toFixed(2) + ')'; g.beginPath(); g.arc(x, y, 7, 0, 6.2832); g.fill();
    if (j === s.held) { g.strokeStyle = '#fff'; g.lineWidth = 2; g.stroke(); }
    g.fillStyle = '#fff'; g.fillText(n.label, Math.min(W - 50, x + 10), y);
  });
}

/** the word box, the Law button, and the slow thought (lib/field-stage.js idea.mount). */
function mount({ el, q, th, tick, redraw, still }) {
  const S = () => th.state;
  const row = document.createElement('div'); row.className = 'af-ctl'; row.style.cssText = 'display:flex;gap:6px;flex-wrap:wrap;align-items:center;margin-top:6px';
  row.innerHTML = '<form class="af-form" style="display:flex;gap:6px;flex:1;min-width:180px"><input class="af-word" type="text" maxlength="' + A.MAX_WORD + '" autocomplete="off" spellcheck="false" placeholder="a word to attend to" aria-label="A word for the field to attend to" style="flex:1;min-width:0;padding:4px 8px;border-radius:7px;border:1px solid var(--line,#444);background:transparent;color:inherit">'
    + '<button type="submit" class="g-btn af-attend">Attend</button></form><button type="button" class="g-btn af-law">Law: affinity</button>';
  q('.ff-btns').insertAdjacentElement('beforebegin', row);
  for (const n of row.querySelectorAll('input,button')) for (const ev of ['pointerdown', 'keydown']) n.addEventListener(ev, (e) => e.stopPropagation());
  const box = q('.af-word'), law = q('.af-law');

  const mind = spawnMind(new URL('../lib/field-attention.js', import.meta.url).href, 'think', A.think);
  let pop = null, busy = false, asked = '';
  const sync = () => {
    const s = S(); s.minded = mind.mode === 'worker' ? 'thinking in a Worker' : 'thinking on the page';
    el.dataset.mind = mind.mode; el.dataset.law = s.variant; el.dataset.gen = String(s.gen || 0); el.dataset.words = String(A.words(s).length);
    el.dataset.answer = A.answer(s).toFixed(3); el.dataset.clusters = String(s.clusters || 0); law.textContent = 'Law: ' + NAMES[s.variant];
  };
  q('.af-form').addEventListener('submit', (e) => {
    e.preventDefault(); const w = A.addQuery(S(), box.value); box.value = '';
    if (w) { if (still()) tick(30); else redraw(); } sync();
  });
  law.addEventListener('click', () => {
    const v = A.nextVariant(S().variant); th.state = A.create(S().seed, { variant: v }); pop = null;
    tick(v === 'lattice' || v === 'causal' ? 20 : 1); sync();
  });
  const think = () => {
    const s = S(); if (busy || still() || document.hidden || !el.isConnected) return; busy = true; asked = s.variant;
    mind.call(A.mindArg(s, pop)).then((o) => { const now = S(); if (o && o.variant === asked && now.variant === asked) { const next = A.applyThought(now, o); if (next) pop = next; } })
      .catch(() => {}).finally(() => { busy = false; sync(); });
  };
  sync();
  const timer = setInterval(() => { if (!el.isConnected) { dispose(); return; } think(); sync(); }, A.MIND_EVERY * 1000);
  function dispose() { clearInterval(timer); try { mind.close(); } catch (_) { /* gone */ } }
  return { dispose };
}

const idea = {
  id: 'attention-field-mind', title: 'Attention field mind', sub: 'type a word, the field attends to it', W: 360, H: 270, warm: 30, trails: true,
  how: 'Type a word: it becomes an attractor, and particles whose hashed features look like it fall toward it while like clusters with like. Move over the field to pull it, press to push. Law switches between Grok\'s four attention drafts.',
  create: (seed) => A.create(seed, { variant: 'affinity' }),
  step: (s, dt, input) => A.step(s, dt, input),
  metrics: (s) => A.metrics(s),
  params: (s) => A.params(s),
  status: (s, m) => NAMES[s.variant] + ' (' + A.SOURCES[s.variant].split(' ')[0] + ') · ' + A.words(s).length + (A.words(s).length === 1 ? ' word · ' : ' words · ')
    + (s.variant === 'lattice' || s.variant === 'causal' ? 'gen ' + (s.gen || 0) + ' · fitness ' + (s.fit || 0).toFixed(2) : (s.clusters || 0) + ' clusters') + ' · consensus ' + m.consensus.toFixed(2) + ' · ' + (s.minded || 'starting'),
  mount, draw
};

export default fieldSkill({
  name: 'attention-field-mind',
  words: '(?:local |spatial |causal )?attention (?:field|lattice)(?: mind)?|attention mind',
  examples: ['attention field', 'attention mind', 'attention field mind', 'show me an attention field', 'spatial attention lattice mind'],
  nearMisses: ['pay attention', 'attention span test', 'what is attention in transformers', 'attention test'],
  idea, say: 'Attention field mind: type a word and the field attends to it · move over it to pull, press to push, Law switches the four attention laws'
});
