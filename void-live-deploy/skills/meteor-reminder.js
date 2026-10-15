/**
 * meteor-reminder skill — meteor shower reminder card that shows next peak and days remaining.
 * "meteor shower reminder", "when is the next meteor shower", "show meteor peaks".
 * Uses public data or simple calendar knowledge. Empty surface stays empty.
 */
const SHOWERS = [
  { name: 'Quadrantids', peak: '2026-01-03', rate: 120 },
  { name: 'Lyrids', peak: '2026-04-22', rate: 18 },
  { name: 'Eta Aquariids', peak: '2026-05-06', rate: 50 },
  { name: 'Perseids', peak: '2026-08-12', rate: 100 },
  { name: 'Orionids', peak: '2026-10-21', rate: 20 },
  { name: 'Leonids', peak: '2026-11-17', rate: 15 },
  { name: 'Geminids', peak: '2026-12-14', rate: 150 },
];

export function meteorOf(text) {
  const t = String(text || '').trim().toLowerCase().replace(/[?!.]+$/, '').replace(/\s+/g, ' ');
  return /^(?:(?:show|when is|next|meteor\s+shower)\s+(?:reminder|peak|shower)|meteor\s+shower\s+reminder\s+card)/i.test(t);
}

function nextPeak(today = new Date()) {
  const now = today.getTime();
  let best = null, bestDays = Infinity;
  for (const s of SHOWERS) {
    const d = new Date(s.peak + 'T12:00:00Z').getTime();
    const days = Math.round((d - now) / 86400000);
    if (days >= -2 && days < bestDays) { best = { ...s, days }; bestDays = days; }
  }
  return best || SHOWERS[0];
}

async function run(text, api) {
  if (!meteorOf(text)) return 'none';
  const { showPage, esc } = api;
  const n = nextPeak();
  const el = showPage((p) => {
    p.innerHTML = '<h2>Meteor shower reminder</h2>'
      + '<div class="sub">Next peak: <b>' + esc(n.name) + '</b></div>'
      + '<p>' + esc(n.days === 0 ? 'Peaks today!' : n.days > 0 ? n.days + ' days remaining' : 'Peaked ' + Math.abs(n.days) + ' days ago') + ' · ZHR ~' + n.rate + '</p>'
      + '<div class="src">From the major showers calendar (IMO-style). Ask again closer to a peak.</div>';
  });
  return 'meteor-reminder';
}

export default {
  name: 'meteor-reminder',
  examples: ['meteor shower reminder', 'when is the next meteor shower', 'show meteor peaks'],
  nearMisses: ['weather', 'moon phase', 'films'],
  match(lower, text) { return meteorOf(text); },
  run,
  suite() {
    const n = nextPeak(new Date('2026-10-15'));
    return { ok: meteorOf('meteor shower reminder') && n && n.name === 'Orionids' };
  },
};
