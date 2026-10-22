/**
 * duel skill: the Verse card game (frontier #33, steps 1 and 2). "duel", "play cards", "card duel", "play the card game" put a table on the stage:
 * your Root against Verse's, Verse cards (lib/card-frame.js) with their arrows, the Treasury and the turn in view. "summon <idea>" and
 * "attack <card> with <card>" play on a duel that is already there. All rules, and Verse's side, are lib/duel-rules.js (pure, no dice, no hidden hand).
 * A real skill's name summons the card it has earned (statsFor); any other idea is a fresh card (1 / 1 / 0, cost 1).
 */
import * as D from '../lib/duel-rules.js';
import { loadStats, lookup, cardOf, chromeHtml } from '../lib/card-frame.js';
import { gamesOf, playTurns, playLines } from '../lib/rules-play.js';
import { rulesLine } from './game-rules-line.js';

export function duelOf(text) {
  const t = String(text || '').trim().replace(/[?!.]+$/, '').replace(/\s+/g, ' '), l = t.toLowerCase();
  if (/^(?:(?:let'?s|lets|can we|i want to|wanna)\s+)?(?:play\s+)?(?:a\s+)?(?:(?:card\s+)?duel|cards|the card game|(?:a\s+)?card game)(?:\s+(?:with|against)\s+(?:me|(?:verse|void)|you))?$/.test(l) || /^play (?:a )?(?:card duel|cards|the card game)$/.test(l)) return { kind: 'open' };
  const games = gamesOf(t); if (games) return { kind: 'rules', games };
  let m = /^summon (.{1,40})$/i.exec(t); if (m) return { kind: 'summon', idea: m[1] };
  m = /^attack (.{1,40}?) with (.{1,40})$/i.exec(t); if (m) return { kind: 'attack', target: m[1], mine: m[2] };
  return null;
}
const onStage = () => typeof document !== 'undefined' && !!document.querySelector('.duel-card');
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
let ctl = null; // the mounted table, for the typed asks

const CSS = [
  '.duel-card{box-sizing:border-box}.duel-card .d-bar{display:flex;flex-wrap:wrap;gap:4px 12px;font-size:13px;margin:6px 0}.duel-card .d-bar b{color:#f3efe2}',
  '.duel-card .d-row{display:flex;flex-wrap:wrap;gap:8px;margin:6px 0 10px;min-height:20px}.duel-card .d-lab{font-size:11px;letter-spacing:.1em;text-transform:uppercase;color:var(--muted,#8a8a8a)}',
  '.duel-tile{position:relative;box-sizing:border-box;width:104px;padding:0 0 4px;border:4px solid transparent;border-radius:12px;cursor:pointer;color:#e9e6dc;text-align:left;font:inherit;--h:230;--edge:hsl(var(--h) 38% 48%);',
  'background:linear-gradient(170deg,hsl(var(--h) 26% 15%),hsl(var(--h) 22% 8%)) padding-box,var(--foil,linear-gradient(135deg,#5b6483,#2c3350,#5b6483,#262c46)) border-box}',
  '.duel-tile .vc-title{display:flex;justify-content:space-between;margin:2px 3px 0;padding:2px 5px;font-size:12px;font-weight:600;border:1px solid var(--edge);border-radius:6px;background:hsl(var(--h) 26% 19%);overflow:hidden;white-space:nowrap}',
  '.duel-tile .vc-title i{font-style:normal;color:hsl(var(--h) 60% 74%);font-size:10px;margin-left:4px}.duel-tile .vc-type{margin:3px 3px;padding:1px 5px;font-size:9px;letter-spacing:.06em;text-transform:uppercase;border:1px solid var(--edge);border-radius:4px;color:hsl(var(--h) 40% 78%);display:flex;justify-content:space-between;align-items:center}',
  '.duel-tile .vc-foot{margin:2px 3px 0;display:block}.duel-tile .vc-num{display:none}.duel-tile .vc-pt{display:flex;gap:5px;justify-content:center;padding:2px 4px;border:1px solid var(--edge);border-radius:7px 3px 7px 3px;background:hsl(var(--h) 26% 18%)}',
  '.duel-tile .vc-pt span{font-size:9px;color:hsl(var(--h) 30% 70%)}.duel-tile .vc-pt b{font-size:13px;color:#f3efe2;margin-left:2px}.duel-tile .vc-gem{display:inline-block;width:8px;height:8px;transform:rotate(45deg);border-radius:2px}',
  '.duel-tile .vc-arrows i{position:absolute;font-style:normal;font-size:10px;line-height:1;color:var(--edge)}.duel-tile .vc-arrows .in{top:-9px;left:50%;transform:translateX(-50%)}.duel-tile .vc-arrows .r{right:-9px;top:50%}.duel-tile .vc-arrows .l{left:-9px;top:50%;transform:scaleX(-1)}.duel-tile .vc-arrows .b{bottom:-9px;left:50%;transform:translateX(-50%) rotate(90deg)}',
  '.duel-tile .d-on{font-size:9px;color:var(--muted,#8a8a8a);margin:1px 5px 0}.duel-tile[data-neutral]{opacity:.45;filter:grayscale(.8)}.duel-tile[data-neutral] .vc-title::after{content:" ✕"}',
  '.duel-tile.sel{outline:2px solid #ffd27a;outline-offset:2px}.duel-tile.tgt{outline:2px solid #e0303e;outline-offset:2px}.duel-open{width:104px;min-height:70px;border:1px dashed rgba(255,255,255,.28);border-radius:12px;background:none;color:var(--muted,#aaa);font:inherit;font-size:11px;cursor:pointer}.duel-open.sel{border-color:#ffd27a;color:#ffd27a}',
  '.duel-card .d-ctl{display:flex;flex-wrap:wrap;gap:6px;align-items:center;margin:8px 0}.duel-card .d-ctl input{flex:1 1 140px;min-width:0;font:inherit;font-size:14px;padding:7px 9px;color:var(--ink,#ddd);background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.16);border-radius:8px}',
  '.duel-card .d-panel{margin:8px 0;padding:8px;border:1px solid rgba(255,210,122,.4);border-radius:10px;font-size:13px}.duel-card .d-panel .g-btn{margin:3px 3px 0 0}.duel-card .d-log{font-size:12px;color:var(--muted,#9a9a9a);margin-top:6px}.duel-card .d-win{font-size:15px;color:#ffd27a;margin:6px 0}.duel-card .d-kws{display:flex;flex-wrap:wrap;gap:3px;margin:2px 6px}.duel-card .d-kw{font-size:10px;letter-spacing:.04em;padding:1px 6px;border-radius:999px;border:1px solid rgba(255,210,122,.45);color:#ffd27a}.duel-card .d-shield{border-color:#9fe08a;color:#9fe08a}',
].join('');

function tile(c, s, stats, pick) {
  const l = lookup(stats, c.name), base = cardOf({ skill: l.skill, page: l.page, book: l.book, deps: l.deps });
  const n = { ...base, name: c.name, cost: 0, power: D.powerOf(s, c), toughness: c.resistance, income: c.income, arrowsOut: Math.min(3, c.arrows), arrowIn: !!c.parent, fetched: false, number: '', adds: '',
    typeLine: c.root ? 'Root' : l.skill || l.page ? base.typeLine : 'Idea' };
  const h = chromeHtml(n, esc), cost = c.root ? '' : '<i>' + '◆'.repeat(Math.min(6, D.cost(c))) + '</i>';
  const parent = c.parent ? s.cards.find((x) => x.id === c.parent) : null;
  const b = document.createElement('button'); b.type = 'button'; b.className = 'duel-tile vcard'; b.dataset.id = c.id; b.dataset.side = c.side; b.style.setProperty('--h', String(n.hue));
  if (n.rarity) b.style.setProperty('--foil', 'linear-gradient(135deg,' + n.rarity.foil + ')');
  if (c.neutralised) b.dataset.neutral = '1';
  b.setAttribute('aria-label', c.name + ', power ' + D.powerOf(s, c) + (D.kin(s, c) ? ' (kin +1)' : '') + ', resistance ' + c.resistance + ', income ' + c.income + (c.abilities && c.abilities.length ? ', ' + c.abilities.join(', ') : '') + (D.shielded(s, c) ? ', shielded this turn' : '') + (c.neutralised ? ', neutralised' : ''));
  // its abilities as keywords under the type line, the way Magic prints them; a Proven card just summoned says it is shielded
  const kw = (c.abilities || []).map((a) => '<span class="d-kw" title="' + esc(D.ABILITIES[a]) + '">' + esc(a[0].toUpperCase() + a.slice(1)) + '</span>').join('') + (D.kin(s, c) ? '<span class="d-kw" title="Kin: another card of its family is in play, +1 Power">Kin +1</span>' : '') + (D.shielded(s, c) ? '<span class="d-kw d-shield" title="Proven: cannot be neutralised this turn">Shielded</span>' : '');
  b.innerHTML = '<div class="vc-title"><span>' + esc(c.name) + '</span>' + cost + '</div>' + h.type + (kw ? '<div class="d-kws">' + kw + '</div>' : '') + (parent ? '<div class="d-on">on ' + esc(parent.name) + '</div>' : '') + h.foot + h.arrows; // void-review: ok: chromeHtml escapes, names go through esc
  b.addEventListener('pointerdown', (e) => e.stopPropagation()); b.addEventListener('click', (e) => { e.stopPropagation(); pick(c); });
  return b;
}

function mount(th, stageApi) {
  if (!th.state || !th.state.cards) th.state = D.newState();
  if (!document.getElementById('duel-style')) { const st = document.createElement('style'); st.id = 'duel-style'; st.textContent = CSS; document.head.appendChild(st); }
  const el = document.createElement('div'); el.className = 'thing kept-card game-card duel-card'; el.dataset.id = th.id;
  el.style.cssText = 'left:' + th.x + 'px;top:' + th.y + 'px;width:min(480px, calc(100vw - 20px));max-height:calc(100vh - 80px);overflow:auto';
  el.innerHTML = '<div class="g-head"><span class="g-title">Verse Duel</span><span class="g-sub">you are below</span></div><div class="d-bar" aria-live="polite"></div><div class="d-lab">Verse</div><div class="d-row d-foe"></div><div class="d-lab">You</div><div class="d-row d-me"></div>'
    + '<div class="d-panel" hidden></div><div class="d-ctl"><input class="d-idea" type="text" maxlength="40" placeholder="any idea to summon" aria-label="an idea to summon"><button type="button" class="g-btn d-summon">Summon</button><button type="button" class="g-btn d-attack">Attack</button><button type="button" class="g-btn d-pass">Pass (+2)</button><button type="button" class="g-btn d-new">New duel</button></div><div class="d-log"></div>';
  el.appendChild(rulesLine('summon a card from any idea, then attack Verse\u2019s Root with it; pledge coins to add power. Bring Verse\u2019s Root to zero to win.'));
  const q = (sel) => el.querySelector(sel), bar = q('.d-bar'), foe = q('.d-foe'), me = q('.d-me'), panel = q('.d-panel'), log = q('.d-log'), input = q('.d-idea');
  const save = () => stageApi.save && stageApi.save();
  let stats = null, mode = null, mine = null, theirs = null, slot = null, pledge = 0, pending = null, busy = null; // mode: 'summon' | 'attack' | null
  for (const b of el.querySelectorAll('button,input')) b.addEventListener('pointerdown', (e) => e.stopPropagation());
  const fam = () => stats && stats.fam, deps = () => stats && stats.deps;
  const defOf = (name) => D.statsFor(name, fam(), deps());
  function seedPool() { // Verse summons from what the site has proved most: the skills whose card has earned more than a fresh one
    if (!stats || !stats.fam || th.state.pool.void.length) return;
    const names = []; for (const f of stats.fam.families || []) for (const s of f.skills || []) names.push(s.name);
    const earned = names.map(defOf).filter((c) => c.power > 1 || c.resistance > 1).sort((a, b) => (b.power + b.resistance) - (a.power + a.resistance) || (a.name < b.name ? -1 : 1));
    th.state.pool = { void: earned.slice(0, 8) }; save();
  }
  function paint() {
    const s = th.state, st = D.collectIncome(s); if (st !== s) { th.state = st; save(); return paint(); }
    const mineTurn = s.side === 'you' && !s.over && !pending;
    bar.innerHTML = '<span>Turn <b>' + Math.min(s.turn + 1, D.TURNS) + '</b> of ' + D.TURNS + '</span><span>Treasury: you <b>' + s.treasury.you + '</b> · Verse <b>' + s.treasury.void + '</b></span><span>Income <b>' + D.incomeOf(s, 'you') + '</b></span><span>' + (s.over ? 'over' : s.side === 'you' ? 'your move · ' + s.actions + ' action' + (s.actions === 1 ? '' : 's') : 'Verse is playing') + '</span>'; // void-review: ok: only numbers the game computed (turn, treasury, income) reach the markup
    const sel = (c) => { if (!mineTurn) return; if (c.side === 'you') { if (c.neutralised) return; mine = c.id; if (mode !== 'attack') mode = 'attack'; } else if (mode === 'attack' && !c.neutralised) theirs = c.id; paint(); };
    for (const [row, side] of [[foe, 'void'], [me, 'you']]) {
      row.textContent = '';
      for (const c of s.cards.filter((x) => x.side === side)) { const t = tile(c, s, stats, sel); if (c.id === mine) t.classList.add('sel'); if (c.id === theirs) t.classList.add('tgt'); row.appendChild(t); }
      if (side === 'you' && mineTurn && mode === 'summon') for (const a of D.openArrows(s, 'you')) {
        const b = document.createElement('button'); b.type = 'button'; b.className = 'duel-open'; b.textContent = '+ arrow on ' + s.cards.find((x) => x.id === a.parent).name; b.dataset.parent = a.parent; b.dataset.slot = a.slot;
        if (slot && slot.parent === a.parent && slot.slot === a.slot) b.classList.add('sel');
        b.addEventListener('pointerdown', (e) => e.stopPropagation()); b.addEventListener('click', (e) => { e.stopPropagation(); slot = a; paint(); }); row.appendChild(b);
      }
    }
    for (const b of el.querySelectorAll('.d-ctl button,.d-ctl input')) b.disabled = !mineTurn && !b.classList.contains('d-new');
    panel.hidden = true; panel.textContent = '';
    if (pending) { // Verse attacks: you answer with coins
      const a = s.cards.find((c) => c.id === pending.from), t = s.cards.find((c) => c.id === pending.target), cap = Math.min(s.treasury.you, 8);
      panel.hidden = false; panel.innerHTML = '<div>Verse attacks <b>' + esc(t.name) + '</b> with <b>' + esc(a.name) + '</b>' + (pending.pledge ? ' and pledges ' + pending.pledge : '') + '. Its total: <b>' + (a.power + D.support(s, a) + pending.pledge) + '</b>, yours: <b>' + (t.resistance + D.support(s, t)) + '</b> + the coins you answer with.</div>';
      for (let n = 0; n <= cap; n++) { const b = document.createElement('button'); b.type = 'button'; b.className = 'g-btn d-answer'; b.textContent = 'Answer ' + n; b.dataset.n = n; b.addEventListener('click', (e) => { e.stopPropagation(); const p = pending; pending = null; step({ ...p, answer: n }); }); panel.appendChild(b); }
    } else if (mineTurn && mode === 'summon') {
      const def = defOf(input.value.trim() || 'Idea'), why = slot ? D.whyIllegal(s, { type: 'summon', card: def, parent: slot.parent, slot: slot.slot }) : 'tap an open arrow';
      panel.hidden = false; panel.innerHTML = '<div>Summon <b>' + esc(def.name) + '</b>: Power ' + def.power + ', Resistance ' + def.resistance + ', Income ' + def.income + ', ' + def.arrows + ' arrow' + (def.arrows === 1 ? '' : 's') + ', costs <b>' + D.cost(def) + '</b>. ' + (def.abilities && def.abilities.length ? esc(def.abilities.map((a) => D.ABILITIES[a]).join('. ')) + '. ' : '') + (why ? esc(why) + '.' : 'Ready.') + '</div>';
      const go = document.createElement('button'); go.type = 'button'; go.className = 'g-btn d-confirm'; go.textContent = 'Summon ' + def.name; go.disabled = !!why; go.addEventListener('click', (e) => { e.stopPropagation(); doSummon(def); }); panel.appendChild(go);
    } else if (mineTurn && mode === 'attack') {
      const a = s.cards.find((c) => c.id === mine), t = s.cards.find((c) => c.id === theirs);
      panel.hidden = false;
      if (!a || !t) panel.innerHTML = '<div>' + (a ? 'Now tap one of Verse’s cards.' : 'Tap one of your cards to attack with.') + '</div>'; // void-review: ok: two fixed strings, no user text
      else {
        pledge = Math.min(pledge, s.treasury.you);
        panel.innerHTML = '<div><b>' + esc(a.name) + '</b> (' + D.powerOf(s, a) + (D.kin(s, a) ? ' with kin' : '') + ' + ' + D.support(s, a) + ' support + <b>' + pledge + '</b> coins = <b>' + (D.powerOf(s, a) + D.support(s, a) + pledge) + '</b>) against <b>' + esc(t.name) + '</b> (' + t.resistance + ' + ' + D.support(s, t) + ' support = <b>' + (t.resistance + D.support(s, t)) + '</b> + Verse’s answer). It must beat the total.</div>';
        for (const [txt, d] of [['− coin', -1], ['+ coin', 1]]) { const b = document.createElement('button'); b.type = 'button'; b.className = 'g-btn d-pledge'; b.textContent = txt; b.addEventListener('click', (e) => { e.stopPropagation(); pledge = Math.max(0, Math.min(s.treasury.you, pledge + d)); paint(); }); panel.appendChild(b); }
        const go = document.createElement('button'); go.type = 'button'; go.className = 'g-btn d-confirm'; go.textContent = 'Attack'; go.addEventListener('click', (e) => { e.stopPropagation(); step({ type: 'attack', from: a.id, target: t.id, pledge }); }); panel.appendChild(go);
      }
    }
    log.textContent = s.log.slice(-3).reverse().join(' · ');
    if (s.over) { const w = document.createElement('div'); w.className = 'd-win'; w.textContent = s.over.winner === 'draw' ? 'A draw: level on Power after ' + D.TURNS + ' turns.' : s.over.winner === 'you' ? 'You win' + (s.over.why === 'root' ? ': Verse’s Root is neutralised.' : ' on Power after ' + D.TURNS + ' turns (' + s.over.you + ' to ' + s.over.void + ').') : 'Verse wins' + (s.over.why === 'root' ? ': your Root is neutralised.' : ' on Power after ' + D.TURNS + ' turns (' + s.over.void + ' to ' + s.over.you + ').'); panel.hidden = false; panel.textContent = ''; panel.appendChild(w); }
  }
  function step(action) { // one action by whoever is to move; Verse answers when it is its turn
    try { th.state = D.apply(th.state, action); } catch (e) { log.textContent = String(e.message); return paint(); }
    mode = null; mine = theirs = slot = null; pledge = 0; input.value = ''; save(); paint(); voidPlays();
  }
  function doSummon(def) { const s = th.state; if (!slot) return; step({ type: 'summon', card: def, parent: slot.parent, slot: slot.slot }); }
  function voidPlays() {
    clearTimeout(busy); const s = th.state;
    if (s.over || s.side !== 'void' || pending) return;
    busy = setTimeout(() => {
      const m = D.opponentMove(th.state); if (!m) return;
      if (m.type === 'attack' && th.state.cards.find((c) => c.id === m.target).side === 'you') { pending = m; paint(); return; }
      th.state = D.apply(th.state, m); save(); paint(); voidPlays();
    }, 550);
  }
  q('.d-summon').addEventListener('click', (e) => { e.stopPropagation(); mode = 'summon'; mine = theirs = null; slot = slot || D.openArrows(th.state, 'you')[0] || null; paint(); });
  q('.d-attack').addEventListener('click', (e) => { e.stopPropagation(); mode = 'attack'; slot = null; paint(); });
  q('.d-pass').addEventListener('click', (e) => { e.stopPropagation(); step({ type: 'pass' }); });
  q('.d-new').addEventListener('click', (e) => { e.stopPropagation(); clearTimeout(busy); pending = null; mode = null; th.state = D.newState(); seedPool(); save(); paint(); });
  input.addEventListener('input', () => { if (mode === 'summon') paint(); });
  // my saved cards (lib/card-deck.js, the one card record) are offered as ideas to summon: a tap fills the box, the duel earns its stats as before
  import('../lib/card-deck.js').then((K) => { const mineSaved = K.view(K.all(), { saved: true }).slice(0, 8); if (!mineSaved.length) return;
    const row = document.createElement('div'); row.className = 'd-mine'; row.style.cssText = 'display:flex;flex-wrap:wrap;gap:4px;margin:4px 0;font-size:12px';
    row.append('my cards: ');
    for (const r of mineSaved) { const b = document.createElement('button'); b.type = 'button'; b.className = 'g-btn'; b.textContent = r.t.slice(0, 40); b.addEventListener('pointerdown', (e) => e.stopPropagation()); b.addEventListener('click', (e) => { e.stopPropagation(); input.value = r.t.slice(0, 40); mode = 'summon'; slot = slot || D.openArrows(th.state, 'you')[0] || null; paint(); }); row.appendChild(b); }
    q('.d-ctl').after(row); }).catch(() => {});
  input.addEventListener('keydown', (e) => { e.stopPropagation(); if (e.key === 'Enter') { mode = 'summon'; slot = slot || D.openArrows(th.state, 'you')[0] || null; paint(); const d = defOf(input.value.trim() || 'Idea'); if (slot && !D.whyIllegal(th.state, { type: 'summon', card: d, parent: slot.parent, slot: slot.slot })) doSummon(d); } });
  ctl = {
    th,
    summon(idea) { mode = 'summon'; input.value = idea; slot = slot || D.openArrows(th.state, 'you')[0] || null; paint(); return !!slot; },
    attack(mineName, theirName) {
      const by = (side, n) => th.state.cards.find((c) => c.side === side && !c.neutralised && c.name.toLowerCase() === String(n).trim().toLowerCase());
      const a = by('you', mineName), t = by('void', theirName); mode = 'attack'; mine = a && a.id; theirs = t && t.id; paint(); return !!(a && t);
    },
  };
  el.addEventListener('pointerdown', (e) => { if (e.target && e.target.closest && e.target.closest('button,input')) e.stopImmediatePropagation(); }); // a press on a control plays the game; only the card itself is picked up (else the stage re-draws the card under the click)
  stageApi.bindDrag(el, th); stageApi.stage.appendChild(el);
  paint();
  loadStats().then((s) => { stats = s; seedPool(); paint(); voidPlays(); });
  voidPlays();
}

const RCSS = '.rules-card .r-sets{display:flex;flex-wrap:wrap;gap:6px;margin:6px 0}.rules-card .r-set{font-size:12px;padding:3px 8px;border:1px solid rgba(255,255,255,.25);border-radius:999px}'
  + '.rules-card .r-log{margin:8px 0;padding:0;list-style:none;font-size:13px;line-height:1.4;max-height:260px;overflow:auto}.rules-card .r-log li{padding:3px 0;border-bottom:1px solid rgba(255,255,255,.08)}'
  + '.rules-card .r-log li.clash{color:#ffd27a;border-left:3px solid #ffd27a;padding-left:6px}.rules-card .r-log li.block{color:#e8a0a8}.rules-card .r-log li.turn{color:#f3efe2;font-weight:600;margin-top:4px}';
const ruleSets = (names) => Promise.all(names.map((n) => fetch(new URL('../lib/rulesets/' + n + '.json', import.meta.url)).then((r) => r.json())));

/** the rules stack on the stage: the named rule sets in force at once, a few turns played by two deterministic sides, every clash in words */
function mountRules(th, stageApi) {
  if (!document.getElementById('duel-style')) { const st = document.createElement('style'); st.id = 'duel-style'; st.textContent = CSS; document.head.appendChild(st); }
  if (!document.getElementById('rules-style')) { const st = document.createElement('style'); st.id = 'rules-style'; st.textContent = RCSS; document.head.appendChild(st); }
  const el = document.createElement('div'); el.className = 'thing kept-card game-card duel-card rules-card'; el.dataset.id = th.id;
  el.style.cssText = 'left:' + th.x + 'px;top:' + th.y + 'px;width:min(520px, calc(100vw - 20px));max-height:calc(100vh - 80px);overflow:auto';
  el.innerHTML = '<div class="g-head"><span class="g-title">Verse Rules</span><span class="g-sub">all in force at once</span></div><div class="r-sets"></div><div class="d-lab">Verse</div><div class="d-row r-foe"></div><div class="d-lab">You</div><div class="d-row r-me"></div><div class="d-bar r-bar"></div><ol class="r-log" aria-label="what happened, in words"></ol><div class="d-ctl"><button type="button" class="g-btn r-more">Play 4 more turns</button></div>';
  for (const b of el.querySelectorAll('button')) b.addEventListener('pointerdown', (e) => e.stopPropagation());
  const q = (sel) => el.querySelector(sel); let turns = 4, stats = null, sets = null;
  function paint() {
    if (!sets) return;
    const play = playTurns(sets, { turns }), lines = playLines(play), st = play.state;
    q('.r-sets').textContent = ''; for (const x of sets) { const c = document.createElement('span'); c.className = 'r-set'; c.textContent = x.title + ' · ' + x.rules.length + ' rules'; c.title = x.about; q('.r-sets').appendChild(c); }
    for (const [row, side] of [[q('.r-foe'), 'void'], [q('.r-me'), 'you']]) { row.textContent = ''; for (const c of st.cards.filter((x) => x.side === side)) row.appendChild(tile(c, st, stats, () => {})); }
    q('.r-bar').innerHTML = '<span>Turn <b>' + (st.turn + 1) + '</b></span><span>Coins: you <b>' + st.res.you.coins + '</b> · Verse <b>' + st.res.void.coins + '</b></span><span>' + (st.over ? esc((st.over.winner === 'draw' ? 'a draw' : (st.over.winner === 'you' ? 'you win' : 'Verse wins')) + ' (' + st.over.why + ')') : 'play goes on') + '</span>';
    const ol = q('.r-log'); ol.textContent = '';
    for (const l of lines) { const li = document.createElement('li'); li.textContent = l; if (/^Clash on/.test(l)) li.className = 'clash'; else if (/ blocked the /.test(l)) li.className = 'block'; else if (/^Turn \d+:/.test(l)) li.className = 'turn'; ol.appendChild(li); }
    q('.r-more').disabled = !!st.over;
  }
  q('.r-more').addEventListener('click', (e) => { e.stopPropagation(); turns += 4; paint(); });
  stageApi.bindDrag(el, th); stageApi.stage.appendChild(el);
  ruleSets(th.names).then((s) => { sets = s; paint(); }).catch(() => { q('.r-log').textContent = 'The rule sets could not be loaded.'; });
  loadStats().then((s) => { stats = s; paint(); });
}

async function run(text, api) {
  const ask = duelOf(text); if (!ask) return 'none';
  if (ask.kind === 'rules') {
    api.summon('rulesduel', { names: ask.games, x: Math.max(10, Math.round(innerWidth / 2 - 260)), y: 50 });
    api.say('Verse Rules · ' + ask.games.join(' + ') + ' in force at once · every clash is written out');
    return 'duel';
  }
  const existing = Object.values(api.stage.things()).find((t) => t.kind === 'duel');
  if (ask.kind === 'open' || !existing) {
    if (existing) { if (api.stage.center) api.stage.center(existing.id); else api.stage.render(); return 'duel'; }
    api.summon('duel', { state: D.newState(), x: Math.max(10, Math.round(innerWidth / 2 - 240)), y: 50 });
    api.say('Verse Duel · destroy the other Root · summon any idea, attack, or pass · you are below');
    return 'duel';
  }
  if (!ctl) return 'duel';
  if (ask.kind === 'summon') api.say(ctl.summon(ask.idea) ? 'Tap Summon to place ' + ask.idea + ' on an open arrow.' : 'You have no open arrow to summon onto.');
  else api.say(ctl.attack(ask.mine, ask.target) ? 'Choose your coins, then Attack.' : 'No card of yours is called ' + ask.mine + ' or none of theirs is called ' + ask.target + '.');
  return 'duel';
}

export default {
  name: 'duel',
  duelOf,
  examples: ['duel', 'play cards', 'card duel', 'play the card game', "let's play a card duel", 'duel with mana and tribute rules', 'play cards with initiative'],
  nearMisses: ['duel of the fates movie', 'card game rules history', 'who won the duel between hamilton and burr', 'attack on titan'],
  match(lower, text) { const a = duelOf(text); return !!a && (a.kind === 'open' || a.kind === 'rules' || onStage()); },
  run,
  stageKinds: { duel: { mount }, rulesduel: { mount: mountRules } },
};
