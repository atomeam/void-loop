/**
 * exportprint skill — slicer handoff for a summoned figure (void-stage open question 1)
 * A normal multi-material slicer loads 3MF, one mesh per material role.
 * Hard-magnetic regions keep the named post-print magnetize step. Soft cores do not.
 * "export a print file", "download a print file". Nothing is published.
 */
export const SOURCES = [
  { date: '2026-02-18', name: 'MIT News', href: 'https://news.mit.edu/2026/3d-printing-platform-rapidly-produces-complex-electric-machines-0218' },
  { date: '3MF', name: '3MF Consortium core spec', href: 'https://github.com/3MFConsortium/spec_core' }
];

export function exportOf(text) {
  const t = String(text || '').trim().replace(/[?!.]+$/, '').replace(/\s+/g, ' ');
  if (/^(?:please\s+)?(?:export|download)\s+(?:a|the|this)\s+print file$/i.test(t)) return true;
  if (/^(?:please\s+)?export this figure to 3mf$/i.test(t)) return true;
  if (/^(?:please\s+)?print file for a hard-magnet part$/i.test(t)) return true;
  return false;
}

export function exportFile() {
  return {
    format: '3MF',
    part: 'original named figure; not a sold likeness',
    why: 'A normal slicer (PrusaSlicer, OrcaSlicer, Bambu Studio, Cura) loads 3MF. Multi-material means one mesh per material role. STL is one mesh and cannot carry the split.',
    meshes: ['dielectric', 'conductive', 'soft magnetic', 'hard magnetic', 'flexible'],
    magnetize: 'Hard-magnetic regions are magnetized after print on a separate fixture, not in the printer. The MIT pellet is nylon-12 / strontium ferrite (69 vol%), magnetized at 1.5 T. Bonded Neo needs about 3–4 T throughout.',
    soft: 'Soft-magnetic cores need no magnetize step.',
    sources: SOURCES
  };
}

async function run(text, api) {
  const { showPage, esc } = api;
  if (!exportOf(text)) return 'none';
  const file = exportFile();
  const el = showPage((p) => { p.innerHTML = '<h2>Print file</h2>'; });
  const src = file.sources.map((s) => '<a href="' + esc(s.href) + '" target="_blank" rel="noopener">' + esc(s.name) + '</a> (' + esc(s.date) + ')').join(' · ');
  el.innerHTML = '<h2>Print file</h2>'
    + '<p>' + esc(file.part) + '. Format: ' + esc(file.format) + '.</p>'
    + '<p>' + esc(file.why) + '</p>'
    + '<p>Meshes: ' + esc(file.meshes.join(', ')) + '.</p>'
    + '<p>' + esc(file.magnetize) + '</p>'
    + '<p>' + esc(file.soft) + '</p>'
    + '<div class="src">Dated sources: ' + src + '. No sold likeness. Nothing is published from this card.</div>';
  return 'exportprint';
}

export default {
  name: 'exportprint',
  examples: ['export a print file', 'download a print file', 'export this figure to 3mf', 'print file for a hard-magnet part'],
  nearMisses: ['show the magnetize step', 'make a cube', 'what is 3mf', 'share this card'],
  exportFile,
  match(lower, text) { return exportOf(text); },
  run
};
