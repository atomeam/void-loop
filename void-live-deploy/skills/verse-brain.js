/**
 * verse-brain skill — Verse Brain, the one entity Grok's frontier drafts became (owner, 2026-10-29: "build all the unique builds as a
 * combination and that can be verse"; "the grok builds combined can be verse brain"; "combine all the builds into one entity"; "all the
 * pages are supposed to be able to work together"). The brain is lib/brain.js (one workspace, eighteen organs, attention, imagination, the
 * self); lib/brain-drafts.json says which frontier drafts in atomeam/a-to-mind.com each organ is made from, and why the rest were left out.
 * The card shows the workspace live: the tissue tinted by the rhythm's phase, surprise in red, the memory's expectation in violet, the
 * attention spotlight, the swarm, the membrane. The words you type, what the gestures organ named, what the memory expects and what the will
 * is doing are DOM orbs you can drag: a drag writes into the workspace as "you". Good rewards the will; Listen feeds it the microphone's
 * level and the pitch of what you hum (numbers, never recorded: lib/brain-hearing.js turns them into notes and guesses the next one). Play a tune feeds the same ear a tune the page plays, for anyone with no microphone. Every other Verse page in this browser reaches the same brain (lib/brain-bridge.js).
 * The mind layers (lib/brain-mind.js): every ask on the stage (the page's 'void:ask' event) and every word typed here becomes ideas and
 * goals that pull; a question ("why did that form?", "what just happened?", "what are you doing?") is answered from its own state; its
 * choices are remembered as moments the will reads before choosing, its winning genomes by context; where two organs disagree over a
 * region the card outlines it. What it learned is kept on this device (lib/brain-store.js, Forget clears it), and what it is thinking (its
 * workspace, ideas, spotlight and goals) is a part it holds in the shared field, kept on this device and given back after a reload (lib/shared-field.js
 * hold, persist, recall); Forget deletes that too. Verse's own priorities
 * (/self.json) are standing ideas it compares yours with. Nothing is sent anywhere; a seal is numbers only (lib/brain.js params).
 * Contract: { name, examples, nearMisses, match(lower, text), run(text, api) }, made with lib/field-stage.js fieldSkill.
 */
import { fieldSkill } from '../lib/field-stage.js';
import * as B from '../lib/brain.js';
import { GW, GH, RG, RH, KIND, REGIONS_X, REGIONS_Y } from '../lib/brain-workspace.js';
import { hostBrain } from '../lib/brain-bridge.js';
import { ensureHost } from '../lib/brain-host.js';
import { MODES, BRAIN } from '../lib/mind-field-modes.js';
import { loadKept, keep, forget } from '../lib/brain-store.js';
import * as Field from '../lib/shared-field.js';
import { feltFrom, linkBrain, fieldSays } from '../lib/brain-field.js';
import { detectPitch } from '../lib/brain-hearing.js';
import { PX, PY } from '../lib/brain-painter.js';

const phone = () => typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches;
const offs = new WeakMap(); // an offscreen GW x GH canvas per state, kept off the state (the stage saves its things)
const paintOffs = new WeakMap();
function paintOffFor(s) { let o = paintOffs.get(s); if (!o) { o = Object.assign(document.createElement('canvas'), { width: PX, height: PY }); paintOffs.set(s, o); } return o; }
function offFor(s) { let o = offs.get(s); if (!o) { o = Object.assign(document.createElement('canvas'), { width: GW, height: GH }); offs.set(s, o); } return o; }
const SPECIES = ['#7fd8ff', '#ffb36b', '#b99bff'];

// the card shows the page's one brain (lib/brain-host.js): the one that has heard every ask on every Verse page. Opening the card adopts it;
// Reset while the card is open gives the host a new brain with what this device kept. Without a window (tests) the card has its own.
const hostOf = () => { try { return typeof window === 'undefined' ? null : ensureHost(); } catch (_) { return null; } };
function create(seed) {
  const h = hostOf(); if (!h) return { b: B.createBrain(seed, { phone: phone() }), level: 0, seed };
  return { b: h.adopted ? h.reset(seed) : h.brain, level: 0, seed, hosted: true };
}
// the shared field (lib/shared-field.js, also skills/field.js): one link per page; the brain feels other skills' slots and publishes its ideas
let link = null; const fieldLink = () => link || (link = linkBrain(Field));
const felt = new WeakMap(); // what the brain felt last tick, per state, for the drawing
const pitchQ = new WeakMap(); // pitch frames [Hz, seconds] the microphone gave since the last tick, per state, kept off the state (never saved)
const framesFor = (s) => { let q = pitchQ.get(s); if (!q) pitchQ.set(s, (q = [])); return q; };
function step(s, dt, input) {
  const L = fieldLink(), f = feltFrom(Field, L.code); felt.set(s, f);
  const q = framesFor(s), pitches = q.splice(0, q.length);
  B.stepBrain(s.b, { x: input.x, y: input.y, over: input.over, down: input.down, tiltX: input.tiltX, tiltY: input.tiltY, sound: s.level, pitches, field: f });
  Field.step(dt); if (s.b.ticks % 10 === 0) L.publish(s.b);
}
function metrics(s) { const m = s.b.metrics; return { entropy: m.entropy, activity: m.activity, consensus: m.order, cx: s.b.focus.x, cy: s.b.focus.y }; }

/** one pixel per cell: the tissue in a hue that turns with the rhythm's phase there, surprise added in red, the expectation in violet. */
function drawField(g, s, W, H) {
  const ws = s.b.ws, L = ws.layers, off = offFor(s), og = off.getContext('2d'); if (!og) return;
  const img = og.createImageData(GW, GH), d = img.data;
  for (let y = 0; y < GH; y++) for (let x = 0; x < GW; x++) {
    const i = y * GW + x, ph = ws.phase[Math.floor(y * RH / GH) * RG + Math.floor(x * RG / GW)] * 6.2832, a = Math.min(1, L.act[i] * 2.4);
    const sur = Math.min(1, L.surprise[i] * 3), mem = Math.min(1, L.memory[i] * 2), inp = Math.min(1, L.input[i] * 1.5);
    d[i * 4] = 8 + a * (90 + 70 * Math.cos(ph)) + sur * 200 + mem * 60 + inp * 40;
    d[i * 4 + 1] = 6 + a * (120 + 60 * Math.cos(ph - 2.1)) + inp * 40;
    d[i * 4 + 2] = 18 + a * (150 + 80 * Math.cos(ph + 2.1)) + mem * 150 + inp * 50;
    d[i * 4 + 3] = 255;
  }
  og.putImageData(img, 0, 0); g.imageSmoothingEnabled = true; g.drawImage(off, 0, 0, W, H);
  // the painter's look: the hues its current program paints, laid lightly over the tissue
  const pt = s.b.board.paint; if (!pt) return;
  const po = paintOffFor(s), pg = po.getContext('2d'); if (!pg) return;
  const pimg = pg.createImageData(PX, PY), pd = pimg.data;
  for (let c = 0; c < PX * PY; c++) { const h = pt.hues[c] * 6.2832; pd[c * 4] = 128 + 110 * Math.cos(h); pd[c * 4 + 1] = 128 + 110 * Math.cos(h - 2.1); pd[c * 4 + 2] = 128 + 110 * Math.cos(h + 2.1); pd[c * 4 + 3] = 255; }
  pg.putImageData(pimg, 0, 0); g.save(); g.globalAlpha = 0.22; g.globalCompositeOperation = 'screen'; g.drawImage(po, 0, 0, W, H); g.restore();
}
function draw(g, s, W, H) {
  const b = s.b, N = b.ws.nodes;
  drawField(g, s, W, H);
  // the grower's plant (F453): stems from its grammar, bent toward the focus, in green
  const gr = b.board.grow; if (gr && gr.segs && gr.segs.length) {
    g.strokeStyle = 'rgba(150,230,120,.7)'; g.lineWidth = 1; g.beginPath();
    for (let k = 0; k + 3 < gr.segs.length; k += 4) { g.moveTo(gr.segs[k] * W, gr.segs[k + 1] * H); g.lineTo(gr.segs[k + 2] * W, gr.segs[k + 3] * H); }
    g.stroke();
  }
  // the attention spotlight
  const fx = b.focus.x * W, fy = b.focus.y * H; g.strokeStyle = 'rgba(255,255,255,.55)'; g.lineWidth = 1.5; g.setLineDash([4, 4]);
  g.beginPath(); g.arc(fx, fy, 26, 0, 6.2832); g.stroke(); g.setLineDash([]);
  // what it feels from other skills in the shared field (a memory orb on another card, say): a soft ring where each sits
  g.strokeStyle = 'rgba(255,170,230,.75)'; g.lineWidth = 1.2;
  for (const p of felt.get(s) || []) { g.beginPath(); g.arc(p.x * W, p.y * H, 3 + 6 * p.act, 0, 6.2832); g.stroke(); }
  // the swarm
  for (const i of b.swarmIds) { g.fillStyle = SPECIES[N.kind[i]] || '#fff'; g.fillRect(N.x[i] * W - 1.2, N.y[i] * H - 1.2, 2.4, 2.4); }
  // the membrane
  const m = b.membraneIds; if (m.length) {
    g.strokeStyle = 'rgba(160,255,210,.7)'; g.lineWidth = 1.6; g.beginPath();
    m.forEach((i, k) => (k ? g.lineTo(N.x[i] * W, N.y[i] * H) : g.moveTo(N.x[i] * W, N.y[i] * H))); g.closePath(); g.stroke();
  }
  // links between ideas (the orbs themselves are DOM, above the canvas)
  const C = b.concepts; g.strokeStyle = 'rgba(190,210,255,.25)'; g.lineWidth = 1;
  for (const [key, w] of C.edges) { if (w < 1) continue; const [p, q] = String(key).split(':').map(Number); const i = C.node[p], j = C.node[q]; if (i == null || j == null || N.kind[i] !== KIND.concept) continue; g.beginPath(); g.moveTo(N.x[i] * W, N.y[i] * H); g.lineTo(N.x[j] * W, N.y[j] * H); g.stroke(); }
  // where two organs disagree (the monitor): the region outlined in amber, with who
  g.font = '600 10px system-ui,sans-serif'; g.textBaseline = 'top';
  for (const c of b.mind.conflicts) {
    const rx = (c.region % REGIONS_X) * W / REGIONS_X, ry = Math.floor(c.region / REGIONS_X) * H / REGIONS_Y, rw = W / REGIONS_X, rh = H / REGIONS_Y;
    g.strokeStyle = 'rgba(255,196,90,.85)'; g.setLineDash([3, 3]); g.strokeRect(rx + 1, ry + 1, rw - 2, rh - 2); g.setLineDash([]);
    g.fillStyle = 'rgba(255,214,140,.95)'; g.fillText(c.organs.slice(0, 2).join(' / '), rx + 4, ry + 4);
  }
}
function status(s) { return B.selfSays(s.b).slice(0, 2).join(' '); }

// ---- the card's own parts: orbs, words, Good, Listen, the organ table, the bridge --------------------------------------------------------
function mount({ el, q, th, cv, tick, redraw, still }) {
  const S = () => th.state, frame = q('.ff-frame'), host = S().hosted ? hostOf() : null;
  if (host) host.adopted = true;
  let DRAFTS = { byOrgan: {} }; // the draft map (lib/brain-drafts.json, written by tools/brain-drafts.mjs), fetched only when a card opens
  frame.style.position = 'relative';
  const layer = document.createElement('div'); layer.className = 'vb-orbs'; layer.style.cssText = 'position:absolute;inset:0;pointer-events:none;overflow:hidden';
  frame.appendChild(layer);
  const row = document.createElement('div'); row.className = 'vb-ctl'; row.style.cssText = 'display:flex;gap:6px;flex-wrap:wrap;align-items:center;margin-top:6px';
  row.innerHTML = '<form class="vb-form" style="display:flex;gap:6px;flex:1;min-width:180px"><input class="vb-word" type="text" maxlength="120" autocomplete="off" spellcheck="false" placeholder="tell it something, or ask why" aria-label="Words for Verse Brain to think about, or a question about what it is doing" style="flex:1;min-width:0;padding:4px 8px;border-radius:7px;border:1px solid var(--line,#444);background:transparent;color:inherit">'
    + '<button type="submit" class="g-btn vb-tell">Tell</button></form><button type="button" class="g-btn vb-good">Good</button><button type="button" class="g-btn vb-listen" aria-pressed="false">Listen</button><button type="button" class="g-btn vb-tune" aria-pressed="false" title="Plays Frere Jacques twice into its ear: a tune the page plays, not your voice, so you can see it hear with no microphone">Play a tune</button><button type="button" class="g-btn vb-forget">Forget</button>';
  q('.ff-btns').insertAdjacentElement('beforebegin', row);
  const said = document.createElement('div'); said.className = 'vb-said'; said.setAttribute('aria-live', 'polite'); said.style.cssText = 'font-size:12px;min-height:1.3em;margin-top:4px';
  row.insertAdjacentElement('afterend', said);
  // the shared field, said in words on the card: what it feels from the other mind cards, and what it holds there of its own
  const fieldLine = document.createElement('div'); fieldLine.className = 'vb-field'; fieldLine.setAttribute('aria-live', 'polite'); fieldLine.style.cssText = 'font-size:12px;margin-top:4px;color:rgb(255,170,230)';
  said.insertAdjacentElement('afterend', fieldLine);
  // how well it guesses the visitor's next ask on Verse (the asks layer, lib/brain-mind.js heardAsk): counted on this device, never sent
  const askLine = document.createElement('div'); askLine.className = 'vb-asks'; askLine.style.cssText = 'font-size:12px;margin-top:4px;color:var(--muted,#8a8a8a)';
  fieldLine.insertAdjacentElement('afterend', askLine);
  const det = document.createElement('details'); det.className = 'vb-organs'; det.style.cssText = 'font-size:12px;margin-top:6px';
  det.innerHTML = '<summary>Organs: what each does and how much it runs</summary><table style="width:100%;border-collapse:collapse;margin-top:4px"><tbody></tbody></table>'
    + '<div class="vb-made" style="color:var(--muted,#8a8a8a);margin-top:4px"></div>';
  askLine.insertAdjacentElement('afterend', det);
  for (const n of [row, det, ...row.querySelectorAll('input,button')]) for (const ev of ['pointerdown', 'keydown']) n.addEventListener(ev, (e) => e.stopPropagation());
  const box = q('.vb-word'), listenBtn = q('.vb-listen'), tuneBtn = q('.vb-tune'), body = det.querySelector('tbody');
  const made = () => {
    q('.vb-made').textContent = DRAFTS.total ? 'Made from ' + DRAFTS.inBrain + ' of ' + DRAFTS.total + ' frontier drafts (' + DRAFTS.techniques + ' techniques); '
      + DRAFTS.left + ' were left out, each with its reason: ' + DRAFTS.drafts.filter((d) => !d.organ).map((d) => d.folder.replace(/^F0*(\d+)-/, 'F$1 ')).join(', ') + '.' : '';
    for (const [id, tr] of rows) { const k = DRAFTS.byOrgan[id] || 0; tr.children[2].textContent = tr.dataset.job + (k ? ' (' + k + ' draft' + (k === 1 ? '' : 's') + ')' : ''); }
    el.dataset.drafts = String(DRAFTS.inBrain || 0);
  };

  // the organ table: one row per organ, its share of recent ticks and its job
  const rows = new Map();
  for (const o of B.ORGANS) {
    const tr = document.createElement('tr');
    tr.innerHTML = '<td style="padding:2px 6px 2px 0;white-space:nowrap;font-weight:600"></td><td class="vb-use" style="padding:2px 6px;white-space:nowrap;text-align:right"></td><td style="padding:2px 0"></td>';
    tr.children[0].textContent = o.name; tr.children[2].textContent = o.job;
    tr.dataset.organ = o.id; tr.dataset.job = o.job; body.appendChild(tr); rows.set(o.id, tr);
  }
  const table = () => { const b = S().b, ran = new Set(b.granted), use = B.useOf(b); for (const [id, tr] of rows) { tr.children[1].textContent = Math.round(use[id] * 100) + '%'; tr.style.opacity = ran.has(id) ? '1' : '0.6'; } };

  // the orbs: one DOM element per embodied thing, reused by key; dragging one writes into the workspace
  const orbs = new Map(); let drag = null;
  const orbFor = (e) => {
    let o = orbs.get(e.key); if (o) return o;
    o = document.createElement('button'); o.type = 'button'; o.className = 'vb-orb'; o.dataset.organ = e.organ; o.dataset.key = e.key;
    o.style.cssText = 'position:absolute;transform:translate(-50%,-50%);pointer-events:auto;border-radius:999px;border:1px solid rgba(255,255,255,.35);padding:2px 8px;font:600 11px system-ui,sans-serif;color:#fff;cursor:grab;touch-action:none;max-width:60%;white-space:normal;text-align:center';
    o.addEventListener('pointerdown', (ev) => { ev.stopPropagation(); ev.preventDefault(); drag = { key: e.key, id: ev.pointerId }; try { o.setPointerCapture(ev.pointerId); } catch (_) { /* fine */ } o.style.cursor = 'grabbing'; });
    o.addEventListener('pointermove', (ev) => {
      if (!drag || drag.key !== e.key) return; const r = cv.getBoundingClientRect(), x = (ev.clientX - r.left) / (r.width || 1), y = (ev.clientY - r.top) / (r.height || 1);
      const cur = B.embodiment(S().b).find((z) => z.key === e.key); B.dragTo(S().b, cur || null, x, y); if (still()) tick(1); else redraw();
    });
    const end = () => { drag = null; o.style.cursor = 'grab'; };
    o.addEventListener('pointerup', end); o.addEventListener('pointercancel', end);
    layer.appendChild(o); orbs.set(e.key, o); return o;
  };
  const place = () => {
    const list = B.embodiment(S().b), seen = new Set();
    for (const e of list) {
      const o = orbFor(e); seen.add(e.key); o.textContent = e.label;
      o.style.left = (e.x * 100).toFixed(2) + '%'; o.style.top = (e.y * 100).toFixed(2) + '%';
      o.style.background = 'hsla(' + Math.round(e.hue) + ',70%,' + Math.round(28 + e.size * 22) + '%,.82)'; o.style.fontSize = (10 + e.size * 4).toFixed(1) + 'px';
    }
    for (const [k, o] of orbs) if (!seen.has(k)) { o.remove(); orbs.delete(k); }
    el.dataset.orbs = String(orbs.size);
  };

  const sync = () => {
    const b = S().b, self = B.selfOf(b);
    el.dataset.utility = String(self.utility); el.dataset.gen = String(self.genome.gen); el.dataset.chosen = String(self.q); el.dataset.imagined = String(self.imagined);
    el.dataset.concepts = String(self.concepts); el.dataset.focus = String(b.focus.region); el.dataset.action = self.action; el.dataset.ticks = String(b.ticks);
    el.dataset.organs = String(B.ORGAN_IDS.length); el.dataset.episodes = String(self.episodes); el.dataset.procedures = String(self.procedures); el.dataset.wants = String(self.wants.length); el.dataset.conflicts = String(self.conflicts.length);
    el.dataset.heard = String(b.ear.notes); el.dataset.guessed = String(b.ear.guessed); el.dataset.hits = String(b.ear.hits); el.dataset.ear = b.board.ear ? b.board.ear.note : ''; el.dataset.paintgen = String(b.painter.gen); el.dataset.growgen = String(b.grower.gen); el.dataset.formulagen = String(b.formula.gen); // Listen: notes heard, guesses made and right (numbers only)
    const fc = Field.census(); el.dataset.felt = String((felt.get(S()) || []).length); el.dataset.published = String(link ? link.held : 0); el.dataset.fieldOwners = Object.keys(fc.held).sort().join(',');
    const t = fieldSays(fc, +el.dataset.felt, link ? link.held : 0); if (fieldLine.textContent !== t) fieldLine.textContent = t;
    const A = b.mind.asks; el.dataset.askGuessed = String(A.guessed); el.dataset.askHits = String(A.hits); el.dataset.askGuess = A.guess || '';
    const a = A.guessed ? 'It guessed your next ask on Verse right ' + A.hits + ' of ' + A.guessed + ' times (' + Math.round(A.hits / A.guessed * 100) + '%)' + (A.guess ? '; next it expects "' + A.guess + '".' : '.')
      : A.heard ? 'It has heard ' + A.heard + ' of your asks on Verse; it guesses the next one once it has seen what follows what.' : 'Ask Verse things in the box above: it learns what you ask next and guesses it.';
    if (askLine.textContent !== a) askLine.textContent = a;
  };

  // words, from this card or from any other Verse page (the bridge)
  const heard = (r, from) => {
    if (!r || !r.words.length) { said.textContent = 'Nothing it could hold there (it keeps words of two letters or more).'; return; }
    const rel = r.related.filter((x) => x.word !== r.words[r.words.length - 1]).slice(0, 3).map((x) => x.word + (x.linked ? ' (used together)' : ''));
    said.textContent = (from === 'page' ? 'Another Verse page told it: ' : 'Holding: ') + r.words.join(', ') + '.' + (rel.length ? ' Nearest ideas: ' + rel.join(', ') + '.' : '')
      + (r.surprise != null ? ' Surprise ' + (+r.surprise).toFixed(1) + ' bits a letter.' : '');
  };
  // what it kept from before a reload comes back first (lib/shared-field.js recall, one read a page), so a word told meanwhile is added to it
  let ready = Promise.resolve();
  q('.vb-form').addEventListener('submit', (e) => {
    e.preventDefault(); const t = box.value; box.value = ''; ready.then(() => told(t));
  });
  const told = (t) => {
    if (!el.isConnected) return; const r = B.ask(S().b, t); if (host && !r.answer) host.told = true;
    if (r.answer) { said.textContent = r.answer.join(' '); el.dataset.answered = String(+(el.dataset.answered || 0) + 1); return; }
    paused = false; heard(r, 'card'); if (still()) tick(20); else redraw(); place(); sync(); publish(true); save();
  };
  // every ask on the stage reaches the brain while its card is open (void.html dispatches 'void:ask' after the owner key is handled)
  // with a host, the host hears every ask (on every page, card open or not) and the card shows what it made of it; without one, the card does
  const fromStage = (r) => { if (!r.answer && r.words.length) { paused = false; said.textContent = 'From the stage: ' + r.words.join(', ') + '.'; place(); } };
  const onAsk = (e) => { const t = e && e.detail && e.detail.text; if (!t || !el.isConnected) return; ready.then(() => { if (el.isConnected) fromStage(B.ask(S().b, t)); }); };
  if (!host) document.addEventListener('void:ask', onAsk);
  const offHost = host ? host.on((type, d) => { if (!el.isConnected) return; if (type === 'ask') fromStage({ words: d.words }); else if (type === 'words') heard({ words: S().b.concepts.words.slice(-3), related: [], surprise: S().b.concepts.lastBits }, d.from); }) : () => {};
  q('.vb-good').addEventListener('click', () => { const n = B.reward(S().b); const a = S().b.board.action; said.textContent = 'Rewarded ' + (a ? '"' + a.name + '"' : 'what it did last') + '. The will learns from it at its next choice (' + n + ' waiting).'; save(); });

  // Listen: the microphone's loudness and the pitch of a hum, as numbers (never recorded, never sent). Pitch is read every 25 ms so a
  // short note still gets the 3 frames the ear needs; the loudness keeps its 100 ms beat.
  // Play a tune: the same ear with no microphone. An oscillator plays Frere Jacques twice (G3, 0.3 s a beat) into the same analyser and
  // 25 ms pitch reads, quietly out of the speakers too, so anyone can watch it hear and guess the next note. Only one ear is on at a time.
  let mic = null;
  const ear = (ctx, an, kind, stop) => {
    mic = { ctx, an, kind, stop, buf: new Float32Array(an.fftSize) };
    mic.pitch = setInterval(() => { if (!mic) return; mic.an.getFloatTimeDomainData(mic.buf); const p = detectPitch(mic.buf, mic.ctx.sampleRate), q = framesFor(S()); q.push([Math.round(p.f * 10) / 10, mic.ctx.currentTime]); if (q.length > 64) q.shift(); }, 25);
  };
  const idle = () => { listenBtn.setAttribute('aria-pressed', 'false'); listenBtn.textContent = listenBtn.disabled ? 'Listen unavailable' : 'Listen'; tuneBtn.setAttribute('aria-pressed', 'false'); tuneBtn.textContent = 'Play a tune'; };
  // when a tune ends (or is stopped), the card says what the ear did with it: notes heard and guesses right, counted from the tune's start
  const heardSince = (from) => { const e = S().b.ear, n = e.notes - from.notes, g = e.guessed - from.guessed, h = e.hits - from.hits;
    said.textContent = 'It heard ' + n + ' of the tune\'s ' + TUNE.length * 2 + ' notes and guessed the next one right ' + h + ' of ' + g + ' times' + (g ? ' (' + Math.round(h / g * 100) + '%).' : '.');
    el.dataset.tune = [n, g, h].join(','); };
  const stopMic = () => { if (!mic) return; framesFor(S()).push([0, mic.ctx.currentTime + 0.05]); clearInterval(mic.pitch); clearTimeout(mic.done); try { mic.stop(); mic.ctx.close(); } catch (_) { /* gone */ } const from = mic.from; mic = null; S().level = 0; idle(); if (from) setTimeout(() => { if (el.isConnected) heardSince(from); }, 500); };
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) { listenBtn.disabled = true; listenBtn.textContent = 'Listen unavailable'; }
  listenBtn.addEventListener('click', async () => {
    if (mic) { const was = mic.kind; stopMic(); if (was === 'mic') return; }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true }), AC = window.AudioContext || window.webkitAudioContext, ctx = new AC();
      const an = ctx.createAnalyser(); an.fftSize = 1024; ctx.createMediaStreamSource(stream).connect(an);
      ear(ctx, an, 'mic', () => stream.getTracks().forEach((t) => t.stop())); listenBtn.setAttribute('aria-pressed', 'true'); listenBtn.textContent = 'Listening (tap to stop)';
    } catch (_) { listenBtn.textContent = 'Microphone not allowed'; }
  });
  const TUNE = [[0, 1], [2, 1], [4, 1], [0, 1], [0, 1], [2, 1], [4, 1], [0, 1], [4, 1], [5, 1], [7, 2], [4, 1], [5, 1], [7, 2]]; // Frere Jacques, semitones over G3, beats
  const AC0 = window.AudioContext || window.webkitAudioContext;
  if (!AC0) { tuneBtn.disabled = true; tuneBtn.textContent = 'No audio here'; }
  tuneBtn.addEventListener('click', async () => {
    if (mic) { const was = mic.kind; stopMic(); if (was === 'tune') return; }
    const ctx = new AC0(); await ctx.resume().catch(() => {});
    const an = ctx.createAnalyser(); an.fftSize = 1024;
    const osc = ctx.createOscillator(), env = ctx.createGain(), out = ctx.createGain(); osc.type = 'triangle'; env.gain.value = 0; out.gain.value = 0.15;
    osc.connect(env); env.connect(an); env.connect(out); out.connect(ctx.destination);
    let t = ctx.currentTime + 0.2;
    for (let r = 0; r < 2; r++) {
      for (const [st, bt] of TUNE) {
        const len = bt * 0.3 - 0.07; osc.frequency.setValueAtTime(440 * Math.pow(2, (55 + st - 69) / 12), t);
        env.gain.setValueAtTime(0, t); env.gain.linearRampToValueAtTime(0.5, t + 0.03); env.gain.setValueAtTime(0.5, t + len - 0.03); env.gain.linearRampToValueAtTime(0, t + len); t += len + 0.07;
      }
      t += 1.7;
    }
    osc.start(); osc.stop(t);
    ear(ctx, an, 'tune', () => { try { osc.stop(); } catch (_) { /* already stopped */ } }); const e0 = S().b.ear; mic.from = { notes: e0.notes, guessed: e0.guessed, hits: e0.hits };
    mic.done = setTimeout(stopMic, (t - ctx.currentTime + 0.3) * 1000);
    tuneBtn.setAttribute('aria-pressed', 'true'); tuneBtn.textContent = 'Playing a tune (tap to stop)';
  });
  const hear = () => { if (!mic) return; mic.an.getFloatTimeDomainData(mic.buf); let s = 0; for (const v of mic.buf) s += v * v; S().level = Math.min(1, Math.sqrt(s / mic.buf.length) * 6); };

  // what it learned, kept on this device: loaded now, put back into a new brain after Reset, saved every 5 seconds and when the page hides
  let kept = null, bound = null, saving = false, paused = false; el.dataset.kept = 'none';
  const bind = () => { const b = S().b; if (bound === b) return; bound = b; if (kept && !S().hosted) el.dataset.kept = B.loadKnowledge(b, kept).join(',') || 'none'; if (verse) B.knowVerse(b, verse); };
  // what it is thinking, held in the shared field: given back after a reload (or when its card opens again) to a brain with nothing of its own
  // yet, never over ideas it already has, and never after Reset. After Forget nothing is kept until it is told something again.
  let restored = false; el.dataset.restored = 'none';
  const release = Field.hold('verse-brain', {
    save: () => (paused || !el.isConnected ? null : B.workingOf(S().b)),
    load: (w) => {
      const here = !!host && host.brain === S().b && host.onlyHere(); // the page's own brain, holding only this page's asks
      if (restored || !(B.isCold(S().b) || here)) return false;
      const done = B.loadWorking(S().b, w); if (!done.length) return false;
      if (here) host.warm(S().b);
      restored = true; el.dataset.restored = done.join(',');
      const words = S().b.concepts.words; said.textContent = 'Back from before the reload: ' + (words.length ? words.slice(-6).join(', ') : 'its workspace and its spotlight') + '.';
      place(); sync(); return true;
    }
  });
  const save = async () => {
    if (saving || !el.isConnected) return; saving = true;
    try { kept = JSON.parse(JSON.stringify(B.knowledgeOf(S().b))); el.dataset.saved = String(await keep(kept)); if (!paused) el.dataset.held = String(await Field.persist()); } finally { saving = false; }
  };
  const onHide = () => { if (document.visibilityState === 'hidden') save(); };
  document.addEventListener('visibilitychange', onHide); addEventListener('pagehide', save);
  loadKept().then((k) => { if (k && k.v === 1) { kept = k; bound = null; bind(); } }).catch(() => {});
  if (host) host.ready.then(() => { if (host.restored.length && el.dataset.kept === 'none') el.dataset.kept = host.restored.join(','); }).catch(() => {});
  let verse = null; fetch('/self.json').then((r) => (r.ok ? r.json() : null)).then((j) => { if (j) { verse = j; el.dataset.semantic = String(B.knowVerse(S().b, j)); } }).catch(() => {});
  q('.vb-forget').addEventListener('click', async () => {
    kept = null; paused = true; if (host) host.forgot(); await forget(); await Field.forgetKept(); const b = S().b; b.mind.episodes = []; b.mind.procedures = []; b.mind.pref.fill(0); el.dataset.kept = 'none'; el.dataset.held = 'false';
    said.textContent = 'Forgot what it kept on this device: its moments, its winning genomes, its preferences, your asks and what it was thinking. A reload starts it fresh, and it keeps nothing new until you tell it something.';
  });
  const bridge = host ? { publish: (f) => host.publish(f), close() {} } : hostBrain(B, () => (el.isConnected ? S().b : null), { onWords: (t, from) => { heard({ words: S().b.concepts.words.slice(-3), related: [], surprise: S().b.concepts.lastBits }, from); place(); } });
  const publish = (f) => bridge.publish(f);
  let n = 0;
  const every = setInterval(() => {
    if (!el.isConnected) { clearInterval(every); bridge.close(); stopMic(); end(); return; }
    bind(); hear(); place(); bridge.publish(); if ((n++ & 3) === 0) { table(); sync(); } if (n % 50 === 0) save();
  }, 100);
  place(); table(); sync(); bridge.publish(true); ready = Field.recall().catch(() => []);
  fetch(new URL('../lib/brain-drafts.json', import.meta.url)).then((r) => (r.ok ? r.json() : null)).then((j) => { if (j && j.drafts) { DRAFTS = j; made(); } }).catch(() => {});
  function end() { release(); offHost(); if (host && host.brain === S().b) host.adopted = false; document.removeEventListener('void:ask', onAsk); document.removeEventListener('visibilitychange', onHide); removeEventListener('pagehide', save); }
  return { dispose() { save().finally(end); clearInterval(every); bridge.close(); stopMic(); } };
}

const idea = {
  id: 'verse-brain', title: 'Verse Brain', sub: 'one workspace · eighteen organs · attention · imagination · a self', W: 360, H: 270, warm: 40,
  create, step, metrics, draw, status, mount,
  // the Mind Field modes, opened beside the brain (it stays): each one it then feels in the shared field and names on the card
  modes: { list: [BRAIN, ...MODES], label: 'Open a Mind Field mode beside the brain', beside: true, ask: (m) => (m.id === 'doodle-mind' ? 'mind field' : m.ask) },
  params: (s) => B.params(s.b),
  how: 'Move over it and it predicts you; where it guessed wrong turns red and its attention moves there. Type to give it ideas, drag them, say Good when it does something you like, or ask it why. With Listen on, hum to it: it hears the notes and guesses your next one. With no microphone, Play a tune plays it Frere Jacques to hear instead. Every action is imagined before it is taken, and checked against moments it remembers.'
};

export { idea }; // the card's own parts, for tools/brain-host.test.mjs
const skill = fieldSkill({
  name: 'verse-brain',
  words: "verse brain|verse'?s brain|your brain|your mind|brain of verse|how (?:do )?you think|what are you thinking(?: about)?|(?:verse'?s\\s+)?shared field|the shared field|working memory",
  examples: ['verse brain', 'show me your brain', 'your brain', 'how do you think', 'what are you thinking about', 'show the shared field'],
  nearMisses: ['add a brain', 'summon a zombie and a brain', 'brain teaser', 'mind field', 'what do you think of this song'],
  idea,
  say: "My brain, live: one workspace that eighteen organs share, made from Grok's frontier drafts. Move over it, tell it something, and drag what it holds."
});
// "what are you thinking (about)?" opens the card and is answered in words by the brain itself, from the state it is in after hearing the
// visitor's asks (lib/brain-host.js answer): what it attends to, what it chose and its goals. Any other ask opens the card as before.
export default {
  ...skill,
  async run(text, api) {
    let said = null; const quiet = Object.create(api); quiet.say = (t) => { said = t; };
    const r = await skill.run(text, quiet); if (r === 'none') return r;
    const h = hostOf(), a = h && /^what (?:are you|is your brain) (?:thinking|doing)/i.test(String(text || '').trim()) ? h.answer(String(text).trim().replace(/\s+about$/i, '').replace(/[?!.]*$/, '?')) : null;
    if (a) api.say(a); else if (said != null) api.say(said);
    return r;
  }
};
