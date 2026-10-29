/**
 * stl-check skill — "check my stl", "is my stl watertight", "stl checker": a card that takes an STL file (pick it or drop it) and
 * says what a slicer will find: watertight or how many open edges, facing outward, fits a 180 mm bed, supports, a brim, how much PLA.
 * The same printCheck the forge's own prints pass (lib/stl-check.js, skills/forge-rules.js); read on this device, never uploaded.
 * Contract: { name, examples, nearMisses, match(lower, text), run(text, api) }
 */
import { checkStl } from '../lib/stl-check.js';

const ASK = /^(?:please\s+)?(?:(?:check|test|inspect|verify|validate)\s+(?:my|an?|this|the)\s+stl(?:\s+file)?(?:\s+for\s+(?:holes|leaks|printing))?|(?:is|are)\s+(?:my|this|the)\s+stl(?:\s+files?)?\s+(?:watertight|manifold|printable)|stl\s+(?:file\s+)?(?:checker|check|validator|watertight\s+check)|(?:check\s+)?(?:if\s+)?(?:my\s+)?stl\s+(?:is\s+)?watertight|watertight\s+(?:stl\s+)?check(?:er)?)$/i;

export const isStlCheck = (text) => ASK.test(String(text || '').trim().replace(/[?!.]+$/, ''));

export function resultHtml(esc, name, r) {
  if (!r.ok && r.error) return '<p><b>' + esc(name) + '</b>: ' + esc(r.error) + '</p>';
  const verdict = r.ok ? 'A slicer takes it as it is.' : (!r.closed ? 'It is not watertight.' : !r.outward ? 'It faces inward.' : 'It does not fit the bed.');
  return '<p><b>' + esc(name) + '</b> · ' + esc(r.format) + ' STL · ' + esc(r.triangles.toLocaleString('en')) + ' facets · ' + esc(r.size.join(' × ')) + ' mm</p>'
    + '<p style="font-size:18px">' + esc(verdict) + '</p><ul>' + r.notes.map((n) => '<li>' + esc(n) + '</li>').join('')
    + (r.outward ? '' : '<li>' + esc('it faces inward: a slicer would read it inside out') + '</li>') + '</ul>';
}

function run(text, api) {
  const { showPage, esc } = api;
  showPage((el) => {
    el.dataset.cardKind = 'STL check';
    el.innerHTML = '<h2>Check an STL print file</h2>'
      + '<p>Pick an STL, or drop it here, and I check it the way a slicer will: watertight, facing outward, fits a 180 mm bed, supports, a brim and how much PLA.</p>'
      + '<p><input type="file" accept=".stl,model/stl,application/sla,application/vnd.ms-pki.stl" data-stl-file aria-label="Choose an STL file"></p>'
      + '<div data-stl-out aria-live="polite"></div>'
      + '<div class="src">Read on this device: the file is never uploaded.</div>';
    const out = el.querySelector('[data-stl-out]');
    const read = async (f) => {
      out.textContent = 'Reading ' + f.name + '…';
      let buf;
      try { buf = await f.arrayBuffer(); } catch (e) { out.textContent = 'I could not read that file.'; return; }
      out.innerHTML = resultHtml(esc, f.name, checkStl(buf, f.name));
    };
    el.querySelector('[data-stl-file]').addEventListener('change', (e) => { const f = e.target.files && e.target.files[0]; if (f) read(f); });
    el.addEventListener('dragover', (e) => { e.preventDefault(); });
    el.addEventListener('drop', (e) => { e.preventDefault(); const f = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0]; if (f) read(f); });
  });
  return 'stl-check';
}

export default {
  name: 'stl-check',
  examples: ['check my stl', 'is my stl watertight', 'stl checker', 'check an stl file', 'watertight check'],
  nearMisses: ['what is an stl file', 'download the rocket stl', 'make an stl of a teapot', 'check my email', 'is my roof watertight'],
  match(lower, text) { return isStlCheck(text || lower); },
  run
};
