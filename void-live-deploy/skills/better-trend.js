/**
 * better-trend skill — surfaces void.better.json on the growth card as a one-line trend.
 * Contract: { name, examples, nearMisses, match(lower, text), run(text, api) }
 * "better trend", "one-line better score trend", "show void.better.json trend".
 * Fetches /void.better.json and shows the latest score and its day/week change in one line.
 * Empty surface stays empty. Follow-on to execution layers.
 */
const WHEN = /^(?:better\s+trend|one-line\s+better\s+score\s+trend|show\s+void\.better\.json\s+trend|void\s+better\s+trend)$/i;

export function trendLine(rows) {
  if (!Array.isArray(rows) || !rows.length) return 'No better scores yet.';
  const last = rows[rows.length - 1];
  const score = last.parts && last.parts.score != null ? last.parts.score : last.score;
  if (score == null) return 'Better score not measured yet.';
  let day = null, week = null;
  if (rows.length > 1) {
    const prev = rows[rows.length - 2];
    const ps = prev.parts && prev.parts.score != null ? prev.parts.score : prev.score;
    if (ps != null) day = score - ps;
  }
  if (rows.length > 7) {
    const old = rows[rows.length - 8];
    const os = old.parts && old.parts.score != null ? old.parts.score : old.score;
    if (os != null) week = score - os;
  }
  const d = day == null ? '' : (day > 0 ? ' +' : ' ') + day + ' since yesterday';
  const w = week == null ? '' : (week > 0 ? ' +' : ' ') + week + ' on the week';
  return 'Better: ' + score + ' of 100' + d + w + '.';
}

async function run(text, api) {
  const { showPage, esc } = api;
  const el = showPage((p) => { p.innerHTML = '<h2>Better trend</h2><div class="sub">reading void.better.json…</div>'; });
  try {
    const r = await fetch('/void.better.json', { cache: 'no-cache' });
    if (!api._pageStill || !api._pageStill(el)) return 'better-trend';
    const rows = r.ok ? await r.json() : [];
    const line = trendLine(rows);
    el.innerHTML = '<h2>Better trend</h2><div class="sub growth-better-line" data-trend="' + esc(line) + '">' + esc(line) + '</div><div class="src">Source: /void.better.json · one line on the growth card</div>';
  } catch (_) {
    if (!api._pageStill || !api._pageStill(el)) return 'none';
    el.innerHTML = '<h2>Better trend</h2><p>The better scores could not be read just now.</p>';
  }
  return 'better-trend';
}

export function suite() {
  const sample = [{ parts: { score: 70 } }, { parts: { score: 75 } }];
  const ok = trendLine(sample).includes('75') && trendLine(sample).includes('+5')
    && trendLine([]).includes('No better')
    && WHEN.test('better trend') && !WHEN.test('growth');
  return { ok, got: ok ? '' : trendLine(sample) };
}

export default {
  name: 'better-trend',
  examples: ['better trend', 'one-line better score trend', 'show void.better.json trend'],
  nearMisses: ['growth', 'how have you grown'],
  suite,
  match(lower, text) { return WHEN.test((text || lower || '').trim()); },
  run
};
