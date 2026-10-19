/**
 * next-meteor skill — shows the next meteor shower.
 * "when is the next meteor shower", "next meteor shower", "upcoming meteor showers".
 * Uses public knowledge of major showers; no external key. Empty if none soon.
 */
const SHOWERS = [
  { name: 'Orionids', peak: '2026-10-21', rate: 20 },
  { name: 'Leonids', peak: '2026-11-17', rate: 15 },
  { name: 'Geminids', peak: '2026-12-14', rate: 120 },
  { name: 'Quadrantids', peak: '2027-01-03', rate: 80 },
];

export function nextMeteorOf(text) {
  const t = String(text || '').trim().toLowerCase().replace(/[?!.]+$/, '').replace(/\s+/g, ' ');
  return /^(?:when is the |what is the |show the )?next meteor shower$/.test(t)
    || /^(?:upcoming|next) meteor showers?$/.test(t);
}

export function nextShower(now = new Date()) {
  const today = now.toISOString().slice(0, 10);
  return SHOWERS.find((s) => s.peak >= today) || null;
}

async function run(text, api) {
  const { showPage, esc } = api;
  if (!nextMeteorOf(text)) return 'none';
  const next = nextShower();
  const el = showPage((p) => {
    if (!next) {
      p.innerHTML = '<h2>Next meteor shower</h2><p>No major shower listed soon. The surface stays empty.</p>';
      return;
    }
    p.innerHTML = '<h2>Next meteor shower</h2><p><b>' + esc(next.name) + '</b> peaks around ' + esc(next.peak) + ' · up to ' + next.rate + ' per hour</p><div class="src">Major annual showers, no live feed.</div>';
  });
  return 'next-meteor';
}

export default {
  name: 'next-meteor',
  examples: ['when is the next meteor shower', 'next meteor shower', 'upcoming meteor showers'],
  nearMisses: ['what is a meteor', 'shooting stars tonight', 'meteorite'],
  match(lower, text) { return nextMeteorOf(text); },
  run,
  suite() {
    const n = nextShower(new Date('2026-10-01'));
    return { ok: nextMeteorOf('next meteor shower') && n && n.name === 'Orionids' && !nextMeteorOf('hello') };
  },
};
