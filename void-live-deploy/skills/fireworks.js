/**
 * fireworks skill — a cooperative card game in the style of Hanabi, you and Void on the same side (skills/fireworks-rules.js):
 * "play fireworks", "play hanabi", "a co-op game". You see Void's cards but not your own; Void sees yours but not its own.
 * Tap one of your cards to play or discard it, or one of Void's to tell it a colour or a number. Each seat moves only its
 * own cards; Void's every choice says why. The table stands in the void in 3D (mini/fireworks.js) with this card beside it.
 */
import * as F from './fireworks-rules.js';
import { lift3d } from './lift3d.js';

export function fireworksOf(text) {
  const t = String(text || '').trim().toLowerCase().replace(/[?!.]+$/, '').replace(/\s+/g, ' ');
  if (/^(?:(?:let'?s|lets|can we|i want to|wanna)\s+)?(?:play|start|open|new)\s+(?:a\s+)?(?:game\s+of\s+)?(?:fireworks|hanabi)(?:\s+(?:card\s+)?game)?(?:\s+(?:with|against)\s+(?:me|void|you))?$/.test(t)) return { kind: 'game' };
  if (/^(?:(?:let'?s|lets)\s+)?play\s+(?:a\s+)?(?:co-?op|cooperative)\s+(?:card\s+|board\s+)?game(?:\s+with\s+(?:me|void|you))?$|^(?:a\s+)?(?:co-?op|cooperative)\s+(?:card\s+|board\s+)?game$|^(?:a\s+)?game\s+of\s+(?:fireworks|hanabi)$/.test(t)) return { kind: 'game' };
  return null;
}
export const HEX = ['#e2453c', '#efc23a', '#3fae5a', '#3d7fe0', '#eceae4'];
const timers = new WeakMap();

function mount(th, stageApi) {
  if (!th.state || !th.state.hands) th.state = F.create();
  const el = document.createElement('div');
  el.className = 'thing kept-card game-card fireworks-card';
  el.dataset.id = th.id;
  el.style.cssText = 'left:' + th.x + 'px;top:' + th.y + 'px;width:min(440px, calc(100vw - 20px))';
  el.innerHTML = '<div class="g-head"><span class="g-title">Fireworks</span><span class="g-sub">co-op · you and Void together</span></div>';
  const wrap = document.createElement('div'); wrap.className = 'g-board';
  const table = document.createElement('div'); table.className = 'fw-table'; table.style.cssText = 'background:#14181f;border-radius:12px;padding:8px';
  const mk = (cls) => { const d = document.createElement('div'); d.className = cls; d.style.cssText = 'display:flex;gap:5px;justify-content:center;margin:5px 0'; return d; };
  const voidRow = mk('fw-void'), rowsRow = mk('fw-rows'), youRow = mk('fw-you');
  const cap = (t) => { const d = document.createElement('div'); d.style.cssText = 'font-size:11px;color:var(--muted,#8a8a8a);text-align:center'; d.textContent = t; return d; };
  table.append(cap('Void’s hand (you can see it, Void can’t)'), voidRow, cap('The fireworks'), rowsRow, cap('Your hand (only what Void has told you)'), youRow); wrap.appendChild(table);
  const status = document.createElement('div'); status.className = 'g-status fw-status'; status.setAttribute('aria-live', 'polite'); status.style.display = 'block';
  const tokens = document.createElement('div'); tokens.style.cssText = 'font-size:12px;margin:4px 0';
  const bar = document.createElement('div'); bar.style.cssText = 'display:flex;gap:6px;flex-wrap:wrap;margin:6px 0;min-height:34px';
  const log = document.createElement('div'); log.className = 'fw-log'; log.style.cssText = 'font-size:11.5px;color:var(--muted,#8a8a8a);max-height:120px;overflow:auto;border-top:1px solid rgba(255,255,255,.08);padding-top:4px';
  const foot = document.createElement('div'); foot.className = 'g-rules'; foot.textContent = 'Build each colour 1 to 5. A hint names every card of one colour or one number. 8 hint tokens (a discard earns one back), 3 mistakes.';
  const btn = (label, cls, fn) => { const b = document.createElement('button'); b.type = 'button'; b.className = 'g-btn ' + cls; b.textContent = label; b.addEventListener('pointerdown', (e) => e.stopPropagation()); b.addEventListener('click', (e) => { e.stopPropagation(); fn(); }); return b; };
  let sel = null; // { side: 'you'|'void', k }
  const save = () => stageApi.save && stageApi.save();
  const done = (next) => { if (next !== th.state) { th.state = next; sel = null; save(); } paint(); voidPlays(); };
  function voidPlays() {
    clearTimeout(timers.get(th));
    if (th.state.over || th.state.turn !== 'void') return;
    timers.set(th, setTimeout(() => { done(F.voidAct(th.state)); }, 1000));
  }
  const card = (side, k, c, known) => {
    const b = document.createElement('button'); b.type = 'button'; b.className = 'fw-card'; b.dataset.i = (side === 'you' ? 'y' : 'v') + k;
    const col = c ? HEX[c.c] : known.c != null ? HEX[known.c] : '#2b3240';
    b.style.cssText = 'width:44px;height:62px;border-radius:6px;border:2px solid ' + (sel && sel.side === side && sel.k === k ? '#ffd76a' : 'rgba(255,255,255,.15)') + ';background:' + col + ';color:' + (c && c.c === 4 ? '#222' : '#fff') + ';font:700 20px Georgia,serif;cursor:pointer;position:relative';
    b.textContent = c ? String(c.r + 1) : known.r != null ? String(known.r + 1) : '?';
    if (!c && (known.c != null || known.r != null)) b.title = 'told: ' + (known.c != null ? F.COLORS[known.c] + ' ' : '') + (known.r != null ? String(known.r + 1) : '');
    b.addEventListener('pointerdown', (e) => e.stopPropagation());
    b.addEventListener('click', (e) => { e.stopPropagation(); sel = sel && sel.side === side && sel.k === k ? null : { side, k }; paint(); });
    return b;
  };
  function paint() {
    const s = th.state, v = F.view(s, 'you'), mine = s.turn === 'you' && !s.over;
    voidRow.replaceChildren(...v.theirs.map((c, k) => card('void', k, c, c.known)));
    youRow.replaceChildren(...v.own.map((c, k) => card('you', k, null, c.known)));
    rowsRow.replaceChildren(...v.rows.map((n, c) => { const d = document.createElement('div'); d.style.cssText = 'width:44px;height:62px;border-radius:6px;display:flex;align-items:center;justify-content:center;font:700 20px Georgia,serif;background:' + (n ? HEX[c] : 'transparent') + ';border:2px dashed ' + HEX[c] + ';color:' + (c === 4 ? '#222' : '#fff'); d.textContent = n ? String(n) : ''; return d; }));
    tokens.textContent = 'Hints ' + v.hints + ' of 8 · mistakes ' + v.mistakes + ' of 3 · deck ' + v.deck + ' · score ' + v.score + ' of 25';
    bar.replaceChildren();
    if (mine && sel && sel.side === 'you') {
      bar.append(btn('Play card ' + (sel.k + 1), 'fw-play g-primary', () => done(F.play(th.state, sel.k))));
      if (v.hints < 8) bar.append(btn('Discard card ' + (sel.k + 1), 'fw-discard', () => done(F.discard(th.state, sel.k))));
    }
    if (mine && sel && sel.side === 'void' && v.hints > 0) {
      const c = v.theirs[sel.k];
      bar.append(btn('Tell Void its ' + F.COLORS[c.c] + ' cards', 'fw-hint-color', () => done(F.hint(th.state, { color: c.c }))),
        btn('Tell Void its ' + (c.r + 1) + 's', 'fw-hint-rank', () => done(F.hint(th.state, { rank: c.r }))));
    }
    const newB = btn('New game', 'fw-new', () => { clearTimeout(timers.get(th)); th.state = F.create(); sel = null; save(); paint(); });
    bar.append(newB);
    status.textContent = s.over ? ({ perfect: 'A perfect show: 25!', boom: 'Three mistakes: the show is over at ' + v.score + '.', deck: 'The deck ran out: you scored ' + v.score + ' together.' })[s.over]
      : mine ? (sel ? (sel.side === 'you' ? 'Play or discard that card?' : 'Tell Void about its cards?') : 'Your turn: tap one of your cards, or one of Void’s to give a hint') : 'Void is thinking…';
    log.textContent = '';
    for (const l of s.log.slice(-12).reverse()) { const line = document.createElement('div'); line.textContent = l.who + ' ' + l.text; if (l.why) { const w = document.createElement('span'); w.style.color = 'var(--ink,#ddd)'; w.textContent = ' · because ' + l.why; line.appendChild(w); } log.appendChild(line); }
  }
  el.append(wrap, status, tokens, bar, foot, log);
  paint();
  stageApi.bindDrag(el, th);
  stageApi.stage.appendChild(el);
  voidPlays();
  lift3d(th, stageApi, el, { kind: 'fireworks', board: table, title: 'Fireworks', W: 480, H: 340,
    snapshot: () => { const v = F.view(th.state, 'you'); return { theirs: v.theirs, own: v.own, rows: v.rows, hints: v.hints, mistakes: v.mistakes, sel }; } });
}

async function run(text, api) {
  if (!fireworksOf(text)) return 'none';
  const existing = Object.values(api.stage.things()).find((t) => t.kind === 'fireworks');
  if (existing) { if (api.stage.center) api.stage.center(existing.id); else api.stage.render(); return 'fireworks'; }
  api.summon('fireworks', { state: F.create(), x: Math.max(10, Math.round(innerWidth / 2 - 400)), y: 50 });
  api.say('Fireworks · you and Void on the same side · you see Void’s cards, not your own');
  return 'fireworks';
}

export default {
  name: 'fireworks',
  fireworksOf,
  examples: ['play fireworks', 'play hanabi', "let's play a co-op game", 'a cooperative card game', 'play fireworks with void'],
  nearMisses: ['fireworks', 'fireworks tonight', 'what is hanabi', 'buy fireworks', 'play chess'],
  match(lower, text) { return !!fireworksOf(text); },
  run,
  stageKinds: { fireworks: { mount } },
};
