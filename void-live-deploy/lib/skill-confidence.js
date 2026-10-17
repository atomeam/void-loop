// The skill-confidence strip on V01D's self card (asked by Void twice, "small": "a 'skill-confidence' visualizer on the self card showing
// proven versus tested by colour intensity"; its idea on the ink change: skills whose last_tested date is old look weathered, washed out, so the
// 'proven' look decays with age). One square per skill, one row per family, read off skills/families.json (rating, last_tested): nothing invented.
// Intensity is the card art's own ink density for the rating (RARITY_LOOK[...].dens in lib/card-art.js: proven strongest, experiment faintest), so a
// card and this strip say the same thing. Weathering: a skill not tested for WEATHER_DAYS or more fades linearly to half its density by FADE_DAYS and
// gets a dashed edge; a skill never tested counts as fully faded. The two day counts are this strip's own display rule, not a measurement.
// Pure: data in, escaped HTML out. The page fetches families.json and calls confidenceHtml().
import { RARITY_LOOK, rarityKey } from './card-art.js';
export const WEATHER_DAYS = 14; // untested this long and the square is marked weathered
export const FADE_DAYS = 90; // untested this long and the square is at its faintest (half density)
export const TIER_ORDER = ['proven', 'checked', 'tested', 'experiment'];
const DAY = 86400000;

/** whole days between a YYYY-MM-DD last_tested and today (a Date or ms), or null when there is no valid date. Pure. */
export function ageDays(lastTested, today) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(lastTested || ''))) return null;
  const t = Date.parse(lastTested + 'T00:00:00Z'), now = today instanceof Date ? today.getTime() : +today;
  if (!Number.isFinite(t) || !Number.isFinite(now)) return null;
  return Math.max(0, Math.floor((now - t) / DAY));
}

/** one skill's look: { tier, density (0..1, what is drawn), base (the rating's own), age (days or null), weathered, label }. Pure. */
export function confidenceOf(skill, today = Date.now()) {
  const tier = TIER_ORDER.includes(skill && skill.tier) ? skill.tier : 'experiment';
  const base = RARITY_LOOK[rarityKey(tier)].dens, age = ageDays(skill && skill.last_tested, today);
  const fade = age == null ? 0.5 : 1 - 0.5 * Math.min(age, FADE_DAYS) / FADE_DAYS;
  const weathered = age == null || age >= WEATHER_DAYS;
  const density = Math.round(base * fade * 100) / 100;
  return { tier, density, base, age, weathered, label: tier + (age == null ? ', never tested' : age === 0 ? ', tested today' : ', tested ' + age + ' day' + (age === 1 ? '' : 's') + ' ago') + (weathered ? ' (weathered)' : '') };
}

/** per-family and overall counts of each rating, with how many are weathered. Pure. */
export function confidenceSummary(fam, today = Date.now()) {
  const out = { total: 0, weathered: 0, byTier: { proven: 0, checked: 0, tested: 0, experiment: 0 } };
  for (const f of (fam && fam.families) || []) for (const s of (f && f.skills) || []) {
    if (!s || !s.name) continue; const c = confidenceOf(s, today);
    out.total++; out.byTier[c.tier]++; if (c.weathered) out.weathered++;
  }
  return out;
}

/** the strip's markup for the self card: a row per family, a square per skill (strongest first), a legend. '' when there are no families. Pure. */
export function confidenceHtml(fam, today, esc = (s) => String(s)) {
  const fams = ((fam && fam.families) || []).filter((f) => f && Array.isArray(f.skills) && f.skills.length);
  if (!fams.length) return '';
  const sum = confidenceSummary(fam, today);
  const rows = fams.map((f) => {
    const sq = f.skills.filter((s) => s && s.name).map((s) => ({ s, c: confidenceOf(s, today) }))
      .sort((a, b) => TIER_ORDER.indexOf(a.c.tier) - TIER_ORDER.indexOf(b.c.tier) || b.c.density - a.c.density)
      .map(({ s, c }) => '<i class="sc-sq' + (c.weathered ? ' sc-weathered' : '') + '" data-tier="' + esc(c.tier) + '" data-density="' + c.density + '" style="--ink-density:' + c.density + '" title="' + esc(s.name + ': ' + c.label) + '"></i>').join('');
    return '<div class="sc-row"><span class="sc-name">' + esc(f.name) + '</span><span class="sc-sqs">' + sq + '</span></div>';
  }).join('');
  const css = '<style>.sc-row{display:flex;gap:8px;align-items:center;margin:3px 0}.sc-name{flex:0 0 38%;font-size:var(--fs-s);color:var(--ink-3)}.sc-sqs{display:flex;flex-wrap:wrap;gap:2px}'
    + '.sc-sq{width:9px;height:9px;border-radius:2px;background:hsl(var(--h,200) 60% 60%);opacity:calc(0.15 + 0.85 * var(--ink-density,0.5));border:1px solid transparent}'
    + '.sc-sq.sc-weathered{border:1px dashed currentColor;filter:grayscale(.7)}</style>';
  return css + '<div class="vh">How sure I am of my skills</div><div class="sc-strip" data-sc="1">' + rows + '</div>'
    + '<div class="sub">One square per skill. Strong colour is proven, faint is only tested or an experiment; a dashed, greyed square has not been tested in ' + WEATHER_DAYS + ' days or more. '
    + esc(sum.byTier.proven) + ' proven, ' + esc(sum.byTier.checked) + ' checked, ' + esc(sum.byTier.tested) + ' tested, ' + esc(sum.byTier.experiment) + ' experiment; ' + esc(sum.weathered) + ' weathered.</div>';
}
