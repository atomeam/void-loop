// The skill-confidence strip on Verse's self card (asked by Verse twice, "small": "a 'skill-confidence' visualizer on the self card showing
// proven versus tested by colour intensity"; its idea on the ink change: skills whose last_tested date is old look weathered, washed out, so the
// 'proven' look decays with age). One square per skill, one row per family, read off skills/families.json (rating, last_tested): nothing invented.
// Intensity is the card art's own ink density for the rating (RARITY_LOOK[...].dens in lib/card-art.js: proven strongest, experiment faintest), so a
// card and this strip say the same thing. Weathering: a skill not tested for WEATHER_DAYS or more fades linearly to half its density by FADE_DAYS and
// gets a dashed edge; a skill never tested counts as fully faded. The two day counts are this strip's own display rule, not a measurement.
// Pure: data in, escaped HTML out. The page fetches families.json and calls confidenceHtml().
import { RARITY_LOOK, rarityKey } from './card-art.js';
import { byWeakness } from './weakest.js';
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
const escHtml = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
export function confidenceHtml(fam, today, esc = escHtml) {
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

// The family bars (owner's redesign of the self card, 2026-10-18: "a horizontal bar per skill family (proven share) ... weakest family highlighted"):
// one row per family of skills/families.json, the bar its share of proven skills; the weakest is the lowest proven share (ties: the lower share of
// proven and checked together, then the larger family). Nothing estimated: counts of ratings the file already holds.
/** [{ id, name, proven, checked, total, share (0..1), weak }] in the file's order. Pure. */
export function familyBars(fam) {
  const rows = ((fam && fam.families) || []).filter((f) => f && Array.isArray(f.skills) && f.skills.some((s) => s && s.name)).map((f) => {
    const sk = f.skills.filter((s) => s && s.name), proven = sk.filter((s) => s.tier === 'proven').length, checked = sk.filter((s) => s.tier === 'checked').length;
    return { id: String(f.id || f.name || ''), name: String(f.name || f.id || ''), proven, checked, total: sk.length, share: proven / sk.length, weak: false };
  });
  const weakest = rows.slice().sort(byWeakness)[0];
  if (weakest) weakest.weak = true;
  return rows;
}
/** "How sure I am of my skills" for the self card: the family bars, then the strip of one square per skill folded under them. '' with no families. Pure. */
export function sureHtml(fam, today, esc = escHtml) {
  const bars = familyBars(fam); if (!bars.length) return '';
  const row = (b) => '<div class="fb-row' + (b.weak ? ' fb-weak' : '') + '" data-fam-bar="' + esc(b.id) + '" data-name="' + esc(b.name) + '" data-share="' + (Math.round(b.share * 1000) / 1000) + '" data-label="' + esc(b.proven + ' of ' + b.total + ' proven') + '"' + (b.weak ? ' data-weak="1"' : '') + '>'
    + '<span class="fb-name">' + esc(b.name) + (b.weak ? ' <em>weakest</em>' : '') + '</span><span class="fb-track" role="img" aria-label="' + esc(b.name + ': ' + b.proven + ' of ' + b.total + ' skills proven') + '"><i style="width:' + Math.round(b.share * 100) + '%"></i></span>'
    + '<span class="fb-num">' + esc(b.proven + '/' + b.total) + '</span></div>';
  const css = '<style>.fb-row{display:grid;grid-template-columns:minmax(0,38%) 1fr auto;gap:10px;align-items:center;margin:5px 0;font-size:var(--fs-s,13px)}.fb-name{color:var(--ink-2,#c3c8d8);overflow-wrap:anywhere}'
    + '.fb-name em{font-style:normal;font-size:10.5px;letter-spacing:.08em;text-transform:uppercase;color:#ffb000;margin-left:4px}.fb-track{height:8px;border-radius:999px;background:rgba(255,255,255,.08);overflow:hidden}'
    + '.fb-track i{display:block;height:100%;border-radius:inherit;background:rgb(var(--d-key,158 178 255)/.9)}.fb-num{font-variant-numeric:tabular-nums;color:var(--ink-3,#8e94a8);font-size:12px}'
    + '.fb-weak .fb-track{box-shadow:0 0 0 1px #ffb000}.fb-weak .fb-track i{background:#ffb000}.fb-weak .fb-name{color:#ffd45e}.sc-more>summary{cursor:pointer;color:var(--ink-3,#8e94a8);font-size:12px;margin-top:6px}</style>';
  return css + '<div class="vh">How sure I am of my skills</div><div class="fb-bars" data-fam-bars="' + bars.length + '">' + bars.map(row).join('') + '</div>'
    + '<div class="sub" style="font-size:12px">Each bar is the share of a family\'s skills rated proven, from the evidence in skills/families.json.</div>'
    + '<details class="sc-more"><summary>Every skill, one square each</summary>' + confidenceHtml(fam, today, esc).replace('<div class="vh">How sure I am of my skills</div>', '') + '</details>';
}
