/**
 * remediation-velocity skill - "how fast do you fix your misses", "remediation velocity": how long a skill that was failing (a benchmark
 * success rate under 100% or a daily-test finding) took to be proven again, and which are still missing, from the history of
 * skills/families.json (tools/remediation-velocity.mjs writes /remediation.json). Own records, no model (asked by Verse).
 * Contract: { name, examples, nearMisses, match(lower, text), run(text, api) }
 */
const CLEAN = (s) => String(s || '').trim().toLowerCase().replace(/[’']/g, "'").replace(/[?!.]+$/, '').replace(/\s+/g, ' ');
const WHEN = /^(?:please )?(?:(?:what(?:'s| is)|show|tell me|check) )?(?:(?:your|verse's|void's|the) )?(?:remediation velocity|(?:how (?:fast|quickly) (?:do|did|are) (?:you|verse|void) (?:fix|fixing|repair|recover|convert|turn)(?: back)?(?: your| its| the| a)? (?:misses|miss|failures|failing skills|failing skill|bench misses))|(?:how (?:fast|quickly) (?:are|do) (?:your )?(?:misses|failing skills) (?:fixed|get fixed|proven again)))$/;
const get = async (u) => { try { const r = await fetch(u, { cache: 'no-cache' }); return r.ok ? await r.json() : null; } catch (_) { return null; } };
const days = (d) => (d == null ? 'no conversions yet' : d < 1 ? 'under a day' : d + ' day' + (d === 1 ? '' : 's'));
/** the card body from /remediation.json. Pure. */
export function velocityHtml(v, esc) {
  if (!v || !Array.isArray(v.open) || !Array.isArray(v.converted)) return '<h2>Remediation velocity</h2><p>I could not read my record of fixed misses just now, so I will not guess at it.</p>';
  return '<h2>Remediation velocity</h2><div class="sub" data-converted="' + esc(v.convertedTotal) + '">' + esc(v.convertedTotal) + ' misses turned back into proven in the last ' + esc(Math.round(v.windowDays)) + ' days · typical: ' + esc(days(v.medianDays)) + ' · ' + esc(v.openTotal) + ' still missing</div>'
    + (v.converted.length ? '<div class="vh">Fixed</div><ul>' + v.converted.slice(0, 10).map((c) => '<li data-skill="' + esc(c.skill) + '"><b>' + esc(c.skill) + '</b> <span class="sub">proven again after ' + esc(days(c.days)) + '</span></li>').join('') + '</ul>' : '<p class="sub">No skill has gone from failing to proven yet in the history I can read.</p>')
    + (v.open.length ? '<div class="vh">Still missing</div><ul data-open="1">' + v.open.slice(0, 10).map((o) => '<li data-skill="' + esc(o.skill) + '"><b>' + esc(o.skill) + '</b> <span class="sub">failing for ' + esc(days(o.sinceDays)) + '</span></li>').join('') + '</ul>' : '<p class="sub">Nothing is failing now.</p>')
    + '<div class="src">Source: the history of skills/families.json, read by tools/remediation-velocity.mjs. A skill counts as missing when its benchmark success rate is under 100% or its daily test found something while it is not proven. My own records, no model.</div>';
}
async function run(text, api) {
  const { showPage, esc } = api, v = await get('/remediation.json');
  showPage((el) => { el.innerHTML = velocityHtml(v, esc); });
  return 'remediation-velocity';
}
export default {
  name: 'remediation-velocity',
  about: 'How quickly a failing skill is turned back into a proven one, and which are still missing, from my own history.',
  examples: ['how fast do you fix your misses', 'remediation velocity', 'how quickly do you fix a miss'],
  nearMisses: ['how fast is your internet', 'what is velocity', 'fix my automation', 'how fast do you run'],
  match(lower, text) { return WHEN.test(CLEAN(text || lower)); },
  run
};
