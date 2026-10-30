/**
 * resonant-membrane skill — Mind Field's Resonant Membrane mode: pluck the living field and hear it ring. A sound mode beside Echo Field.
 * Combined from frontier draft F-232's resonant neural membrane: the field is a membrane you pluck (tap or click), each pluck plays a soft
 * tone whose pitch follows the field's energy where you touched it, and the card's glow follows the whole field's energy. It adds the one
 * thing Echo Field lacks, hearing the field, and keeps everything else on the same tested law (lib/field-doodle.js) and card
 * (lib/field-stage.js, with the Mind Field Mode switcher). Sound starts only from your tap (no microphone, nothing recorded), every tone
 * stops by itself in under a second, at most four ring at once, and Mute silences it. Seal keeps only numbers.
 * Current version, never finished: next upgrades are chords from neighbouring cells and a slow drone tied to the sealed genome.
 * Contract: { name, examples, nearMisses, match(lower, text), run(text, api) }
 */
import { fieldSkill } from '../lib/field-stage.js';
import { idea as doodle, mount as doodleMount } from './doodle-mind.js';
import * as D from '../lib/field-doodle.js';

const SAY = 'Mind Field, Resonant Membrane mode: tap or click the membrane to pluck it and hear it ring (sound only from your tap, no microphone); Mode for the others';
const SCALE = [220, 247.5, 277.2, 330, 370, 440, 495, 554.4, 660]; // a calm pentatonic-ish ladder, so random plucks never clash

/** the field's energy at a point, 0..1. Pure. */
export function energyAt(a, x, y) {
  const i = Math.min(D.GW - 1, Math.max(0, Math.floor(x * D.GW))), j = Math.min(D.GH - 1, Math.max(0, Math.floor(y * D.GH)));
  const v = a[j * D.GW + i]; return Number.isFinite(v) ? Math.min(1, Math.max(0, v)) : 0;
}
/** the pitch a pluck rings at for an energy (higher energy, higher note). Pure. */
export const pitchOf = (e) => SCALE[Math.min(SCALE.length - 1, Math.max(0, Math.round(e * (SCALE.length - 1))))];

function mount(ctx) {
  const hook = doodleMount(ctx), { el, q, th, cv } = ctx;
  const listen = q('.mf-listen'); if (listen) listen.style.display = 'none'; // this mode makes sound rather than hearing it
  const mute = document.createElement('button'); mute.type = 'button'; mute.className = 'g-btn rm-mute'; mute.textContent = 'Mute'; mute.setAttribute('aria-pressed', 'false');
  mute.addEventListener('pointerdown', (e) => e.stopPropagation());
  const btns = q('.ff-btns'); if (btns) btns.insertBefore(mute, q('.ff-reset'));
  let ac = null, ringing = 0, muted = false, plucks = 0;
  mute.addEventListener('click', () => { muted = !muted; mute.textContent = muted ? 'Unmute' : 'Mute'; mute.setAttribute('aria-pressed', String(muted)); });
  const AC = window.AudioContext || window.webkitAudioContext;
  const pluck = (e) => {
    const r = cv.getBoundingClientRect(); if (!r.width) return;
    const x = (e.clientX - r.left) / r.width, y = (e.clientY - r.top) / r.height, en = energyAt(th.state.a, x, y), f = pitchOf(en);
    plucks++; el.dataset.plucks = String(plucks); el.dataset.pitch = String(Math.round(f));
    if (muted || !AC || ringing >= 4) return;
    try {
      ac = ac || new AC(); const t = ac.currentTime, o = ac.createOscillator(), g = ac.createGain();
      o.type = 'triangle'; o.frequency.setValueAtTime(f, t); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.12, t + 0.015); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.8);
      o.connect(g).connect(ac.destination); ringing++; o.onended = () => { ringing--; }; o.start(t); o.stop(t + 0.85);
    } catch (_) { /* no sound here; the field still answers */ }
  };
  cv.addEventListener('pointerdown', pluck);
  const frame = q('.ff-frame');
  const glow = setInterval(() => { if (!el.isConnected || !frame) return; const en = th.state.thought ? th.state.thought[3] : 0; frame.style.boxShadow = '0 0 ' + Math.round(6 + en * 22) + 'px hsla(' + Math.round(190 + en * 120) + ',90%,60%,.55)'; }, 200);
  return { dispose() { cv.removeEventListener('pointerdown', pluck); clearInterval(glow); try { ac && ac.close(); } catch (_) { /* gone */ } hook && hook.dispose && hook.dispose(); } };
}

const idea = {
  ...doodle, id: 'resonant-membrane', sub: 'Resonant Membrane · pluck it and hear it ring', mount,
  how: 'Tap or click the membrane to pluck it: it ripples, and a soft note rings whose pitch follows the field\'s energy where you touched. The glow follows the whole field. No microphone is used; Mute silences it. Seal keeps only the numbers.'
};

export default fieldSkill({
  name: 'resonant-membrane',
  words: '(?:resonant (?:neural )?membrane|membrane mind|pluck (?:the |a )?(?:membrane|field)|singing (?:membrane|field)|membrane i can pluck)',
  examples: ['resonant membrane', 'pluck the membrane', 'membrane mind', 'singing field', 'pluck the field'],
  nearMisses: ['what is a cell membrane', 'pluck a guitar string', 'membrane roof', 'resonant frequency of a bridge'],
  idea, say: SAY
});
