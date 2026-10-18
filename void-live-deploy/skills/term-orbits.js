/**
 * term-orbits skill - "watch my words drift" (asked by the owner, 2026-10-18, operating laws for serious thought).
 * Paste your text: its important terms become nodes in orbit. Overused terms pull toward each other and, closer than a threshold,
 * collapse into one visible mush node; rare precise terms keep their orbit. You act with forces (push apart, tap a node to anchor
 * it), never by editing the words. The law is lib/term-orbits-law.js (pure, tested). Runs in the page; nothing is sent or stored.
 * Contract: { name, examples, nearMisses, match(lower, text), run(text, api) }
 */
import * as T from '../lib/term-orbits-law.js';

const WHEN = /^watch\s+(?:my|the|our)\s+(?:words|terms|vocabulary|language)\s+(?:drift|collapse|orbit)\b/i; // "watch the news" is another ask
const SAMPLE = 'clarity clarity clarity clarity clarity clarity synergy synergy synergy synergy synergy synergy alignment alignment alignment alignment alignment alignment quartz nebula lantern harbor meadow';

function run(text, api) {
  const { showPage } = api;
  showPage((el) => {
    el.classList.add('term-orbits');
    el.innerHTML = '<h2>Term orbits</h2><textarea class="to-text" rows="3" style="width:100%;max-width:420px" aria-label="your text: its important terms become nodes" placeholder="paste what you wrote"></textarea><canvas class="to-c" width="360" height="300" style="width:100%;max-width:420px;border-radius:8px;touch-action:manipulation" aria-label="terms in orbit: tap a node to anchor it"></canvas><div class="to-btns"><button type="button" class="g-btn to-go">Watch</button> <button type="button" class="g-btn to-push">Push apart</button></div><div class="to-note" role="status"></div><div class="src">Overuse pulls terms together until they merge; rare use keeps them in orbit. You push or anchor, you never edit. Local only · as of 2026-10</div>';
    const ta = el.querySelector('textarea'), cv = el.querySelector('canvas'), g = cv.getContext && cv.getContext('2d'), note = el.querySelector('.to-note'); ta.value = SAMPLE;
    let s = T.create(ta.value, 1), raf = 0, last = 0;
    const draw = () => {
      const m = T.metrics(s);
      if (g) { g.clearRect(0, 0, cv.width, cv.height); g.strokeStyle = 'rgba(128,128,128,.3)'; g.beginPath(); g.arc(cv.width / 2, cv.height / 2, T.ORBIT_R * cv.width, 0, 7); g.stroke();
        for (const n of s.nodes) { const x = n.x * cv.width, y = n.y * cv.height, r = 4 + Math.min(14, n.uses * 1.4); g.fillStyle = n.mush ? 'hsla(20,15%,45%,.85)' : 'hsla(' + (200 + (n.uses % 6) * 25) + ',80%,60%,.9)'; g.beginPath(); g.arc(x, y, r, 0, 7); g.fill(); if (n.anchored) { g.strokeStyle = '#fff'; g.lineWidth = 2; g.stroke(); g.lineWidth = 1; } g.fillStyle = '#fff'; g.font = '11px sans-serif'; g.fillText(n.name + ' ×' + n.uses, x + r + 2, y + 3); } }
      el.dataset.terms = String(s.nodes.length); el.dataset.merges = String(s.merges.length); el.dataset.mush = String(s.nodes.filter((n) => n.mush).length); el.dataset.anchored = String(s.nodes.filter((n) => n.anchored).length);
      note.textContent = s.nodes.length + ' terms · ' + s.merges.length + ' collapsed' + (s.merges.length ? ' (' + s.merges.slice(-2).map((p) => p.join(' + ')).join(', ') + ')' : '') + ' · ' + Math.round(m.activity * 100) + '% motion';
    };
    const loop = (t) => { raf = 0; if (!el.isConnected) return; const dt = Math.min(0.05, last ? (t - last) / 1000 : 0.016); last = t; if (!document.hidden) { for (let i = 0; i < 3; i++) T.step(s, dt / 3); draw(); } raf = requestAnimationFrame(loop); };
    const go = () => { s = T.create(ta.value, 1); draw(); if (!raf) raf = requestAnimationFrame(loop); };
    el.querySelector('.to-go').addEventListener('click', go);
    el.querySelector('.to-push').addEventListener('click', () => { T.pushApart(s, 0.2, 0.4); draw(); });
    cv.addEventListener('click', (e) => { const r = cv.getBoundingClientRect(), n = T.nodeAt(s, (e.clientX - r.left) / (r.width || 1), (e.clientY - r.top) / (r.height || 1), 0.08); if (n) { T.toggleAnchor(s, n.name); draw(); } });
    const reduced = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduced) { draw(); } else go();
    if (reduced) el.querySelector('.to-go').addEventListener('click', () => { for (let i = 0; i < 600; i++) T.step(s, 1 / 60); draw(); });
  });
  return 'term-orbits';
}

export default {
  name: 'term-orbits',
  examples: ['watch my words drift', 'watch my terms drift apart'],
  nearMisses: ['watch the news', 'words that rhyme with orange'],
  match(lower) { return WHEN.test(lower.trim()); },
  run
};
