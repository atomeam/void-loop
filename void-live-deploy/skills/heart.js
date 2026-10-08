/**
 * heart skill - target heart rate and training zones, worked out for you (no key; pure math)
 * Contract: { name, examples, nearMisses, match(lower, text), run(text, api) }
 * "what is my target heart rate", "heart rate zones for a 40 year old", "max heart rate for a 55 year old",
 * "fat burning heart rate for a 35 year old", "what is zone 2 heart rate", "heart rate zones age 40 resting heart rate 60",
 * "is a resting heart rate of 55 good", "what is a normal resting heart rate", "heart rate zone calculator".
 * Max heart rate: 220 - age (the American Heart Association's chart) beside Tanaka's 208 - 0.7 x age (JACC 2001, 351 studies,
 * 18,712 people), or a measured max when you give one. Target 50-85% of max (AHA: moderate 50-70%, vigorous 70-85%),
 * five training zones (50-60-70-80-90-100%), and with a resting rate the heart-rate-reserve method (Karvonen 1957):
 * rest + (max - rest) x %. Resting rate: AHA's 60-100 bpm normal, 40-60 common in trained athletes.
 * Built on nutrition.js: with no age in the ask it uses the age from the last calories / protein card (page memory),
 * and it shares the age it learns back, so "and calories" after a heart card knows you.
 */
import { statsOf, lastStatsOf, shareBody, clean } from './nutrition.js';

const ZONES = [
  { n: 1, lo: 0.5, hi: 0.6, name: 'very light', what: 'warm-up, cool-down and recovery days' },
  { n: 2, lo: 0.6, hi: 0.7, name: 'light', what: 'easy endurance you can keep up for hours, talking in full sentences (the "fat-burning" zone)' },
  { n: 3, lo: 0.7, hi: 0.8, name: 'moderate', what: 'steady aerobic work, talking in short sentences' },
  { n: 4, lo: 0.8, hi: 0.9, name: 'hard', what: 'threshold pace, a few words at a time' },
  { n: 5, lo: 0.9, hi: 1.0, name: 'maximum', what: 'all-out efforts of seconds to a couple of minutes' }
];
const SRC = '<div class="src">Sources: <a href="https://www.heart.org/en/healthy-living/fitness/fitness-basics/target-heart-rates" target="_blank" rel="noopener">American Heart Association, Target Heart Rates</a> \u00b7 <a href="https://pubmed.ncbi.nlm.nih.gov/11153730/" target="_blank" rel="noopener">Tanaka 2001, JACC</a> \u00b7 heart rate reserve: Karvonen 1957 \u00b7 not medical advice</div>';
const BIG = '<div style="font-size:48px;font-weight:300;line-height:1.15;margin:6px 0 4px">';
const GREY = '<p style="color:#8a8a8a">';
const HR = '(?:heart[\\s-]?rate|hr|pulse|bpm)';
const NOT = /\b(?:monitor|monitors|watch(?:es)?|apple|fitbit|garmin|strap|app|apps|translate|spanish|french|meaning|define|definition|attack|disease|failure|murmur|transplant|song|lyrics|movie|baby|fetal|fetus|dog|dogs|cat|cats|horse|variability|hrv|blood\s+pressure)\b/;
const FOLLOW_MS = 30 * 60 * 1000;
let last = null; // { q, at }

function ageOf(t) {
  const s = statsOf(t);
  if (s.age) return s.age;
  const m = t.match(/\b(?:at|for|age(?:d)?)\s+(?:age\s+)?(?:a\s+)?(1[3-9]|[2-9]\d)\b(?!\s*(?:bpm|beats|%|percent|min|minutes|seconds|miles|km))/);
  return m ? +m[1] : null;
}
function restOf(t) {
  let m = t.match(/\bresting(?:\s+(?:heart[\s-]?rate|hr|pulse))?(?:\s+(?:is|of|at|was|=|:|around|about))*\s*(\d{2,3})\b/)
    || t.match(/\b(?:rhr|resting\s+bpm)\s*(?:is|of|=|:)?\s*(\d{2,3})\b/)
    || t.match(/\b(\d{2,3})\s*(?:bpm\s+)?(?:a\s+good\s+|a\s+normal\s+|a\s+healthy\s+|a\s+bad\s+|a\s+high\s+|a\s+low\s+)?resting\b/)
    || t.match(/\bresting\s+(?:heart\s+rate\s+)?(?:(?:is|of)\s+)?(?:about\s+|around\s+)?(\d{2,3})\b/);
  const v = m ? +m[1] : null;
  return v && v >= 25 && v <= 150 ? v : null;
}
function maxGiven(t) {
  const m = t.match(/\b(?:my\s+)?(?:measured\s+|tested\s+|real\s+|actual\s+)?max(?:imum)?\s+(?:heart[\s-]?rate|hr)\s+(?:is|was|of|=|:)\s*(\d{3})\b/);
  const v = m ? +m[1] : null;
  return v && v >= 120 && v <= 230 ? v : null;
}
function zoneOf(t) {
  let m = t.match(/\bzone\s*([1-5]|one|two|three|four|five)\b/);
  if (m) return { one: 1, two: 2, three: 3, four: 4, five: 5 }[m[1]] || +m[1];
  if (/\bfat[\s-]?burn(?:ing)?\b/.test(t)) return 2;
  if (/\b(?:cardio|aerobic)\s+(?:heart\s+rate|zone|range)\b/.test(t)) return 3;
  return null;
}

function askOf(text) {
  const t = clean(text);
  if (!t || t.length > 160 || NOT.test(t)) return null;
  if (/^(?:a\s+|open\s+(?:a\s+|the\s+)?|show\s+(?:me\s+)?(?:a\s+|the\s+)?)?(?:target\s+|max(?:imum)?\s+)?(?:heart[\s-]?rate|hr)(?:\s+(?:zones?|training\s+zones?|zone|range))?\s+calculator$/.test(t)) return { form: true };
  const age = ageOf(t), rest = restOf(t), max = maxGiven(t), zone = zoneOf(t);
  const hr = new RegExp('\\b' + HR + '\\b').test(t);
  // resting heart rate: what is normal, is mine good
  if (/\bresting\b/.test(t) && hr && !/\b(?:zones?|target|max(?:imum)?|training)\b/.test(t)
    && (/^(?:what(?:'s|\s+is)\s+(?:a\s+)?(?:normal|good|healthy|average|ideal|the\s+normal)|(?:normal|good|healthy|average|ideal)\s+resting)\b/.test(t)
      || /^is\s+(?:a\s+|my\s+)?(?:resting\s+(?:heart\s+rate|hr|pulse)\s+(?:of\s+)?)?\d{2,3}\s*(?:bpm\s+)?(?:a\s+)?(?:good|normal|healthy|bad|high|low|too\s+(?:high|low)|ok|okay|fine|dangerous)\b/.test(t)
      || /^my\s+resting\s+(?:heart[\s-]?rate|hr|pulse)\s+is\s+\d{2,3}/.test(t)
      || /^resting\s+(?:heart[\s-]?rate|hr|pulse)\s+(?:for|by|chart|of)\b/.test(t)))
    return { kind: rest || age ? (age || (lastStatsOf() || {}).s?.age ? 'zones' : 'rest') : 'rest', age, rest, max, zone, t };
  // target / max / zones
  if (hr && (/\b(?:target|max(?:imum)?|peak|fat[\s-]?burn(?:ing)?|cardio|aerobic|training|exercise|workout|ideal)\s+(?:heart[\s-]?rate|hr|pulse)\b/.test(t)
      || /\b(?:heart[\s-]?rate|hr)\s+(?:zones?|training\s+zones?|range|chart|target)\b/.test(t)
      || new RegExp('\\bzone\\s*(?:[1-5]|one|two|three|four|five)\\s+' + HR + '\\b').test(t)
      || new RegExp('\\b' + HR + '\\s+(?:for|at)\\s+(?:zone\\s*(?:[1-5]|one|two|three|four|five)|fat\\s+burn(?:ing)?|cardio)\\b').test(t)
      || /^(?:what\s+(?:should|does)\s+my\s+heart\s+rate\s+be\s+(?:when|while|during)\s+(?:i\s+)?(?:exercise|exercising|working\s+out|work\s+out|running|run|jogging|cycling|walking))/.test(t))
    && !/\b(?:lower|raise|increase|decrease|reduce|why\s+is|causes?|symptoms?)\b/.test(t))
    return { kind: 'zones', age, rest, max, zone, t };
  // "what is zone 2", "zone 2 training" (no heart rate words)
  if (/^(?:what(?:'s|\s+is)\s+)?(?:my\s+)?zone\s*(?:[1-5]|two)(?:\s+(?:training|cardio|range|for\s+(?:a\s+)?(?:1[3-9]|[2-9]\d)\s*(?:year\s+old)?))?$/.test(t)) return { kind: 'zones', age, rest, max, zone, t };
  return null;
}

// after a heart card: "my resting heart rate is 55", "resting 60", "i'm 50", "what about zone 4", "fat burning"
function followOf(text) {
  if (!last || Date.now() - last.at > FOLLOW_MS) return null;
  const mem = lastStatsOf();
  if (mem && mem.owner !== 'heart') return null; // a calories card spoke last; its follow-ups win
  const t = clean(text).replace(/[,.;:]+/g, ' ').replace(/\s+/g, ' ').trim();
  if (!t || t.length > 80) return null;
  const q = Object.assign({}, last.q, { form: false, kind: 'zones' });
  const L = '^(?:(?:and|now|ok|okay|so|but)\\s+)?(?:(?:what|how)\\s+about\\s+|what\\s+if\\s+|with\\s+|at\\s+|for\\s+|use\\s+|show\\s+(?:me\\s+)?)?';
  let m;
  if ((m = t.match(new RegExp(L + "(?:(?:my\\s+|a\\s+)?resting\\s+(?:heart[\\s-]?rate\\s+|hr\\s+|pulse\\s+)?(?:is\\s+|of\\s+|was\\s+)?(?:about\\s+|around\\s+)?(\\d{2,3})(?:\\s*bpm)?|(\\d{2,3})\\s*(?:bpm\\s+)?resting(?:\\s+(?:heart[\\s-]?rate|hr|pulse))?)$")))) {
    const v = +(m[1] || m[2]); if (v < 25 || v > 150) return null; q.rest = v; return q;
  }
  if ((m = t.match(new RegExp(L + "(?:(?:my\\s+)?(?:measured\\s+|real\\s+|actual\\s+)?max(?:imum)?(?:\\s+(?:heart[\\s-]?rate|hr))?\\s+(?:is\\s+|of\\s+|was\\s+)?(\\d{3}))$")))) { q.max = +m[1]; return q; }
  if ((m = t.match(new RegExp(L + "(?:i'?m\\s+|i\\s+am\\s+|im\\s+|age\\s+|a\\s+)?(1[3-9]|[2-9]\\d)(?:\\s*(?:-\\s*)?(?:years?|yrs?)(?:\\s*-?\\s*old)?)?(?:\\s+instead)?$")))) { q.age = +m[1]; q.ageFrom = null; return q; }
  if ((m = t.match(new RegExp(L + '(?:zone\\s*([1-5]|one|two|three|four|five)|(fat[\\s-]?burn(?:ing)?|cardio|aerobic))(?:\\s+(?:zone|heart\\s+rate|then|instead))?$')))) { q.zone = zoneOf(m[0]); return q; }
  if (/^(?:(?:and|now|ok|so)\s+)?(?:use\s+)?(?:220\s*-\s*age|tanaka|the\s+other\s+formula)$/.test(t)) return q;
  return null;
}

function band(max, rest, lo, hi) {
  const f = (p) => Math.round(rest ? rest + (max - rest) * p : max * p);
  return [f(lo), f(hi)];
}
function zonesHtml(q, esc) {
  const age = q.age, tanaka = age ? Math.round(208 - 0.7 * age) : null;
  const max = q.max || (220 - age), rest = q.rest;
  const target = band(max, rest, 0.5, 0.85), mod = band(max, rest, 0.5, 0.7), vig = band(max, rest, 0.7, 0.85);
  const how = q.max ? 'your measured max ' + max + ' bpm' : 'max ' + max + ' bpm (220 \u2212 age)';
  const sub = 'age ' + age + (q.ageFrom ? ' (' + q.ageFrom + ')' : '') + ' \u00b7 ' + how + (rest ? ' \u00b7 resting ' + rest + ' bpm, by heart rate reserve' : '');
  const pick = q.zone ? ZONES[q.zone - 1] : null, pb = pick ? band(max, rest, pick.lo, pick.hi) : null;
  const head = pick ? pb[0] + '\u2013' + pb[1] : target[0] + '\u2013' + target[1];
  const headSub = pick ? 'zone ' + pick.n + ' (' + pick.name + ', ' + Math.round(pick.lo * 100) + '\u2013' + Math.round(pick.hi * 100) + '%' + (rest ? ' of reserve' : ' of max') + '): ' + pick.what
    : 'target heart rate while exercising (50\u201385%' + (rest ? ' of your heart rate reserve' : ' of max') + ') \u00b7 moderate ' + mod[0] + '\u2013' + mod[1] + ' \u00b7 vigorous ' + vig[0] + '\u2013' + vig[1];
  const rows = ZONES.map((z) => { const b = band(max, rest, z.lo, z.hi), on = pick && pick.n === z.n;
    return '<li>' + (on ? '<b>' : '') + 'Zone ' + z.n + ' \u00b7 ' + esc(z.name) + ' (' + Math.round(z.lo * 100) + '\u2013' + Math.round(z.hi * 100) + '%): ' + b[0] + '\u2013' + b[1] + ' bpm' + (on ? '</b>' : '') + ' <span style="color:#8a8a8a">' + esc(z.what) + '</span></li>'; }).join('');
  const restNote = rest ? restVerdict(rest) + ' ' : '';
  const alt = q.max ? '' : 'Tanaka\'s formula (208 \u2212 0.7 \u00d7 age), which fit 18,712 people better than 220 \u2212 age, puts your max at ' + tanaka + ' bpm' + (Math.abs(tanaka - max) >= 2 ? ', so ' + (tanaka > max ? 'your zones may sit a few beats higher' : 'your zones may sit a few beats lower') : '') + '. Either formula can be off by 10 or more beats for one person; a hard, warmed-up uphill effort or a supervised treadmill test measures your own max ("my max heart rate is 186" uses it). ';
  return '<h2>Heart rate zones</h2><div class="sub">' + esc(sub) + '</div>' + BIG + esc(head) + '<span style="font-size:18px"> bpm</span></div>'
    + '<div class="sub">' + esc(headSub) + '</div>' + (rest ? '<p>' + esc(restNote) + '</p>' : '') + '<ul>' + rows + '</ul>'
    + GREY + esc(alt) + (rest ? '' : 'Give your resting heart rate ("my resting heart rate is 60", counted sitting still first thing in the morning) for zones built on your heart rate reserve, the Karvonen method coaches use. ')
    + 'Medicines such as beta blockers lower heart rate, so these numbers don\'t apply; ask your doctor. The talk test works too: in zone 2 you can chat, in zone 4 only a few words.</p>' + SRC;
}
function restVerdict(r) {
  if (r < 40) return 'A resting rate of ' + r + ' is below 40, which is worth checking with a doctor unless you are a trained endurance athlete.';
  if (r < 60) return 'A resting rate of ' + r + ' is below the usual 60\u2013100, which is common and healthy in fit people (trained athletes often sit at 40\u201360); see a doctor if it comes with dizziness, fainting or tiredness.';
  if (r <= 100) return 'A resting rate of ' + r + ' is in the normal adult range (60\u2013100 bpm)' + (r <= 70 ? ', on the fitter side.' : r >= 85 ? '; regular aerobic exercise usually brings it down, and large studies tie lower resting rates to longer lives.' : '.');
  return 'A resting rate of ' + r + ' is above 100 (tachycardia); if it stays there at rest, see a doctor.';
}
function restHtml(q, esc) {
  const r = q.rest;
  return '<h2>Resting heart rate</h2><div class="sub">' + (r ? 'yours: ' + r + ' bpm' : 'adults, by the American Heart Association') + '</div>'
    + BIG + (r ? r : '60\u2013100') + '<span style="font-size:18px"> bpm' + (r ? '' : ' is normal') + '</span></div>'
    + (r ? '<p>' + esc(restVerdict(r)) + '</p>' : '')
    + '<ul><li>Normal for adults: <b>60\u2013100 bpm</b></li><li>Trained athletes: often <b>40\u201360 bpm</b></li><li>Children 6\u201315: about 70\u2013100 bpm</li>'
    + '<li>Under 60 with dizziness or fainting, or over 100 at rest: see a doctor</li></ul>'
    + GREY + 'Count it sitting still, first thing in the morning before coffee: beats in 30 seconds \u00d7 2. Fitness, rest and hydration lower it; caffeine, stress, heat, illness and some medicines raise it. Give your age ("i\'m 40") for training zones built on your resting rate.</p>' + SRC;
}
function chartHtml(esc) {
  const ages = [20, 30, 35, 40, 45, 50, 55, 60, 65, 70];
  return '<h2>Target heart rate</h2><div class="sub">by age, from the American Heart Association\'s chart (50\u201385% of 220 \u2212 age)</div>'
    + BIG + '50\u201385%<span style="font-size:18px"> of your max</span></div>'
    + '<ul>' + ages.map((a) => { const mx = 220 - a; return '<li>Age ' + a + ': <b>' + Math.round(mx * 0.5) + '\u2013' + Math.round(mx * 0.85) + ' bpm</b> \u00b7 max ' + mx + '</li>'; }).join('') + '</ul>'
    + GREY + 'Fill in your age below for your five training zones, or ask "heart rate zones for a 40 year old with a resting heart rate of 60".</p>';
}
function formHtml(el, q, esc) {
  const box = el.querySelector('#hr-form');
  if (!box) return;
  box.innerHTML = '<div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center;margin:10px 0">'
    + 'age <input id="hr-age" type="number" min="13" max="100" value="' + (q.age || 40) + '" style="width:64px" aria-label="age">'
    + 'resting <input id="hr-rest" type="number" min="25" max="150" placeholder="optional" ' + (q.rest ? 'value="' + q.rest + '" ' : '') + 'style="width:84px" aria-label="resting heart rate"> bpm'
    + '<select id="hr-f" aria-label="formula"><option value="aha">220 \u2212 age (AHA)</option><option value="tanaka">208 \u2212 0.7 \u00d7 age (Tanaka)</option></select></div>'
    + '<div id="hr-out" aria-live="polite"></div>';
  const g = (id) => box.querySelector('#' + id), out = g('hr-out');
  const upd = () => {
    const age = +g('hr-age').value, rest = +g('hr-rest').value || 0;
    if (!(age >= 13 && age <= 100)) { out.textContent = 'enter an age from 13 to 100'; return; }
    const max = g('hr-f').value === 'tanaka' ? Math.round(208 - 0.7 * age) : 220 - age;
    const r = rest >= 25 && rest < max ? rest : 0, t = band(max, r, 0.5, 0.85);
    out.innerHTML = '<div class="sub">max ' + max + ' bpm' + (r ? ' \u00b7 resting ' + r : '') + '</div>' + BIG + t[0] + '\u2013' + t[1] + '<span style="font-size:18px"> bpm target</span></div>'
      + '<ul>' + ZONES.map((z) => { const b = band(max, r, z.lo, z.hi); return '<li>Zone ' + z.n + ' \u00b7 ' + esc(z.name) + ': ' + b[0] + '\u2013' + b[1] + ' bpm</li>'; }).join('') + '</ul>';
  };
  box.querySelectorAll('input,select').forEach((n) => { n.addEventListener('input', upd); n.addEventListener('change', upd); });
  upd();
}

async function run(text, api) {
  const { showPage, esc } = api;
  let q = followOf(text) || askOf(text); // after a heart card, "zone 2" keeps the resting rate you gave
  if (!q) return 'none';
  q = Object.assign({}, q);
  const mem = lastStatsOf();
  if (!q.age && !q.form && mem && mem.s.age) { q.age = mem.s.age; q.ageFrom = 'from your last ask'; }
  if (q.kind === 'zones' && q.age && q.age >= 13 && q.age <= 100) {
    if (q.rest && q.rest >= (q.max || 220 - q.age)) q.rest = null;
    last = { q, at: Date.now() };
    shareBody({ age: q.age }, 'heart', mem ? mem.kind : null);
    showPage((el) => { el.innerHTML = zonesHtml(q, esc); });
    return 'heart';
  }
  if (q.kind === 'rest' && !q.form) {
    last = { q, at: Date.now() };
    shareBody({}, 'heart', mem ? mem.kind : null);
    showPage((el) => { el.innerHTML = restHtml(q, esc); });
    return 'heart';
  }
  const el = showPage((p) => { p.innerHTML = (q.form ? '<h2>Heart rate zone calculator</h2><div class="sub">your target heart rate and five training zones</div>' : chartHtml(esc)) + '<div id="hr-form"></div>' + SRC; });
  formHtml(el, q, esc);
  return 'heart';
}

export { askOf, followOf, zonesHtml, band };
export default {
  name: 'heart',
  examples: [
    'what is my target heart rate',
    'heart rate zones for a 40 year old',
    'max heart rate for a 55 year old',
    'fat burning heart rate for a 35 year old',
    'heart rate zones age 40 resting heart rate 60',
    'what is a normal resting heart rate',
    'is a resting heart rate of 55 good',
    'heart rate zone calculator'
  ],
  nearMisses: [
    'best heart rate monitor',
    'what is a heart attack',
    'how to lower my resting heart rate',
    'heart rate variability',
    'normal heart rate for a dog',
    'how many calories should i eat a day'
  ],
  match(lower, text) { return !!askOf(text) || !!followOf(text); },
  run
};
