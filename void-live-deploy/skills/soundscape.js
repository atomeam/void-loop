/**
 * soundscape skill - layered ambient sound, made in the browser (asked by the owner, 2026-10-18): "add soft rain", "add a low drone",
 * "add wind" / "ocean waves" / "room tone", "quieter", "louder", "only the drone", "mute soundscape", "stop the soundscape". Filtered
 * noise makes rain, room tone, wind and waves; oscillators make the drone (Web Audio). Nothing is fetched or recorded. Sound starts only
 * from an ask (a keypress is a gesture), never by itself, and a small bar names the layers with buttons to change them. The words are
 * tight on purpose: "add milk to my list" and "add rain boots" are not sounds, and a bare "quieter" is taken only while a soundscape plays.
 * The state is a pure value (reduce); the audio only follows it (follow).
 * Contract: { name, examples, nearMisses, match(lower, text), run(text, api) }
 */
export const LAYERS = ['rain', 'drone', 'wind', 'waves', 'room'];
const NAME = '(rain|drone|wind|waves|room\\s+tone)';
const CLEAN = (t) => String(t || '').trim().toLowerCase().replace(/[’]/g, "'").replace(/[?!.]+$/, '').replace(/\s+/g, ' ');
const ADD = new RegExp('^(?:add|start)\\s+(?:some\\s+|a\\s+|the\\s+)?(?:(soft|gentle|light|distant|quiet|heavy|loud|steady|low|deep)\\s+)?(?:(?:ocean|sea)\\s+)?' + NAME + '(?:\\s+(?:sounds?|noise|layer))?$');
const ONLY = new RegExp('^only\\s+(?:the\\s+)?' + NAME + '$');
const LEVEL = { soft: 0.3, gentle: 0.3, light: 0.3, distant: 0.25, quiet: 0.25, heavy: 0.8, loud: 0.8 };
const layerOf = (w) => (/^room/.test(w) ? 'room' : w);

/** what the ask wants: { op: 'add', layer, level } | { op: 'only', layer } | { op: 'quieter'|'louder'|'mute'|'unmute'|'stop' } | null. Pure. */
export function soundOf(text) {
  const t = CLEAN(text); let m;
  if ((m = ADD.exec(t))) return { op: 'add', layer: layerOf(m[2]), level: LEVEL[m[1]] || 0.5 };
  if ((m = ONLY.exec(t))) return { op: 'only', layer: layerOf(m[1]) };
  if (/^(?:a\s+bit\s+|a\s+little\s+|much\s+)?quieter$/.test(t)) return { op: 'quieter' };
  if (/^(?:a\s+bit\s+|a\s+little\s+|much\s+)?louder$/.test(t)) return { op: 'louder' };
  if (/^mute\s+(?:the\s+)?sound\s?scape$|^sound\s?scape\s+(?:off|mute)$/.test(t)) return { op: 'mute' };
  if (/^unmute\s+(?:the\s+)?sound\s?scape$/.test(t)) return { op: 'unmute' };
  if (/^(?:stop|clear|end)\s+(?:the\s+)?sound\s?scape$/.test(t)) return { op: 'stop' };
  return null;
}
export const START = { layers: {}, master: 0.7, muted: false };
/** the next state for a command; a new object, the old one untouched. Pure. */
export function reduce(s, c) {
  const layers = { ...s.layers };
  switch (c.op) {
    case 'add': layers[c.layer] = c.level; return { ...s, layers, muted: false };
    case 'only': return { ...s, layers: { [c.layer]: s.layers[c.layer] || 0.5 }, muted: false };
    case 'quieter': return { ...s, master: Math.max(0.08, +(s.master * 0.6).toFixed(3)) };
    case 'louder': return { ...s, master: Math.min(1, +(s.master / 0.6).toFixed(3)) };
    case 'mute': return { ...s, muted: true };
    case 'unmute': return { ...s, muted: false };
    case 'stop': return { ...START };
    default: return s;
  }
}
// how loud each layer sounds at level 1 (a drone's oscillators are far louder than noise)
const GAIN = { rain: 0.5, room: 0.7, wind: 0.45, waves: 0.55, drone: 0.12 };
/** the gain a layer should have now (0 when muted or absent). Pure. */
export const gainOf = (s, layer) => (s.muted || !(layer in s.layers) ? 0 : +(s.layers[layer] * s.master * GAIN[layer]).toFixed(4));
export const activeNames = (s) => Object.keys(s.layers).filter((l) => LAYERS.includes(l));

// --- the audio (Web Audio; nothing here runs until a command) ---
let state = START, ctx = null, master = null, nodes = {}, apiRef = null;
function noise(c, brown) {
  const n = c.sampleRate * 2, buf = c.createBuffer(1, n, c.sampleRate), d = buf.getChannelData(0); let last = 0;
  for (let i = 0; i < n; i++) { const w = Math.random() * 2 - 1; if (brown) { last = (last + 0.02 * w) / 1.02; d[i] = last * 3.5; } else d[i] = w; }
  const src = c.createBufferSource(); src.buffer = buf; src.loop = true; src.start(); return src;
}
function filt(c, type, f, q = 0.7) { const b = c.createBiquadFilter(); b.type = type; b.frequency.value = f; b.Q.value = q; return b; }
function lfo(c, hz, depth, target) { const o = c.createOscillator(), g = c.createGain(); o.frequency.value = hz; g.gain.value = depth; o.connect(g); g.connect(target); o.start(); return o; }
function build(c, name, out) {
  const g = c.createGain(); g.gain.value = 0; g.connect(out); const srcs = [];
  if (name === 'rain') { const s = noise(c); const hp = filt(c, 'highpass', 900), lp = filt(c, 'lowpass', 7000); s.connect(hp); hp.connect(lp); lp.connect(g); srcs.push(s); }
  else if (name === 'room') { const s = noise(c, true), lp = filt(c, 'lowpass', 320); s.connect(lp); lp.connect(g); srcs.push(s); }
  else if (name === 'wind') { const s = noise(c), bp = filt(c, 'bandpass', 520, 0.6); s.connect(bp); bp.connect(g); srcs.push(s, lfo(c, 0.11, 260, bp.frequency)); }
  else if (name === 'waves') { const s = noise(c, true), lp = filt(c, 'lowpass', 750), sw = c.createGain(); sw.gain.value = 0.6; s.connect(lp); lp.connect(sw); sw.connect(g); srcs.push(s, lfo(c, 0.09, 0.4, sw.gain)); }
  else { const lp = filt(c, 'lowpass', 420); lp.connect(g); for (const [type, f, det] of [['sine', 55, 0], ['triangle', 82.4, 4], ['sine', 110.3, -5]]) { const o = c.createOscillator(); o.type = type; o.frequency.value = f; o.detune.value = det; o.connect(lp); o.start(); srcs.push(o); } }
  return { gain: g, stop() { for (const s of srcs) { try { s.stop(); } catch (_) {} } g.disconnect(); } };
}
/** make the sound match the state: build layers that appeared, fade the others out. */
function follow() {
  if (!ctx) return;
  const now = ctx.currentTime;
  for (const name of activeNames(state)) if (!nodes[name]) nodes[name] = build(ctx, name, master);
  for (const name of Object.keys(nodes)) {
    const g = nodes[name].gain.gain; g.cancelScheduledValues(now); g.setTargetAtTime(gainOf(state, name), now, 0.35);
    if (!(name in state.layers)) { const dead = nodes[name]; delete nodes[name]; setTimeout(() => dead.stop(), 2500); }
  }
}
function stopAll() { for (const k of Object.keys(nodes)) { nodes[k].stop(); delete nodes[k]; } if (ctx) { try { ctx.close(); } catch (_) {} } ctx = null; master = null; }
function bar(api) {
  let el = document.getElementById('soundscape-bar'); const names = activeNames(state);
  if (!names.length) { if (el) el.remove(); document.documentElement.dataset.soundscape = ''; return; }
  if (!el) {
    el = document.createElement('div'); el.id = 'soundscape-bar'; el.setAttribute('role', 'group'); el.setAttribute('aria-label', 'Soundscape');
    el.style.cssText = 'position:fixed;bottom:14px;right:14px;z-index:7;display:flex;flex-wrap:wrap;gap:6px;align-items:center;max-width:min(94vw,520px);padding:7px 12px;border-radius:18px;background:rgba(20,18,34,.9);border:1px solid rgba(255,255,255,.2);font:13px system-ui,sans-serif;color:#eee';
    document.body.appendChild(el);
    el.addEventListener('click', (e) => { const b = e.target.closest && e.target.closest('button[data-op]'); if (b) act({ op: b.dataset.op === 'mute' && state.muted ? 'unmute' : b.dataset.op }, api); });
  }
  const chip = 'cursor:pointer;border-radius:999px;border:1px solid rgba(255,255,255,.3);background:transparent;color:inherit;padding:2px 10px;font:inherit';
  el.innerHTML = '<span>' + api.esc(names.join(' + ')) + (state.muted ? ' (muted)' : '') + '</span>'
    + ['quieter', 'louder', 'mute', 'stop'].map((op) => '<button type="button" data-op="' + op + '" style="' + chip + '">' + (op === 'mute' && state.muted ? 'unmute' : op) + '</button>').join(''); // void-review: ok: layer names come from a fixed list and are escaped
  document.documentElement.dataset.soundscape = names.join(',');
}
function act(c, api) {
  apiRef = api; state = reduce(state, c);
  if (c.op === 'stop') { stopAll(); bar(api); api.say('soundscape stopped'); return; }
  if (!ctx) {
    const AC = typeof window !== 'undefined' && (window.AudioContext || window.webkitAudioContext);
    if (!AC) { state = START; api.say('this browser has no Web Audio, so no soundscape'); return; }
    try { ctx = new AC(); master = ctx.createGain(); master.gain.value = 0.8; master.connect(ctx.destination); } catch (_) { ctx = null; state = START; api.say('sound could not start in this browser'); return; }
  }
  if (ctx.state === 'suspended') { try { ctx.resume(); } catch (_) {} }
  follow(); bar(api);
  api.say(c.op === 'add' ? c.layer + ' added · "quieter", "only the ' + c.layer + '" or "mute soundscape" change it' : c.op === 'mute' ? 'soundscape muted' : c.op === 'unmute' ? 'soundscape back' : c.op === 'only' ? 'only the ' + c.layer : c.op);
}

function run(text, api) {
  const c = soundOf(text); if (!c) return 'none';
  if (!activeNames(state).length && c.op !== 'add') { api.say('no soundscape yet · try "add soft rain"'); return 'soundscape'; }
  act(c, api); return 'soundscape';
}

export default {
  name: 'soundscape',
  soundOf,
  examples: ['add soft rain', 'add a low drone', 'only the drone', 'mute soundscape', 'add ocean waves'],
  nearMisses: ['add milk to my list', 'add rain boots', 'only the lonely', 'quieter font', 'the drone strike news'],
  // a bare quieter/louder/mute belongs to the soundscape only while one plays; the sound words themselves are always taken
  match(lower, text) { const c = soundOf(text || lower); return !!c && (c.op === 'add' || c.op === 'only' || c.op === 'stop' || c.op === 'mute' || c.op === 'unmute' || activeNames(state).length > 0); },
  run,
};
