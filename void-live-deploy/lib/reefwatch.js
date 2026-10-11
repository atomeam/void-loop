// reefwatch — the coral heat card's live half (frontier #8): NOAA Coral Reef Watch's 5 km regional virtual stations, one
// text file per reef region with a daily row of sea-surface temperature, Degree Heating Weeks (DHW) and the 7-day maximum
// Bleaching Alert Area level (BAA: 0 no stress, 1 Watch, 2 Warning, 3 to 7 Alert Levels 1 to 5). Pure: the file is read by its
// header names (never fixed columns), and a change of alert level between two readings is what tools/reef-changes.mjs
// writes to the ledger. https://coralreefwatch.noaa.gov/product/vs/
export const VS_BASE = 'https://coralreefwatch.noaa.gov/product/vs/data/';
export const STATIONS = [{ id: 'florida_keys', name: 'Florida Keys' }];
export const stationPage = (id) => 'https://coralreefwatch.noaa.gov/product/vs/gauges/' + id + '.php';

const LEVELS = ['no stress', 'Watch', 'Warning', 'Alert Level 1', 'Alert Level 2', 'Alert Level 3', 'Alert Level 4', 'Alert Level 5'];
export const alertName = (baa) => LEVELS[Math.max(0, Math.min(7, Math.round(+baa) || 0))];

/** a station file -> its newest reading { date, sstMax, dhw, baa }, or null when the file is not shaped as expected */
export function parseStation(text) {
  const lines = String(text || '').split(/\r?\n/);
  const h = lines.findIndex((l) => /\bYYYY\b/.test(l) && /\bBAA/i.test(l) && /\bDHW/i.test(l));
  if (h < 0) return null;
  const cols = lines[h].trim().split(/\s+/), at = (re) => cols.findIndex((c) => re.test(c));
  const iY = at(/^YYYY$/), iM = at(/^MM$/), iD = at(/^DD$/), iDhw = at(/^DHW/i), iBaa = at(/^BAA/i), iMax = at(/^SST_MAX$/i);
  if ([iY, iM, iD, iDhw, iBaa].some((i) => i < 0)) return null;
  for (let k = lines.length - 1; k > h; k--) {
    const v = lines[k].trim().split(/\s+/);
    if (v.length < cols.length || !/^\d{4}$/.test(v[iY])) continue;
    const dhw = +v[iDhw], baa = +v[iBaa];
    if (!Number.isFinite(dhw) || !Number.isFinite(baa)) continue;
    return { date: v[iY] + '-' + v[iM].padStart(2, '0') + '-' + v[iD].padStart(2, '0'), sstMax: iMax >= 0 ? +v[iMax] : null, dhw, baa };
  }
  return null;
}

/** each station in both readings whose alert level changed, in words; a first reading is the baseline */
export function reefChanges(prev, next) {
  const out = [];
  for (const id of Object.keys(next || {})) {
    const a = prev && prev[id], b = next[id];
    if (!a || !b || !Number.isFinite(a.baa) || !Number.isFinite(b.baa) || alertName(a.baa) === alertName(b.baa)) continue;
    const from = alertName(a.baa), to = alertName(b.baa);
    out.push({ id, name: b.name || a.name || id, from, to, dhw: b.dhw, date: b.date, text: from + ' → ' + to + ' (' + b.dhw + ' degree heating weeks' + (b.date ? ' on ' + b.date : '') + ')' });
  }
  return out;
}

// The heat card's "right now" line, from the served reading (void-live-deploy/reefwatch.json, kept daily by the reef watch).
// The thresholds are Coral Reef Watch's own: 4 or more degree heating weeks, significant bleaching likely; 8 or more,
// severe bleaching and significant mortality likely. null when there is no reading.
const r1 = (x) => Math.round(+x * 10) / 10;
export function liveLine(snap, id = STATIONS[0].id) {
  const s = snap && snap.rows && snap.rows[id];
  if (!s || !Number.isFinite(+s.dhw) || !Number.isFinite(+s.baa)) return null;
  return {
    text: (s.name || id) + ': ' + alertName(s.baa) + ' · ' + r1(s.dhw) + ' degree heating weeks' + (Number.isFinite(+s.sstMax) && s.sstMax != null ? ' · water up to ' + r1(s.sstMax) + ' °C' : '') + ' (NOAA Coral Reef Watch, ' + (s.date || 'latest') + ')',
    note: 'Degree heating weeks add up the last 12 weeks of heat above the usual summer maximum: 4 or more means significant bleaching is likely, 8 or more severe bleaching and coral death.',
    href: stationPage(id),
  };
}
