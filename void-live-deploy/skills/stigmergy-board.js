/**
 * stigmergy-board skill - "leave a trail on <topic>" (asked by the owner, 2026-10-18, operating laws for serious thought).
 * Click cells to leave weighted marks. The board assigns nothing: each tick a trail touched in 2+ visits grows and a one-visit
 * trail evaporates; the heat view shows which paths earn attention. Marks and the visit counter are kept in this browser only
 * (localStorage, one board per topic). The law is lib/stigmergy-law.js (pure, tested). No network.
 * Contract: { name, examples, nearMisses, match(lower, text), run(text, api) }
 */
import * as S from '../lib/stigmergy-law.js';

const WHEN = /^leave\s+a\s+(?:stigmergy\s+)?trail\s+(?:on|for|about)\s+\S/i; // "leave a review" and "trail running" are other asks

const keyOf = (t) => 'void-stigmergy:' + String(t).toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 40);
const store = { get: (k) => { try { return localStorage.getItem(k); } catch { return null; } }, set: (k, v) => { try { localStorage.setItem(k, v); } catch { /* private window: the board still works */ } } }; // void-review: ok (storage can be blocked: the board still works)

function run(text, api) {
  const { showPage, esc } = api, topic = String(text).replace(/^\s*leave\s+a\s+(?:stigmergy\s+)?trail\s+\w+\s+/i, '').replace(/[?.!]+$/, '').trim().slice(0, 60), key = keyOf(topic);
  showPage((el) => {
    el.classList.add('stigmergy-board');
    const s = S.newSession(S.load(store.get(key) || '')); // opening the board is a visit
    el.innerHTML = '<h2>Stigmergy board</h2><div class="sb-topic"></div><canvas class="sb-c" width="360" height="240" style="width:100%;max-width:420px;touch-action:manipulation;border-radius:8px" aria-label="trail grid: tap a cell to leave a mark"></canvas><div class="sb-btns"><button type="button" class="g-btn sb-tick">Let time pass</button> <button type="button" class="g-btn sb-visit">New visit</button> <button type="button" class="g-btn sb-view">View: marks</button></div><div class="sb-note" role="status"></div><div class="src">Nothing here assigns work: marks you come back to grow, the rest evaporate. Kept on this device only · as of 2026-10</div>';
    el.querySelector('.sb-topic').textContent = 'Topic: ' + topic;
    const cv = el.querySelector('canvas'), g = cv.getContext && cv.getContext('2d'), note = el.querySelector('.sb-note'); let heatView = false;
    const cw = cv.width / S.W, ch = cv.height / S.H;
    const draw = () => {
      const h = S.heat(s), m = S.metrics(s), hot = S.hottest(s, 3);
      if (g) { g.clearRect(0, 0, cv.width, cv.height); g.fillStyle = 'rgba(128,128,128,.12)'; g.fillRect(0, 0, cv.width, cv.height);
        for (let i = 0; i < s.w.length; i++) { const x = (i % S.W) * cw, y = Math.floor(i / S.W) * ch, v = heatView ? h[i] : Math.min(1, s.w[i] / 4);
          if (v > 0) { g.fillStyle = heatView ? 'hsla(' + Math.round(50 - 50 * v) + ',95%,55%,' + (0.25 + 0.75 * v).toFixed(2) + ')' : 'hsla(205,80%,60%,' + (0.2 + 0.8 * v).toFixed(2) + ')'; g.fillRect(x + 1, y + 1, cw - 2, ch - 2); }
          if (s.visits[i] > 1) { g.fillStyle = 'rgba(255,255,255,.9)'; g.font = '10px sans-serif'; g.fillText(String(s.visits[i]), x + 4, y + 12); } } }
      el.dataset.marks = String(s.w.filter((v) => v > 0).length); el.dataset.reinforced = String(s.visits.filter((v, i) => v >= 2 && s.w[i] > 0).length); el.dataset.session = String(s.session); el.dataset.ticks = String(s.ticks); el.dataset.hot = hot.map((c) => c.x + ',' + c.y).join(';'); el.dataset.view = heatView ? 'heat' : 'marks';
      note.textContent = 'Visit ' + s.session + ' · ' + el.dataset.marks + ' marks · ' + el.dataset.reinforced + ' reinforced (touched in 2+ visits) · ' + (hot.length ? 'earning attention: ' + hot.map((c) => '(' + (c.x + 1) + ',' + (c.y + 1) + ')').join(' ') : 'no trail yet') + ' · ' + Math.round(m.consensus * 100) + '% of trails are returning';
      store.set(key, S.dump(s));
    };
    cv.addEventListener('click', (e) => { const r = cv.getBoundingClientRect(); S.leave(s, Math.floor(((e.clientX - r.left) / (r.width || 1)) * S.W), Math.floor(((e.clientY - r.top) / (r.height || 1)) * S.H), 1); draw(); });
    el.querySelector('.sb-tick').addEventListener('click', () => { S.tick(s); draw(); });
    el.querySelector('.sb-visit').addEventListener('click', () => { S.newSession(s); draw(); });
    el.querySelector('.sb-view').addEventListener('click', (e) => { heatView = !heatView; e.target.textContent = 'View: ' + (heatView ? 'heat' : 'marks'); draw(); });
    draw();
  });
  return 'stigmergy-board';
}

export default {
  name: 'stigmergy-board',
  examples: ['leave a trail on onboarding', 'leave a trail on the launch plan'],
  nearMisses: ['leave a review on a restaurant', 'trail running shoes'],
  match(lower) { return WHEN.test(lower.trim()); },
  run
};
