/**
 * motorbody skill — Pentamote-1, an original printed linear-motor body in the five material classes of the MIT printed
 * motor, and its multi-material 3MF (domains/void.growth.md, Next [think-tank] "multi-material 3MF download").
 * The file uses the layout Forethinkers slot-tested on 2026-10-07 (domains/forethinkers/tracks/printing-working-machines.md):
 * five top-level build items, one mesh object per material class, each named after it with `pid` pointing at its own
 * one-colour m:colorgroup; a Core basematerials group with the same five names for portable tools; and
 * Metadata/Slic3r_PE_model.config with extruders 1-5 for PrusaSlicer 2.9. OrcaSlicer 2.4.2 put five named parts on
 * extruders 1-5 only in this layout.
 * The body is axis-aligned boxes on one shared rectilinear grid, so every part is a closed, manifold mesh, neighbouring
 * parts meet face to face, and nothing overlaps. Original name, original shape, untested: the card says so.
 * "download the printed motor as 3mf", "show the multi-material print file", "pentamote-1".
 */
import { zipStore } from './print-file.js';

// the five MIT material classes, in extruder order, with display colours (the slot-test colours)
export const MATERIALS = [
  { name: 'dielectric', color: '#E8E2D0', role: 'housing and base: holds everything and insulates the coils' },
  { name: 'conductive', color: '#B87333', role: 'three flat printed coils on the floor, one per phase' },
  { name: 'soft-magnetic', color: '#5A5F66', role: 'an iron-filled core tooth through each coil, to carry its field up to the magnet' },
  { name: 'hard-magnetic', color: '#1F2A44', role: 'the moving magnet slab, magnetized after printing' },
  { name: 'flexible', color: '#3FA34D', role: 'two flexure springs that hold the magnet over the coils and pull it back to centre' },
];

// Pentamote-1, in millimetres: [x0, x1, y0, y1, z0, z1] boxes per material (index into MATERIALS)
export const PENTAMOTE = (() => {
  const B = [[], [], [], [], []];
  // housing: base plate, then side and end walls on top of it (24 × 12 × 5 mm)
  B[0].push([0, 24, 0, 12, 0, 1], [0, 24, 0, 1.5, 1, 5], [0, 24, 10.5, 12, 1, 5], [0, 1.5, 1.5, 10.5, 1, 5], [22.5, 24, 1.5, 10.5, 1, 5]);
  for (let k = 0; k < 3; k++) {
    const x0 = 3.5 + 5.5 * k, x1 = x0 + 5; // each coil a 5 × 6 mm flat ring, 0.5 mm apart from the next
    B[1].push([x0, x1, 3, 4, 1, 1.5], [x0, x1, 8, 9, 1, 1.5], [x0, x0 + 1, 4, 8, 1, 1.5], [x1 - 1, x1, 4, 8, 1, 1.5]);
    B[2].push([x0 + 1, x1 - 1, 4, 8, 1, 2]); // the core tooth fills the ring's hole and stands 0.5 mm above the coil
  }
  B[3].push([8, 15, 3.5, 8.5, 2.5, 3.5]); // magnet slab: 0.5 mm air gap over the teeth
  B[4].push([1.5, 8, 5.5, 6.5, 2.5, 3.5], [15, 22.5, 5.5, 6.5, 2.5, 3.5]); // flexures from each end wall to the magnet
  return { name: 'Pentamote-1', size: [24, 12, 5], boxes: B, stroke: 1, gap: 0.5 };
})();

const CLEAN = (s) => String(s || '').trim().toLowerCase().replace(/[?!.]+$/, '').replace(/\s+/g, ' ');
const MOTOR = '(?:(?:the\\s+|a\\s+)?(?:printed|3d[\\s-]?printed|multi[\\s-]?material(?:\\s+printed)?|five[\\s-]material)\\s+motor(?:\\s+body)?|pentamote(?:[\\s-]?(?:1|one))?)';
const ASK_RE = new RegExp('^(?:please\\s+)?(?:'
  + '(?:download|export|save|get|give\\s+me)\\s+' + MOTOR + '\\s+(?:as\\s+(?:a\\s+)?)?(?:3mf|print\\s+file)'
  + '|(?:download|export|save|get|give\\s+me)\\s+(?:the\\s+|a\\s+)?(?:3mf|print\\s+file)\\s+(?:of|for)\\s+' + MOTOR
  + '|(?:show(?:\\s+me)?\\s+|open\\s+)?(?:the\\s+|a\\s+)?multi[\\s-]?material\\s+(?:print\\s+file|3mf)(?:\\s+for\\s+' + MOTOR + ')?'
  + '|(?:summon\\s+|show(?:\\s+me)?\\s+)?pentamote(?:[\\s-]?(?:1|one))?'
  + '|(?:summon|show(?:\\s+me)?)\\s+(?:the\\s+|a\\s+)?(?:multi[\\s-]?material|five[\\s-]material)\\s+(?:printed\\s+)?motor(?:\\s+body)?'
  + ')$');
export function motorbodyOf(text) { return ASK_RE.test(CLEAN(text)); }

/** Every part as triangles on one shared grid: [{ name, color, tris: [[a, b, c], …] }], mm, counter-clockwise from outside. */
export function pentamoteParts(model = PENTAMOTE) {
  const axes = [new Set(), new Set(), new Set()];
  model.boxes.forEach((list) => list.forEach((b) => { for (let d = 0; d < 3; d++) { axes[d].add(b[2 * d]); axes[d].add(b[2 * d + 1]); } }));
  const G = axes.map((s) => [...s].sort((a, b) => a - b));
  const n = G.map((g) => g.length - 1), at = (i, j, k) => (i * n[1] + j) * n[2] + k;
  const cell = new Int8Array(n[0] * n[1] * n[2]).fill(-1);
  for (let i = 0; i < n[0]; i++) for (let j = 0; j < n[1]; j++) for (let k = 0; k < n[2]; k++) {
    const c = [(G[0][i] + G[0][i + 1]) / 2, (G[1][j] + G[1][j + 1]) / 2, (G[2][k] + G[2][k + 1]) / 2];
    model.boxes.forEach((list, m) => { if (list.some((b) => c[0] > b[0] && c[0] < b[1] && c[1] > b[2] && c[1] < b[3] && c[2] > b[4] && c[2] < b[5])) cell[at(i, j, k)] = m; });
  }
  const mat = (i, j, k) => (i < 0 || j < 0 || k < 0 || i >= n[0] || j >= n[1] || k >= n[2] ? -1 : cell[at(i, j, k)]);
  const parts = MATERIALS.map((m) => ({ name: m.name, color: m.color, tris: [] }));
  for (let i = 0; i < n[0]; i++) for (let j = 0; j < n[1]; j++) for (let k = 0; k < n[2]; k++) {
    const m = mat(i, j, k); if (m < 0) continue;
    const idx = [i, j, k];
    for (let d = 0; d < 3; d++) for (const s of [1, -1]) {
      const nb = idx.slice(); nb[d] += s; if (mat(nb[0], nb[1], nb[2]) === m) continue;
      const u = (d + 1) % 3, v = (d + 2) % 3, p = (du, dv) => { const q = [0, 0, 0]; q[d] = G[d][idx[d] + (s > 0 ? 1 : 0)]; q[u] = G[u][idx[u] + du]; q[v] = G[v][idx[v] + dv]; return q; };
      const [a, b, c, e] = [p(0, 0), p(1, 0), p(1, 1), p(0, 1)]; // e_u × e_v = e_d: this order faces +d
      if (s > 0) parts[m].tris.push([a, b, c], [a, c, e]); else parts[m].tris.push([a, c, b], [a, e, c]);
    }
  }
  return parts;
}

const num = (v) => String(Math.abs(v) < 1e-9 ? 0 : +v.toFixed(4));
function meshXml(tris) {
  const verts = [], at = new Map(), faces = [];
  for (const t of tris) faces.push(t.map((v) => { const k = v.map(num).join(','); if (!at.has(k)) { at.set(k, verts.length); verts.push(v); } return at.get(k); }));
  return { count: faces.length, xml: '<mesh><vertices>' + verts.map((v) => '<vertex x="' + num(v[0]) + '" y="' + num(v[1]) + '" z="' + num(v[2]) + '"/>').join('')
    + '</vertices><triangles>' + faces.map((f) => '<triangle v1="' + f[0] + '" v2="' + f[1] + '" v3="' + f[2] + '"/>').join('') + '</triangles></mesh>' };
}

/** The package's files: [{ name, data }] (3D/3dmodel.model, the PrusaSlicer config, rels, content types). */
export function pentamoteFiles(parts = pentamoteParts()) {
  const meshes = parts.map((p) => meshXml(p.tris));
  const base = '<basematerials id="1">' + parts.map((p) => '<base name="' + p.name + '" displaycolor="' + p.color + 'FF"/>').join('') + '</basematerials>';
  const groups = parts.map((p, i) => '<m:colorgroup id="' + (2 + i) + '"><m:color color="' + p.color + 'FF"/></m:colorgroup>').join('');
  const objs = parts.map((p, i) => '<object id="' + (10 + i) + '" type="model" name="' + p.name + '" pid="' + (2 + i) + '" pindex="0">' + meshes[i].xml + '</object>').join('');
  const items = parts.map((p, i) => '<item objectid="' + (10 + i) + '"/>').join('');
  const model = '<?xml version="1.0" encoding="UTF-8"?><model unit="millimeter" xml:lang="en-US" xmlns="http://schemas.microsoft.com/3dmanufacturing/core/2015/02" xmlns:m="http://schemas.microsoft.com/3dmanufacturing/material/2015/02">'
    + '<metadata name="Title">' + PENTAMOTE.name + '</metadata><metadata name="Designer">A-to-Mind</metadata><metadata name="Application">a-to-mind.com Void</metadata>'
    + '<resources>' + base + groups + objs + '</resources><build>' + items + '</build></model>';
  const config = '<?xml version="1.0" encoding="UTF-8"?>\n<config>\n' + parts.map((p, i) => ' <object id="' + (10 + i) + '" instances_count="1">\n'
    + '  <metadata type="object" key="name" value="' + p.name + '"/>\n  <metadata type="object" key="extruder" value="' + (i + 1) + '"/>\n'
    + '  <volume firstid="0" lastid="' + (meshes[i].count - 1) + '">\n   <metadata type="volume" key="name" value="' + p.name + '"/>\n'
    + '   <metadata type="volume" key="volume_type" value="ModelPart"/>\n   <metadata type="volume" key="extruder" value="' + (i + 1) + '"/>\n  </volume>\n </object>\n').join('') + '</config>\n';
  return [
    { name: '[Content_Types].xml', data: '<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="model" ContentType="application/vnd.ms-package.3dmanufacturing-3dmodel+xml"/><Default Extension="config" ContentType="text/xml"/></Types>' },
    { name: '_rels/.rels', data: '<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Target="/3D/3dmodel.model" Id="rel0" Type="http://schemas.microsoft.com/3dmanufacturing/2013/01/3dmodel"/></Relationships>' },
    { name: '3D/3dmodel.model', data: model },
    { name: 'Metadata/Slic3r_PE_model.config', data: config },
  ];
}
export function pentamote3mf() { return zipStore(pentamoteFiles()); }

export const SOURCES = [
  { date: '2026-02-18', name: 'MIT News: the fully printed linear motor and its five material classes', href: 'https://news.mit.edu/2026/3d-printing-platform-rapidly-produces-complex-electric-machines-0218' },
  { date: '2025-06-06', name: 'ISO/IEC 25422:2025, the 3MF standard', href: 'https://www.iso.org/standard/90283.html' },
  { date: '2026-07-07', name: 'OrcaSlicer 2.4.2 3MF reader (one colour group per part)', href: 'https://github.com/OrcaSlicer/OrcaSlicer/blob/v2.4.2/src/libslic3r/Format/bbs_3mf.cpp' },
  { date: '2026-06-25', name: 'PrusaSlicer 2.9.6 3MF reader (extruders from its config file)', href: 'https://github.com/prusa3d/PrusaSlicer/blob/version_2.9.6/src/libslic3r/Format/3mf.cpp' },
];

function save(bytes) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([bytes], { type: 'model/3mf' }));
  a.download = 'pentamote-1.3mf';
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 4000);
}

export function motorbodyHtml(esc) {
  const P = PENTAMOTE, src = (s) => '<a href="' + esc(s.href) + '" target="_blank" rel="noopener">' + esc(s.name) + '</a> (' + esc(s.date) + ')';
  return '<h2>Pentamote-1</h2><div class="sub">five-material printed linear motor body · original design · not yet printed or tested</div>'
    + '<div class="pentamote-mini" style="height:200px;margin:8px 0 4px"></div>'
    + '<p>A ' + P.size.join(' × ') + ' mm motor body in the five material classes of the MIT printed motor: three flat coils on the floor push a magnet slab held '
    + P.gap + ' mm above them on two flexure springs. One file carries all five parts, each on its own extruder.</p>'
    + '<table style="border-collapse:collapse;margin:8px 0">' + MATERIALS.map((m, i) => '<tr><td style="padding:2px 10px 2px 0"><span style="display:inline-block;width:12px;height:12px;border-radius:3px;vertical-align:-1px;background:' + m.color + '"></span></td>'
      + '<td style="padding:2px 12px 2px 0;white-space:nowrap">extruder ' + (i + 1) + '</td><td style="padding:2px 12px 2px 0"><b>' + esc(m.name) + '</b></td><td style="color:#8a8a92">' + esc(m.role) + '</td></tr>').join('') + '</table>'
    + '<p style="margin:8px 0 4px"><b>How slicers read it</b></p><ul style="margin:0 0 0 18px;padding:0">'
    + '<li>OrcaSlicer 2.4.2: five named parts on extruders 1–5 (this file, round-tripped through its command line on 2026-10-08).</li>'
    + '<li>Bambu Studio: the same reader family, so the same five slots (read from its source, not run).</li>'
    + '<li>PrusaSlicer 2.9: extruders 1–5 from the PrusaSlicer config file inside the 3MF (read from its source, not run).</li>'
    + '<li>Cura: the five parts load by name; set each part’s extruder by hand.</li></ul>'
    + '<p style="margin:8px 0 4px"><b>After printing</b></p><p style="margin:0">The hard-magnetic slab still has to be magnetized on a separate fixture: '
    + '<a href="#" data-ask="show the magnetize step">the magnetize step</a>. The soft-magnetic teeth need no magnetizing. Coil lead-outs are not modelled yet.</p>'
    + '<p style="margin:12px 0 0"><button type="button" data-pentamote-3mf>Download 3MF</button> <span class="sub">pentamote-1.3mf · five parts, millimetres</span></p>'
    + '<div class="src">Dated sources: ' + SOURCES.map(src).join(' · ') + '. Original name and design by A-to-Mind; dimensions are a first design, not a tested part. Small magnets are dangerous if swallowed.</div>';
}

async function run(text, api) {
  if (!motorbodyOf(text)) return 'none';
  const { showPage, esc } = api;
  const page = showPage((p) => {
    p.innerHTML = motorbodyHtml(esc);
    const btn = p.querySelector('[data-pentamote-3mf]');
    if (btn) btn.addEventListener('click', () => save(pentamote3mf()));
  });
  const slot = page && page.querySelector('.pentamote-mini');
  if (slot && api.stage && api.stage.miniature) {
    api.stage.miniature(slot, 'pentamote', {}, { key: 'pentamote-page', place: 'inside', label: '3D Pentamote-1: the magnet slab shuttling over three coils, slowed down' }).catch(() => slot.remove());
  } else if (slot) slot.remove();
  return 'motorbody';
}

export default {
  name: 'motorbody',
  examples: ['download the printed motor as 3mf', 'show the multi-material print file', 'pentamote-1', 'summon pentamote', 'download a 3mf of the printed motor', 'show the five-material motor'],
  nearMisses: ['download a 3mf of the stage', 'export a print file', 'can you 3d print a motor', 'what is a 3mf file', 'show the magnetize step', 'summon linemote-1'],
  motorbodyOf,
  match(lower, text) { return motorbodyOf(text); },
  run,
};
