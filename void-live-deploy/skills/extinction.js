/**
 * extinction skill - the mass extinction (asked by the owner, 2026-10-18, stage pack E, the Opposite Era). "mass extinction" opens one
 * card that asks you to type the word extinct; nothing happens until you do. Confirmed, every thing on the stage that nobody kept (a
 * kept card, one marked keep, or one put where it is by hand is safe; lib/opposite-era.js isSafe) collapses in one cinematic fall (a
 * flash over the stage, each thing spinning down into nothing, a beat apart) and one random survivor is spared and marked. An empty
 * stage, or one where everything is kept, says so and takes nothing. "mass extinction event dinosaurs" and "when was the last mass
 * extinction" are not this. The confirmation and the plan are pure and tested in tools/stage-pack-e.test.mjs.
 */
import { removable, pickOne, nameOf, elOf, stillness } from '../lib/opposite-era.js';

const CLEAN = (s) => String(s || '').trim().toLowerCase().replace(/[?!.]+$/, '').replace(/\s+/g, ' ');
/** the ask wants the extinction card. Pure. */
export const extinctionOf = (text) => /^(?:(?:trigger|start|begin|cause|run|do)\s+(?:a\s+|the\s+)?)?mass\s+extinction(?:\s+(?:now|please|on\s+the\s+stage))?$/.test(CLEAN(text));
export const WORD = 'extinct';
/** the typed word confirms it. Pure. */
export const confirmed = (typed) => String(typed || '').trim().toLowerCase() === WORD;
/** who goes and who is spared: { survivor, doomed } over the things nobody kept; an empty plan when there is nothing to take. Pure. */
export function plan(things, r = Math.random) {
  const ids = removable(things), survivor = pickOne(ids, r);
  return { survivor, doomed: ids.filter((id) => id !== survivor) };
}

let lastStage = null;
/** the survivor wears its mark (a thing with survivor: true), drawn again after every redraw */
function markSurvivors(st) {
  for (const t of Object.values(st.things())) {
    if (!t || !t.survivor) continue;
    const el = elOf(st, t.id); if (!el || el.querySelector(':scope > .survivor-tag')) continue;
    el.classList.add('survivor');
    const tag = document.createElement('span'); tag.className = 'survivor-tag'; tag.textContent = 'survivor';
    tag.style.cssText = 'position:absolute;top:-12px;left:8px;font:11px/1.4 ui-monospace,monospace;letter-spacing:.1em;text-transform:uppercase;padding:0 7px;border-radius:8px;background:#ffd166;color:#111;pointer-events:none;z-index:3';
    el.appendChild(tag);
  }
}
if (typeof document !== 'undefined' && !globalThis.__voidExtinction) { globalThis.__voidExtinction = true; addEventListener('void:stage-change', () => { if (lastStage) requestAnimationFrame(() => markSurvivors(lastStage)); }); }

/** the fall: the flash, each doomed thing spinning down, then they are removed and the survivor marked. Resolves to the line said. */
export function extinguish(st, p) {
  const things = st.things();
  const still = stillness() || typeof document === 'undefined';
  const done = () => {
    for (const id of p.doomed) { delete things[id]; if (st.selected() === id) st.select(null); }
    for (const t of Object.values(things)) if (t && t.survivor) delete t.survivor;
    if (p.survivor && things[p.survivor]) things[p.survivor].survivor = true;
    st.save(); st.render(); markSurvivors(st);
    return p.doomed.length + ' gone' + (p.survivor ? ' · survivor: the ' + nameOf(things[p.survivor]) : '');
  };
  if (still) return Promise.resolve(done());
  const flash = document.createElement('div');
  flash.className = 'extinction-flash'; flash.style.cssText = 'position:fixed;inset:0;background:#fff;opacity:0;pointer-events:none;z-index:40';
  document.body.appendChild(flash);
  const anims = [];
  if (typeof flash.animate === 'function') anims.push(flash.animate([{ opacity: 0 }, { opacity: 0.9, offset: 0.08 }, { opacity: 0, offset: 0.4 }, { background: '#000', opacity: 0.6, offset: 0.7 }, { opacity: 0 }], { duration: 1400, easing: 'ease-out' }).finished.catch(() => {}));
  p.doomed.forEach((id, i) => {
    const el = elOf(st, id); if (!el || typeof el.animate !== 'function') return;
    anims.push(el.animate([{ transform: 'scale(1) rotate(0deg)', opacity: 1, filter: 'blur(0)' }, { transform: 'scale(.05) rotate(540deg)', opacity: 0, filter: 'blur(6px)' }], { duration: 800, delay: Math.min(500, i * 60), easing: 'cubic-bezier(.5,0,.9,.4)', fill: 'forwards' }).finished.catch(() => {}));
  });
  return Promise.all(anims).then(() => { flash.remove(); return done(); });
}

async function run(text, api) {
  if (!extinctionOf(text)) return 'none';
  const st = api.stage, { showPage, esc } = api; lastStage = st;
  const n = removable(st.things()).length;
  showPage((el) => {
    el.dataset.cardKind = 'Mass extinction';
    el.innerHTML = '<h2>Mass extinction</h2>' // void-review: ok: the count and the word are the only values, both through esc; the rest is fixed markup
      + (n ? '<p>' + esc(String(n)) + ' thing' + (n === 1 ? '' : 's') + ' on the stage will collapse. Kept, pinned and marked things are safe; one random survivor is spared.</p>'
        + '<p class="sub">Type <b>' + esc(WORD) + '</b> to confirm. Nothing happens until you do.</p>'
        + '<form class="ext-form" style="display:flex;gap:8px;margin:8px 0"><input class="ext-word" type="text" autocomplete="off" aria-label="type extinct to confirm" placeholder="type extinct" style="flex:1;padding:6px 10px;border-radius:8px;border:1px solid #888;background:transparent;color:inherit"><button type="submit" class="ext-go">Confirm</button></form><div class="ext-line sub" aria-live="polite"></div>'
        : '<p>Nothing here can go: the stage is empty or everything on it is kept.</p>')
      + '<div class="src">The Opposite Era · stage pack E</div>';
    const form = el.querySelector('.ext-form'); if (!form) return;
    const input = el.querySelector('.ext-word'), line = el.querySelector('.ext-line');
    input.addEventListener('keydown', (e) => e.stopPropagation()); // typing here is not an ask
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      if (!confirmed(input.value)) { line.textContent = 'not confirmed · type ' + WORD + ' exactly'; api.say('not confirmed'); return; }
      const p = plan(st.things());
      if (!p.survivor) { line.textContent = 'nothing left to take'; return; }
      form.querySelector('.ext-go').disabled = true; line.textContent = 'it begins';
      extinguish(st, p).then((said) => { line.textContent = said; api.say('mass extinction · ' + said); });
    });
    setTimeout(() => { try { input.focus(); } catch (_) {} }, 50);
  });
  api.say(n ? 'type extinct on the card to confirm' : 'nothing to end');
  return 'extinction';
}

export default {
  name: 'extinction',
  examples: ['mass extinction'],
  nearMisses: ['mass extinction event dinosaurs', 'when was the last mass extinction', 'extinction rebellion'],
  match(lower, text) { return extinctionOf(text || lower); },
  run,
  extinctionOf, confirmed, plan,
};
