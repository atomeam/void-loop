/**
 * monopoly skill — a property-trading board game with Monopoly's rules (skills/monopoly-rules.js), you against 1-3 Verse
 * seats. "play monopoly", "monopoly board game", "a property game". The board stands in the void in 3D (mini/monopoly.js,
 * lifted by skills/lift3d.js) with this card beside it; the flat board here is the fallback.
 * Every act is named for what it is: buying is your choice (Buy / Don't buy, never automatic), rent, tax, cards and Jail
 * are forced and the log says so, a trade is an offer Verse accepts or declines, and each choice Verse makes shows its reason.
 */
import { loadLater } from '../lib/load-later.js';

// the rules (spaceName and themeText read them too), the 3D lift and the Game Box's dice (2026-10-22: your rolls use the box's fair dice;
// Verse's seats roll inside the rules as before)
// load with the first game, not with the routing order (lib/load-later.js, owner 2026-10-30)
let M, lift3d, rollDice;
export const ready = loadLater(() => Promise.all([
  import('./monopoly-rules.js'),
  import('./lift3d.js'),
  import('../lib/table-tools.js'),
]).then(([m, l, t]) => { M = m; ({ lift3d } = l); ({ rollDice } = t); }));

// VoidQuest (domains/void.canon.md): Verse's own space version of the property game, after Solar Quest, Verse as the rival.
// "play voidquest" and "play solar quest" open it; it plays on the same rules (monopoly-rules.js) with its own board.
export const VOIDQUEST_RE = /^(?:(?:let'?s|lets|can we|i want to|wanna)\s+)?(?:(?:play|start|open|new)\s+)?(?:a\s+game\s+of\s+)?(?:void\s*quest|v01d\s*quest|verse\s*quest|solar\s*quest)(?:\s+(?:board\s+)?game)?(?:\s+(?:with|against)\s+(?:me|void|v01d|verse|you))?$/;
export function monopolyOf(text) {
  const t = String(text || '').trim().toLowerCase().replace(/[?!.]+$/, '').replace(/\s+/g, ' ');
  if (VOIDQUEST_RE.test(t)) return { kind: 'game', theme: 'voidquest' };
  if (/^(?:(?:let'?s|lets|can we|i want to|wanna)\s+)?(?:play|start|open|new)\s+(?:a\s+|some\s+)?(?:game\s+of\s+)?(?:monopoly|property\s+trading|the\s+property\s+game|a\s+property\s+game|(?:the\s+)?landlord[’']?s?\s+game)(?:\s+(?:board\s+)?game)?(?:\s+(?:with|against)\s+(?:me|(?:verse|void)|you))?$/.test(t)) return { kind: 'game' };
  if (/^(?:the\s+)?landlord[’']?s?\s+game$|^(?:a\s+)?game\s+of\s+monopoly$|^(?:a\s+)?monopoly\s+(?:board\s*)?game$|^(?:a\s+)?property\s+(?:trading\s+)?(?:board\s+)?game$/.test(t)) return { kind: 'game' };
  return null;
}

export const COLORS = { brown: '#8a5a3c', lightblue: '#9fd3ef', pink: '#d9559c', orange: '#f08a2c', red: '#d9353a', yellow: '#f2d23a', green: '#2f9b57', darkblue: '#1f4fa8' };
export const SEAT_COLORS = ['#e9e4d8', '#7b6cff', '#3ec7b0', '#f0a64a'];
const timers = new WeakMap();

// each board: the stage kind, its title, the words in its middle, and its own name for each of the 40 spaces (rules unchanged)
export const VOIDQUEST_NAMES = [
  'Launch', 'Ceres Dock', 'Deep Signal', 'Vesta Yard', 'Fuel Levy', 'Mercury Gate', 'Io Flats', 'Nebula Drift', 'Europa Ice',
  'Ganymede Rim', 'Orbit Brig', 'Titan Shore', 'Solar Array', 'Enceladus Vent', 'Rhea Crater', 'Venus Gate', 'Phobos Ridge',
  'Deep Signal', 'Deimos Port', 'Mars Canyon', 'Drift Zone', 'Triton Spire', 'Nebula Drift', 'Oberon Fields', 'Miranda Cliffs',
  'Earth Gate', 'Luna Base', 'Kuiper Reach', 'Ion Works', 'Pluto Station', 'To the Brig', 'Sirius Ring', 'Vega Halo',
  'Deep Signal', 'Altair Forge', 'Jupiter Gate', 'Nebula Drift', 'Orion Spire', 'Verse Tax', 'The Verse Core',
];
export const THEMES = {
  monopoly: { kind: 'monopoly', title: 'The Landlord’s Game', mid: 'THE LANDLORD’S GAME', sub: 'you against Verse', names: null, sky: '#e9f1e2', ground: '#1d2a22', centre: '#cfe2c8', ink: '#2b4a33' },
  voidquest: { kind: 'voidquest', title: 'VoidQuest', mid: 'VOIDQUEST', sub: 'our version of SolarQuest · you against Verse', names: VOIDQUEST_NAMES, sky: '#dfe3ff', ground: '#120f2a', centre: '#1b1640', ink: '#b9a8ff' },
};
/** a space's name on this board */
export const spaceName = (theme, i) => (theme.names ? theme.names[i] : M.SPACES[i].n);
/** a rules log line in this board's names (the rules speak in the classic names); longest names first so none is cut */
export function themeText(theme, text) {
  if (!theme.names) return text;
  let out = String(text);
  const order = M.SPACES.map((sp, i) => [sp.n, i]).filter(([n]) => !/^(Chance|Community Chest|Jail|Go to Jail|Go)$/.test(n)).sort((a, b) => b[0].length - a[0].length);
  for (const [n, i] of order) out = out.split(n).join(theme.names[i]);
  return out.replace(/\bCommunity Chest\b|\bChance\b/g, (m) => (m === 'Chance' ? 'Nebula Drift' : 'Deep Signal'));
}

// space i -> grid cell on an 11 x 11 board: Go bottom right, Jail bottom left, Free Parking top left, Go to Jail top right
export function cell(i) {
  if (i <= 10) return [10, 10 - i];
  if (i <= 20) return [10 - (i - 10), 0];
  if (i <= 30) return [0, i - 20];
  return [i - 30, 10];
}

const makeMount = (theme) => function mount(th, stageApi) {
  const N = (i) => spaceName(theme, i), T = (x) => themeText(theme, x);
  if (!th.state || !th.state.players) th.state = M.create({ voids: 1 });
  const el = document.createElement('div');
  el.className = 'thing kept-card game-card monopoly-card' + (theme.kind === 'voidquest' ? ' voidquest-card' : '');
  el.dataset.id = th.id;
  el.style.cssText = 'left:' + th.x + 'px;top:' + th.y + 'px;width:min(470px, calc(100vw - 20px))';
  el.innerHTML = '<div class="g-head"><span class="g-title"></span><span class="g-sub"></span></div>';
  el.querySelector('.g-title').textContent = theme.title;
  el.querySelector('.g-sub').textContent = theme.sub;
  const wrap = document.createElement('div'); wrap.className = 'g-board';
  const board = document.createElement('div'); board.className = 'mono-board';
  board.style.cssText = 'display:grid;grid-template-columns:repeat(11,1fr);grid-template-rows:repeat(11,1fr);aspect-ratio:1;gap:1px;background:' + theme.ground + ';border-radius:8px;padding:2px;font-size:6.5px;line-height:1.05';
  const cells = M.SPACES.map((sp, i) => {
    const b = document.createElement('button'); b.type = 'button'; b.dataset.i = i; b.className = 'mono-space';
    const [r, c] = cell(i);
    b.style.cssText = 'grid-row:' + (r + 1) + ';grid-column:' + (c + 1) + ';padding:1px;border:0;background:' + theme.sky + ';color:#1a1a1a;position:relative;overflow:hidden;cursor:pointer;font:inherit';
    b.setAttribute('aria-label', N(i));
    b.addEventListener('pointerdown', (e) => e.stopPropagation());
    b.addEventListener('click', (e) => { e.stopPropagation(); pick(i); });
    board.appendChild(b); return b;
  });
  const mid = document.createElement('div'); mid.style.cssText = 'grid-row:2/11;grid-column:2/11;background:' + theme.centre + ';display:flex;align-items:center;justify-content:center;color:' + theme.ink + ';font:700 18px Georgia,serif;letter-spacing:.08em';
  mid.textContent = theme.mid; board.appendChild(mid);
  wrap.appendChild(board);
  // the card: whose turn, money, what you can do now, your property, an offer to Verse, the log with Verse's reasons
  const status = document.createElement('div'); status.className = 'g-status mono-status'; status.setAttribute('aria-live', 'polite'); status.style.display = 'block';
  const money = document.createElement('div'); money.className = 'mono-money mono-players'; money.style.cssText = 'display:grid;grid-template-columns:repeat(auto-fit,minmax(190px,1fr));gap:6px;font-variant-numeric:tabular-nums;margin:6px 0';
  const acts = document.createElement('div'); acts.className = 'mono-acts'; acts.style.cssText = 'display:flex;gap:6px;flex-wrap:wrap;margin:6px 0';
  const btn = (label, cls, fn) => { const b = document.createElement('button'); b.type = 'button'; b.className = 'g-btn ' + cls; b.textContent = label; b.addEventListener('pointerdown', (e) => e.stopPropagation()); b.addEventListener('click', (e) => { e.stopPropagation(); fn(); }); return b; };
  const rollB = btn('Roll', 'mono-roll g-primary', () => act(M.roll(th.state, rollDice(2, 6).rolls)));
  const buyB = btn('Buy', 'mono-buy', () => act(M.buy(th.state, true)));
  const skipB = btn('Don’t buy', 'mono-skip', () => act(M.buy(th.state, false)));
  const jailB = btn('Pay 50 to leave Jail', 'mono-jail', () => act(M.payJail(th.state)));
  const endB = btn('End turn', 'mono-end', () => act(M.endTurn(th.state)));
  const newB = btn('New game', 'mono-new', () => { th.state = M.create({ voids: th.state.players.length - 1 }); picked = -1; offerOut.textContent = ''; save(); paint(); });
  acts.append(rollB, buyB, skipB, jailB, endB, newB);
  // an offer Verse made you: it waits, with Verse's reason, until you answer; nothing moves before that
  const prop = document.createElement('div'); prop.className = 'mono-proposal'; prop.style.cssText = 'display:none;font-size:12px;margin:6px 0;padding:6px 8px;border-radius:10px;background:rgba(123,108,255,.12)';
  const propText = document.createElement('div');
  const acceptB = btn('Accept', 'mono-accept', () => act(M.answer(th.state, true))), declineB = btn('Decline', 'mono-decline', () => act(M.answer(th.state, false)));
  const propBtns = document.createElement('div'); propBtns.style.cssText = 'display:flex;gap:6px;margin-top:4px'; propBtns.append(acceptB, declineB);
  prop.append(propText, propBtns);
  const detail = document.createElement('div'); detail.className = 'mono-detail'; detail.style.cssText = 'font-size:12px;min-height:16px;margin:4px 0';
  const offerRow = document.createElement('div'); offerRow.className = 'mono-offer'; offerRow.style.cssText = 'display:none;gap:6px;align-items:center;font-size:12px;margin:4px 0';
  const cashIn = document.createElement('input'); cashIn.type = 'number'; cashIn.setAttribute('aria-label', 'cash to offer'); cashIn.min = '1'; cashIn.step = '10'; cashIn.style.cssText = 'width:80px;font:inherit;background:rgba(255,255,255,.06);color:inherit;border:1px solid rgba(255,255,255,.2);border-radius:8px;padding:3px 6px';
  cashIn.addEventListener('pointerdown', (e) => e.stopPropagation());
  const offerB = btn('Offer', 'mono-offer-btn', () => { const r = M.offer(th.state, { space: picked, cash: cashIn.value }); th.state = r.s; offerOut.textContent = T(r.why); save(); paint(); });
  const buildB = btn('Build a house', 'mono-build', () => act(M.build(th.state, picked)));
  offerRow.append(document.createTextNode('Offer Verse'), cashIn, offerB);
  const offerOut = document.createElement('div'); offerOut.className = 'mono-offer-out'; offerOut.style.cssText = 'font-size:12px;color:var(--muted,#8a8a8a);min-height:15px';
  const log = document.createElement('div'); log.className = 'mono-log'; log.style.cssText = 'font-size:11.5px;color:var(--muted,#8a8a8a);max-height:132px;overflow:auto;margin-top:6px;border-top:1px solid rgba(255,255,255,.08);padding-top:4px';
  const foot = document.createElement('div'); foot.className = 'g-rules';
  foot.textContent = 'Buying is always your choice. Rent, tax, cards and Jail are forced. Tap a space or a deed in a panel to read its card; tap one of Verse’s to make an offer, one of yours to mortgage it, or one of your full sets to build.';
  let picked = -1;
  // a deed goes to the shared card store (the card binder reads verse.cards; a verse:card-save event tells it at once)
  // the one card record (lib/card-deck.js): deeds and drawn chance cards are noted there so the 'My cards' binder files them by game
  const GAME = theme.kind === 'voidquest' ? 'VoidQuest' : "The Landlord's Game";
  const deck = (f) => import('../lib/card-deck.js').then(f).catch((e) => console.warn('card deck unavailable', e && e.message));
  const deckRec = (card) => ({ kind: 'board', game: GAME, t: card.title, k: card.kind || 'Deed', b: (card.fields || []).map(([a, b]) => a + ': ' + b).join(' · ') || card.text || '' });
  const notedDraws = new Set();
  function saveCard(card) { try { const all = JSON.parse(localStorage.getItem('verse.cards') || '[]'); if (!all.some((c) => c.id === card.id && c.game === card.game)) all.push({ ...card, savedAt: Date.now() }); localStorage.setItem('verse.cards', JSON.stringify(all)); } catch (e) { console.warn('card store unavailable', e && e.message); } dispatchEvent(new CustomEvent('verse:card-save', { detail: card })); deck((D) => D.setSaved(deckRec(card), true)); offerOut.textContent = card.title + ' is saved to your cards.'; }
  const save = () => stageApi.save && stageApi.save();
  function act(next) { if (next !== th.state) { th.state = next; save(); } paint(); voidPlays(); }
  function pick(i) { picked = picked === i ? -1 : i; offerOut.textContent = ''; paint(); }
  function voidPlays() { // Verse seats take their turns one at a time, a beat apart, so you can watch each one
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
      const name = document.createElement('span'); name.textContent = N(i); name.style.cssText = 'display:block;padding:1px'; b.appendChild(name);
      if (h) { const hs = document.createElement('span'); hs.textContent = h === 5 ? 'H' : '•'.repeat(h); hs.style.cssText = 'position:absolute;top:0;right:1px;color:' + (h === 5 ? '#c0262b' : '#1c7a3d') + ';font-weight:700'; b.appendChild(hs); }
      if (o != null) b.style.boxShadow = 'inset 0 -3px 0 ' + SEAT_COLORS[o];
      else b.style.boxShadow = '';
      s.players.forEach((p, k) => { if (!p.out && p.pos === i) { const tk = document.createElement('b'); tk.className = 'mono-token'; tk.dataset.seat = k; tk.style.cssText = 'position:absolute;bottom:3px;left:' + (2 + k * 7) + 'px;width:6px;height:6px;border-radius:50%;background:' + SEAT_COLORS[k] + ';box-shadow:0 0 0 1px #000'; b.appendChild(tk); } });
      b.style.outline = i === picked ? '2px solid #ffd76a' : '';
    });
    money.textContent = '';
    s.players.forEach((p, k) => { // one panel per player: balance, whose turn, and every deed grouped by its set with houses and mortgages
      const card = document.createElement('div'); card.className = 'mono-player' + (k === s.turn ? ' mono-turn' : ''); card.dataset.seat = k;
      card.style.cssText = 'padding:6px 8px;border-radius:10px;background:rgba(255,255,255,.05);border:1px solid ' + (k === s.turn && s.phase !== 'over' ? '#ffd76a' : 'rgba(255,255,255,.1)') + ';font-size:12px;overflow-wrap:anywhere';
      const head = document.createElement('div'); head.style.cssText = 'display:flex;align-items:center;gap:6px;font-weight:700';
      const dot = document.createElement('b'); dot.style.cssText = 'display:inline-block;width:9px;height:9px;border-radius:50%;flex:none;background:' + SEAT_COLORS[k];
      const nm = document.createElement('span'); nm.textContent = p.name + (k === s.turn && s.phase !== 'over' ? ' · to play' : '') + (p.out ? ' · out' : p.jail ? ' · in Jail' : '') + (p.free ? ' · ' + p.free + ' free-from-Jail card' + (p.free > 1 ? 's' : '') : '');
      const bal = document.createElement('span'); bal.className = 'mono-balance'; bal.style.cssText = 'margin-left:auto;font-size:14px'; bal.textContent = (theme.kind === 'voidquest' ? '' : '$') + p.money + (theme.kind === 'voidquest' ? ' fuel' : '');
      head.append(dot, nm, bal); card.appendChild(head);
      const worthL = document.createElement('div'); worthL.style.cssText = 'color:var(--muted,#8a8a8a)'; worthL.textContent = 'Net worth ' + M.worth(s, k); card.appendChild(worthL);
      const groups = M.holdings(s, k);
      if (!groups.length) { const none = document.createElement('div'); none.style.color = 'var(--muted,#8a8a8a)'; none.textContent = 'No property yet'; card.appendChild(none); }
      for (const g of groups) {
        const row = document.createElement('div'); row.className = 'mono-set'; row.dataset.set = g.key; row.style.cssText = 'display:flex;flex-wrap:wrap;gap:3px;align-items:center;margin-top:3px';
        const sw = document.createElement('i'); sw.style.cssText = 'display:inline-block;width:10px;height:10px;border-radius:2px;flex:none;background:' + (COLORS[g.key] || '#777');
        const lab = document.createElement('span'); lab.textContent = g.label + ' ' + g.items.length + '/' + g.of + (g.full ? ' · full set' : '');
        row.append(sw, lab);
        for (const it of g.items) { const d = btn(N(it.i) + (it.houses ? ' ' + (it.houses === 5 ? '· hotel' : '· ' + it.houses + ' house' + (it.houses > 1 ? 's' : '')) : '') + (it.mortgaged ? ' · mortgaged' : ''), 'mono-deed-chip', () => pick(it.i)); d.style.cssText = 'font-size:11px;padding:1px 6px;white-space:normal;text-align:left' + (it.mortgaged ? ';opacity:.6;text-decoration:line-through' : ''); row.appendChild(d); }
        card.appendChild(row);
      }
      money.appendChild(card);
    });
    const pl = s.players[s.turn];
    rollB.hidden = !(me && s.phase === 'roll');
    buyB.hidden = skipB.hidden = !(me && s.phase === 'buy');
    if (me && s.phase === 'buy') buyB.textContent = 'Buy ' + N(s.pending.buy) + ' for ' + M.SPACES[s.pending.buy].p;
    buyB.disabled = !(me && s.phase === 'buy' && pl.money >= M.SPACES[s.pending.buy].p);
    jailB.hidden = !(me && s.phase === 'roll' && pl.jail);
    if (pl.free) jailB.textContent = 'Use your Get out of Jail card';
    endB.hidden = !(me && s.phase === 'end');
    status.textContent = s.phase === 'over' ? (s.winner === 0 ? 'You win! Net worth ' + M.worth(s, 0) + '. Tap New game to play again.' : s.players[s.winner].name + ' wins with net worth ' + M.worth(s, s.winner) + '. Tap New game to play again.')
      : !me ? pl.name + ' is playing…' : s.phase === 'buy' ? 'You landed on ' + N(s.pending.buy) + '. Buy it? It is your choice.'
        : s.phase === 'end' ? 'Your turn is done unless you build or make an offer.' : pl.jail ? 'You are in Jail: roll doubles, or pay to leave.' : 'Your roll' + (s.doubles ? ' again (doubles)' : '');
    const o = s.proposal;
    prop.style.display = o && s.phase !== 'over' ? 'block' : 'none';
    if (o) propText.textContent = s.players[o.from].name + ' offers you ' + o.cash + ' for ' + N(o.space) + ', because ' + T(o.why) + '. It is your choice.';
    // the picked space: what it is, and what you can do about it now
    detail.textContent = ''; offerRow.style.display = 'none'; buildB.remove();
    if (picked >= 0) {
      const sp = M.SPACES[picked], o = s.owner[picked];
      detail.textContent = N(picked) + (sp.p ? ' · price ' + sp.p : '') + (o != null ? ' · owned by ' + s.players[o].name + ' · rent ' + M.rentFor(s, picked) : sp.p ? ' · unowned' : '');
      if (me && o != null && s.players[o].seat === 'void' && !s.players[o].out) { offerRow.style.display = 'flex'; if (!cashIn.value) cashIn.value = String(Math.ceil(sp.p * 1.5)); }
      if (sp.p) { // the deed itself, readable in full, savable to your cards
        const deed = M.deedCard(s, picked, theme.names), dc = document.createElement('div'); dc.className = 'mono-deed'; dc.dataset.deckKind = 'board'; dc.dataset.deckGame = GAME; deck((D) => D.note(deckRec(deed)));
        dc.style.cssText = 'margin-top:6px;padding:8px;border-radius:10px;background:#f4efe2;color:#1a1a1a;max-width:260px;overflow-wrap:anywhere';
        const band = document.createElement('div'); band.style.cssText = 'padding:4px;border-radius:6px;text-align:center;font-weight:700;background:' + (COLORS[sp.g] || '#cfc8b4'); band.textContent = deed.title; dc.appendChild(band);
        for (const [k2, v] of deed.fields) { const r = document.createElement('div'); r.style.cssText = 'display:flex;justify-content:space-between;gap:8px'; const a = document.createElement('span'); a.textContent = k2; const b2 = document.createElement('span'); b2.textContent = String(v); b2.style.textAlign = 'right'; r.append(a, b2); dc.appendChild(r); }
        dc.appendChild(btn('Save to my cards', 'mono-save-deed', () => saveCard(deed)));
        detail.appendChild(dc);
      }
      if (me && M.canMortgage(s, 0, picked)) detail.appendChild(btn('Mortgage for ' + M.mortgageValue(picked), 'mono-mortgage', () => act(M.mortgage(th.state, picked))));
      if (me && s.owner[picked] === 0 && s.mortgaged && s.mortgaged[picked]) { const u = btn('Pay off mortgage for ' + M.unmortgageCost(picked), 'mono-unmortgage', () => act(M.unmortgage(th.state, picked))); u.disabled = !M.canUnmortgage(s, 0, picked); detail.appendChild(u); }
      if (me && M.canBuild(s, 0, picked)) { buildB.textContent = 'Build ' + ((s.houses[picked] || 0) === 4 ? 'a hotel' : 'a house') + ' for ' + sp.h; detail.appendChild(document.createTextNode(' ')); detail.appendChild(buildB); }
    }
    log.textContent = '';
    for (const l of s.log.slice(-14).reverse()) {
      const dm = /^drew (.+?): (.+)$/.exec(l.text || ''); // a drawn chance card goes into the card record once per draw
      if (dm) { const key = s.log.indexOf(l) + '|' + l.text; if (!notedDraws.has(key)) { notedDraws.add(key); const t = T(dm[1]); deck((D) => D.note({ kind: 'board', game: GAME, t: t + ' card', k: t, b: T(dm[2]) })); } }
      const line = document.createElement('div');
      line.textContent = (l.who ? l.who + ' ' : '') + T(l.text) + (l.forced ? ' (forced)' : '');
      if (l.why) { const w = document.createElement('span'); w.style.color = 'var(--ink,#ddd)'; w.textContent = ' · because ' + T(l.why); line.appendChild(w); }
      log.appendChild(line);
    }
  }
  el.append(wrap, status, money, prop, acts, detail, offerRow, offerOut, foot, log);
  paint();
  stageApi.bindDrag(el, th);
  stageApi.stage.appendChild(el);
  voidPlays(); // a reloaded game on a Verse turn carries on
  // the board stands in the void in 3D (skills/mini/monopoly.js), the card beside it; this flat board stays the fallback
  lift3d(th, stageApi, el, { kind: 'monopoly', board, title: theme.title, W: 520, H: 440,
    snapshot: () => ({ owner: { ...th.state.owner }, houses: { ...th.state.houses }, players: th.state.players.map((p) => ({ pos: p.pos, out: p.out })), picked, dice: th.state.dice, names: theme.names, lid: theme.names ? theme.mid : null }) });
};

async function run(text, api) {
  const m = monopolyOf(text);
  if (!m) return 'none';
  await ready();
  const kind = m.theme === 'voidquest' ? 'voidquest' : 'monopoly';
  const existing = Object.values(api.stage.things()).find((t) => t.kind === kind);
  if (existing) { if (api.stage.center) api.stage.center(existing.id); else api.stage.render(); return kind; }
  if (kind === 'voidquest') {
    api.summon('voidquest', { state: M.create({ voids: 1 }), x: Math.max(10, Math.round(innerWidth / 2 - 420)), y: 40 });
    api.say('VoidQuest, our version of SolarQuest · you against Verse · roll to start; buying is always your choice');
    return 'voidquest';
  }
  api.summon('monopoly', { state: M.create({ voids: 1 }), x: Math.max(10, Math.round(innerWidth / 2 - 420)), y: 40 });
  api.say('The Landlord’s Game (plays like Monopoly) · you against Verse · roll to start; buying is always your choice');
  return 'monopoly';
}

export default {
  name: 'monopoly',
  monopolyOf,
  examples: ['play monopoly', 'play voidquest', 'play solar quest', 'solarquest', 'solar quest board game', "let's play monopoly", 'monopoly board game', 'a game of monopoly', 'play monopoly against void', 'property trading game'],
  nearMisses: ['monopoly', 'what is a monopoly', 'is google a monopoly', 'monopoly money', 'play chess'],
  match(lower, text) { return !!monopolyOf(text); },
  run,
  ready,
  stageKinds: { monopoly: { mount: ready.mount(makeMount(THEMES.monopoly)) }, voidquest: { mount: ready.mount(makeMount(THEMES.voidquest)) } },
};
