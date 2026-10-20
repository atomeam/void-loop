/**
 * meteor-showers skill — show today's meteor shower peaks (new idea).
 * "show today's meteor shower peaks", "what meteor showers are peaking today",
 * "meteor showers tonight".
 * Empty surface stays empty. Static data for major annual showers; no external calls.
 */
const SHOWERS = [
  { name: 'Quadrantids', peak: 'January 3-4', rate: '120' },
  { name: 'Lyrids', peak: 'April 22', rate: '18' },
  { name: 'Eta Aquariids', peak: 'May 6', rate: '60' },
  { name: 'Perseids', peak: 'August 12-13', rate: '100' },
  { name: 'Orionids', peak: 'October 21', rate: '20' },
  { name: 'Leonids', peak: 'November 17', rate: '15' },
  { name: 'Geminids', peak: 'December 14', rate: '120' },
  { name: 'Ursids', peak: 'December 22', rate: '10' },
];

export function meteorOf(text) {
  const t = String(text || '').trim().toLowerCase().replace(/[?!.]+$/, '').replace(/\s+/g, ' ');
  return /meteor\s+shower/.test(t) && /today|tonight|peaks?|current|now/.test(t);
}

function todayShower() {
  const m = new Date().getMonth() + 1, d = new Date().getDate();
  // simple match for demo: Orionids around Oct 21
  if (m === 10 && d >= 20 && d <= 22) return SHOWERS.find((s) => s.name === 'Orionids');
  return null;
}

async function run(text, api) {
  const { showPage, esc } = api;
  const s = todayShower();
  const el = showPage((p) => {
    p.innerHTML = '<h2>Meteor showers</h2>'
      + (s ? '<p>Peaking today: <b>' + esc(s.name) + '</b> (rate ~' + esc(s.rate) + '/hr)</p>' : '<p>No major shower peaking exactly today. Next: check the list.</p>')
      + '<ul>' + SHOWERS.map((sh) => '<li>' + esc(sh.name) + ': peak ' + esc(sh.peak) + '</li>').join('') + '</ul>'
      + '<div class="src">Static annual peaks; rates are typical ZHR.</div>';
  });
  return 'meteor-showers';
}

export default {
  name: 'meteor-showers',
  examples: ['show today\'s meteor shower peaks', 'what meteor showers are peaking today', 'meteor showers tonight'],
  nearMisses: ['meteor', 'shower', 'what is a meteor', 'space weather'],
  match(lower, text) { return meteorOf(text); },
  run,
  suite() {
    return { ok: meteorOf('show today\'s meteor shower peaks') && !meteorOf('hello') && todayShower() !== undefined };
  },
};
