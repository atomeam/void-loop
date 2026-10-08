/**
 * monopoly skill — a property-trading board game with Monopoly's rules (skills/monopoly-rules.js), you against 1-3 Void
 * seats. "play monopoly", "monopoly board game", "a property game". The board stands in the void in 3D (mini/monopoly.js,
 * lifted by skills/lift3d.js) with this card beside it; the flat board here is the fallback.
 * Every act is named for what it is: buying is your choice (Buy / Don't buy, never automatic), rent, tax, cards and Jail
 * are forced and the log says so, a trade is an offer Void accepts or declines, and each choice Void makes shows its reason.
 */
import * as M from './monopoly-rules.js';
import { lift3d } from './lift3d.js';

export function monopolyOf(text) {
  const t = String(text || '').trim().toLowerCase().replace(/[?!.]+$/, '').replace(/\s+/g, ' ');
  if (/^(?:(?:let'?s|lets|can we|i want to|wanna)\s+)?(?:play|start|open|new)\s+(?:a\s+|some\s+)?(?:game\s+of\s+)?(?:monopoly|property\s+trading|the\s+property\s+game|a\s+property\s+game)(?:\s+(?:board\s+)?game)?(?:\s+(?:with|against)\s+(?:me|void|you))?$/.test(t)) return { kind: 'game' };
  if (/^(?:a\s+)?game\s+of\s+monopoly$|^(?:a\s+)?monopoly\s+(?:board\s*)?game$|^(?:a\s+)?property\s+(?:trading\s+)?(?:board\s+)?game$/.test(t)) return { kind: 'game' };
  return null;
}

export const COLORS = { brown: '#8a5a3c', lightblue: '#9fd3ef', pink: '#d9559c', orange: '#f08a2c', red: '#d9353a', yellow: '#f2d23a', green: '#2f9b57', darkblue: '#1f4fa8' };
export const SEAT_COLORS = ['#e9e4d8', '#7b6cff', '#3ec7b0', '#f0a64a'];
const timers = new WeakMap();

// space i -> grid cell on an 11 x 11 board: Go bottom right, Jail bottom left, Free Parking top left, Go to Jail top right
export function cell(i) {
  if (i <= 10) return [10, 10 - i];
  if (i <= 20) return [10 - (i - 10), 0];
  if (i <= 30) return [0, i - 20];
  return [i - 30, 10];
}

function mount(th, stageApi) {
  if (!th.state || !th.state.players) th.state = M.create({ voids: 1 });
  const el = document.createElement('div');
  el.className = 'thing kept-card game-card monopoly-card';
  el.dataset.id = th.id;
  el.style.cssText = 'left:' + th.x + 'px;top:' + th.y + 'px;width:min(470px, calc(100vw - 20px))';
  el.innerHTML = '<div class="g-head"><span class="g-title">Monopoly</span><span class="g-sub">you against Void</span></div>';
  const wrap = document.createElement('div'); wrap.className = 'g-board';
  const board = document.createElement('div'); board.className = 'mono-board';
  board.style.cssText = 'display:grid;grid-template-columns:repeat(11,1fr);grid-template-rows:repeat(11,1fr);aspect-ratio:1;gap:1px;background:#1d2a22;border-radius:8px;padding:2px;font-size:6.5px;line-height:1.05';
  const cells = M.SPACES.map((sp, i) => {
    const b = document.createElement('button'); b.type = 'button'; b.dataset.i = i; b.className = 'mono-space';
    const [r, c] = cell(i);
    b.style.cssText = 'grid-row:' + (r + 1) + ';grid-column:' + (c + 1) + ';padding:1px;border:0;background:#e9f1e2;color:#1a1a1a;position:relative;overflow:hidden;cursor:pointer;font:inherit';
    b.setAttribute('aria-label', sp.n);
    b.addEventListener('pointerdown', (e) => e.stopPropagation());
    b.addEventListener('click', (e) => { e.stopPropagation(); pick(i); });
    board.appendChild(b); return b;
  });
  const mid = document.createElement('div'); mid.style.cssText = 'grid-row:2/11;grid-column:2/11;background:#cfe2c8;display:flex;align-items:center;justify-content:center;color:#2b4a33;font:700 18px Georgia,serif;letter-spacing:.08em';
  mid.textContent = 'MONOPOLY'; board.appendChild(mid);
  wrap.appendChild(board);
  // the card: whose turn, money, what you can do now, your property, an offer to Void, the log with Void's reasons
  const status = document.createElement('div'); status.className = 'g-status mono-status'; status.setAttribute('aria-live', 'polite'); status.style.display = 'block';
  const money = document.createElement('div'); money.className = 'mono-money'; money.style.cssText = 'display:flex;gap:10px;flex-wrap:wrap;font-variant-numeric:tabular-nums;margin:4px 0';
  const acts = document.createElement('div'); acts.className = 'mono-acts'; acts.style.cssText = 'display:flex;gap:6px;flex-wrap:wrap;margin:6px 0';
  const btn = (label, cls, fn) => { const b = document.createElement('button'); b.type = 'button'; b.className = 'g-btn ' + cls; b.textContent = label; b.addEventListener('pointerdown', (e) => e.stopPropagation()); b.addEventListener('click', (e) => { e.stopPropagation(); fn(); }); return b; };
  const rollB = btn('Roll', 'mono-roll g-primary', () => act(M.roll(th.state)));
  const buyB = btn('Buy', 'mono-buy', () => act(M.buy(th.state, true)));
  const skipB = btn('Don’t buy', 'mono-skip', () => act(M.buy(th.state, false)));
  const jailB = btn('Pay 50 to leave Jail', 'mono-jail', () => act(M.payJail(th.state)));
  const endB = btn('End turn', 'mono-end', () => act(M.endTurn(th.state)));
  const newB = btn('New game', 'mono-new', () => { th.state = M.create({ voids: th.state.players.length - 1 }); picked = -1; offerOut.textContent = ''; save(); paint(); });
  acts.append(rollB, buyB, skipB, jailB, endB, newB);
  // an offer Void made you: it waits, with Void's reason, until you answer; nothing moves before that
  const prop = document.createElement('div'); prop.className = 'mono-proposal'; prop.style.cssText = 'display:none;font-size:12px;margin:6px 0;padding:6px 8px;border-radius:10px;background:rgba(123,108,255,.12)';
  const propText = document.createElement('div');
  const acceptB = btn('Accept', 'mono-accept', () => act(M.answer(th.state, true))), declineB = btn('Decline', 'mono-decline', () => act(M.answer(th.state, false)));
  const propBtns = document.createElement('div'); propBtns.style.cssText = 'display:flex;gap:6px;margin-top:4px'; propBtns.append(acceptB, declineB);
  prop.append(propText, propBtns);
  const detail = document.createElement('div'); detail.className = 'mono-detail'; detail.style.cssText = 'font-size:12px;min-height:16px;margin:4px 0';
  const offerRow = document.createElement('div'); offerRow.className = 'mono-offer'; offerRow.style.cssText = 'display:none;gap:6px;align-items:center;font-size:12px;margin:4px 0';
  const cashIn = document.createElement('input'); cashIn.type = 'number'; cashIn.min = '1'; cashIn.step = '10'; cashIn.style.cssText = 'width:80px;font:inherit;background:rgba(255,255,255,.06);color:inherit;border:1px solid rgba(255,255,255,.2);border-radius:8px;padding:3px 6px';
  cashIn.addEventListener('pointerdown', (e) => e.stopPropagation());
  const offerB = btn('Offer', 'mono-offer-btn', () => { const r = M.offer(th.state, { space: picked, cash: cashIn.value }); th.state = r.s; offerOut.textContent = r.why; save(); paint(); });
  const buildB = btn('Build a house', 'mono-build', () => act(M.build(th.state, picked)));
  offerRow.append(document.createTextNode('Offer Void'), cashIn, offerB);
  const offerOut = document.createElement('div'); offerOut.className = 'mono-offer-out'; offerOut.style.cssText = 'font-size:12px;color:var(--muted,#8a8a8a);min-height:15px';
  const log = document.createElement('div'); log.className = 'mono-log'; log.style.cssText = 'font-size:11.5px;color:var(--muted,#8a8a8a);max-height:132px;overflow:auto;margin-top:6px;border-top:1px solid rgba(255,255,255,.08);padding-top:4px';
  const foot = document.createElement('div'); foot.className = 'g-rules';
  foot.textContent = 'Buying is always your choice. Rent, tax, cards and Jail are forced. Tap a space to see it; tap one of Void’s to make an offer, or one of your full sets to build.';
  let picked = -1;
  const save = () => stageApi.save && stageApi.save();
  function act(next) { if (next !== th.state) { th.state = next; save(); } paint(); voidPlays(); }
  function pick(i) { picked = picked === i ? -1 : i; offerOut.textContent = ''; paint(); }
  function voidPlays() { // Void seats take their turns one at a time, a beat apart, so you can watch each one
    clearTimeout(timers.get(th));
    const s = th.state;
    if (s.phase === 'over' || s.players[s.turn].seat !== 'void') return;
    timers.set(th, setTimeout(() => { if (!el.isConnected && !document.querySelector('[data-id="' + th.id + '"]')) return; th.state = M.voidTurn(th.state); save(); paint(); voidPlays(); }, 900));
  }
  function paint() {
    const s = th.state, me = s.turn === 0 && s.phase !== 'over';
    M.SPACES.forEach((sp, i) => {
      const b = cells[i], o = s.owner[i], h = s.houses[i] || 0;
      b.textContent = '';
      if (sp.g) { const band = document.createElement('i'); band.style.cssText = 'display:block;height:22%;background:' + COLORS[sp.g]; b.appendChild(band); }
      const name = document.createElement('span'); name.textContent = sp.n; name.style.cssText = 'display:block;padding:1px'; b.appendChild(name);
      if (h) { const hs = document.createElement('span'); hs.textContent = h === 5 ? 'H' : '•'.repeat(h); hs.style.cssText = 'position:absolute;top:0;right:1px;color:' + (h === 5 ? '#c0262b' : '#1c7a3d') + ';font-weight:700'; b.appendChild(hs); }
      if (o != null) b.style.boxShadow = 'inset 0 -3px 0 ' + SEAT_COLORS[o];
      else b.style.boxShadow = '';
      s.players.forEach((p, k) => { if (!p.out && p.pos === i) { const tk = document.createElement('b'); tk.className = 'mono-token'; tk.dataset.seat = k; tk.style.cssText = 'position:absolute;bottom:3px;left:' + (2 + k * 7) + 'px;width:6px;height:6px;border-radius:50%;background:' + SEAT_COLORS[k] + ';box-shadow:0 0 0 1px #000'; b.appendChild(tk); } });
      b.style.outline = i === picked ? '2px solid #ffd76a' : '';
    });
    money.textContent = '';
    s.players.forEach((p, k) => { const m = document.createElement('span'); const dot = document.createElement('b'); dot.style.cssText = 'display:inline-block;width:8px;height:8px;border-radius:50%;margin-right:4px;background:' + SEAT_COLORS[k]; m.append(dot, document.createTextNode(p.name + ' ' + p.money + (p.out ? ' (out)' : p.jail ? ' (in Jail)' : ''))); if (k === s.turn) m.style.fontWeight = '700'; money.appendChild(m); });
    const pl = s.players[s.turn];
    rollB.hidden = !(me && s.phase === 'roll');
    buyB.hidden = skipB.hidden = !(me && s.phase === 'buy');
    if (me && s.phase === 'buy') buyB.textContent = 'Buy ' + M.SPACES[s.pending.buy].n + ' for ' + M.SPACES[s.pending.buy].p;
    buyB.disabled = !(me && s.phase === 'buy' && pl.money >= M.SPACES[s.pending.buy].p);
    jailB.hidden = !(me && s.phase === 'roll' && pl.jail);
    if (pl.free) jailB.textContent = 'Use your Get out of Jail card';
    endB.hidden = !(me && s.phase === 'end');
    status.textContent = s.phase === 'over' ? (s.winner === 0 ? 'You win!' : s.players[s.winner].name + ' wins.')
      : !me ? pl.name + ' is playing…' : s.phase === 'buy' ? 'You landed on ' + M.SPACES[s.pending.buy].n + '. Buy it? It is your choice.'
        : s.phase === 'end' ? 'Your turn is done unless you build or make an offer.' : pl.jail ? 'You are in Jail: roll doubles, or pay to leave.' : 'Your roll' + (s.doubles ? ' again (doubles)' : '');
    const o = s.proposal;
    prop.style.display = o && s.phase !== 'over' ? 'block' : 'none';
    if (o) propText.textContent = s.players[o.from].name + ' offers you ' + o.cash + ' for ' + M.SPACES[o.space].n + ', because ' + o.why + '. It is your choice.';
    // the picked space: what it is, and what you can do about it now
    detail.textContent = ''; offerRow.style.display = 'none'; buildB.remove();
    if (picked >= 0) {
      const sp = M.SPACES[picked], o = s.owner[picked];
      detail.textContent = sp.n + (sp.p ? ' · price ' + sp.p : '') + (o != null ? ' · owned by ' + s.players[o].name + ' · rent ' + M.rentFor(s, picked) : sp.p ? ' · unowned' : '');
      if (me && o != null && s.players[o].seat === 'void' && !s.players[o].out) { offerRow.style.display = 'flex'; if (!cashIn.value) cashIn.value = String(Math.ceil(sp.p * 1.5)); }
      if (me && M.canBuild(s, 0, picked)) { buildB.textContent = 'Build ' + ((s.houses[picked] || 0) === 4 ? 'a hotel' : 'a house') + ' for ' + sp.h; detail.appendChild(document.createTextNode(' ')); detail.appendChild(buildB); }
    }
    log.textContent = '';
    for (const l of s.log.slice(-14).reverse()) {
      const line = document.createElement('div');
      line.textContent = (l.who ? l.who + ' ' : '') + l.text + (l.forced ? ' (forced)' : '');
      if (l.why) { const w = document.createElement('span'); w.style.color = 'var(--ink,#ddd)'; w.textContent = ' · because ' + l.why; line.appendChild(w); }
      log.appendChild(line);
    }
  }
  el.append(wrap, status, money, prop, acts, detail, offerRow, offerOut, foot, log);
  paint();
  stageApi.bindDrag(el, th);
  stageApi.stage.appendChild(el);
  voidPlays(); // a reloaded game on a Void turn carries on
  // the board stands in the void in 3D (skills/mini/monopoly.js), the card beside it; this flat board stays the fallback
  lift3d(th, stageApi, el, { kind: 'monopoly', board, title: 'Monopoly', W: 520, H: 440,
    snapshot: () => ({ owner: { ...th.state.owner }, houses: { ...th.state.houses }, players: th.state.players.map((p) => ({ pos: p.pos, out: p.out })), picked, dice: th.state.dice }) });
}

async function run(text, api) {
  if (!monopolyOf(text)) return 'none';
  const existing = Object.values(api.stage.things()).find((t) => t.kind === 'monopoly');
  if (existing) { if (api.stage.center) api.stage.center(existing.id); else api.stage.render(); return 'monopoly'; }
  api.summon('monopoly', { state: M.create({ voids: 1 }), x: Math.max(10, Math.round(innerWidth / 2 - 420)), y: 40 });
  api.say('Monopoly · you against Void · roll to start; buying is always your choice');
  return 'monopoly';
}

export default {
  name: 'monopoly',
  monopolyOf,
  examples: ['play monopoly', "let's play monopoly", 'monopoly board game', 'a game of monopoly', 'play monopoly against void', 'property trading game'],
  nearMisses: ['monopoly', 'what is a monopoly', 'is google a monopoly', 'monopoly money', 'play chess'],
  match(lower, text) { return !!monopolyOf(text); },
  run,
  stageKinds: { monopoly: { mount } },
};
