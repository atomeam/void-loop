/**
 * speed-tests skill - three small tests that run in the page (docs/GAPS.md rows 27, 28 and 29, 2026-11-06: each gave a definition or an article):
 * "reaction time test" (wait for green, click, five tries, the average and the best in ms), "click speed test" (clicks per second over 5 or
 * 10 seconds, "10 second click test"), "aim trainer" (20 targets, hits, misses and the average time to a hit).
 * Times come from performance.now() in this browser. Nothing is kept or sent, and no score is compared with anyone else's.
 * Contract: { name, examples, nearMisses, match(lower, text), run(text, api) }. Tests: tools/gaps-batch2.test.mjs.
 */

/** which test an ask names: { kind: 'reaction' | 'clicks' | 'aim', seconds? } or null. Pure. */
export function testOf(text) {
  const t = String(text || '').trim().toLowerCase().replace(/[?!.]+$/, '').replace(/\s+/g, ' ');
  if (!t || t.length > 60) return null;
  if (/^(?:what|why|how|is|does|do|define|who|average|normal|good)\b|\b(?:meaning|definition|average|study|psychology|medical|dogs?|for kids definition)\b/.test(t)) return null;
  const pre = '^(?:please )?(?:(?:take|do|start|open|play|try|give me|run) )?(?:a |an |the |my )?(?:free |online |quick )?';
  if (new RegExp(pre + '(?:reaction(?: time| speed)?|reflex(?:es)?|reflex time|response time) (?:test|tester|game|check|trainer)$').test(t)) return { kind: 'reaction' };
  let m = t.match(new RegExp(pre + '(?:(5|10|five|ten)[ -]second )?(?:click(?:ing)?(?: speed)?|cps|clicks per second|mouse click) (?:test|tester|counter|game|checker)(?: (?:for |in )?(5|10|five|ten) ?(?:s|secs?|seconds?))?$'));
  if (m) { const w = m[1] || m[2]; return { kind: 'clicks', seconds: w === '5' || w === 'five' ? 5 : 10 }; }
  if (new RegExp(pre + '(?:aim (?:trainer|training|test|practice|game)|mouse (?:accuracy|aim) (?:test|trainer|game)|target practice game)$').test(t)) return { kind: 'aim' };
  return null;
}

/** the average and best of a list of times in ms, rounded: { count, avg, best }. Pure. */
export function summary(times) {
  const xs = (times || []).filter((x) => Number.isFinite(x) && x >= 0);
  if (!xs.length) return { count: 0, avg: 0, best: 0 };
  return { count: xs.length, avg: Math.round(xs.reduce((a, b) => a + b, 0) / xs.length), best: Math.round(Math.min(...xs)) };
}

/** clicks per second, to two places. Pure. */
export function cps(clicks, ms) { return ms > 0 ? Math.round((clicks / (ms / 1000)) * 100) / 100 : 0; }

/** hits, misses, accuracy in whole percent and the average ms to a hit. Pure. */
export function aimSummary(hitTimes, misses) {
  const s = summary(hitTimes), all = s.count + (misses || 0);
  return { hits: s.count, misses: misses || 0, accuracy: all ? Math.round((s.count / all) * 100) : 0, avg: s.avg };
}

const BTN = 'padding:6px 14px;border-radius:999px;border:1px solid rgba(255,255,255,.28);background:transparent;color:#e8e8e8;cursor:pointer;font:14px system-ui';
const now = () => (typeof performance !== 'undefined' && performance.now ? performance.now() : Date.now());
const NOTE = '<div class="src">Timed in your browser · nothing is kept or sent</div>';

function reaction(api) {
  const { showPage } = api, TRIES = 5;
  const el = showPage((p) => {
    p.innerHTML = '<h2>Reaction time test</h2><div class="rt-box" role="button" tabindex="0" aria-live="polite" style="height:220px;border-radius:14px;display:flex;align-items:center;justify-content:center;text-align:center;font-size:22px;cursor:pointer;user-select:none;background:#2b2b44;padding:12px">Click here to start</div>'
      + '<p class="rt-out" aria-live="polite" style="font-size:18px;margin:10px 0"></p><p style="color:#8a8a8a">Wait for green, then click as fast as you can. Five tries. Your screen, mouse and browser add some delay of their own.</p>' + NOTE;
  });
  const box = el && el.querySelector && el.querySelector('.rt-box'), out = el && el.querySelector && el.querySelector('.rt-out');
  if (!box) return 'speed-tests';
  let state = 'idle', t0 = 0, wait = null; const times = [];
  const set = (bg, text) => { box.style.background = bg; box.textContent = text; };
  const arm = () => { state = 'wait'; set('#7a2330', 'Wait for green…'); wait = setTimeout(() => { if (api._pageStill && !api._pageStill(el)) return; state = 'go'; t0 = now(); set('#1f7a3a', 'Click!'); }, 1500 + Math.random() * 2500); };
  const hit = () => {
    if (state === 'idle' || state === 'done') { if (state === 'done') times.length = 0; if (out) out.textContent = ''; arm(); return; }
    if (state === 'wait') { clearTimeout(wait); state = 'idle'; set('#2b2b44', 'Too soon. Click to try again'); return; }
    if (state === 'go') {
      times.push(now() - t0); const s = summary(times);
      if (out) out.textContent = times.map((x) => Math.round(x) + ' ms').join(' · ');
      if (times.length >= TRIES) { state = 'done'; set('#2b2b44', 'Average ' + s.avg + ' ms · best ' + s.best + ' ms. Click to go again'); }
      else { state = 'idle'; set('#2b2b44', Math.round(times[times.length - 1]) + ' ms. Click for try ' + (times.length + 1) + ' of ' + TRIES); }
    }
  };
  box.addEventListener('pointerdown', (e) => { e.preventDefault(); hit(); });
  box.addEventListener('keydown', (e) => { if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); hit(); } });
  return 'speed-tests';
}

function clicks(api, seconds) {
  const { showPage } = api;
  const el = showPage((p) => {
    p.innerHTML = '<h2>Click speed test</h2><div role="group" aria-label="Length" style="display:flex;gap:6px;margin:8px 0">' // void-review: ok, the values are the numbers 5 and 10 and a boolean, never text from a user
      + [5, 10].map((n) => '<button type="button" class="cs-len" data-s="' + n + '" aria-pressed="' + (n === seconds) + '" style="' + BTN + '">' + n + ' seconds</button>').join('') + '</div>'
      + '<button type="button" class="cs-pad" style="display:block;width:100%;height:200px;border-radius:14px;border:0;background:#2b2b44;color:#e8e8e8;font-size:22px;cursor:pointer;user-select:none">Click here to start</button>'
      + '<p class="cs-out" aria-live="polite" style="font-size:18px;margin:10px 0"></p>' + NOTE;
  });
  const $ = (c) => el && el.querySelector && el.querySelector(c), pad = $('.cs-pad'), out = $('.cs-out');
  if (!pad) return 'speed-tests';
  let len = seconds, n = 0, t0 = 0, timer = null, done = false;
  const reset = () => { clearInterval(timer); timer = null; n = 0; t0 = 0; done = false; pad.textContent = 'Click here to start'; if (out) out.textContent = ''; };
  const finish = () => { clearInterval(timer); timer = null; done = true; pad.textContent = n + ' clicks · ' + cps(n, len * 1000) + ' per second'; if (out) out.textContent = 'Wait a moment, then click to go again.'; setTimeout(() => { if (done) done = 'ready'; }, 800); };
  pad.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    if (done === true) return; // a click right after the end does not start the next round
    if (done === 'ready') reset();
    if (!t0) { t0 = now(); timer = setInterval(() => { if (api._pageStill && !api._pageStill(el)) { clearInterval(timer); return; } const ms = now() - t0; if (ms >= len * 1000) finish(); else if (out) out.textContent = ((len * 1000 - ms) / 1000).toFixed(1) + ' s left'; }, 100); }
    n++; if (!done) pad.textContent = String(n);
  });
  if (el && el.querySelectorAll) for (const b of el.querySelectorAll('.cs-len')) b.addEventListener('click', () => { len = +b.dataset.s; for (const o of el.querySelectorAll('.cs-len')) o.setAttribute('aria-pressed', String(o === b)); reset(); });
  return 'speed-tests';
}

function aim(api) {
  const { showPage } = api, TARGETS = 20;
  const el = showPage((p) => {
    p.innerHTML = '<h2>Aim trainer</h2><div class="am-area" style="position:relative;height:280px;border-radius:14px;background:#1d1d2e;overflow:hidden;cursor:crosshair;user-select:none">'
      + '<button type="button" class="am-start" style="position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);' + BTN + '">Start: 20 targets</button></div>'
      + '<p class="am-out" aria-live="polite" style="font-size:18px;margin:10px 0"></p><p style="color:#8a8a8a">Click each target as it appears. A click on the empty area counts as a miss.</p>' + NOTE;
  });
  const $ = (c) => el && el.querySelector && el.querySelector(c), area = $('.am-area'), out = $('.am-out'), startB = $('.am-start');
  if (!area || !startB) return 'speed-tests';
  let left = 0, misses = 0, t0 = 0, dot = null; const hits = [];
  const place = () => {
    if (dot) dot.remove();
    if (!left) { const s = aimSummary(hits, misses); if (out) out.textContent = s.hits + ' hits · ' + s.misses + ' misses · ' + s.accuracy + '% accuracy · ' + s.avg + ' ms a hit on average'; area.appendChild(startB); startB.textContent = 'Go again'; return; }
    const w = area.clientWidth || 300, h = area.clientHeight || 280, r = 18;
    dot = document.createElement('button'); dot.type = 'button'; dot.className = 'am-dot'; dot.setAttribute('aria-label', 'target');
    dot.style.cssText = 'position:absolute;width:' + 2 * r + 'px;height:' + 2 * r + 'px;border-radius:50%;border:3px solid #fff;background:#e0465a;padding:0;cursor:crosshair;left:' + Math.round(Math.random() * (w - 2 * r)) + 'px;top:' + Math.round(Math.random() * (h - 2 * r)) + 'px';
    dot.addEventListener('pointerdown', (e) => { e.preventDefault(); e.stopPropagation(); hits.push(now() - t0); left--; t0 = now(); place(); });
    area.appendChild(dot); if (out) out.textContent = left + ' left';
  };
  area.addEventListener('pointerdown', (e) => { if (left && e.target === area) { misses++; } });
  startB.addEventListener('click', (e) => { e.stopPropagation(); startB.remove(); hits.length = 0; misses = 0; left = TARGETS; t0 = now(); place(); });
  return 'speed-tests';
}

function run(text, api) {
  const q = testOf(text);
  if (!q) return 'none';
  return q.kind === 'reaction' ? reaction(api) : q.kind === 'clicks' ? clicks(api, q.seconds) : aim(api);
}

export default {
  name: 'speed-tests',
  examples: ['reaction time test', 'reaction test', 'click speed test', 'cps test', '10 second click test', 'aim trainer', 'aim test'],
  nearMisses: ['what is a good reaction time', 'average reaction time', 'reaction time definition', 'how fast can I click', 'aim of the study', 'click test for dogs'],
  match(lower, text) { return !!testOf(text || lower); },
  run,
};
