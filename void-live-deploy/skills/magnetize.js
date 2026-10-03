/**
 * magnetize skill — handoff card for the post-print magnetize step
 * Board Next: impulse magnetization of hard-magnetic regions on a separate fixture.
 * Original part name and original shape only. Soft-magnetic cores need no magnetize step.
 * "show the magnetize step", "how do I magnetize a printed motor".
 */
export const SOURCES = [
  { date: '2026-02-18', name: 'MIT News', href: 'https://news.mit.edu/2026/3d-printing-platform-rapidly-produces-complex-electric-machines-0218' },
  { date: '2025-07-18', name: 'Słoma et al.', href: 'https://doi.org/10.1088/2058-8585/aded1f' },
  { date: '2024', name: 'Cañada, Kim, Velásquez-García', href: 'https://doi.org/10.1080/17452759.2024.2310046' }
];

export function magnetizeOf(text) {
  const t = String(text || '').trim().replace(/[?!.]+$/, '').replace(/\s+/g, ' ');
  if (/^(?:please\s+)?(?:show\s+)?(?:me\s+)?the magnetize step$/i.test(t)) return true;
  if (/^(?:how do I|how to) magnetize a printed motor$/i.test(t)) return true;
  if (/^magnetize a printed motor$/i.test(t)) return true;
  if (/^figure-scale benchtop magnetize$/i.test(t)) return true;
  return false;
}

export function magnetizeCard() {
  return {
    part: 'MIT multi-material printed linear motor',
    shape: 'original printed motor body; hard-magnetic regions only',
    hard: 'Hard-magnetic regions are magnetized after print on a separate fixture, not in the printer. The MIT pellet is nylon-12 / strontium ferrite (69 vol%), magnetized at 1.5 T. Bonded Neo needs about 3–4 T throughout (labs have used about 7 T in a 40 mm coil).',
    soft: 'Soft-magnetic cores need no magnetize step.',
    figure: 'A named benchtop impulse unit lists 4 T at 1.25 cm sample OD (figure scale) and 2.9 T at 2.5 cm. That covers the MIT ferrite path; bonded Neo at 2.5 cm needs a tighter coil or a higher-energy shop unit.',
    sources: SOURCES
  };
}

async function run(text, api) {
  const { showPage, esc } = api;
  if (!magnetizeOf(text)) return 'none';
  const card = magnetizeCard();
  const el = showPage((p) => { p.innerHTML = '<h2>Magnetize step</h2>'; });
  const src = card.sources.map((s) => '<a href="' + esc(s.href) + '" target="_blank" rel="noopener">' + esc(s.name) + '</a> (' + esc(s.date) + ')').join(' · ');
  el.innerHTML = '<h2>Magnetize step</h2>'
    + '<p>' + esc(card.part) + '. ' + esc(card.shape) + '.</p>'
    + '<p>' + esc(card.hard) + '</p>'
    + '<p>' + esc(card.soft) + '</p>'
    + '<p>' + esc(card.figure) + '</p>'
    + '<div class="src">Dated sources: ' + src + '. No sold likeness. Nothing is published from this card.</div>';
  return 'magnetize';
}

export default {
  name: 'magnetize',
  examples: ['show the magnetize step', 'how do I magnetize a printed motor', 'magnetize a printed motor', 'figure-scale benchtop magnetize'],
  nearMisses: ['what is a magnet', 'show the map', 'weather in Kyoto', 'make a motor'],
  magnetizeOf,
  magnetizeCard,
  match(lower, text) { return magnetizeOf(text); },
  run
};
