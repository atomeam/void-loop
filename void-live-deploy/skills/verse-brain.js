/**
 * verse-brain skill — Verse Brain, the one entity Grok's frontier drafts became (owner, 2026-10-29: "build all the unique builds as a
 * combination and that can be verse"; "the grok builds combined can be verse brain"; "combine all the builds into one entity"; "all the
 * pages are supposed to be able to work together"). The brain is lib/brain.js (one workspace, eleven organs, attention, imagination, the
 * self); lib/brain-drafts.json says which of the 233 drafts in atomeam/a-to-mind.com each organ is made from, and why the rest were left out.
 * The card shows the workspace live: the tissue tinted by the rhythm's phase, surprise in red, the memory's expectation in violet, the
 * attention spotlight, the swarm, the membrane. The words you type, what the gestures organ named, what the memory expects and what the will
 * is doing are DOM orbs you can drag: a drag writes into the workspace as "you". Good rewards the will; Listen feeds it the microphone's
 * level (a number a frame, never recorded). Every other Verse page in this browser reaches the same brain (lib/brain-bridge.js).
 * The mind layers (lib/brain-mind.js): every ask on the stage (the page's 'void:ask' event) and every word typed here becomes ideas and
 * goals that pull; a question ("why did that form?", "what just happened?", "what are you doing?") is answered from its own state; its
 * choices are remembered as moments the will reads before choosing, its winning genomes by context; where two organs disagree over a
 * region the card outlines it. What it learned is kept on this device (lib/brain-store.js, Forget clears it) and Verse's own priorities
 * (/self.json) are standing ideas it compares yours with. Nothing is sent anywhere; a seal is numbers only (lib/brain.js params).
 * Contract: { name, examples, nearMisses, match(lower, text), run(text, api) }, made with lib/field-stage.js fieldSkill.
 */
import { fieldSkill } from '../lib/field-stage.js';
import * as B from '../lib/brain.js';
import { GW, GH, RG, RH, KIND, REGIONS_X, REGIONS_Y } from '../lib/brain-workspace.js';
import { hostBrain } from '../lib/brain-bridge.js';
import { MODES, BRAIN } from '../lib/mind-field-modes.js';
import { loadKept, keep, forget } from '../lib/brain-store.js';
import * as Field from '../lib/shared-field.js';
import { feltFrom, linkBrain, fieldSays } from '../lib/brain-field.js';

const phone = () => typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches;
const offs = new WeakMap(); // an offscreen GW x GH canvas per state, kept off the state (the stage saves its things)
function offFor(s) { let o = offs.get(s); if (!o) { o = Object.assign(document.createElement('canvas'), { width: GW, height: GH }); offs.set(s, o); } return o; }
const SPECIES = ['#7fd8ff', '#ffb36b', '#b99bff'];

function create(seed) { return { b: B.createBrain(seed, { phone: phone() }), level: 0, seed }; }
// the shared field (lib/shared-field.js, also skills/field.js): one link per page; the brain feels other skills' slots and publishes its ideas
let link = null; const fieldLink = () => link || (link = linkBrain(Field));
const felt = new WeakMap(); // what the brain felt last tick, per state, for the drawing
function step(s, dt, input) {
  const L = fieldLink(), f = feltFrom(Field, L.code); felt.set(s, f);
  B.stepBrain(s.b, { x: input.x, y: input.y, over: input.over, down: input.down, tiltX: input.tiltX, tiltY: input.tiltY, sound: s.level, field: f });
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
}
function draw(g, s, W, H) {
  const b = s.b, N = b.ws.nodes;
  drawField(g, s, W, H);
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
  const S = () => th.state, frame = q('.ff-frame');
  let DRAFTS = { byOrgan: {} }; // the draft map (lib/brain-drafts.json, written by tools/brain-drafts.mjs), fetched only when a card opens
  frame.style.position = 'relative';
  const layer = document.createElement('div'); layer.className = 'vb-orbs'; layer.style.cssText = 'position:absolute;inset:0;pointer-events:none;overflow:hidden';
  frame.appendChild(layer);
  const row = document.createElement('div'); row.className = 'vb-ctl'; row.style.cssText = 'display:flex;gap:6px;flex-wrap:wrap;align-items:center;margin-top:6px';
  row.innerHTML = '<form class="vb-form" style="display:flex;gap:6px;flex:1;min-width:180px"><input class="vb-word" type="text" maxlength="120" autocomplete="off" spellcheck="false" placeholder="tell it something, or ask why" aria-label="Words for Verse Brain to think about, or a question about what it is doing" style="flex:1;min-width:0;padding:4px 8px;border-radius:7px;border:1px solid var(--line,#444);background:transparent;color:inherit">'
    + '<button type="submit" class="g-btn vb-tell">Tell</button></form><button type="button" class="g-btn vb-good">Good</button><button type="button" class="g-btn vb-listen" aria-pressed="false">Listen</button><button type="button" class="g-btn vb-forget">Forget</button>';
  q('.ff-btns').insertAdjacentElement('beforebegin', row);
  const said = document.createElement('div'); said.className = 'vb-said'; said.setAttribute('aria-live', 'polite'); said.style.cssText = 'font-size:12px;min-height:1.3em;margin-top:4px';
  row.insertAdjacentElement('afterend', said);
  // the shared field, said in words on the card: what it feels from the other mind cards, and what it holds there of its own
  const fieldLine = document.createElement('div'); fieldLine.className = 'vb-field'; fieldLine.setAttribute('aria-live', 'polite'); fieldLine.style.cssText = 'font-size:12px;margin-top:4px;color:rgb(255,170,230)';
  said.insertAdjacentElement('afterend', fieldLine);
  const det = document.createElement('details'); det.className = 'vb-organs'; det.style.cssText = 'font-size:12px;margin-top:6px';
  det.innerHTML = '<summary>Organs: what each does and how much it runs</summary><table style="width:100%;border-collapse:collapse;margin-top:4px"><tbody></tbody></table>'
    + '<div class="vb-made" style="color:var(--muted,#8a8a8a);margin-top:4px"></div>';
  fieldLine.insertAdjacentElement('afterend', det);
  for (const n of [row, det, ...row.querySelectorAll('input,button')]) for (const ev of ['pointerdown', 'keydown']) n.addEventListener(ev, (e) => e.stopPropagation());
  const box = q('.vb-word'), listenBtn = q('.vb-listen'), body = det.querySelector('tbody');
  const made = () => {
    q('.vb-made').textContent = DRAFTS.total ? 'Made from ' + DRAFTS.inBrain + ' of ' + DRAFTS.total + ' frontier drafts (' + DRAFTS.techniques + ' techniques); '
      + DRAFTS.left + ' were left out, each with its reason: ' + DRAFTS.drafts.filter((d) => !d.organ).map((d) => d.folder.replace(/^F0*(\d+)-/, 'F$1 ')).join(', ') + '.' : '';
    for (const [id, tr] of rows) { const k = DRAFTS.byOrgan[id] || 0; tr.children[2].textContent = tr.dataset.job + (k ? ' (' + k + ' draft' + (k === 1 ? '' : 's') + ')' : ''); }
    el.dataset.drafts = String(DRAFTS.inBrain || 0);
  };

  // the organ table: one row per organ, its live share of ticks and its job
  const rows = new Map();
  for (const o of B.ORGANS) {
    const tr = document.createElement('tr');
    tr.innerHTML = '<td style="padding:2px 6px 2px 0;white-space:nowrap;font-weight:600"></td><td class="vb-use" style="padding:2px 6px;white-space:nowrap;text-align:right"></td><td style="padding:2px 0"></td>';
    tr.children[0].textContent = o.name; tr.children[2].textContent = o.job;
    tr.dataset.organ = o.id; tr.dataset.job = o.job; body.appendChild(tr); rows.set(o.id, tr);
  }
  const table = () => { const b = S().b, ran = new Set(b.granted); for (const [id, tr] of rows) { tr.children[1].textContent = Math.round((b.runs[id] / Math.max(1, b.ticks)) * 100) + '%'; tr.style.opacity = ran.has(id) ? '1' : '0.6'; } };

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
    const fc = Field.census(); el.dataset.felt = String((felt.get(S()) || []).length); el.dataset.published = String(link ? link.held : 0); el.dataset.fieldOwners = Object.keys(fc.held).sort().join(',');
    const t = fieldSays(fc, +el.dataset.felt, link ? link.held : 0); if (fieldLine.textContent !== t) fieldLine.textContent = t;
  };

  // words, from this card or from any other Verse page (the bridge)
  const heard = (r, from) => {
    if (!r || !r.words.length) { said.textContent = 'Nothing it could hold there (it keeps words of two letters or more).'; return; }
    const rel = r.related.filter((x) => x.word !== r.words[r.words.length - 1]).slice(0, 3).map((x) => x.word + (x.linked ? ' (used together)' : ''));
    said.textContent = (from === 'page' ? 'Another Verse page told it: ' : 'Holding: ') + r.words.join(', ') + '.' + (rel.length ? ' Nearest ideas: ' + rel.join(', ') + '.' : '')
      + (r.surprise != null ? ' Surprise ' + (+r.surprise).toFixed(1) + ' bits a letter.' : '');
  };
  q('.vb-form').addEventListener('submit', (e) => {
    e.preventDefault(); const t = box.value; box.value = ''; const r = B.ask(S().b, t);
    if (r.answer) { said.textContent = r.answer.join(' '); el.dataset.answered = String(+(el.dataset.answered || 0) + 1); return; }
    heard(r, 'card'); if (still()) tick(20); else redraw(); place(); sync(); bridge.publish(true);
  });
  // every ask on the stage reaches the brain while its card is open (void.html dispatches 'void:ask' after the owner key is handled)
  const onAsk = (e) => { const t = e && e.detail && e.detail.text; if (!t || !el.isConnected || B.ask === undefined) return; const r = B.ask(S().b, t); if (!r.answer && r.words.length) { said.textContent = 'From the stage: ' + r.words.join(', ') + '.'; place(); } };
  document.addEventListener('void:ask', onAsk);
  q('.vb-good').addEventListener('click', () => { const n = B.reward(S().b); const a = S().b.board.action; said.textContent = 'Rewarded ' + (a ? '"' + a.name + '"' : 'what it did last') + '. The will learns from it at its next choice (' + n + ' waiting).'; save(); });

  // Listen: the microphone's loudness as one number a frame (never recorded, never sent)
  let mic = null;
  const stopMic = () => { if (!mic) return; try { mic.stream.getTracks().forEach((t) => t.stop()); mic.ctx.close(); } catch (_) { /* gone */ } mic = null; S().level = 0; listenBtn.setAttribute('aria-pressed', 'false'); listenBtn.textContent = 'Listen'; };
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) { listenBtn.disabled = true; listenBtn.textContent = 'Listen unavailable'; }
  listenBtn.addEventListener('click', async () => {
    if (mic) return stopMic();
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true }), AC = window.AudioContext || window.webkitAudioContext, ctx = new AC();
      const an = ctx.createAnalyser(); an.fftSize = 512; ctx.createMediaStreamSource(stream).connect(an);
      mic = { stream, ctx, an, buf: new Float32Array(an.fftSize) }; listenBtn.setAttribute('aria-pressed', 'true'); listenBtn.textContent = 'Listening (tap to stop)';
    } catch (_) { listenBtn.textContent = 'Microphone not allowed'; }
  });
  const hear = () => { if (!mic) return; mic.an.getFloatTimeDomainData(mic.buf); let s = 0; for (const v of mic.buf) s += v * v; S().level = Math.min(1, Math.sqrt(s / mic.buf.length) * 6); };

  // what it learned, kept on this device: loaded now, put back into a new brain after Reset, saved every 20 seconds and when the page hides
  let kept = null, bound = null, saving = false; el.dataset.kept = 'none';
  const bind = () => { const b = S().b; if (bound === b) return; bound = b; if (kept) el.dataset.kept = B.loadKnowledge(b, kept).join(',') || 'none'; if (verse) B.knowVerse(b, verse); };
  const save = async () => { if (saving || !el.isConnected) return; saving = true; try { kept = JSON.parse(JSON.stringify(B.knowledgeOf(S().b))); el.dataset.saved = String(await keep(kept)); } finally { saving = false; } };
  const onHide = () => { if (document.visibilityState === 'hidden') save(); };
  document.addEventListener('visibilitychange', onHide); addEventListener('pagehide', save);
  loadKept().then((k) => { if (k && k.v === 1) { kept = k; bound = null; bind(); } }).catch(() => {});
  let verse = null; fetch('/self.json').then((r) => (r.ok ? r.json() : null)).then((j) => { if (j) { verse = j; el.dataset.semantic = String(B.knowVerse(S().b, j)); } }).catch(() => {});
  q('.vb-forget').addEventListener('click', async () => { kept = null; await forget(); const b = S().b; b.mind.episodes = []; b.mind.procedures = []; b.mind.pref.fill(0); el.dataset.kept = 'none'; said.textContent = 'Forgot what it kept on this device: its moments, its winning genomes and its preferences. It starts learning again now.'; });
  const bridge = hostBrain(B, () => (el.isConnected ? S().b : null), { onWords: (t, from) => { heard({ words: S().b.concepts.words.slice(-3), related: [], surprise: S().b.concepts.lastBits }, from); place(); } });
  let n = 0;
  const every = setInterval(() => {
    if (!el.isConnected) { clearInterval(every); bridge.close(); stopMic(); end(); return; }
    bind(); hear(); place(); bridge.publish(); if ((n++ & 3) === 0) { table(); sync(); } if (n % 200 === 0) save();
  }, 100);
  place(); table(); sync(); bridge.publish(true);
  fetch(new URL('../lib/brain-drafts.json', import.meta.url)).then((r) => (r.ok ? r.json() : null)).then((j) => { if (j && j.drafts) { DRAFTS = j; made(); } }).catch(() => {});
  function end() { document.removeEventListener('void:ask', onAsk); document.removeEventListener('visibilitychange', onHide); removeEventListener('pagehide', save); }
  return { dispose() { save(); clearInterval(every); bridge.close(); stopMic(); end(); } };
}

const idea = {
  id: 'verse-brain', title: 'Verse Brain', sub: 'one workspace · eleven organs · attention · imagination · a self', W: 360, H: 270, warm: 40,
  create, step, metrics, draw, status, mount,
  // the Mind Field modes, opened beside the brain (it stays): each one it then feels in the shared field and names on the card
  modes: { list: [BRAIN, ...MODES], label: 'Open a Mind Field mode beside the brain', beside: true, ask: (m) => (m.id === 'doodle-mind' ? 'mind field' : m.ask) },
  params: (s) => B.params(s.b),
  how: 'Move over it and it predicts you; where it guessed wrong turns red and its attention moves there. Type to give it ideas, drag them, say Good when it does something you like, or ask it why. Every action is imagined before it is taken, and checked against moments it remembers.'
};

export default fieldSkill({
  name: 'verse-brain',
  words: "verse brain|verse'?s brain|your brain|your mind|brain of verse|how (?:do )?you think|what are you thinking(?: about)?|(?:verse'?s\\s+)?shared field|the shared field|working memory",
  examples: ['verse brain', 'show me your brain', 'your brain', 'how do you think', 'what are you thinking about', 'show the shared field'],
  nearMisses: ['add a brain', 'summon a zombie and a brain', 'brain teaser', 'mind field', 'what do you think of this song'],
  idea,
  say: "My brain, live: one workspace that eleven organs share, made from Grok's frontier drafts. Move over it, tell it something, and drag what it holds."
});
