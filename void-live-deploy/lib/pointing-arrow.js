// The pointing arrow (Posner cueing, 1980): the lab page void-live-deploy/fringe/attention-7.html and the core skill
// skills/pointing-arrow.js share this maths. 80% of trials the arrow points at the star, 20% it lies; the cost of a
// sitting is the median correct time after a lying arrow minus the median after a true one. The lab page keeps its own
// copy so its self-test on main still runs inside the frame; this module is the one the skill and its unit test call.
export const TRIALS = 40;
export const VALID = 0.8;

export function shuffle(a) {
  const b = a.slice();
  for (let i = b.length - 1; i > 0; i--) { const k = Math.floor(Math.random() * (i + 1)); const t = b[i]; b[i] = b[k]; b[k] = t; }
  return b;
}

/** one sitting's trials: sides balanced, VALID of them cued truly, the rest lying. Pure apart from the shuffle. */
export function plan(n = TRIALS) {
  const t = [], valid = Math.round(n * VALID);
  for (let i = 0; i < n; i++) { const side = i % 2 ? 'R' : 'L'; const v = i < valid; t.push({ side, cue: v ? side : (side === 'L' ? 'R' : 'L'), valid: v }); }
  return shuffle(t);
}

export function median(a) {
  if (!a.length) return null;
  const s = a.slice().sort((x, y) => x - y), m = s.length >> 1;
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

/** one sitting from finished trials: medians on correct answers only, cost = lying minus true, error share. Pure. */
export function sitting(trials) {
  const v = [], iv = []; let wrong = 0;
  for (const t of trials || []) { if (!t.correct) { wrong++; continue; } (t.valid ? v : iv).push(t.ms); }
  const mv = median(v), mi = median(iv);
  return { valid: mv, invalid: mi, cost: mv != null && mi != null ? mi - mv : null, errors: (trials || []).length ? wrong / trials.length : 0 };
}

/** cost by part of day: night 0-6, morning 6-12, afternoon 12-18, evening 18-24. Pure. */
export function byPart(ss) {
  const parts = [['night', 0, 6], ['morning', 6, 12], ['afternoon', 12, 18], ['evening', 18, 24]];
  return parts.map((p) => { const xs = (ss || []).filter((s) => s.hour >= p[1] && s.hour < p[2]).map((s) => s.cost); return { part: p[0], n: xs.length, cost: median(xs) }; });
}

/** the lab page's own cases. true when they hold, else a short reason. Pure. */
export function selftest() {
  const p = plan(40);
  if (p.filter((t) => t.valid).length !== 32) return 'plan should be 80% valid';
  if (p.some((t) => t.valid !== (t.cue === t.side))) return 'a valid cue must point at the star';
  if (p.filter((t) => t.side === 'L').length !== 20) return 'sides should be balanced';
  const tr = [{ valid: true, correct: true, ms: 300 }, { valid: true, correct: true, ms: 320 }, { valid: false, correct: true, ms: 360 }, { valid: false, correct: true, ms: 380 }, { valid: true, correct: false, ms: 200 }];
  const s = sitting(tr);
  if (s.valid !== 310 || s.invalid !== 370 || s.cost !== 60 || Math.abs(s.errors - 0.2) > 1e-12) return 'sitting gave ' + JSON.stringify(s);
  const b = byPart([{ hour: 8, cost: 40 }, { hour: 9, cost: 60 }, { hour: 20, cost: 90 }]);
  if (b[1].n !== 2 || b[1].cost !== 50 || b[3].cost !== 90 || b[0].n !== 0) return 'byPart gave ' + JSON.stringify(b);
  return true;
}
