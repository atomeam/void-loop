/**
 * echo-field skill — Mind Field's Echo Field mode: press Listen and your voice moves the living field, its word orbs drifting to the loudest spots.
 * Combined from
 * the acoustic frontier draft F-225 (acoustic causal lattice with morphing echo orbs). Press Listen and the sound level around you feeds
 * the living lattice; the word orbs drift toward its brightest spots and their words change with how loud it is. Without the microphone
 * the pointer feeds it the same way. Only a level number is read, in memory: nothing is recorded, kept or sent, and Seal keeps numbers.
 * The law is lib/field-doodle.js (the same one as Doodle Mind, tested); the card is lib/field-stage.js with the Mind Field Mode switcher.
 * Contract: { name, examples, nearMisses, match(lower, text), run(text, api) }
 */
import { fieldSkill } from '../lib/field-stage.js';
import { idea as doodle, mount as doodleMount } from './doodle-mind.js';
import * as D from '../lib/field-doodle.js';

const SAY = 'Mind Field, Echo Field mode: press Listen and your voice moves the field and its word orbs (only a sound level, nothing recorded); Mode for the others';
const QUIET = ['hush', 'still', 'calm', 'soft'], LOUD = ['echo', 'ring', 'boom', 'roar'];

/** Doodle Mind's controls plus: the Listen button first, word orbs that follow the loudest cells, words from the sound level. */
function mount(ctx) {
  const hook = doodleMount(ctx), { el, q, th, input } = ctx;
  const listen = q('.mf-listen'); if (listen) { q('.ff-btns').insertBefore(listen, q('.ff-seal')); listen.classList.add('ef-listen'); }
  const orbs = [...el.querySelectorAll('.mf-orb')];
  orbs.forEach((d) => { d.style.width = 'auto'; d.style.height = 'auto'; d.style.minWidth = '18px'; d.style.padding = '1px 6px'; d.style.borderRadius = '9px'; d.style.font = '600 11px/1.4 system-ui,sans-serif'; d.style.color = '#071018'; d.style.margin = '-9px 0 0 -14px'; });
  let n = 0;
  const peak = () => { const a = th.state.a; let best = 0, k = 0; for (let i = 0; i < a.length; i++) if (a[i] > best) { best = a[i]; k = i; } return { x: (k % D.GW + 0.5) / D.GW, y: (Math.floor(k / D.GW) + 0.5) / D.GH }; };
  const tick = setInterval(() => {
    if (!el.isConnected) return; const s = th.state, lvl = input.audio || 0, words = lvl > 0.25 ? LOUD : QUIET, p = peak();
    s.orbs.forEach((o, i) => { if (o.held) return; const k = 0.04 + lvl * 0.12, jx = (i - 1.5) * 0.06; o.x += (p.x + jx - o.x) * k; o.y += (p.y - o.y) * k; if (orbs[i]) orbs[i].textContent = words[(i + n) % words.length]; });
    n++; el.dataset.echo = lvl.toFixed(2);
  }, 120);
  return { dispose() { clearInterval(tick); hook && hook.dispose && hook.dispose(); } };
}

const idea = {
  ...doodle, id: 'echo-field', sub: 'Echo Field · your voice moves it', mount,
  how: 'Press Listen: the sound level around you feeds the field and the word orbs drift to its loudest spots (only a number, nothing is recorded or sent). No microphone? Move or draw on it instead. Seal keeps only the numbers.'
};

export default fieldSkill({
  name: 'echo-field',
  words: '(?:echo field|echo orbs|(?:mind field|field) (?:that|which) (?:listens|hears)|acoustic (?:causal )?(?:lattice|field)(?: mind)?|voice field|sound mind field)',
  examples: ['echo field', 'show me the echo field', 'acoustic lattice', 'echo orbs', 'voice field'],
  nearMisses: ['echo this back', 'what is an echo', 'field of sound recordings', 'echo dot setup'],
  idea, say: SAY
});
