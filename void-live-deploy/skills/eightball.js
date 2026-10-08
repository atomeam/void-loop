/**
 * eightball — the Magic 8 Ball as a thing in the void (Adam, 2026-10-08: "magic 8 ball should spawn an 8 ball"). Not an
 * ask matcher: "magic 8 ball" is still answered by the page's chance line (void.html chanceOf, logged as 'chance'), which
 * now summons this ball with the answer instead of opening a page. This file gives the stage its 'eightball' kind: a 3D
 * ball (skills/mini/eightball.js) standing in the void; tap it, or ask again, and it shakes for a new answer. Where WebGL
 * can't run it is a flat black ball with the same blue triangle.
 */
import { grip } from './side-card.js';

export const ANSWERS = ['It is certain', 'Without a doubt', 'Yes, definitely', 'You may rely on it', 'As I see it, yes', 'Most likely', 'Outlook good', 'Yes',
  'Signs point to yes', 'Reply hazy, try again', 'Ask again later', 'Better not tell you now', 'Cannot predict now', 'Concentrate and ask again',
  "Don't count on it", 'My reply is no', 'My sources say no', 'Outlook not so good', 'Very doubtful', 'No'];
export const pick = (rnd = Math.random) => ANSWERS[Math.floor(rnd() * ANSWERS.length)];

function mount(th, stageApi) {
  const S = 240;
  const el = document.createElement('div');
  el.className = 'thing kept-card free-board eightball-wrap';
  el.dataset.id = th.id;
  el.style.cssText = 'position:absolute;left:' + th.x + 'px;top:' + th.y + 'px;width:' + S + 'px;text-align:center;user-select:none;background:transparent;border:0;box-shadow:none;padding:0';
  const view = document.createElement('div'); view.className = 'eightball-view';
  view.style.cssText = 'position:relative;width:100%;height:' + S + 'px';
  view.addEventListener('pointerdown', (e) => e.stopPropagation());
  const said = document.createElement('div'); said.className = 'eightball-answer'; said.setAttribute('aria-live', 'polite');
  said.style.cssText = 'font-size:13px;color:var(--ink,#eee);min-height:18px;margin-top:2px';
  el.append(view, said, grip('Magic 8 Ball · tap to shake'));
  let mini = null;
  const data = () => ({ answer: th.answer, n: th.n || 0, onShake: shake });
  function shake() {
    th.answer = pick(); th.n = (th.n || 0) + 1;
    stageApi.save && stageApi.save();
    said.textContent = '';
    if (mini) { mini.update(data()); setTimeout(() => { said.textContent = th.answer; }, 1500); } else flat();
  }
  function flat() { // no WebGL: a black ball with the blue triangle
    view.innerHTML = '';
    const b = document.createElement('div');
    b.style.cssText = 'width:200px;height:200px;margin:20px auto;border-radius:50%;background:radial-gradient(circle at 35% 30%,#4a4a52,#0b0b0d 55%);display:flex;align-items:center;justify-content:center;cursor:pointer;box-shadow:0 20px 40px rgba(0,0,0,.6)';
    const w = document.createElement('div');
    w.style.cssText = 'width:96px;height:96px;border-radius:50%;background:#06122e;display:flex;align-items:center;justify-content:center;color:#e8f0ff;font:bold 11px Arial,sans-serif;text-transform:uppercase;text-align:center;padding:8px;box-sizing:border-box';
    w.textContent = th.answer;
    b.appendChild(w); b.addEventListener('click', (e) => { e.stopPropagation(); shake(); });
    view.appendChild(b); said.textContent = th.answer;
  }
  said.textContent = th.answer;
  stageApi.bindDrag(el, th);
  stageApi.stage.appendChild(el);
  if (stageApi.miniature) {
    stageApi.miniature(view, 'eightball', data(), { key: 'eightball:' + th.id, label: 'Magic 8 Ball: ' + th.answer + '. Tap it to shake; drag to turn it', minPolar: 0.2, maxPolar: 2.6 })
      .then((h) => { mini = h; h.update(data()); }).catch(() => flat());
  } else flat();
}

// asked from void.html's chance line: one ball on the stage; asking again shakes it for a new answer
export function summonBall(stage, summon, answer) {
  const things = stage.things();
  const existing = Object.values(things).find((t) => t.kind === 'eightball');
  if (existing) { existing.answer = answer; existing.n = (existing.n || 0) + 1; stage.render(); return existing; }
  return summon('eightball', { answer, n: 0, x: Math.max(10, Math.round(innerWidth / 2 - 120)), y: Math.max(40, Math.round(innerHeight / 2 - 220)) });
}

export default {
  name: 'eightball',
  examples: [],
  nearMisses: ['magic 8 ball'], // the page's chance line answers it and summons the ball
  match() { return false; },
  run: async () => 'none',
  stageKinds: { eightball: { mount } },
};
