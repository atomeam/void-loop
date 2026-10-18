/**
 * contradiction-lamp skill - "what contradicts" (asked by the owner, 2026-10-18, stage pack G). Reads the kept things on the stage (their
 * text, name, label, state) and finds pairs that cannot both be true with the plain heuristics of lib/contradict.js: two days or times
 * for the same named event, two numbers for the same labelled quantity, two timers with one label and two durations, a yes and a no on
 * one subject. A soft lamp (a glowing line with a small label of the clash) is drawn between the two things and a card lists each pair in
 * one line with a "dismiss" per pair; "nothing contradicts" when none. Never invents one; nothing appears until asked; nothing leaves
 * the page and nothing is saved (a dismissed pair stays dismissed until the page is reloaded). Not "what contradicts the theory of relativity".
 */
import { contradictions, contradictsAsk, visible } from '../lib/contradict.js';

const dismissed = new Set();
let lamps = null; // { svg, pairs, st, timer }

function center(st, id) {
  const el = st.stage.querySelector('[data-id="' + (typeof CSS !== 'undefined' && CSS.escape ? CSS.escape(String(id)) : String(id)) + '"]');
  if (!el) return null;
  const r = el.getBoundingClientRect(), s = st.stage.getBoundingClientRect();
  return { x: r.left - s.left + r.width / 2, y: r.top - s.top + r.height / 2 };
}
export function clearLamps() {
  if (!lamps) return;
  clearInterval(lamps.timer); if (lamps.svg && lamps.svg.parentNode) lamps.svg.parentNode.removeChild(lamps.svg);
  lamps = null;
}
function paintLamps() {
  if (!lamps) return;
  const { svg, st } = lamps, NS = 'http://www.w3.org/2000/svg';
  while (svg.firstChild) svg.removeChild(svg.firstChild);
  for (const p of lamps.pairs) {
    if (dismissed.has(p.id)) continue;
    const a = center(st, p.a), b = center(st, p.b); if (!a || !b) continue;
    const g = document.createElementNS(NS, 'g'); g.setAttribute('class', 'contra-lamp'); g.setAttribute('data-pair', p.id);
    const line = document.createElementNS(NS, 'line');
    for (const [k, v] of [['x1', a.x], ['y1', a.y], ['x2', b.x], ['y2', b.y], ['stroke', '#ffcf5a'], ['stroke-width', 3], ['stroke-linecap', 'round'], ['opacity', 0.85]]) line.setAttribute(k, v);
    line.style.filter = 'drop-shadow(0 0 6px #ffcf5a)';
    const t = document.createElementNS(NS, 'text'); t.setAttribute('class', 'contra-lamp-label');
    t.setAttribute('x', (a.x + b.x) / 2); t.setAttribute('y', (a.y + b.y) / 2 - 8); t.setAttribute('text-anchor', 'middle');
    t.setAttribute('fill', '#ffcf5a'); t.setAttribute('font-size', '12'); t.textContent = p.label;
    g.append(line, t); svg.appendChild(g);
  }
}
function lightLamps(st, pairs, card) {
  clearLamps();
  const NS = 'http://www.w3.org/2000/svg', svg = document.createElementNS(NS, 'svg');
  svg.setAttribute('class', 'contra-lamps'); svg.setAttribute('aria-hidden', 'true');
  svg.style.cssText = 'position:absolute;left:0;top:0;width:100%;height:100%;pointer-events:none;z-index:50;overflow:visible';
  st.stage.appendChild(svg);
  lamps = { svg, pairs, st, timer: setInterval(() => { if (card && !card.isConnected) clearLamps(); else paintLamps(); }, 400) };
  paintLamps();
}

function run(text, api) {
  const { showPage, esc } = api, st = api.stage;
  const things = Object.values(st.things()).filter((t) => t && t.kind !== 'sudden-death');
  const pairs = contradictions(things);
  let card = null;
  const body = () => {
    const live = visible(pairs, dismissed);
    return live.length
      ? '<ul class="contra-list" style="list-style:none;padding:0;margin:8px 0">' + live.map((p) => '<li class="contra-line" data-pair="' + esc(p.id) + '" style="display:flex;gap:10px;align-items:baseline;justify-content:space-between;margin:6px 0"><span>' + esc(p.line) + '</span><button type="button" class="contra-dismiss" data-pair="' + esc(p.id) + '" style="flex:none">dismiss</button></li>').join('') + '</ul>'
      : '<p class="contra-none">' + (pairs.length ? 'every clash is dismissed' : 'nothing contradicts') + '</p>';
  };
  showPage((el) => {
    card = el;
    el.innerHTML = '<h2>' + esc('Contradiction lamp') + '</h2><div class="contra-body">' + body() + '</div><div class="src">Source: the words and fields of the things on your stage · plain matching on days, times, numbers, labels and yes/no, nothing sent anywhere · it can miss a clash, it does not invent one</div>';
    el.addEventListener('click', (e) => {
      const b = e.target.closest && e.target.closest('.contra-dismiss'); if (!b) return;
      dismissed.add(b.getAttribute('data-pair'));
      el.querySelector('.contra-body').innerHTML = body(); paintLamps();
    });
  });
  if (visible(pairs, dismissed).length) lightLamps(st, pairs, card); else clearLamps();
  api.say(visible(pairs, dismissed).length ? visible(pairs, dismissed).length + ' clash' + (visible(pairs, dismissed).length === 1 ? '' : 'es') + ' on the stage' : 'nothing contradicts');
  return 'contradiction-lamp';
}

export default {
  name: 'contradiction-lamp',
  examples: ['what contradicts', 'which of my notes contradict each other'],
  nearMisses: ['what contradicts the theory of relativity', 'what contradicts darwin', 'contradiction in terms meaning'],
  match(lower, text) { return contradictsAsk(text || lower); },
  run,
  contradictions, clearLamps,
};
