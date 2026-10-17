/**
 * living-cards-mind skill — F-038 Living Spatial Cards Mind, Grok's frontier idea (delivered to atomeam/a-to-mind.com 85651746; asked by
 * the owner, 2026-10-17: "all of Grok's ideas are to be added to Void"): a Gray-Scott field whose feed, kill and diffusion a small
 * evolutionary mind keeps choosing (6 genomes, one generation every 2 s, in a Worker or on the page when Workers are blocked), and five
 * real cards that live in it. Each card pulls energy toward itself, drifts along the field, and takes its size, hue, blur and opacity
 * from the field around it; drag one and it seeds the field where it is and asks the mind for rules that answer it. The law is
 * lib/field-cards.js (pure, tested); the card is lib/field-stage.js. Canvas2D.
 * Contract: { name, examples, nearMisses, match(lower, text), run(text, api) }
 */
import { fieldSkill } from '../lib/field-stage.js';
import { spawnMind } from '../lib/field-worker.js';
import * as F from '../lib/field-cards.js';

const CSS = '.lc-chip{position:absolute;transform:translate(-50%,-50%) scale(var(--lc-s,1));padding:3px 8px;border-radius:7px;font:600 11px/1.2 system-ui,sans-serif;'
  + 'color:#fff;background:hsl(var(--lc-h,200) 70% 38% / .82);border:1px solid hsl(var(--lc-h,200) 80% 70% / .7);filter:blur(var(--lc-b,0px));opacity:var(--lc-o,1);'
  + 'cursor:grab;touch-action:none;user-select:none;white-space:nowrap;box-shadow:0 2px 10px rgba(0,0,0,.4)}.lc-chip:active{cursor:grabbing}.lc-chip:focus-visible{outline:2px solid #fff}';

/** the cards, their drag, and the mind thinking in the background (lib/field-stage.js idea.mount). */
function mount({ el, q, th, still }) {
  const s = th.state, frame = q('.ff-frame'); frame.style.position = 'relative';
  if (!document.getElementById('lc-css')) { const st = document.createElement('style'); st.id = 'lc-css'; st.textContent = CSS; document.head.appendChild(st); }
  const chips = s.cards.map((c, i) => {
    const b = document.createElement('div'); b.className = 'lc-chip'; b.textContent = c.label; b.tabIndex = 0; b.dataset.card = String(i);
    b.dataset.family = c.family || ''; b.title = c.family ? 'family: ' + c.family : '';
    b.setAttribute('role', 'button'); b.setAttribute('aria-label', 'card ' + c.label + (c.family ? ', family ' + c.family : '') + ': drag it, or use the arrow keys, to seed the field');
    const to = (e) => { const r = frame.getBoundingClientRect(); c.x = Math.min(0.94, Math.max(0.06, (e.clientX - r.left) / r.width)); c.y = Math.min(0.92, Math.max(0.08, (e.clientY - r.top) / r.height)); };
    b.addEventListener('pointerdown', (e) => { e.stopPropagation(); e.preventDefault(); s.dragging = i; try { b.setPointerCapture(e.pointerId); } catch (_) { /* fine */ } to(e); });
    b.addEventListener('pointermove', (e) => { if (s.dragging === i) { to(e); if (still()) { F.step(s, 1 / 60, {}); paint(); } } });
    const up = () => { if (s.dragging === i) s.dragging = -1; };
    b.addEventListener('pointerup', up); b.addEventListener('pointercancel', up);
    b.addEventListener('keydown', (e) => { const d = { ArrowLeft: [-0.03, 0], ArrowRight: [0.03, 0], ArrowUp: [0, -0.03], ArrowDown: [0, 0.03] }[e.key]; if (!d) return; e.preventDefault(); c.x = Math.min(0.94, Math.max(0.06, c.x + d[0])); c.y = Math.min(0.92, Math.max(0.08, c.y + d[1])); F.seedAt(s.u, c.x, c.y, 0.2, 2, s.v); s.boost = Math.min(5, s.boost + 0.5); paint(); });
    frame.appendChild(b); return b;
  });
  const paint = () => chips.forEach((b, i) => { const st = F.cardStyle(s.cards[i], s.act); b.style.left = st.left + '%'; b.style.top = st.top + '%'; b.style.setProperty('--lc-s', st.scale); b.style.setProperty('--lc-h', st.hue); b.style.setProperty('--lc-b', st.blur + 'px'); b.style.setProperty('--lc-o', st.opacity); b.dataset.hue = String(st.hue); b.dataset.scale = String(st.scale); });

  // the mind: one generation every MIND_EVERY seconds, in a Worker (lib/field-worker.js) or on the page; never while the card is still
  const mind = spawnMind(new URL('../lib/field-cards.js', import.meta.url).href, 'evolveCards', F.evolveCards);
  const say = () => { s.minded = mind.mode === 'worker' ? 'thinking in a Worker' : 'thinking on the page'; el.dataset.mind = mind.mode; };
  say(); s.gen = 0; s.fit = 0; let pop = null, busy = false, raf = 0;
  const think = () => {
    if (busy || still() || document.hidden || !el.isConnected) return; busy = true;
    mind.call({ pop, u: Array.from(s.u), v: Array.from(s.v), cards: s.cards.map(({ x, y, hue, label, family }) => ({ x, y, hue, label, family })), seed: s.seed, gen: s.gen, boost: s.boost })
      .then((o) => { if (o && o.best) { pop = o.pop; F.setGenome(s, o.best); s.gen = o.gen; s.fit = o.fitness; el.dataset.gen = String(s.gen); } say(); })
      .catch(() => {}).finally(() => { busy = false; });
  };
  const timer = setInterval(() => { if (!el.isConnected) { dispose(); return; } think(); }, F.MIND_EVERY * 1000);
  const frameLoop = () => { raf = 0; if (!el.isConnected) return; paint(); raf = requestAnimationFrame(frameLoop); };
  paint(); if (!still()) raf = requestAnimationFrame(frameLoop);
  function dispose() { clearInterval(timer); if (raf) cancelAnimationFrame(raf); try { mind.close(); } catch (_) { /* gone */ } }
  return { dispose };
}

const idea = {
  id: 'living-cards-mind', title: 'Living cards mind', sub: 'cards that live in an evolving field', W: 360, H: 270, warm: 120, perFrame: 4,
  how: 'Five cards live in a reaction-diffusion field: each pulls the field toward itself and takes its size and colour from it, and cards of one skill family drift toward each other. Drag a card to seed the field and its family follows; the mind keeps the rules that answer the cards.',
  create(seed) { return F.create(seed); },
  step(s, dt, input) { F.step(s, dt, input); },
  metrics: (s) => F.metrics(s),
  params: (s) => ({ genome: F.params(s), gen: s.gen || 0 }),
  status: (s) => { const m = F.metrics(s); return 'gen ' + (s.gen || 0) + ' · fitness ' + (s.fit || 0).toFixed(2) + ' · entropy ' + m.entropy.toFixed(2) + ' · cards answered ' + m.consensus.toFixed(2) + ' · ' + (s.minded || 'starting'); },
  mount,
  draw(g, s, W, H) {
    const off = s.off || (s.off = Object.assign(document.createElement('canvas'), { width: F.GW, height: F.GH })), og = off.getContext('2d');
    if (!og) return; const img = og.createImageData(F.GW, F.GH), d = img.data;
    for (let i = 0; i < s.u.length; i++) { const a = s.u[i], b = s.v[i]; d[i * 4] = 20 + a * 235; d[i * 4 + 1] = 10 + a * 120 + (1 - b) * 60; d[i * 4 + 2] = 40 + (1 - a) * 120 + a * 60; d[i * 4 + 3] = 255; }
    og.putImageData(img, 0, 0); g.imageSmoothingEnabled = true; g.drawImage(off, 0, 0, W, H);
  }
};

export default fieldSkill({
  name: 'living-cards-mind',
  words: '(?:living (?:spatial )?cards?(?: mind)?|spatial cards? mind|cards? that live in a field)',
  examples: ['living spatial cards mind', 'show me the living cards mind', 'living cards'],
  nearMisses: ['what is a living card', 'living cards game rules', 'make me a card'],
  idea, say: 'Living cards mind (F-038): five cards ride an evolving field and reshape it · drag a card, tap Sound on for the drone'
});
