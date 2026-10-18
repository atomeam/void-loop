// pulse — the rhythm of living arrows (asked by Void, 2026-10-16). Every time a thing hands a value along an arrow, skills/label.js
// records that pulse at the moment it is added (not when something polls and happens to look) and says 'void:pulse'. The pulse
// card (skills/pulse.js) draws the live rhythm from this record; when the rhythm turns irregular the incident skill gets a status
// report drafted for it (reportOf, saved by skills/pulse.js into the incident skill's draft). Pure over the list handed in.

export const KEEP = 200, WINDOW_MS = 60000;

/** the list with one more pulse { at, from, to } at the end; the last KEEP kept. Pure. */
export function add(list, at, from = '', to = '') {
  const l = (Array.isArray(list) ? list : []).concat([{ at: +at, from: String(from).slice(0, 40), to: String(to).slice(0, 40) }]);
  return l.length > KEEP ? l.slice(-KEEP) : l;
}
/** the page-wide record, shared by label.js (which adds) and the pulse card (which reads). */
export const record = () => (globalThis.__voidPulses || (globalThis.__voidPulses = []));
/** one pulse recorded now; says 'void:pulse' so a card open on the stage redraws at once. */
export function note(from, to, now = Date.now()) {
  const l = add(record(), now, from, to); globalThis.__voidPulses = l;
  try { if (typeof document !== 'undefined') document.dispatchEvent(new CustomEvent('void:pulse', { detail: { at: now } })); } catch (_) {}
  return l;
}

/** pulses per bucket over the last `buckets` buckets of `size` ms, oldest first. Pure. */
export function bars(list, now, buckets = 12, size = 5000) {
  const out = new Array(buckets).fill(0);
  for (const p of list || []) { const age = now - p.at; if (age < 0 || age >= buckets * size) continue; out[buckets - 1 - Math.floor(age / size)]++; }
  return out;
}
const median = (a) => { const s = a.slice().sort((x, y) => x - y), m = s.length >> 1; return s.length ? (s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2) : 0; };
/** { count, perMin, gaps, median, since } for the last 12 pulses; since is ms since the latest (null when none). Pure. */
export function rhythm(list, now) {
  const L = (list || []).filter((p) => p.at <= now).slice(-12), gaps = [];
  for (let i = 1; i < L.length; i++) gaps.push(L[i].at - L[i - 1].at);
  const recent = (list || []).filter((p) => now - p.at < WINDOW_MS && p.at <= now).length;
  return { count: L.length, perMin: recent, gaps, median: median(gaps), since: L.length ? now - L[L.length - 1].at : null };
}
/** null when steady (or fewer than 5 pulses), else { kind: 'stall'|'burst'|'uneven', why }. Pure. */
export function irregular(list, now) {
  const r = rhythm(list, now);
  if (r.count < 5 || !r.gaps.length || r.median <= 0) return null;
  const usual = Math.max(1, Math.round(r.median / 1000));
  if (r.since > Math.max(4 * r.median, 8000)) return { kind: 'stall', why: 'no pulse for ' + Math.round(r.since / 1000) + ' s, when they usually come every ' + usual + ' s' };
  if (r.gaps.length >= 4 && r.gaps.slice(-3).every((g) => g < r.median / 4)) return { kind: 'burst', why: 'three pulses in a row far closer together than the usual ' + usual + ' s' };
  const longest = Math.max(...r.gaps), shortest = Math.min(...r.gaps);
  if (longest > 5 * r.median && shortest < r.median / 3) return { kind: 'uneven', why: 'gaps from ' + Math.round(shortest / 1000) + ' s to ' + Math.round(longest / 1000) + ' s around a usual ' + usual + ' s' };
  return null;
}
/** the incident draft (the fields skills/incident.js keeps) for an irregular rhythm. Pure. */
export function reportOf(irr, list, now = Date.now()) {
  const iso = (t) => new Date(t - new Date(t).getTimezoneOffset() * 60000).toISOString().slice(0, 16);
  const L = (list || []).slice(-8), r = rhythm(list, now);
  return {
    title: 'Irregular pulse on the stage: ' + irr.kind, status: 'investigating', severity: 'SEV4', started: iso(L.length ? L[0].at : now), detected: iso(now), mitigated: '', resolved: '',
    impact: 'The living arrows on the stage pulsed unevenly: ' + irr.why + '. ' + r.perMin + ' pulse' + (r.perMin === 1 ? '' : 's') + ' in the last minute. Drafted by Verse from its own pulse record.',
    cause: '', timeline: L.map((p, i) => ({ at: iso(p.at), what: 'pulse ' + (i + 1) + ' of the last ' + L.length + (p.from ? ' (' + p.from + ' to ' + p.to + ')' : '') })).concat([{ at: iso(now), what: 'Verse noticed: ' + irr.why }]),
    next: [{ what: 'Check the timer or thing at the start of the arrow', owner: '', due: '' }, { what: 'Decide whether the arrow should be there at all', owner: '', due: '' }],
  };
}
