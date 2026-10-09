/**
 * poker skill — heads-up Texas Hold'em against Void for play money (skills/poker-rules.js): "play poker", "texas hold'em".
 * The card shows only what you may see (rules view()): your two cards, the board, the pot and both stacks; Void's cards
 * stay face down until a showdown. Each choice Void makes shows its estimate of how often it wins and why it chose.
 * The table stands in the void in 3D (mini/poker.js), lifted by skills/lift3d.js with this card beside it.
 */
import * as P from './poker-rules.js';
import { lift3d } from './lift3d.js';

export function pokerOf(text) {
  const t = String(text || '').trim().toLowerCase().replace(/[?!.]+$/, '').replace(/\s+/g, ' ');
  if (/^(?:(?:let'?s|lets|can we|i want to|wanna)\s+)?(?:play|start|open|deal|new)\s+(?:a\s+(?:game|hand|round)\s+of\s+|some\s+)?(?:poker|texas hold ?'?em|hold ?'?em)(?:\s+(?:game|hand))?(?:\s+(?:with|against)\s+(?:me|void|you))?$/.test(t)) return { kind: 'game' };
  if (/^(?:a\s+)?(?:game|hand)\s+of\s+(?:poker|texas hold ?'?em|hold ?'?em)$|^deal\s+(?:me\s+)?(?:in|a\s+hand)$/.test(t)) return { kind: 'game' };
  return null;
}
const timers = new WeakMap();
const red = (c) => ((c / 13) | 0) === 1 || ((c / 13) | 0) === 2;

function cardEl(c) {
  const d = document.createElement('span'); d.className = 'pk-card';
  d.style.cssText = 'display:inline-flex;align-items:center;justify-content:center;width:34px;height:48px;border-radius:5px;margin:0 2px;font:700 15px Georgia,serif;box-shadow:0 2px 4px rgba(0,0,0,.4);'
    + (c == null ? 'background:repeating-linear-gradient(45deg,#7b6cff 0 4px,#5b4ed6 4px 8px);border:2px solid #f2f0ff' : 'background:#fbfaf5;color:' + (red(c) ? '#c0262b' : '#15161a'));
  if (c != null) d.textContent = P.cardName(c);
  return d;
}

function mount(th, stageApi) {
  if (!th.state || !th.state.stacks) th.state = P.create();
  const el = document.createElement('div');
  el.className = 'thing kept-card game-card poker-card';
  el.dataset.id = th.id;
  el.style.cssText = 'left:' + th.x + 'px;top:' + th.y + 'px;width:min(420px, calc(100vw - 20px))';
  el.innerHTML = '<div class="g-head"><span class="g-title">Poker</span><span class="g-sub">Texas Hold’em · play money</span></div>';
  const wrap = document.createElement('div'); wrap.className = 'g-board';
  const table = document.createElement('div'); table.className = 'pk-table';
  table.style.cssText = 'background:radial-gradient(ellipse at 50% 40%,#2f8a57,#17563a);border:8px solid #5a3a22;border-radius:120px;padding:14px 10px;text-align:center;color:#eaf6ee';
  const voidRow = document.createElement('div'), boardRow = document.createElement('div'), potRow = document.createElement('div'), youRow = document.createElement('div');
  for (const r of [voidRow, boardRow, youRow]) r.style.cssText = 'min-height:52px;margin:4px 0';
  potRow.style.cssText = 'font-size:12px;margin:2px 0';
  table.append(voidRow, boardRow, potRow, youRow); wrap.appendChild(table);
  const status = document.createElement('div'); status.className = 'g-status pk-status'; status.setAttribute('aria-live', 'polite'); status.style.display = 'block';
  const stacks = document.createElement('div'); stacks.style.cssText = 'font-size:12px;margin:4px 0;font-variant-numeric:tabular-nums';
  const bar = document.createElement('div'); bar.style.cssText = 'display:flex;gap:6px;flex-wrap:wrap;margin:6px 0';
  const btn = (label, cls, fn) => { const b = document.createElement('button'); b.type = 'button'; b.className = 'g-btn ' + cls; b.textContent = label; b.addEventListener('pointerdown', (e) => e.stopPropagation()); b.addEventListener('click', (e) => { e.stopPropagation(); fn(); }); return b; };
  const moves = {};
  for (const m of ['fold', 'check', 'call', 'bet', 'raise']) { moves[m] = btn(m[0].toUpperCase() + m.slice(1), 'pk-' + m, () => { th.state = P.act(th.state, m); save(); paint(); voidPlays(); }); bar.appendChild(moves[m]); }
  const dealB = btn('Deal the next hand', 'pk-deal g-primary', () => { th.state = P.deal(th.state); save(); paint(); voidPlays(); });
  const newB = btn('New game', 'pk-new', () => { clearTimeout(timers.get(th)); th.state = P.create(); save(); paint(); voidPlays(); });
  bar.append(dealB, newB);
  const log = document.createElement('div'); log.className = 'pk-log'; log.style.cssText = 'font-size:11.5px;color:var(--muted,#8a8a8a);max-height:120px;overflow:auto;border-top:1px solid rgba(255,255,255,.08);padding-top:4px';
  const foot = document.createElement('div'); foot.className = 'g-rules'; foot.textContent = 'Fixed limit, play money. Void never sees your cards: it estimates its chances from the hands you could hold.';
  const save = () => stageApi.save && stageApi.save();
  function voidPlays() {
    clearTimeout(timers.get(th));
    if (th.state.toAct !== 'void' || th.state.result || th.state.over) return;
    timers.set(th, setTimeout(() => { th.state = P.voidAct(th.state); save(); paint(); voidPlays(); }, 900));
  }
  function paint() {
    const s = th.state, v = P.view(s, 'you');
    voidRow.replaceChildren(...(v.theirs || [null, null]).map(cardEl));
    boardRow.replaceChildren(...v.board.map(cardEl));
    youRow.replaceChildren(...v.mine.map(cardEl));
    potRow.textContent = 'Pot ' + v.pot + (v.bet.void || v.bet.you ? ' · in this round: Void ' + v.bet.void + ', you ' + v.bet.you : '');
    stacks.textContent = 'You ' + v.stacks.you + ' · Void ' + v.stacks.void;
    for (const m of Object.keys(moves)) {
      moves[m].hidden = !v.legal.includes(m);
      const owe = v.bet.void - v.bet.you;
      if (m === 'call') moves[m].textContent = 'Call ' + owe;
    }
    dealB.hidden = !(v.result && !v.over);
    status.textContent = v.over ? (v.over === 'you' ? 'You took all of Void’s chips!' : 'Void took all your chips.')
      : v.result ? (v.result.winner === 'you' ? 'You win ' + v.result.pot : v.result.winner === 'void' ? 'Void wins ' + v.result.pot : 'Split pot') + (v.result.hands ? ' · you: ' + v.result.hands.you + ', Void: ' + v.result.hands.void : '')
        : v.toAct === 'you' ? 'Your move' : 'Void is thinking…';
    log.textContent = '';
    for (const l of s.log.slice(-12).reverse()) { const line = document.createElement('div'); line.textContent = (l.who ? l.who + ' ' : '') + l.text; if (l.why) { const w = document.createElement('span'); w.style.color = 'var(--ink,#ddd)'; w.textContent = ' · because ' + l.why; line.appendChild(w); } log.appendChild(line); }
  }
  el.append(wrap, status, stacks, bar, foot, log);
  paint();
  stageApi.bindDrag(el, th);
  stageApi.stage.appendChild(el);
  voidPlays();
  lift3d(th, stageApi, el, { kind: 'poker', board: table, title: 'Poker', W: 480, H: 340,
    snapshot: () => { const v = P.view(th.state, 'you'); return { mine: v.mine, theirs: v.theirs, board: v.board, pot: v.pot, stacks: v.stacks, hand: th.state.hand }; } });
}

async function run(text, api) {
  if (!pokerOf(text)) return 'none';
  const existing = Object.values(api.stage.things()).find((t) => t.kind === 'poker');
  if (existing) { if (api.stage.center) api.stage.center(existing.id); else api.stage.render(); return 'poker'; }
  api.summon('poker', { state: P.create(), x: Math.max(10, Math.round(innerWidth / 2 - 400)), y: 50 });
  api.say('Poker · Texas Hold’em for play money · Void can’t see your cards');
  return 'poker';
}

export default {
  name: 'poker',
  pokerOf,
  examples: ['play poker', "let's play poker", 'play texas holdem', 'a game of poker', "play hold'em against void", 'deal me in'],
  nearMisses: ['poker', 'what is poker', 'poker face', 'how to play poker', 'play chess'],
  match(lower, text) { return !!pokerOf(text); },
  run,
  stageKinds: { poker: { mount } },
};
