/**
 * swarm-mind skill — swarms, trajectories and implicit fields: seven of Grok's drafts on Verse's field kit (asked by the owner, 2026-10-18:
 * "all of groks builds should be what v01ds engine is built on"). The card's own law (F-044 + F-030 + F-026 + F-028): two tribes of
 * agents ride a tiny MLP vector field, climb the fading memory of where your pointer went, lean toward where it is heading, and compete,
 * one tribe rewarded for staying with you and one for exploring; the tribe doing better at its own reward leads. A small evolutionary
 * mind (two populations of 6 genomes, one generation every 1.5 s) evolves both tribes' genomes in a Worker, or on the page when Workers
 * are blocked. "Law" switches to each draft on its own: neural implicit field (F-044), trajectory memory (F-030), intent lattice (F-026),
 * competitive minds (F-028), neural probe swarm (F-040), resonance-seeking agents (F-041), thought gravity (F-022: type a thought and it
 * becomes a well). The law is lib/field-swarm.js (pure, tested); the card is lib/field-stage.js; the pointer's path is never kept.
 * Contract: { name, examples, nearMisses, match(lower, text), run(text, api) }
 */
import { fieldSkill } from '../lib/field-stage.js';
import { spawnMind } from '../lib/field-worker.js';
import * as S from '../lib/field-swarm.js';

/** which law an ask names; the card's own blend when it names none. Pure. */
export function lawFor(text) {
  const t = String(text || '').toLowerCase();
  if (/gravity/.test(t)) return 'gravity';
  if (/probe/.test(t)) return 'probes';
  if (/resonan/.test(t)) return 'resonance';
  if (/competitive/.test(t)) return 'compete';
  if (/trajectory memory/.test(t)) return 'memory';
  if (/lattice/.test(t)) return 'lattice';
  if (/neural|implicit/.test(t)) return 'neural';
  return 'swarm';
}

const SAY = 'Swarm mind (F-044, F-030, F-026, F-028, F-040, F-041, F-022): two tribes in a neural field remember your pointer and compete · move over it, tap Law for each draft';
const TRIBE = ['hsla(205,90%,66%,', 'hsla(28,95%,62%,']; // A engages (blue), B explores (amber)

/** the Law button, the thought box and the mind thinking in the background (lib/field-stage.js idea.mount). */
function mount({ el, q, th, still, redraw }) {
  const btns = q('.ff-btns'), law = document.createElement('button'), thought = document.createElement('input');
  law.type = 'button'; law.className = 'g-btn sw-law'; law.title = 'switch to the next draft\'s law';
  thought.type = 'text'; thought.className = 'sw-thought'; thought.maxLength = 40; thought.placeholder = 'drop a thought'; thought.setAttribute('aria-label', 'type a thought and press Enter: it becomes a gravity well (only its place is kept)');
  thought.style.cssText = 'flex:1 1 120px;min-width:0;padding:4px 8px;border-radius:7px;border:1px solid rgba(255,255,255,.25);background:rgba(0,0,0,.25);color:inherit;font:inherit;font-size:12px';
  for (const n of [law, thought]) n.addEventListener('pointerdown', (e) => e.stopPropagation()); // a press on a control is not a drag of the card
  btns.prepend(law); btns.appendChild(thought);

  const mind = spawnMind(new URL('../lib/field-swarm.js', import.meta.url).href, 'evolveSwarm', S.evolveSwarm);
  let pop = null, busy = false, epoch = 0;
  const show = () => {
    const s = th.state; s.minded = mind.mode === 'worker' ? 'thinking in a Worker' : 'thinking on the page';
    law.textContent = 'Law: ' + S.VARIANTS[s.variant].title; thought.style.display = s.variant === 'gravity' || s.variant === 'swarm' ? '' : 'none';
    Object.assign(el.dataset, { law: s.variant, fid: s.fid, agents: String(s.n), mind: mind.mode, gen: String(s.gen || 0), wells: String(s.wells.length), dominant: S.VARIANTS[s.variant].tribes ? (s.dominant ? 'B' : 'A') : '' });
  };
  const use = (v) => { const seed = th.state.seed; th.state = S.create(seed, { variant: v }); th.state.gen = 0; th.state.fit = 0; th.law = v; pop = null; epoch++; show(); redraw(); };
  if (th.law && th.law !== th.state.variant) use(th.law); else { th.state.gen = 0; th.state.fit = 0; show(); }
  law.addEventListener('click', () => use(S.LAWS[(S.LAWS.indexOf(th.state.variant) + 1) % S.LAWS.length]));
  el.addEventListener('swarm-law', (e) => { const v = S.VARIANTS[e.detail] ? e.detail : 'swarm'; if (v !== th.state.variant) use(v); });
  q('.ff-reset').addEventListener('click', () => use(th.law || 'swarm')); // the stage's Reset makes a fresh field; keep the chosen law
  thought.addEventListener('keydown', (e) => { if (e.key !== 'Enter' || !thought.value.trim()) return; e.preventDefault(); S.addWell(th.state, thought.value); thought.value = ''; show(); redraw(); }); // the words go no further

  const think = () => {
    if (busy || still() || document.hidden || !el.isConnected) return; busy = true;
    const s = th.state, mine = epoch; // the mind is told only where the pointer is now (or last was), never where it has been
    mind.call({ variant: s.variant, pop, seed: s.seed, gen: s.gen || 0, pointer: s.lastOver || null })
      .then((o) => { if (o && o.best && mine === epoch && o.variant === th.state.variant) { pop = o.pop; S.setGenome(th.state, o.best); th.state.gen = o.gen; th.state.fit = o.fitness; } show(); })
      .catch(() => {}).finally(() => { busy = false; });
  };
  const timer = setInterval(() => { if (!el.isConnected) { dispose(); return; } show(); think(); }, S.MIND_EVERY * 1000);
  function dispose() { clearInterval(timer); try { mind.close(); } catch (_) { /* gone */ } }
  return { dispose };
}

const idea = {
  id: 'swarm-mind', title: 'Swarm mind', sub: 'agents in a neural field that remember you and compete', W: 360, H: 270, warm: 30, trails: true,
  how: 'Two tribes ride a tiny neural vector field: blue stays with your pointer, remembering where it went and where it is heading; amber explores. The one doing better leads, and a small mind evolves both. Law switches between the seven drafts it is built from.',
  create(seed) { return S.create(seed, { variant: 'swarm' }); },
  step(s, dt, input) { S.step(s, dt, input); s.lastOver = input.over ? { x: input.x, y: input.y } : s.lastOver || null; }, // one point, overwritten: never a path
  metrics: (s) => S.metrics(s),
  params: (s) => ({ ...S.params(s), gen: s.gen || 0 }),
  status: (s) => {
    const v = S.VARIANTS[s.variant], m = S.measure(s);
    const tail = v.tribes ? ' · ' + (s.dominant ? 'amber explores' : 'blue engages') + ' (A ' + m.liveA.toFixed(2) + ' vs B ' + m.liveB.toFixed(2) + ')'
      : s.variant === 'resonance' ? ' · in tune ' + m.resonance.toFixed(2) : s.variant === 'probes' ? ' · ' + (m.edges || 0) + ' links' : s.variant === 'gravity' ? ' · ' + s.wells.length + ' wells' : s.variant === 'lattice' ? ' · intent ' + m.confidence.toFixed(2) : '';
    return v.fid + ' · gen ' + (s.gen || 0) + ' · fitness ' + (s.fit || 0).toFixed(2) + ' · entropy ' + m.entropy.toFixed(2) + tail + ' · ' + (s.minded || 'starting');
  },
  mount,
  draw(g, s, W, H) {
    g.fillStyle = 'rgba(5,4,12,0.28)'; g.fillRect(0, 0, W, H);
    const grid = s.mem || s.wave, n = s.mem ? S.MG : S.WG;
    if (grid) { const cw = W / n, ch = H / n, hue = s.mem ? 170 : 260; for (let i = 0; i < grid.length; i++) { const v = Math.min(1, grid[i] / (s.mem ? 1 : 2)); if (v < 0.04) continue; g.fillStyle = 'hsla(' + hue + ',80%,55%,' + (v * 0.35).toFixed(3) + ')'; g.fillRect((i % n) * cw, Math.floor(i / n) * ch, cw + 0.5, ch + 0.5); } }
    if (s.lat) for (const p of S.predictions(s.lat, 0.3)) { g.strokeStyle = 'rgba(255,255,255,' + (0.25 + p.s * 0.6).toFixed(3) + ')'; g.lineWidth = 1.5; g.beginPath(); g.arc(p.x * W, p.y * H, 6 + p.s * 10, 0, Math.PI * 2); g.stroke(); }
    for (const w of s.wells) { const gr = g.createRadialGradient(w.x * W, w.y * H, 0, w.x * W, w.y * H, 26 * w.strength + 6); gr.addColorStop(0, 'rgba(255,220,140,.55)'); gr.addColorStop(1, 'rgba(255,220,140,0)'); g.fillStyle = gr; g.fillRect(w.x * W - 34, w.y * H - 34, 68, 68); }
    if (s.variant === 'probes') { g.lineWidth = 1.5; for (const [i, j, st] of S.graphEdges(s)) { g.strokeStyle = 'hsla(' + Math.round(200 + st * 100) + ',70%,60%,' + (st * 0.6).toFixed(3) + ')'; g.beginPath(); g.moveTo(s.x[i] * W, s.y[i] * H); g.lineTo(s.x[j] * W, s.y[j] * H); g.stroke(); } }
    const big = s.n <= 40, tribes = S.VARIANTS[s.variant].tribes;
    for (let i = 0; i < s.n; i++) {
      const lead = tribes && s.tribe[i] === s.dominant, a = tribes ? (lead ? 0.95 : 0.55) : 0.85;
      g.fillStyle = s.variant === 'resonance' ? 'hsla(' + Math.round(((s.phase[i] % 6.2832) + 6.2832) % 6.2832 * 57) + ',80%,65%,.9)' : s.variant === 'probes' ? 'hsla(' + Math.round(180 + s.connect[i] * 120) + ',80%,62%,.95)' : tribes ? TRIBE[s.tribe[i]] + a + ')' : 'hsla(195,85%,70%,.85)'; // void-review: ok (string comparisons of the variant name; the decimals are hue math, never compared for equality)
      const r = big ? 3 + (s.variant === 'resonance' ? s.energy[i] * 5 : 2) : lead ? 2.4 : 1.8;
      if (big) { g.beginPath(); g.arc(s.x[i] * W, s.y[i] * H, r, 0, Math.PI * 2); g.fill(); } else g.fillRect(s.x[i] * W - r / 2, s.y[i] * H - r / 2, r, r);
    }
  }
};

const base = fieldSkill({
  name: 'swarm-mind',
  words: '(?:swarm mind|swarm of minds|thought gravity(?: wells?)?|neural (?:implicit )?(?:vector )?field(?: mind)?|implicit (?:vector )?field(?: mind)?|trajectory memory(?: field)?(?: mind)?|(?:pointer )?trajectory lattice(?: mind)?|intent lattice|competitive minds(?: field)?|(?:evolved )?(?:neural )?probe swarm|resonance[- ]seeking agents|resonance agents)',
  examples: ['swarm mind', 'thought gravity', 'neural field', 'show me the swarm mind', 'competitive minds', 'resonance seeking agents', 'trajectory memory field', 'neural probe swarm'],
  nearMisses: ['what is a swarm mind', 'how does gravity work', 'what is a neural network', 'swarm'],
  idea, say: SAY
});

export default {
  ...base,
  /** like the kit's run, but an ask that names one draft ("thought gravity") opens the card on that draft's law (or switches the one already there). */
  async run(text, api) {
    if (!base.match(String(text || '').toLowerCase(), text)) return 'none';
    const existing = Object.values(api.stage.things()).find((t) => t.kind === 'swarm-mind');
    if (existing) {
      if (api.stage.center) api.stage.center(existing.id); else api.stage.render();
      const el = document.querySelector('.ff-swarm-mind[data-id="' + CSS.escape(existing.id) + '"]'); // the card on the stage switches to the law the ask names
      if (el) el.dispatchEvent(new CustomEvent('swarm-law', { detail: lawFor(text) }));
      return 'swarm-mind';
    }
    api.summon('swarm-mind', { x: Math.max(10, Math.round(innerWidth / 2 - 180)), y: 50, law: lawFor(text) });
    api.say(SAY);
    return 'swarm-mind';
  }
};
