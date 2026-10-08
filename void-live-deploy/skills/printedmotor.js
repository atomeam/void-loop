/**
 * printedmotor skill — "from a twitch to a wave": where fully printed motors really are, in three short dated steps
 * (domains/void.growth.md, Next [think-tank] "printed-motor card"). A printed linear motor in all five materials moved
 * 318 µm at 41.6 Hz; printed rotary and linear motors (bought magnets aside) now drive a fan, a pump, a paddle boat, a
 * walking robot and a waving arm; a one-print soft robot walks off a desktop printer on air alone. Ends with the honest
 * next step and links the magnetize step, Pentamote-1 (with its moving miniature) and Linemote-1. Original wording only.
 * "can you 3d print a motor", "printed motor", "printed robot arm".
 */
export const STEPS = [
  { head: 'A twitch', date: '2026-02-18', line: 'A linear motor printed in one go from all five material classes (insulator, conductor, soft and hard magnetic, flexible) moved 318 µm back and forth at 41.6 Hz. It needed one step after printing: magnetizing.',
    name: 'MIT News; Virtual and Physical Prototyping', href: 'https://doi.org/10.1080/17452759.2026.2613185' },
  { head: 'Real work', date: '2026-04-20', line: 'Printed rotary and linear motors, with every part printed except the bought magnets, ran a fan, a water pump, a paddle-wheel boat, a walking robot with several legs and a waving arm, at 7.62 N·mm per amp and up to 28.2% efficiency.',
    name: 'Schwalbe et al., Advanced Materials Technologies', href: 'https://doi.org/10.1002/admt.70994' },
  { head: 'Walking off the printer', date: '2025-01-26', line: 'A soft robot printed in one piece on a desktop printer walks away on air pressure alone, with no electronics on board.',
    name: 'Zhai et al., Advanced Intelligent Systems', href: 'https://doi.org/10.1002/aisy.202400876' },
];
export const NEXT_LINE = 'Next: a printed motor small and cool enough to wave a toy figure’s arm.';

const CLEAN = (s) => String(s || '').trim().toLowerCase().replace(/[?!.]+$/, '').replace(/\s+/g, ' ');
const PRINTED = '(?:3d[\\s-]?print(?:ed)?|print(?:ed)?)';
const ASK_RE = new RegExp('^(?:'
  + '(?:can|could)\\s+(?:you|i|we|someone)\\s+(?:3d\\s+)?print\\s+(?:a|an)\\s+(?:electric\\s+)?motor'
  + '|is\\s+it\\s+possible\\s+to\\s+(?:3d\\s+)?print\\s+(?:a|an)\\s+(?:electric\\s+)?motor'
  + '|(?:tell\\s+me\\s+about\\s+|show(?:\\s+me)?\\s+|what\\s+about\\s+)?(?:a\\s+|the\\s+)?' + PRINTED + '\\s+(?:electric\\s+)?(?:motors?|robot\\s+arms?|actuators?)'
  + '|(?:how\\s+far\\s+along\\s+are|state\\s+of)\\s+' + PRINTED + '\\s+motors'
  + ')$');
export function printedMotorOf(text) { return ASK_RE.test(CLEAN(text)); }

export function printedMotorHtml(esc) {
  return '<h2>Printed motors: from a twitch to a wave</h2><div class="sub">where one-print machines really are · three dated steps</div>'
    + '<div class="printedmotor-mini" style="height:180px;margin:8px 0 4px"></div>'
    + STEPS.map((s, i) => '<p><b>' + (i + 1) + '. ' + esc(s.head) + '</b> · ' + esc(s.line) + ' <span style="color:#8a8a92;font-size:12px">· <a href="' + esc(s.href) + '" target="_blank" rel="noopener">' + esc(s.name) + '</a> (' + esc(s.date) + ')</span></p>').join('')
    + '<p><b>' + esc(NEXT_LINE) + '</b></p>'
    + '<p style="color:#8a8a92;font-size:13px">The printed hard magnets still need <a href="#" data-ask="show the magnetize step">the magnetize step</a>. Void’s own designs, both untested: <a href="#" data-ask="pentamote-1">Pentamote-1</a>, a five-material motor body with a slicer-ready file, shown above, and <a href="#" data-ask="summon linemote-1">Linemote-1</a>, a finger-scale actuator.</p>'
    + '<div class="src">Dated sources: ' + STEPS.map((s) => '<a href="' + esc(s.href) + '" target="_blank" rel="noopener">' + esc(s.name) + '</a> (' + esc(s.date) + ')').join(' · ') + '. Lab results, not products.</div>';
}

async function run(text, api) {
  if (!printedMotorOf(text)) return 'none';
  const { showPage, esc } = api;
  const page = showPage((p) => { p.innerHTML = printedMotorHtml(esc); });
  const slot = page && page.querySelector('.printedmotor-mini');
  if (slot && api.stage && api.stage.miniature) {
    api.stage.miniature(slot, 'pentamote', {}, { key: 'printedmotor-page', place: 'inside', label: '3D Pentamote-1, a printed motor body: the magnet slab shuttling over three coils, slowed down' }).catch(() => slot.remove());
  } else if (slot) slot.remove();
  return 'printedmotor';
}

export default {
  name: 'printedmotor',
  examples: ['can you 3d print a motor', 'printed motor', 'printed robot arm', '3d printed motors', 'is it possible to 3d print an electric motor', 'tell me about printed actuators'],
  nearMisses: ['download the printed motor as 3mf', 'how do I magnetize a printed motor', 'what is a motor', 'print my list', 'robot arm', 'summon linemote-1'],
  printedMotorOf,
  match(lower, text) { return printedMotorOf(text); },
  run,
};
