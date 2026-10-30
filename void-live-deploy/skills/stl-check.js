/**
 * stl-check skill (asked by Verse: "Create a browser-based utility to check the watertightness of STL print files."): "check my stl file",
 * "is my stl watertight", "stl checker". A card with a file box: pick an STL and the card says at once whether it is watertight, and if not
 * what is wrong and where (lib/stl-check.js, the same check as the full page /stl/), all on this device; nothing is uploaded. When the forge
 * has made something on this stage, the card offers to check its file on /stl/ (?forge=<key>: the same STL "Print it" downloads).
 * Contract: { name, examples, nearMisses, match(lower, text), run(text, api) }
 */
import { parseStl, analyze } from '../lib/stl-check.js';

const ASKS = /^(?:please\s+)?(?:(?:can\s+you\s+)?(?:check|verify|test|inspect|validate|analy[sz]e)\s+(?:my\s+|an?\s+|the\s+|this\s+)?(?:3d\s+)?(?:print\s+)?stl(?:\s+file)?(?:\s+for\s+(?:holes|errors|problems|leaks))?|is\s+(?:my\s+|the\s+|this\s+|an?\s+)?stl(?:\s+file)?\s+(?:watertight|manifold|printable|ok|okay|closed|broken)|(?:is\s+)?(?:my\s+)?stl\s+watertight|stl\s+(?:file\s+)?(?:checker|check|validator|verifier|watertight(?:ness)?(?:\s+check(?:er)?)?)|(?:check|test)\s+(?:the\s+)?watertightness\s+of\s+(?:my\s+|an?\s+|the\s+)?stl(?:\s+files?)?|does\s+my\s+stl\s+have\s+(?:holes|open\s+edges))\s*[?.!]*$/i;

/** true for an ask that wants the STL checker. Pure. */
export const matches = (text) => ASKS.test(String(text || '').trim());

function run(text, api) {
  const { showPage, esc } = api, things = api.stage && api.stage.things ? Object.values(api.stage.things()) : [];
  const forged = things.filter((t) => t && t.kind === 'forge' && /^[a-z][a-z0-9-]{0,30}$/.test(t.key || '')).pop();
  showPage((el) => {
    el.dataset.cardKind = 'STL check';
    el.innerHTML = '<h2>Is my STL watertight?</h2>' // void-review: ok (constant markup; the forge key is checked against a closed pattern above and escaped)
      + '<p>Pick an STL print file (binary or ASCII). It is checked on this device and never uploaded.</p>'
      + '<p><input class="stl-in" type="file" accept=".stl,model/stl" aria-label="STL file to check" style="font:inherit;max-width:100%"></p>'
      + '<div class="stl-out" aria-live="polite"></div>'
      + '<p><a href="/stl/" class="stl-full">Open the full checker</a> (3D view of the holes, the whole report, a mended copy) · <a href="/stl/?sample=hole">try a cube with a hole</a>'
      + (forged ? ' · <a href="/stl/?forge=' + esc(forged.key) + '" class="stl-forge">check the forge\'s ' + esc(forged.key) + '</a>' : '') + '</p>'
      + '<div class="src">Every edge must be shared by exactly two faces (open edges are holes, three or more is non-manifold), each face wound the same way as its neighbours, each shell facing outward. Sizes are read as millimetres.</div>';
    const inp = el.querySelector('.stl-in'), out = el.querySelector('.stl-out');
    for (const ev of ['pointerdown', 'keydown']) for (const b of el.querySelectorAll('input,a')) b.addEventListener(ev, (e) => e.stopPropagation());
    inp.addEventListener('change', async () => {
      const f = inp.files && inp.files[0]; if (!f) return; out.textContent = 'Checking ' + f.name + ' on this device.';
      const r = analyze(parseStl(new Uint8Array(await f.arrayBuffer())));
      out.textContent = '';
      const line = (t, strong) => { const p = document.createElement('p'); p.style.margin = '6px 0'; if (strong) { const b = document.createElement('b'); b.textContent = t; p.appendChild(b); } else p.textContent = t; out.appendChild(p); };
      line(r.verdict, true);
      if (r.triangles) line(r.triangles.toLocaleString('en') + ' triangles · ' + r.size.map((v) => +v.toFixed(1)).join(' × ') + ' mm · open edges ' + r.openEdges + ' · non-manifold ' + r.nonManifoldEdges + ' · flipped ' + r.flippedFaces + ' · shells ' + r.shells);
    });
  });
  return 'stl-check';
}

export default {
  name: 'stl-check',
  examples: ['check my stl file', 'is my stl watertight', 'stl checker', 'check my stl for holes', 'is this stl file printable', 'check the watertightness of my stl', 'does my stl have holes'],
  nearMisses: ['download the stl', 'make me a vase', 'what is an stl file', 'print it', 'check it before printing'],
  match(lower, text) { return matches(text || lower); },
  run
};
