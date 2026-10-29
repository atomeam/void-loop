// Whether an obituary may say "beaten" (owner, 2026-10-28: "be sure that our sites are actually better or have a plan to be better in
// every way ... we actually want to outdo them all in every way"). The tower gate (lib/tower.js) measures a floor on its 9+ aspects; that
// alone no longer earns a memorial. A site is beaten only when BOTH hold:
//   1. the tower gate passed every aspect with evidence (floor.beaten, n === m, m >= 9), and
//   2. its feature inventory, docs/PARITY/<site>.md (tools/parity.mjs → /parity.json), has zero missing, partial or unreviewed rows.
// Anything else is "in progress": the page shows the match % and the features still to build, and keeps the homage text. Pure.

export const GATE_MIN = 9;

/** whether a floor has a memorial at all: the gate passed it, or it won every aspect measured so far and the only ones left are new aspects
 *  the gate has not measured yet (2026-10-28: "wider use" joined every floor, and a memorial is never taken down for an unmeasured aspect;
 *  it reads "in progress" until the gate measures it). Pure. */
export function hasMemorial(floor) {
  const f = floor || {}, left = f.left || [], ev = f.ev || {};
  if (f.beaten) return true;
  return !!f.measured && !(f.lost || []).length && left.length > 0 && left.every((a) => !ev[a]) && f.n >= GATE_MIN;
}

/** `floor` is a lib/tower.js floor, `row` the site's /parity.json row ({ pct, have, partial, missing, unreviewed, total, gaps }) or null */
export function obituaryStatus(floor, row) {
  const why = [];
  const f = floor || {};
  const unmeasured = !f.beaten && hasMemorial(f) ? f.left : [];
  if (unmeasured.length) why.push('the tower gate has not measured ' + unmeasured.join(', ') + ' yet (' + f.n + ' of ' + f.m + ' aspects passed)');
  else if (!f.beaten || !(f.m >= GATE_MIN) || f.n !== f.m) why.push('the tower gate is ' + (f.n || 0) + ' of ' + (f.m || 0) + ' aspects, not all of at least ' + GATE_MIN);
  if (!row) why.push('no feature inventory yet (docs/PARITY)');
  else {
    if (row.missing) why.push(row.missing + ' missing feature' + (row.missing === 1 ? '' : 's'));
    if (row.partial) why.push(row.partial + ' partly built');
    if (row.unreviewed) why.push(row.unreviewed + ' not compared yet');
  }
  const pct = row ? Math.max(0, Math.min(100, Math.round(row.pct))) : 0;
  return { beaten: why.length === 0, state: why.length ? 'in progress' : 'beaten', pct: why.length ? Math.min(pct, 99) : 100, why, gaps: (row && row.gaps) || [] };
}

/** the slug docs/PARITY and docs/HISTORY use for a site name (same rule as tools/site-history.mjs) */
export const siteSlug = (site) => String(site || '').trim().toLowerCase().replace(/^https?:\/\//, '').replace(/^www\./, '').replace(/[^a-z0-9.]+/g, '-').replace(/^-+|-+$/g, '');
