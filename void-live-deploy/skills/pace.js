/**
 * pace skill — running pace from distance and time (no key; pure math)
 * Contract: { name, examples, nearMisses, match(lower, text), run(text, api) }
 * "pace for 5k in 25 minutes", "what pace for a marathon in 4 hours",
 * "running pace 10 miles in 80 minutes".
 * Shows pace per mile and per km. Empty stage stays empty.
 */
function num(s) {
  if (s == null) return NaN;
  return parseFloat(String(s).replace(/,/g, ''));
}

function qty(n, unit) {
  return (Math.round(n * 100) / 100).toLocaleString(undefined, { maximumFractionDigits: 2 }) + ' ' + unit;
}

function paceOf(text) {
  const raw = String(text || '').trim().replace(/[?!.]+$/, '').replace(/\s+/g, ' ');
  const t = raw.toLowerCase();
  if (!/\b(pace|running|run|marathon|5k|10k|half)\b/.test(t)) return null;
  if (/\b(heart\s+rate|heart\s+zone|calories|fuel|tip|what\s+is\s+pace|gas)\b/.test(t)) return null;

  let dist = NaN, distUnit = null;
  if (/\b5k\b/.test(t)) { dist = 5; distUnit = 'km'; }
  else if (/\b10k\b/.test(t)) { dist = 10; distUnit = 'km'; }
  else if (/\bhalf\s*marathon\b/.test(t)) { dist = 21.0975; distUnit = 'km'; }
  else if (/\bmarathon\b/.test(t)) { dist = 42.195; distUnit = 'km'; }
  else {
    const m = t.match(/(\d+(?:\.\d+)?)\s*(k|km|kilometers?|miles?|mi)\b/);
    if (m) {
      dist = num(m[1]);
      distUnit = /^mi/.test(m[2]) ? 'mi' : 'km';
    }
  }
  if (!Number.isFinite(dist) || dist <= 0 || dist > 200) return null;

  let mins = NaN;
  let m = t.match(/(\d+):(\d{1,2})(?::(\d{1,2}))?/);
  if (m) {
    const h = num(m[1]), mn = num(m[2]), s = m[3] ? num(m[3]) : 0;
    mins = h * 60 + mn + s / 60;
  } else {
    m = t.match(/(\d+(?:\.\d+)?)\s*(?:hours?|hrs?|h)\s*(?:and\s+)?(\d+(?:\.\d+)?)?\s*(?:minutes?|mins?|m)?/);
    if (m && m[2]) mins = num(m[1]) * 60 + num(m[2]);
    else {
      m = t.match(/(\d+(?:\.\d+)?)\s*(?:minutes?|mins?|m)\b/);
      if (m) mins = num(m[1]);
      else {
        m = t.match(/(\d+(?:\.\d+)?)\s*(?:hours?|hrs?|h)\b/);
        if (m) mins = num(m[1]) * 60;
      }
    }
  }
  if (!Number.isFinite(mins) || mins <= 0 || mins > 24 * 60) return null;

  return { dist, distUnit, mins, raw };
}

function compute(q) {
  const miles = q.distUnit === 'km' ? q.dist * 0.621371 : q.dist;
  const km = q.distUnit === 'mi' ? q.dist * 1.609344 : q.dist;
  const paceMi = q.mins / miles;
  const paceKm = q.mins / km;
  const fmt = (p) => {
    const m = Math.floor(p), s = Math.round((p - m) * 60);
    return m + ':' + String(s).padStart(2, '0');
  };
  return { miles, km, paceMi: fmt(paceMi), paceKm: fmt(paceKm), total: q.mins };
}

async function run(text, api) {
  const { showPage, esc } = api;
  const q = paceOf(text);
  if (!q) return 'none';
  const r = compute(q);
  if (!r) return 'none';
  const distLabel = q.distUnit === 'km' ? 'km' : (q.dist === 1 ? 'mile' : 'miles');
  showPage((el) => {
    el.innerHTML = '<h2>Running pace</h2>'
      + '<div class="sub">' + esc(String(Math.round(q.dist * 100) / 100)) + ' ' + esc(distLabel)
      + ' in ' + esc(String(Math.round(q.mins))) + ' min</div>'
      + '<div style="font-size:48px;font-weight:300;line-height:1.15;margin:6px 0 4px">'
      + esc(r.paceMi) + '<span style="font-size:18px;color:#8a8a8a"> / mile</span></div>'
      + '<ul>'
      + '<li><b>Per km</b> ' + esc(r.paceKm) + '</li>'
      + '<li><b>Distance</b> ' + esc(qty(r.miles, 'mi')) + ' · ' + esc(qty(r.km, 'km')) + '</li>'
      + '</ul>'
      + '<p style="color:#8a8a8a">Pace from the distance and time you gave. Real runs vary with hills, weather, and how you feel.</p>'
      + '<div class="src">Formula: pace = total minutes ÷ distance · as of Oct 2026</div>';
  });
  return 'pace';
}

export default {
  name: 'pace',
  examples: [
    'pace for 5k in 25 minutes',
    'what pace for a marathon in 4 hours',
    'running pace 10 miles in 80 minutes',
    'pace for half marathon in 1:45',
    '5 miles in 40 minutes pace'
  ],
  nearMisses: [
    'heart rate for a 35 year old',
    'what is pace',
    'fuel cost for 320 miles',
    '20% tip on 45',
    'weather in Tokyo'
  ],
  match(lower, text) { return !!paceOf(text); },
  run
};
