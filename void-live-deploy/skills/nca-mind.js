/**
 * nca-mind skill — V01D's neural cellular automata and living lattices, built from Grok's drafts F-036, F-039, F-043 (two of them) and
 * F-045 (asked by the owner, 2026-10-18: "all of groks builds should be what v01ds engine is built on"). One card runs a lattice whose
 * every cell follows the same small rule; the pointer seeds it (move to feed it, press to plant life) and a small evolutionary mind
 * (6 rules, one generation every 2 s, in a Worker or on the page when Workers are blocked) keeps the rules that make a varied,
 * moving lattice that answers where it is touched. The card's "Rule" picker (or the ask's words) switches between the drafts' laws:
 * a multichannel growing NCA (default), F-036's tiny-MLP NCA, F-039's three-channel lattice, F-043's Gray-Scott pointer mind,
 * F-045's portal NCA (hotspots open portals; tap one to keep its rule) and F-043's predictive residual lattice. The law is
 * lib/field-nca.js (pure, tested); the card is lib/field-stage.js; the mind runs through lib/field-worker.js. Canvas2D.
 * Contract: { name, examples, nearMisses, match(lower, text), run(text, api) }
 */
import { fieldSkill } from '../lib/field-stage.js';
import { spawnMind } from '../lib/field-worker.js';
import * as F from '../lib/field-nca.js';

let wanted = F.DEFAULT; // the rule a new card (or Reset) starts with: the ask's words or the picker set it
const CSS = '.nca-portal{position:absolute;transform:translate(-50%,-50%);padding:2px 7px;border-radius:7px;font:600 10.5px/1.3 system-ui,sans-serif;color:#fff;'
  + 'background:rgba(100,180,255,.28);border:1px solid rgba(150,220,255,.7);cursor:pointer;white-space:nowrap;text-shadow:0 0 4px #000}'
  + '.nca-portal:hover,.nca-portal:focus-visible{background:rgba(150,220,255,.45);outline:2px solid #fff}.nca-portal[data-kept]{border-color:#afa}'
  + '.nca-rule{font:inherit;font-size:12px;color:var(--ink,#eee);background:rgba(255,255,255,.07);border:1px solid rgba(255,255,255,.13);border-radius:8px;padding:3px 6px}';

/** the rule picker, the portals and the mind thinking in the background (lib/field-stage.js idea.mount). */
function mount({ el, q, th, tick, redraw, still }) {
  if (!document.getElementById('nca-css')) { const st = document.createElement('style'); st.id = 'nca-css'; st.textContent = CSS; document.head.appendChild(st); }
  const frame = q('.ff-frame'); frame.style.position = 'relative';
  const pick = document.createElement('select'); pick.className = 'nca-rule'; pick.setAttribute('aria-label', 'Rule (which of Grok\'s lattices runs)');
  for (const id of F.VARIANT_IDS) { const o = document.createElement('option'); o.value = id; o.textContent = F.VARIANTS[id].title; pick.appendChild(o); }
  pick.addEventListener('pointerdown', (e) => e.stopPropagation());
  q('.ff-btns').prepend(pick);

  const mind = spawnMind(new URL('../lib/field-nca.js', import.meta.url).href, 'evolveNca', F.evolveNca, { timeout: 6000 });
  let pop = null, busy = false, portals = [];
  const say = () => { th.state.minded = mind.mode === 'worker' ? 'thinking in a Worker' : 'thinking on the page'; el.dataset.mind = mind.mode; };
  const clearPortals = () => { for (const p of portals) p.el.remove(); portals = []; el.dataset.portals = '0'; };
  const use = (id) => {
    if (!F.VARIANTS[id]) return;
    wanted = id; th.variant = id; pick.value = id; el.dataset.variant = id; q('.g-sub').textContent = F.VARIANTS[id].sub;
    if (th.state.variant !== id) { th.state = F.create((Date.now() & 0xffff) || 1, id); pop = null; clearPortals(); say(); tick(20); }
  };
  pick.addEventListener('change', () => use(pick.value));
  el.addEventListener('nca-variant', (e) => use(e.detail));
  if (th.variant && th.variant !== th.state.variant) use(th.variant); else use(th.state.variant);
  say();

  const think = () => {
    const s = th.state; if (busy || still() || document.hidden || !el.isConnected) return; busy = true;
    mind.call({ variant: s.variant, x: Array.from(s.x), seed: s.seed, gen: s.gen || 0, pop, current: s.genome, bonus: s.bonus || 0, px: s.px, py: s.py, pointer: s.touched > 0, hist: (s.hist || []).slice() })
      .then((o) => { if (o && o.best && th.state === s) { pop = o.pop; F.setGenome(s, o.best); s.gen = o.gen; s.fit = o.fitness; s.bonus = (s.bonus || 0) * 0.5; el.dataset.gen = String(s.gen); } say(); })
      .catch(() => {}).finally(() => { busy = false; });
  };
  // F-045's portals: hotspots of the portal lattice become small buttons for 6 s; a tap keeps the rule in use (a fitness bonus)
  const portalTick = () => {
    const s = th.state, now = Date.now();
    portals = portals.filter((p) => { if (now - p.born > 6000 || s.variant !== 'portal') { p.el.remove(); return false; } return true; });
    if (s.variant === 'portal' && !still()) {
      for (const h of F.portalsOf(s)) {
        if (portals.length >= 5) break; if (portals.some((p) => Math.hypot(p.x - h.x, p.y - h.y) < 0.12)) continue;
        const b = document.createElement('button'); b.type = 'button'; b.className = 'nca-portal'; b.textContent = 'activity ' + h.energy.toFixed(2);
        b.setAttribute('aria-label', 'portal at activity ' + h.energy.toFixed(2) + ': tap to keep this rule'); b.style.left = (h.x * 100) + '%'; b.style.top = (h.y * 100) + '%';
        b.addEventListener('pointerdown', (e) => e.stopPropagation());
        b.addEventListener('click', () => { const v = F.reinforce(th.state); b.dataset.kept = '1'; el.dataset.reinforced = String((+el.dataset.reinforced || 0) + 1); el.dataset.bonus = v.toFixed(2); setTimeout(() => b.remove(), 400); redraw(); });
        frame.appendChild(b); portals.push({ el: b, x: h.x, y: h.y, born: now });
      }
    }
    el.dataset.portals = String(portals.filter((p) => p.el.isConnected).length);
  };
  const timer = setInterval(() => { if (!el.isConnected) { dispose(); return; } think(); }, F.MIND_EVERY * 1000);
  const ptimer = setInterval(() => { if (!el.isConnected) { dispose(); return; } portalTick(); }, 500);
  function dispose() { clearInterval(timer); clearInterval(ptimer); clearPortals(); try { mind.close(); } catch (_) { /* gone */ } }
  return { dispose };
}

const idea = {
  id: 'nca-mind', title: 'NCA mind', sub: F.VARIANTS[F.DEFAULT].sub, W: 360, H: 250, warm: 30,
  how: 'Every cell runs the same small rule on its neighbours. Move over the lattice to feed it, press to plant life; the mind keeps the rules that make it varied, moving and answering you. Pick another of Grok\'s lattices under Rule.',
  create(seed) { return F.create(seed, wanted); },
  step(s, dt, input) { F.step(s, dt, input); },
  metrics: (s) => F.metrics(s),
  params: (s) => F.params(s),
  status: (s) => { const m = F.metrics(s); return s.fid + ' · gen ' + (s.gen || 0) + ' · fitness ' + (s.fit || 0).toFixed(2) + ' · entropy ' + m.entropy.toFixed(2) + ' · activity ' + m.activity.toFixed(2) + (m.residual != null ? ' · surprise ' + m.residual.toFixed(2) : '') + ' · ' + (s.minded || 'starting'); },
  mount,
  draw(g, s, W, H) {
    if (!s.off || s.off.width !== s.W || s.off.height !== s.H) s.off = Object.assign(document.createElement('canvas'), { width: s.W, height: s.H });
    const og = s.off.getContext('2d'); if (!og) return;
    const img = og.createImageData(s.W, s.H); F.paint(s, img.data); og.putImageData(img, 0, 0);
    g.imageSmoothingEnabled = true; g.drawImage(s.off, 0, 0, W, H);
    if (s.variant === 'residual' && s.pred) { g.strokeStyle = 'rgba(180,240,255,.85)'; g.lineWidth = 2; g.beginPath(); g.arc(s.pred.x * W, s.pred.y * H, 7 + (s.res || 0) * 14, 0, Math.PI * 2); g.stroke(); } // where the mind thinks the pointer goes next
  }
};

const base = fieldSkill({
  name: 'nca-mind',
  words: '(?:(?:evolving |growing |local |multi-?channel )?(?:nca|neural cellular automat(?:on|a)|living lattice|lattice mind|multi-?channel lattice)(?: mind)?|gray[- ]scott (?:nca|lattice|pointer mind)|nca portals?(?: mind)?|portal nca|(?:predictive )?residual lattice(?: mind)?|predictive lattice(?: mind)?)',
  examples: ['nca mind', 'show me a living lattice', 'neural cellular automaton', 'multichannel lattice mind', 'nca portal mind', 'predictive residual lattice', 'gray scott nca', 'evolving nca'],
  nearMisses: ['what is a neural cellular automaton', 'lattice energy of salt', 'nca basketball scores', 'crystal lattice structure'],
  idea, say: 'NCA mind: a lattice where every cell runs one small rule, and a mind that evolves it · move over it to feed it, press to plant life, pick another rule under Rule'
});

export default {
  ...base,
  async run(text, api) {
    if (!base.match(String(text || '').toLowerCase(), text)) return 'none';
    const named = F.variantOf(text, null);
    if (named) {
      wanted = named;
      const existing = Object.values(api.stage.things()).find((t) => t.kind === 'nca-mind');
      if (existing) { const el = document.querySelector('.ff-nca-mind'); if (el) el.dispatchEvent(new CustomEvent('nca-variant', { detail: named })); }
    }
    return base.run(text, api);
  }
};
