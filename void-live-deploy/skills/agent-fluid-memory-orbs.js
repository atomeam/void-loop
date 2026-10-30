/**
 * agent-fluid-memory-orbs skill — F-321, agent-fluid memory orbs (asked by Owner, 2026-10-29; the draft is
 * drafts/F321-webgpu-agent-fluid-memory-orbs on atomeam/a-to-mind.com): small agents run one evolved tiny MLP and push a fluid; where
 * the fluid pools, a memory orb is born on the card as a real element, drifting with the flow, growing with the density under it and
 * taking its hue from the swirl. Tap an orb to seal it (SHA-256 of the 8 x 8 density around it and the agents' genome, kept in
 * IndexedDB); Recall stamps the newest seal back into the field, makes its genome the mind's seed, and checks it seals to the same hash.
 * Tilt leans the whole flow, the pointer adds energy, and the field's entropy and swirl colour the card's own chrome (never the page).
 * A mind of 6 genomes evolves every 2 s in a Worker, or on the page when Workers are blocked. The law is lib/field-fluid-orbs.js (pure,
 * tools/field-fluid-orbs.test.mjs); the card is lib/field-stage.js; it is a Mind Field mode. The pointer's path is never kept.
 * When Verse has its shared field (skills/field.js), live orbs are written into it and a seal is also sealed there (lib/orb-field.js,
 * tools/orb-field.test.mjs): the orbs are the field's episodic memory. Without it, nothing changes.
 * Open its colour hands the last sealed orb's colour (or the densest orb's) to /color/, which hands it on to /gradient/ and /wheel/.
 * Verse's own memories float in the fluid too (lib/orb-memories.js, tools/orb-memories.test.mjs): each word the visitor told Verse, where
 * Verse Brain's workspace holds it and as bright as it is there, and every other card's live slot in the shared field. Each pulls a little
 * dye where it sits, so the fluid's orbs pool on them. Tap a word to remind Verse of it; Spin its words hands them to /wheel/. The newest
 * sealed orb comes back by itself when the card opens again (a reload included), checked against its SHA-256 first.
 * Contract: { name, examples, nearMisses, match(lower, text), run(text, api) }
 */
import { fieldSkill, keepSeal } from '../lib/field-stage.js';
import { spawnMind } from '../lib/field-worker.js';
import * as F from '../lib/field-fluid-orbs.js';
import { fieldLink } from '../lib/orb-field.js';
import * as Mem from '../lib/orb-memories.js';
import { connectBrain } from '../lib/brain-bridge.js';
import { wheelLink } from '../lib/handoff.js';

const NAME = 'agent-fluid-memory-orbs';
const SAY = 'Memory orbs (F-321): small agents push a fluid, and where it pools a memory orb is born · the words you told Verse float in it too · tap an orb to seal it, Recall brings the last one back';
const SYNC = new WeakMap(); // card canvas -> the function that moves its orb elements (draw runs every frame and has only the canvas)
const tabSeals = []; // this tab's orb seals, for Recall when IndexedDB is blocked

/** the newest orb seal this device keeps (IndexedDB, then this tab). Never throws. */
function lastOrbSeal() {
  return new Promise((res) => {
    const fallback = () => res(tabSeals[tabSeals.length - 1] || null), done = setTimeout(fallback, 3000);
    try {
      const q = indexedDB.open('void-field', 1);
      q.onupgradeneeded = () => q.result.createObjectStore('seals', { keyPath: 'hash' });
      q.onsuccess = () => {
        try {
          const all = q.result.transaction('seals').objectStore('seals').getAll();
          all.onsuccess = () => { clearTimeout(done); q.result.close(); const rows = all.result.filter((r) => r.idea === NAME && r.orb).sort((a, b) => a.ts - b.ts); res(rows[rows.length - 1] || tabSeals[tabSeals.length - 1] || null); };
          all.onerror = () => { clearTimeout(done); fallback(); };
        } catch (_) { clearTimeout(done); fallback(); }
      };
      q.onerror = q.onblocked = () => { clearTimeout(done); fallback(); };
    } catch (_) { clearTimeout(done); fallback(); }
  });
}

/** the orb layer, Recall, and the mind thinking in the background (lib/field-stage.js idea.mount). */
function mount({ el, q, th, cv, still, redraw }) {
  const frame = q('.ff-frame'), layer = document.createElement('div'), recall = document.createElement('button'), sealed = q('.ff-sealed');
  frame.style.position = 'relative'; frame.style.border = '1px solid hsla(var(--fo-hue, 230), 80%, 62%, var(--fo-edge, .3))';
  frame.style.boxShadow = 'inset 0 0 calc(var(--fo-vorticity, 0) * 28px) hsla(var(--fo-hue, 230), 85%, 55%, .45)';
  cv.style.filter = 'none';
  layer.className = 'fo-layer'; layer.style.cssText = 'position:absolute;inset:0;pointer-events:none;overflow:hidden';
  frame.appendChild(layer);
  recall.type = 'button'; recall.className = 'g-btn fo-recall'; recall.textContent = 'Recall'; recall.title = 'bring the last sealed orb back into the field';
  recall.addEventListener('pointerdown', (e) => e.stopPropagation());
  q('.ff-btns').prepend(recall);
  // the hand-off to the other pages: an orb's colour opens on the colour page, which hands it on to the gradient and the wheel
  const toColor = document.createElement('a'), dot = document.createElement('span');
  toColor.className = 'g-btn fo-color'; toColor.href = '/color/'; toColor.title = 'open the colour of the last sealed orb, or the densest one, on the colour page';
  toColor.style.cssText = 'display:inline-flex;align-items:center;gap:6px;text-decoration:none;color:inherit';
  dot.className = 'fo-dot'; dot.style.cssText = 'width:10px;height:10px;border-radius:50%;background:transparent;box-shadow:0 0 0 1px currentColor';
  toColor.append(dot, document.createTextNode('Open its colour'));
  const aim = () => { const u = F.orbColorLink(th.state); if (u) toColor.href = u; return u; }; // worked out when pressed, from the orbs there now
  toColor.addEventListener('pointerdown', (e) => { e.stopPropagation(); aim(); });
  toColor.addEventListener('focus', aim);
  toColor.addEventListener('click', (e) => { if (!aim()) { e.preventDefault(); sealed.textContent = 'No orb yet to take a colour from: wait for one to form.'; } });
  recall.after(toColor);
  // and Verse's remembered words to the wheel, in the link's hash (it never reaches a server)
  const toWheel = document.createElement('a');
  toWheel.className = 'g-btn fo-wheel'; toWheel.href = '/wheel/'; toWheel.textContent = 'Spin its words';
  toWheel.title = 'put the words Verse remembers on the wheel of names'; toWheel.style.cssText = 'text-decoration:none;color:inherit';
  const aimWheel = () => { const u = wheelLink(Mem.wordsOf(mems)); toWheel.href = u || '/wheel/'; return u; };
  toWheel.addEventListener('pointerdown', (e) => { e.stopPropagation(); aimWheel(); });
  toWheel.addEventListener('focus', aimWheel);
  toWheel.addEventListener('click', (e) => { if (!aimWheel()) { e.preventDefault(); sealed.textContent = 'Verse remembers no words yet: tell it something first.'; } });
  toColor.after(toWheel);

  const els = new Map(); // orb id -> its element
  let pop = null, busy = false; // the mind's population (a recalled seal resets it) and whether a generation is out
  let field = null, fieldBusy = false; // the shared field's adapter once it answers (null: no field here, the orbs keep their own state)
  el.dataset.field = 'checking';
  fieldLink().then((f) => { if (!el.isConnected) return; field = f; el.dataset.field = f ? 'on' : 'off'; th.state.fielded = !!f; });
  const sealOne = async (o) => {
    try {
      const s = th.state, { hash, snap } = await F.sealOrb(s, o), m = F.metrics(s);
      const rec = { hash, idea: NAME, ts: Date.now(), params: { kind: 'orb', gen: s.gen || 0 }, metrics: m, orb: snap };
      const inField = field ? await field.seal(s, o).catch(() => null) : null; // the field seals its own copy; the SHA-256 seal stands either way
      if (inField) { rec.field = inField; el.dataset.fieldGenome = inField.genomeId; }
      tabSeals.push(rec); if (tabSeals.length > 20) tabSeals.shift();
      const r = await keepSeal(rec); o.sealed = hash; o.sealedAt = Date.now();
      sealed.textContent = 'Orb sealed ' + hash.slice(0, 12) + ' (SHA-256 of the density around it and the agents\' genome, no pointer path) · ' + r.kept + ' kept on ' + r.where + (inField ? ' · in the shared field as ' + inField.genomeId : '');
      el.dataset.orbSeal = hash.slice(0, 12); el.dataset.orbSeals = String((+el.dataset.orbSeals || 0) + 1);
    } catch (_) { sealed.textContent = 'Could not seal this orb here.'; }
  };
  const sync = (s) => {
    const live = new Set();
    for (const o of s.orbs) {
      live.add(o.id); let b = els.get(o.id);
      if (!b) {
        b = document.createElement('button'); b.type = 'button'; b.className = 'fo-orb'; b.dataset.orb = String(o.id);
        b.setAttribute('aria-label', 'memory orb: tap to seal it');
        b.style.cssText = 'position:absolute;width:22px;height:22px;margin:-11px 0 0 -11px;padding:0;border-radius:50%;border:0;cursor:pointer;pointer-events:auto;mix-blend-mode:screen;transition:opacity .3s';
        b.addEventListener('pointerdown', (e) => e.stopPropagation());
        b.addEventListener('click', (e) => { e.stopPropagation(); const cur = th.state.orbs.find((x) => x.id === o.id); if (cur) sealOne(cur); });
        layer.appendChild(b); els.set(o.id, b);
      }
      const m = F.orbMorph(o), gold = !!o.sealed, hue = gold ? 42 : m.hue;
      b.style.left = (o.x / F.GW * 100).toFixed(2) + '%'; b.style.top = (o.y / F.GH * 100).toFixed(2) + '%';
      b.style.transform = 'scale(' + m.scale + ')'; b.style.opacity = String(m.opacity);
      b.style.background = 'radial-gradient(circle at 40% 38%, hsla(' + hue + ',100%,88%,.95) 0%, hsla(' + hue + ',90%,60%,.7) 38%, hsla(' + hue + ',90%,45%,0) 72%)';
      b.style.boxShadow = '0 0 14px hsla(' + hue + ',90%,60%,.55)' + (gold ? ', 0 0 0 1.5px hsla(42,95%,65%,.9)' : '');
      b.classList.toggle('sealed', gold); b.dataset.scale = String(m.scale); b.dataset.hue = String(hue);
      b.setAttribute('aria-label', gold ? 'sealed memory orb ' + o.sealed.slice(0, 12) : 'memory orb: tap to seal it');
    }
    for (const [id, b] of els) if (!live.has(id)) { b.remove(); els.delete(id); }
    el.dataset.orbs = String(s.orbs.length);
    const hand = F.handOrb(s), hx = hand ? F.orbHex(hand) : ''; // keep the hand-off's swatch on the orb it would carry
    if (hx !== (el.dataset.handColor || '')) { el.dataset.handColor = hx; dot.style.background = hx || 'transparent'; toColor.href = hx ? '/color/?c=' + hx.slice(1) : '/color/'; }
  };
  // Verse's own memories as orbs (lib/orb-memories.js): the page's brain when it has one (window.verseBrainHost, the same brain the Verse
  // Brain card shows), else what a brain on another tab posts; then the other cards' live slots in the shared field
  const memEls = new Map(), memLine = document.createElement('div');
  let mems = [], heard = null;
  memLine.className = 'fo-memories'; memLine.setAttribute('aria-live', 'polite'); memLine.style.cssText = 'font-size:12px;opacity:.85;margin-top:4px';
  sealed.after(memLine);
  const pageBrain = () => { const h = window.verseBrainHost; return h && h.alive !== false && h.brain ? h.brain : null; };
  const remind = (word) => {
    const api = window.verseBrain, done = api && typeof api.tell === 'function' ? api.tell(word) !== null : !!(heard && heard.tell(word));
    sealed.textContent = done ? 'Reminded Verse of "' + word + '": that idea is bright again.' : 'Verse Brain is not running here, so it could not be reminded.';
    if (done) el.dataset.reminded = word; remember();
  };
  const memOf = (m) => {
    let b = memEls.get(m.key); if (b) return b;
    b = document.createElement(m.word ? 'button' : 'span'); b.className = 'fo-mem'; b.dataset.mem = m.kind;
    if (m.word) {
      b.type = 'button'; b.textContent = m.word;
      b.style.cssText = 'position:absolute;transform:translate(-50%,-50%);padding:1px 7px;border-radius:999px;font:11px/1.5 system-ui,sans-serif;color:#e8f6ff;white-space:nowrap;cursor:pointer;pointer-events:auto;border:1px solid hsla(190,90%,72%,.55);background:radial-gradient(circle at 50% 40%, hsla(190,95%,62%,.38), hsla(230,80%,30%,.25));box-shadow:0 0 10px hsla(190,90%,60%,.35);transition:opacity .4s';
      b.addEventListener('pointerdown', (e) => e.stopPropagation());
      b.addEventListener('click', (e) => { e.stopPropagation(); remind(m.word); });
    } else b.style.cssText = 'position:absolute;width:14px;height:14px;margin:-7px 0 0 -7px;border-radius:50%;pointer-events:none;border:1.5px solid hsla(320,85%,70%,.8);box-shadow:0 0 8px hsla(320,85%,60%,.5)';
    layer.appendChild(b); memEls.set(m.key, b); return b;
  };
  const remember = () => {
    const brain = pageBrain();
    if (!brain && !heard) { try { heard = connectBrain(); } catch (_) { heard = null; } } // no brain on this page: hear one on another tab
    mems = Mem.memoriesOf({ brain, heard: heard && heard.live ? heard.state : null, slots: field ? field.slots() : [], own: field ? field.code : 0 });
    th.state.pulls = Mem.pullsOf(mems, F.GW, F.GH); th.state.memories = mems.length;
    const live = new Set();
    for (const m of mems) {
      live.add(m.key); const b = memOf(m);
      b.style.left = (m.x * 100).toFixed(2) + '%'; b.style.top = (m.y * 100).toFixed(2) + '%'; b.style.opacity = (0.45 + 0.55 * m.act).toFixed(2);
      const what = m.word ? m.from + ' remembers "' + m.word + '"' + (m.kind === 'heard' ? ' (on another tab)' : '') + ': tap to remind it' : m.from + ': its slot in the shared field';
      b.title = what; if (m.word) b.setAttribute('aria-label', what);
    }
    for (const [k, b] of memEls) if (!live.has(k)) { b.remove(); memEls.delete(k); }
    const words = Mem.wordsOf(mems), t = Mem.memorySays(mems);
    if (memLine.textContent !== t) memLine.textContent = t;
    Object.assign(el.dataset, { memories: String(mems.length), memoryWords: words.join(','), memoryFrom: brain ? 'page' : heard && heard.live ? 'tab' : mems.length ? 'field' : 'none' });
  };
  SYNC.set(cv, sync);

  recall.addEventListener('click', async () => {
    const rec = await lastOrbSeal();
    if (!rec || !rec.orb) { sealed.textContent = 'No sealed orb yet: tap an orb to seal one.'; return; }
    const ok = F.verifySnap(rec.orb, rec.hash);
    if (!ok) { sealed.textContent = 'That seal no longer matches its hash, so it was not loaded.'; return; }
    const o = F.loadOrb(th.state, rec.orb, rec.hash), again = F.sealOrbSync(th.state, o).hash; o.sealedAt = Date.now();
    sealed.textContent = 'Recalled orb ' + rec.hash.slice(0, 12) + (again === rec.hash ? ' · it seals to the same SHA-256' : ' · its hash changed') + ' · its genome seeds the mind';
    el.dataset.recalled = rec.hash.slice(0, 12); el.dataset.recallSame = String(again === rec.hash); pop = null; redraw();
    if (field) field.sync(th.state).catch(() => {}); // the recalled memory is back in the shared field too
  });

  // a memory that vanished on reload would be no memory: the newest sealed orb comes back by itself, checked against its SHA-256 first
  lastOrbSeal().then((rec) => {
    if (!el.isConnected || !rec || !rec.orb || el.dataset.recalled || !F.verifySnap(rec.orb, rec.hash)) return;
    const o = F.loadOrb(th.state, rec.orb, rec.hash), again = F.sealOrbSync(th.state, o).hash; o.sealedAt = Date.now(); pop = null;
    el.dataset.restoredOrb = rec.hash.slice(0, 12); el.dataset.restoredSame = String(again === rec.hash);
    sealed.textContent = 'Back from before: orb ' + rec.hash.slice(0, 12) + (again === rec.hash ? ', it seals to the same SHA-256' : ', its hash changed'); redraw();
  }).catch(() => {});

  const mind = spawnMind(new URL('../lib/field-fluid-orbs.js', import.meta.url).href, 'evolveOrbs', F.evolveOrbs);
  const show = () => { const s = th.state; s.minded = mind.mode === 'worker' ? 'thinking in a Worker' : 'thinking on the page'; Object.assign(el.dataset, { mind: mind.mode, gen: String(s.gen || 0) }); };
  const think = () => {
    if (busy || still() || document.hidden || !el.isConnected) return; busy = true;
    const s = th.state; // the mind hears where the pointer is now (or last was), never where it has been
    mind.call({ pop, seed: s.seed, gen: s.gen || 0, pointer: s.lastOver || null })
      .then((o) => { if (o && o.best) { pop = o.pop; F.setGenome(th.state, o.best); th.state.gen = o.gen; th.state.fit = o.fitness; } show(); })
      .catch(() => {}).finally(() => { busy = false; });
  };
  show();
  const timer = setInterval(() => { if (!el.isConnected) { dispose(); return; } show(); think(); }, F.MIND_EVERY * 1000);
  remember();
  const toField = setInterval(() => { // Verse's memories onto the card, then live orbs into the shared field, a pass at a time
    if (el.isConnected && !document.hidden) remember();
    if (!field || fieldBusy || still() || document.hidden || !el.isConnected) return; fieldBusy = true;
    field.sync(th.state).catch(() => {}).finally(() => { fieldBusy = false; });
  }, 500);
  function dispose() { clearInterval(timer); clearInterval(toField); try { mind.close(); } catch (_) { /* gone */ } if (field) field.close().catch(() => {}); if (heard) heard.close(); SYNC.delete(cv); }
  return { dispose };
}

let img = null; // one small canvas for the density image (48 x 36, scaled up smooth)
function densityImage(s) {
  if (!img) { img = document.createElement('canvas'); img.width = F.GW; img.height = F.GH; img.ctx = img.getContext('2d'); img.data = img.ctx && img.ctx.createImageData(F.GW, F.GH); }
  if (!img.ctx) return null;
  const px = img.data.data;
  for (let i = 0; i < s.d.length; i++) { // deep space: near-black violet, through indigo, to a cyan-white core
    const t = Math.pow(s.d[i] / F.DMAX, 0.6), k = i * 4;
    px[k] = 5 + 70 * t + 150 * t * t * t; px[k + 1] = 4 + 120 * Math.pow(t, 1.6); px[k + 2] = 12 + 230 * t; px[k + 3] = 255;
  }
  img.ctx.putImageData(img.data, 0, 0); return img;
}

const idea = {
  id: NAME, title: 'Memory orbs', sub: 'F-321 · agents in a fluid', W: 360, H: 270, warm: 40,
  how: 'Small agents share one tiny neural policy and push a fluid. Where it pools, a memory orb is born: it drifts with the current, grows with the density under it and turns with the swirl. Tap one to seal it; Recall brings the last sealed orb back. The words you told Verse float in it too, where Verse Brain holds them, and the fluid pools on them: tap a word to remind Verse of it.',
  create(seed) { return F.create(seed); },
  step(s, dt, input) {
    F.step(s, dt, input);
    const h = Math.max(0, Math.min(3, (+dt || 1 / 60) * 60)); for (const p of s.pulls || []) F.splat(s, p.x, p.y, 0, 0, p.dye * h, 2); // Verse's memories pull the fluid
    s.lastOver = input.over ? { x: input.x, y: input.y } : s.lastOver || null; }, // one point, overwritten: never a path
  metrics: (s) => F.metrics(s),
  params: (s) => F.params(s),
  vars: (s, m) => F.chromeOf(m),
  status: (s, m) => 'F-321 · gen ' + (s.gen || 0) + ' · fitness ' + (s.fit || 0).toFixed(2) + ' · ' + m.orbs + (m.orbs === 1 ? ' orb' : ' orbs') + ' · swirl ' + m.vorticity.toFixed(2) + ' · entropy ' + m.entropy.toFixed(2) + ' · ' + (s.minded || 'starting') + (s.fielded ? ' · in the shared field' : '') + (s.memories ? ' · ' + s.memories + ' of Verse\'s memories' : ''),
  mount,
  draw(g, s, W, H) {
    const im = densityImage(s);
    if (im) { g.imageSmoothingEnabled = true; g.drawImage(im, 0, 0, W, H); } else { g.fillStyle = '#05040c'; g.fillRect(0, 0, W, H); }
    const cx = W / F.GW, cy = H / F.GH; g.lineWidth = 1.2;
    for (let k = 0; k < F.N_AGENTS; k++) { // each agent and the push it is giving
      const x = s.ax[k] * cx, y = s.ay[k] * cy;
      g.strokeStyle = 'rgba(160,230,255,.55)'; g.beginPath(); g.moveTo(x, y); g.lineTo(x + s.fx[k] * 9, y + s.fy[k] * 9); g.stroke();
      g.fillStyle = 'rgba(225,245,255,.95)'; g.beginPath(); g.arc(x, y, 2.2, 0, Math.PI * 2); g.fill();
    }
    const sync = SYNC.get(g.canvas); if (sync) sync(s);
  }
};

const words = '(?:agent[- ]fluid(?: memory)? orbs?|(?:fluid )?memory orbs?|fluid (?:memory )?orbs?|agent fluid(?: field| mind)?|fluid orb mind|f-?321(?: orbs?)?)';
export default fieldSkill({
  name: NAME, words,
  examples: ['memory orbs', 'agent fluid memory orbs', 'fluid memory orbs', 'show me the memory orbs', 'agent fluid', 'fluid orbs'],
  nearMisses: ['what is a fluid', 'how does memory work', 'orbs', 'buy crystal orbs', 'fluid ounces to ml'],
  idea, say: SAY
});
