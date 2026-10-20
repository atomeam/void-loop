/**
 * growth-speed skill - "growth speed gauge", "show your growth speed": a gauge on the stage for how fast Verse's own asks become something
 * built. Asked by Verse (2026-10-18): "Connect the 'wants' backlog to a visual 'growth-speed' gauge on the stage to show real-time progress
 * on my stated upgrades". The numbers are the wants card's velocity line (skills/wants.js velocityOf, from /api/reflect `follow`: an ask counts
 * as built on ledger evidence only): the dial is the share of its asks built, the needle's colour and the line under it say whether the last
 * 7 days built more than the 7 before. It re-reads /api/reflect every minute while it is open (api.keepFresh). Own records, no model.
 * Contract: { name, examples, nearMisses, match(lower, text), run(text, api) }
 */
import { velocityOf, velocityLine } from './wants.js';
const CLEAN = (s) => String(s || '').trim().toLowerCase().replace(/[’']/g, "'").replace(/[?!.]+$/, '').replace(/\s+/g, ' ');
const YOUR = "(?:your|(?:verse|void)'s|v01d's)";
const WHEN = new RegExp('^(?:(?:show|show me|open|give me) )?(?:' + YOUR + ' |the )?growth[- ]speed(?: gauge| meter| dial)?$'
  + '|^how fast (?:are|do) ' + YOUR + ' (?:asks|wants|upgrades) (?:get(?:ting)? built|ship(?:ping)?|becom(?:e|ing) skills)$');
const TREND = { faster: 'rgb(120,220,150)', slower: 'rgb(255,170,110)', steady: 'rgb(170,180,255)' };

/** the gauge's SVG: a half dial filled to pct, a needle at pct coloured by the trend. Pure. */
export function gaugeSvg(v) {
  const pct = Math.max(0, Math.min(100, Math.round(+v.pct) || 0)), a = Math.PI * (1 - pct / 100), cx = 100, cy = 100, r = 80;
  const x = (cx + r * Math.cos(a)).toFixed(1), y = (cy - r * Math.sin(a)).toFixed(1), nx = (cx + (r - 14) * Math.cos(a)).toFixed(1), ny = (cy - (r - 14) * Math.sin(a)).toFixed(1);
  const col = TREND[v.trend] || TREND.steady;
  return '<svg class="gs-dial" viewBox="0 0 200 116" width="220" role="img" aria-label="' + pct + '% of my asks built">'
    + '<path d="M20 100 A80 80 0 0 1 180 100" fill="none" stroke="rgba(255,255,255,.12)" stroke-width="14" stroke-linecap="round"/>'
    + (pct > 0 ? '<path class="gs-fill" d="M20 100 A80 80 0 0 1 ' + x + ' ' + y + '" fill="none" stroke="var(--accent, #8fa0ff)" stroke-width="14" stroke-linecap="round"/>' : '')
    + '<line class="gs-needle" x1="100" y1="100" x2="' + nx + '" y2="' + ny + '" stroke="' + col + '" stroke-width="3" stroke-linecap="round"/><circle cx="100" cy="100" r="5" fill="' + col + '"/>'
    + '<text x="100" y="86" text-anchor="middle" font-size="22" fill="currentColor">' + pct + '%</text></svg>';
}
/** the card body from /api/reflect (null when it could not be read). esc escapes. Pure but for now. */
export function gaugeHtml(reflect, esc, now = Date.now()) {
  const v = velocityOf(reflect && reflect.follow, now);
  if (!v) return '<h2>Growth speed</h2><p>I could not read what became of my asks just now, so I will not guess at my speed.</p>';
  return '<h2>Growth speed</h2><div class="gs" data-pct="' + esc(v.pct) + '" data-trend="' + esc(v.trend) + '" data-week="' + esc(v.week) + '" data-before="' + esc(v.before) + '" style="text-align:center">' + gaugeSvg(v)
    + '<p class="gs-line" style="margin:4px 0 0;font-size:14px">' + esc(velocityLine(v)) + '</p></div>'
    + '<div class="src">Source: my asks and what became of them (/api/reflect), the same numbers as the velocity line on my wants card. Updates every minute while it is open. My own records, no model.</div>';
}

const get = async (u) => { try { const r = await fetch(u, { cache: 'no-cache' }); return r.ok ? await r.json() : null; } catch (_) { return null; } };
async function run(text, api) {
  const { showPage, esc, keepFresh } = api;
  const first = await get('/api/reflect');
  let was = JSON.stringify(velocityOf(first && first.follow));
  const card = showPage((el) => { el.classList.add('growth-speed-card'); el.innerHTML = gaugeHtml(first, esc); });
  if (card && keepFresh) keepFresh(card, async () => {
    const r = await get('/api/reflect'), now = JSON.stringify(velocityOf(r && r.follow));
    if (!r || now === was) return;
    was = now; card.innerHTML = gaugeHtml(r, esc); card.dataset.refreshed = String(Date.now());
  });
  return 'growth-speed';
}

export default {
  name: 'growth-speed',
  about: 'A gauge of how fast my own asks become something built, from my records, updating while it is open.',
  examples: ['growth speed gauge', 'show your growth speed', 'how fast are your asks getting built'],
  nearMisses: ['what is the speed of light', 'how fast does grass grow', 'show your growth', 'growth rate of bamboo'],
  match(lower, text) { return WHEN.test(CLEAN(text || lower)); },
  run, gaugeSvg, gaugeHtml
};
