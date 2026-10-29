/**
 * arcade skill — the Verse arcade cabinet (owner, 2026-10-19: "also a 3d arcade machine", "Verse brand cabinet of course"): a 3D upright cabinet
 * in Verse's violet and cyan (skills/mini/arcade.js) whose screen lists the arcade games, with a card beside it that lists them as buttons with
 * your record against Verse (lib/ladder.js), so it works where WebGL can't. Tap a game on the screen or a button: the cabinet steps aside and the
 * game opens. "arcade games", "show me the arcade", "my arcade ladder", "play an arcade game", "arcade machine". A bare "arcade" stays a lookup.
 */
import { grip, sideCard } from './side-card.js';
import { GAMES, TITLES, ASKS, arcadeRow, load as loadLadder } from '../lib/ladder.js';

export function arcadeOf(text) {
  const t = String(text || '').trim().toLowerCase().replace(/[?!.]+$/, '').replace(/\s+/g, ' ');
  if (t === 'arcade') return false;
  return /^(?:show\s+(?:me\s+)?|open\s+|play\s+(?:an?\s+)?|go\s+to\s+|summon\s+)?(?:the\s+|your\s+|my\s+|a\s+)?(?:verse\s+)?arcade(?:\s+(?:games?|ladder|record|scores?|machine|cabinet))?$|^(?:what|which)\s+arcade\s+games\s+(?:can\s+i\s+play|do\s+you\s+have)$/.test(t);
}

const listOf = () => { const l = loadLadder(); return GAMES.map((g) => ({ id: g, title: TITLES[g], line: arcadeRow(l, g).slice(TITLES[g].length).replace(/^ · /, '') })); };

function mount(th, stageApi) {
  const phone = Math.min(innerWidth, innerHeight) < 560;
  const W = phone ? Math.min(innerWidth - 20, 360) : 380, H = Math.round(W * 1.05);
  const el = document.createElement('div');
  el.className = 'thing kept-card free-board arcade-wrap';
  el.dataset.id = th.id;
  el.style.cssText = 'position:absolute;left:' + th.x + 'px;top:' + th.y + 'px;width:' + W + 'px;text-align:center;user-select:none;background:transparent;border:0;box-shadow:none;padding:0';
  const view = document.createElement('div'); view.className = 'arcade-view';
  view.style.cssText = 'position:relative;width:100%;height:' + H + 'px';
  view.addEventListener('pointerdown', (e) => e.stopPropagation());
  el.append(view, grip('Verse arcade'));
  const open = (id) => { if (!ASKS[id] || !stageApi.ask) return; delete stageApi.things()[th.id]; stageApi.save && stageApi.save(); stageApi.ask(ASKS[id]); };
  const card = document.createElement('div'); card.className = 'arcade-card';
  card.innerHTML = '<div class="g-head"><span class="g-title">Verse arcade</span><span class="g-sub">you against Verse · tap a game</span></div>';
  const list = document.createElement('div'); list.style.cssText = 'display:flex;flex-direction:column;gap:6px;margin-top:8px';
  for (const g of listOf()) {
    const b = document.createElement('button'); b.type = 'button'; b.className = 'g-btn arcade-pick'; b.dataset.arcade = g.id;
    b.textContent = g.title + (g.line ? ' · ' + g.line : '');
    b.addEventListener('pointerdown', (e) => e.stopPropagation());
    b.addEventListener('click', (e) => { e.stopPropagation(); open(g.id); });
    list.appendChild(b);
  }
  card.appendChild(list);
  stageApi.bindDrag(el, th);
  stageApi.stage.appendChild(el);
  sideCard(th, stageApi, card, { boardW: W, boardH: H + 24, w: 240 });
  if (stageApi.miniature) {
    stageApi.miniature(view, 'arcade', { games: listOf(), onPick: open }, { key: 'arcade:' + th.id, label: 'Verse arcade cabinet: tap a game on the screen, or nudge the joystick and press the cyan button; drag to look around', maxPolar: 1.5, minPolar: 0.5 })
      .catch((e) => { console.warn('[arcade] 3D unavailable, the card lists the games', e); el.remove(); });
  } else el.remove();
}

async function run(text, api) {
  if (!arcadeOf(text)) return 'none';
  const existing = Object.values(api.stage.things()).find((t) => t.kind === 'arcade');
  if (existing) { if (api.stage.center) api.stage.center(existing.id); else api.stage.render(); }
  else {
    const phone = Math.min(innerWidth, innerHeight) < 560, w = phone ? Math.min(innerWidth - 20, 360) : 380, both = phone ? w : w + 260;
    api.summon('arcade', { hold: true, x: Math.max(10, Math.round((innerWidth - both) / 2)), y: phone ? 56 : 50 });
  }
  api.say('the Verse arcade · tap a game on the screen, or pick one on the card');
  return 'arcade';
}

export default {
  name: 'arcade',
  arcadeOf,
  examples: ['arcade games', 'show me the arcade', 'my arcade ladder', 'play an arcade game', 'what arcade games can i play', 'arcade machine', 'verse arcade'],
  nearMisses: ['arcade', 'arcade fire', 'arcade machine for sale', 'history of arcade games', 'arcade near me', 'video arcade definition'],
  match(lower, text) { return arcadeOf(text || lower); },
  run,
  stageKinds: { arcade: { mount } },
};
