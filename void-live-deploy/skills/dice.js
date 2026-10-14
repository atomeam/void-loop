/**
 * dice skill — roll dice that stay on the stage
 * Contract: { name, examples, nearMisses, match(lower, text), run(text, api) }
 * "roll a die", "roll 2d6", "dice", "roll the dice".
 * Puts a dice card on the stage that can be rolled again. Empty surface stays empty.
 */
export function wantsDice(text) {
  const t = String(text || '').trim().toLowerCase().replace(/[?!.]+$/, '').replace(/\s+/g, ' ');
  return /^(?:please\s+)?(?:roll\s+(?:a\s+|the\s+|some\s+)?(?:dice|die|d6|2d6)|dice(?:\s+roller)?|roll\s+dice)$/.test(t);
}

function roll(n = 1, sides = 6) {
  const rolls = Array.from({ length: n }, () => Math.floor(Math.random() * sides) + 1);
  return { rolls, total: rolls.reduce((a, b) => a + b, 0) };
}

function mount(th, stageApi) {
  const el = document.createElement('div');
  el.className = 'thing kept-card dice-card';
  el.dataset.id = th.id;
  el.style.cssText = 'left:' + th.x + 'px;top:' + th.y + 'px;width:min(220px, calc(100vw - 20px));padding:12px;background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.16);border-radius:12px';
  const head = document.createElement('div');
  head.innerHTML = '<b>Dice</b><div class="g-sub">tap to roll</div>';
  const out = document.createElement('div');
  out.style.cssText = 'font-size:28px;margin:8px 0;text-align:center';
  const btn = document.createElement('button');
  btn.textContent = 'Roll';
  btn.style.cssText = 'width:100%;padding:8px;border-radius:8px;background:#7a5cff;color:#fff;border:0;font:inherit';
  const doRoll = () => {
    const r = roll(2, 6);
    out.textContent = r.rolls.join(' + ') + ' = ' + r.total;
    th.last = r;
    stageApi.save();
  };
  btn.addEventListener('click', (e) => { e.stopPropagation(); doRoll(); });
  el.append(head, out, btn);
  doRoll();
  stageApi.bindDrag(el, th);
  stageApi.stage.appendChild(el);
}

function run(text, api) {
  if (!wantsDice(text)) return 'none';
  api.summon('dice', { center: true });
  api.say('Dice on the stage · tap to roll again · it stays after a reload');
  return 'dice';
}

export default {
  name: 'dice',
  examples: ['roll a die', 'roll 2d6', 'dice', 'roll the dice', 'dice roller'],
  nearMisses: ['what is a die', 'dice game', 'roll the credits'],
  match(lower, text) { return wantsDice(text || lower); },
  run,
  stageKinds: { dice: { mount } }
};
