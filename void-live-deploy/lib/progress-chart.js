// Verse's progress over time on the self card (docs/LOOP-GAPS.md: progress over time). Read only from the public growth ledger
// (/void.growth.json): per week, how many builds and improvements landed and how many skills had at least one, drawn as a
// running total in an inline SVG. Counts are of ledger entries, never of people. Pure.
const DAY = 864e5;
export function weekly(ledger, now = Date.now(), weeks = 12) {
  const es = Array.isArray(ledger) ? ledger : Object.values(ledger || {});
  const start = now - weeks * 7 * DAY, rows = Array.from({ length: weeks }, (_, i) => ({ from: start + i * 7 * DAY, built: 0, skills: new Set() }));
  let before = 0;
  for (const e of es) {
    const t = Date.parse((e && e.at) || ''); if (!Number.isFinite(t) || t > now) continue;
    if (t < start) { before++; continue; }
    const r = rows[Math.min(weeks - 1, Math.floor((t - start) / (7 * DAY)))];
    r.built++; const m = /^([a-z0-9][a-z0-9-]+)[,:]/.exec(String(e.what || '')); if (m) r.skills.add(m[1]);
  }
  let total = before;
  return rows.map((r) => ({ from: r.from, built: r.built, skills: r.skills.size, total: (total += r.built) }));
}
export function progressHtml(rows, esc = (s) => String(s)) {
  if (!rows.length) return '';
  const W = 300, H = 80, max = Math.max(1, ...rows.map((r) => r.total)), min = rows[0].total - rows[0].built;
  const x = (i) => (i / Math.max(1, rows.length - 1)) * (W - 10) + 5, y = (v) => H - 5 - ((v - min) / Math.max(1, max - min)) * (H - 10);
  const pts = rows.map((r, i) => x(i).toFixed(1) + ',' + y(r.total).toFixed(1)).join(' ');
  const bmax = Math.max(1, ...rows.map((r) => r.built));
  const bars = rows.map((r, i) => `<rect x="${(x(i) - 4).toFixed(1)}" y="${(H - 5 - (r.built / bmax) * 30).toFixed(1)}" width="8" height="${((r.built / bmax) * 30).toFixed(1)}" opacity="0.35"/>`).join('');
  const last = rows[rows.length - 1];
  return '<section data-sec="progress"><h3>My progress, week by week</h3>'
    + `<svg viewBox="0 0 ${W} ${H}" width="100%" role="img" aria-label="${esc(`ledger entries over ${rows.length} weeks: ${last.total} in total, ${last.built} this week`)}" style="max-width:420px;fill:currentColor"><polyline points="${pts}" fill="none" stroke="currentColor" stroke-width="2"/>${bars}</svg>`
    + `<p>${esc(`The line is every build and improvement in my ledger so far (${last.total}). The bars are each week's new ones: ${last.built} this week.`)}</p></section>`;
}

/** miss rate and page speed per week from /tester-log.json's weekly counts (the site tester's own checks; no visitor words). Pure. */
export function testerHtml(t, esc = (s) => String(s)) {
  const w = (t && Array.isArray(t.weekly) ? t.weekly : []).filter((x) => x.of > 0);
  if (!w.length) return '';
  const W = 300, H = 60, x = (i) => (i / Math.max(1, w.length - 1)) * (W - 10) + 5;
  const miss = w.map((r) => 1 - r.passed / r.of), sp = w.filter((r) => Number.isFinite(r.ms)), smax = Math.max(1, ...sp.map((r) => r.ms));
  const line = (vals, f) => vals.map((v, i) => x(i).toFixed(1) + ',' + (H - 5 - f(v) * (H - 10)).toFixed(1)).join(' ');
  const last = w[w.length - 1], pct = Math.round((1 - last.passed / last.of) * 100);
  const sLast = sp.length ? sp[sp.length - 1].ms : null;
  return '<section data-sec="tester-trend"><h3>Misses and speed, week by week</h3>'
    + `<svg viewBox="0 0 ${W} ${H}" width="100%" role="img" aria-label="${esc(`miss rate ${pct}% this week`)}" style="max-width:420px"><polyline points="${line(miss, (v) => v)}" fill="none" stroke="currentColor" stroke-width="2"/>`
    + (sp.length > 1 ? `<polyline points="${sp.map((r, i) => (i / Math.max(1, sp.length - 1) * (W - 10) + 5).toFixed(1) + ',' + (H - 5 - (r.ms / smax) * (H - 10)).toFixed(1)).join(' ')}" fill="none" stroke="currentColor" stroke-dasharray="4 3" opacity="0.6"/>` : '') + '</svg>'
    + `<p>${esc(`The solid line is the share of my site tester's checks that missed each week: ${pct}% this week (${last.of - last.passed} of ${last.of}, over ${last.runs || 'its'} runs).` + (last.broken ? ` ${last.broken} of those runs missed more than half their checks at once (the tester or the site down mid-run, not one skill); without them ${Math.round(100 * ((last.of - last.passed) - (last.brokenOf - last.brokenPassed)) / Math.max(1, last.of - last.brokenOf))}% missed (${(last.of - last.passed) - (last.brokenOf - last.brokenPassed)} of ${last.of - last.brokenOf}).` : '') + (sLast != null ? ` The dashed line is the median page load: ${sLast} ms in the latest week with timings.` : ' Page-load timings start with the next tester run.'))}</p></section>`;
}
