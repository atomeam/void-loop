/**
 * dim-void skill — Dim the Verse, Verse's lights-out puzzle (skills/dim-void-rules.js; research in domains/void.game-research.md):
 * "dim the void", "lights out", "play lights out", "switch the lamps off". Pressing a lamp flips it and the four beside it; put every lamp out.
 * Player two is Verse: it plays the same board with the shortest solution, one press every 1.4 seconds once you have pressed, and that count is the
 * par your presses are measured against. First board dark wins. A hint shows one press from a shortest solution and is counted. A finished game goes
 * on Verse's arcade ladder.
 */
import * as D from './dim-void-rules.js';
import { studioCard, every, verdict } from '../lib/studio-card.js';
import { finish } from '../lib/ladder.js';

export function dimVoidOf(text) {
  const t = String(text || '').trim().toLowerCase().replace(/[?!.]+$/, '').replace(/\s+/g, ' ');
  return /^(?:(?:let'?s|lets|can we|i want to|wanna)\s+)?(?:(?:play|start|open|new)\s+)?(?:a\s+)?(?:game\s+of\s+)?(?:(?:verse|void|v01d)\s+)?(?:dim\s+the\s+(?:void|verse)|lights?[\s-]out|switch\s+the\s+lamps?\s+off|lamp\s+puzzle)(?:\s+(?:game|puzzle))?(?:\s+(?:with|against|vs)\s+(?:me|(?:verse|void)|you))?$/.test(t)
    && (/\b(dim|play|game|puzzle|let|start|open|switch|lamp|wanna|new)\b/.test(t));
}

function mount(th, stageApi) {
  const c = studioCard(th, stageApi, { cls: 'dvoid', title: 'Dim the Verse', sub: 'you against Verse, one board', width: 300 });
  let you, vs, result = '', stop = null, started = false, hints = 0, hint = -1;
  const g = document.createElement('div'); g.className = 'dv-grid'; g.style.cssText = 'display:grid;grid-template-columns:repeat(' + D.N + ',1fr);gap:4px';
  const lamps = [];
  for (let i = 0; i < D.N * D.N; i++) {
    const b = document.createElement('button'); b.type = 'button'; b.className = 'dv-lamp'; b.dataset.i = i;
    b.style.cssText = 'aspect-ratio:1;border-radius:10px;border:1px solid rgba(255,255,255,.2);cursor:pointer;padding:0;transition:background .12s';
    b.addEventListener('click', (e) => { e.stopPropagation(); act(i); }); g.appendChild(b); lamps.push(b);
  }
  c.body.appendChild(g);
  const mini = document.createElement('div'); mini.className = 'dv-verse'; mini.style.cssText = 'display:grid;grid-template-columns:repeat(' + D.N + ',1fr);gap:2px;width:70px;flex:none';
  const vl = Array.from({ length: D.N * D.N }, () => { const d = document.createElement('div'); d.style.cssText = 'aspect-ratio:1;border-radius:2px'; mini.appendChild(d); return d; });
  const vinfo = document.createElement('div'); vinfo.className = 'dv-vinfo'; vinfo.style.cssText = 'font-size:12px;line-height:1.35';
  const row = document.createElement('div'); row.style.cssText = 'display:flex;gap:10px;align-items:center;margin-top:8px'; row.append(mini, vinfo); c.body.appendChild(row);
  c.button('Hint', () => { if (result || you.over) return; const m = D.botMove(you); if (!m) return; hints++; hint = m.i; paint(); }, 'dv-hint');

  function reset() { const seed = (Date.now() & 0xffff) || 7; you = D.create(seed); vs = D.create(seed); result = ''; started = false; hints = 0; hint = -1; if (stop) stop(); stop = null; c.el.dataset.result = ''; paint(); }
  function act(i) {
    if (result || you.over) return;
    D.press(you, i); hint = -1;
    if (!started) { started = true; stop = every(c.el, 1400, verse); }
    settle(); paint();
  }
  function verse() { if (result || vs.over) return; const m = D.botMove(vs); if (!m) return; D.apply(vs, m); settle(); paint(); }
  function settle() {
    if (result) return;
    result = you.over === 'win' ? 'you' : vs.over === 'win' ? 'void' : '';
    if (result) { if (stop) stop(); stop = null; c.el.dataset.result = result; try { finish('dim-void', result); } catch (_) { /* the ladder is a convenience */ } }
  }
  function paint() {
    lamps.forEach((b, i) => {
      b.style.background = you.lights[i] ? '#ffd04a' : 'rgba(255,255,255,.07)'; b.style.boxShadow = you.lights[i] ? '0 0 12px rgba(255,208,74,.55)' : 'none';
      b.style.outline = i === hint ? '2px solid #4ef0a0' : 'none'; b.disabled = !!(result || you.over);
      b.setAttribute('aria-label', 'row ' + (Math.floor(i / D.N) + 1) + ', column ' + ((i % D.N) + 1) + ': ' + (you.lights[i] ? 'lit' : 'dark'));
    });
    vs.lights.forEach((v, i) => { vl[i].style.background = v ? '#a070ff' : 'rgba(255,255,255,.08)'; });
    vinfo.textContent = 'Verse · ' + vs.presses + ' of ' + vs.par + ' presses' + (vs.over ? ' · dark' : '');
    const over = you.presses + hints;
    c.status.textContent = result ? verdict(result, 'You put them all out' + (you.presses <= you.par && !hints ? ' in par' : ''), 'Verse put them all out first') + ' · ' + you.presses + ' presses' + (hints ? ' + ' + hints + ' hint' + (hints === 1 ? '' : 's') : '') + ', par ' + you.par
      : started ? you.presses + ' presses' + (hints ? ' + ' + hints + ' hint' + (hints === 1 ? '' : 's') : '') + ' · par ' + you.par + (over > you.par ? ' · over par' : '')
        : 'Press a lamp: it flips itself and the four beside it · par ' + you.par + (hints ? ' · ' + hints + ' hint' + (hints === 1 ? '' : 's') + ' used' : '');
    c.why.textContent = started && vs.why ? 'Verse: ' + vs.why : '';
  }
  c.again.addEventListener('click', (e) => { e.stopPropagation(); reset(); });
  reset();
}

async function run(text, api) {
  if (!dimVoidOf(text)) return 'none';
  const existing = Object.values(api.stage.things()).find((t) => t.kind === 'dim-void');
  if (existing) { if (api.stage.center) api.stage.center(existing.id); else api.stage.render(); return 'dim-void'; }
  api.summon('dim-void', { x: Math.max(10, Math.round(innerWidth / 2 - 150)), y: 50 });
  api.say('Dim the Verse · put every lamp out before Verse does');
  return 'dim-void';
}

export default {
  name: 'dim-void',
  dimVoidOf,
  examples: ['dim the void', 'dim the verse', 'lights out puzzle', 'play lights out', 'switch the lamps off', "let's play dim the void", 'lamp puzzle'],
  nearMisses: ['lights out for the night', 'dim the lights', 'how to dim a monitor', 'turn off the lights', 'play chess', 'lamp shopping'],
  match(lower, text) { return !!dimVoidOf(text); },
  run,
  stageKinds: { 'dim-void': { mount } },
};
