/**
 * part skill — summon Linemote-1, the first printable part: a page with what it is, its dimensions, materials, the one
 * post-step and the three dated sources, plus a Download button for one STL a slicer can take.
 * Contract: { name, examples, nearMisses, match(lower, text), run(text, api) }
 * The STL is built here from plain boxes and two round mount holes (millimetres, ASCII STL). No network, no libraries.
 * Linemote-1 is an original design and an untested one: the page says so. Not a body, not a wearable, not medical.
 */
const CLEAN = (s) => String(s || '').trim().replace(/[?!.]+$/, '').replace(/\s+/g, ' ');

export function wantsLinemote(text) {
  const t = CLEAN(text).toLowerCase();
  if (/\bline[\s-]?mote(?:[\s-]*(?:1|one))?\b/.test(t)) return true;
  // "summon / show / make / export / download a printable (linear) actuator (spec)"
  return /^(?:please\s+)?(?:summon|show(?:\s+me)?|make(?:\s+me)?|give\s+me|export|download|print)\s+(?:a\s+|the\s+)?(?:printable|printed|3d[\s-]?printable)\s+(?:linear\s+)?actuator(?:\s+spec)?$/.test(t);
}

// ---- the part, in millimetres ----
export const LINEMOTE = {
  name: 'Linemote-1',
  rail: { length: 22, width: 6, height: 5, wall: 0.8, base: 1, channel: 4.4 },
  slider: { length: 8, width: 4, height: 3.6, pocket: [3.2, 3.2, 1.2] },
  stroke: 3.5,
  coil: { from: 8, to: 14, recess: 0.3 },
  holes: { diameter: 1.2, at: [1.5, 20.5] },
  stops: [[4.25, 5.25], [16.75, 17.75]],
  magnet: '3 × 3 × 1 mm neodymium (N52)',
};

// axis-aligned box [x0,x1]×[y0,y1]×[z0,z1] as 12 triangles, counter-clockwise seen from outside
function box(tris, x0, x1, y0, y1, z0, z1) {
  const p = (x, y, z) => [x, y, z];
  const quad = (a, b, c, d) => { tris.push([a, b, c], [a, c, d]); };
  quad(p(x0, y0, z0), p(x0, y1, z0), p(x1, y1, z0), p(x1, y0, z0)); // bottom (-z)
  quad(p(x0, y0, z1), p(x1, y0, z1), p(x1, y1, z1), p(x0, y1, z1)); // top (+z)
  quad(p(x0, y0, z0), p(x1, y0, z0), p(x1, y0, z1), p(x0, y0, z1)); // front (-y)
  quad(p(x0, y1, z0), p(x0, y1, z1), p(x1, y1, z1), p(x1, y1, z0)); // back (+y)
  quad(p(x0, y0, z0), p(x0, y0, z1), p(x0, y1, z1), p(x0, y1, z0)); // left (-x)
  quad(p(x1, y0, z0), p(x1, y1, z0), p(x1, y1, z1), p(x1, y0, z1)); // right (+x)
}

// a square tab (side s, centre cx,cy) from z0 to z1 with a round through-hole of radius r, as one closed shell
function holedTab(tris, cx, cy, s, r, z0, z1, n = 32) {
  const h = s / 2, inner = [], outer = [];
  for (let i = 0; i < n; i++) {
    const a = (2 * Math.PI * i) / n, c = Math.cos(a), si = Math.sin(a), k = h / Math.max(Math.abs(c), Math.abs(si));
    inner.push([cx + r * c, cy + r * si]);
    outer.push([cx + k * c, cy + k * si]); // the ray's point on the square (n a multiple of 8 puts the corners on rays)
  }
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n, [ia, ib, oa, ob] = [inner[i], inner[j], outer[i], outer[j]];
    tris.push([[ia[0], ia[1], z1], [oa[0], oa[1], z1], [ob[0], ob[1], z1]], [[ia[0], ia[1], z1], [ob[0], ob[1], z1], [ib[0], ib[1], z1]]); // top
    tris.push([[ia[0], ia[1], z0], [ob[0], ob[1], z0], [oa[0], oa[1], z0]], [[ia[0], ia[1], z0], [ib[0], ib[1], z0], [ob[0], ob[1], z0]]); // bottom
    tris.push([[oa[0], oa[1], z0], [ob[0], ob[1], z0], [ob[0], ob[1], z1]], [[oa[0], oa[1], z0], [ob[0], ob[1], z1], [oa[0], oa[1], z1]]); // outer wall
    tris.push([[ia[0], ia[1], z0], [ia[0], ia[1], z1], [ib[0], ib[1], z1]], [[ia[0], ia[1], z0], [ib[0], ib[1], z1], [ib[0], ib[1], z0]]); // hole wall
  }
}

/** Both printed pieces as triangles: the rail at the origin, the slider beside it (y 9..13). */
export function linemoteTriangles() {
  const L = LINEMOTE, t = [];
  const { length: RL, width: RW, height: RH, wall: W, base: B } = L.rail;
  const tab = 3, ty0 = (RW - tab) / 2, ty1 = ty0 + tab;
  // base plate: the middle, and each end as a holed tab between two strips
  box(t, tab, RL - tab, 0, RW, 0, B);
  for (const [x0, cx] of [[0, L.holes.at[0]], [RL - tab, L.holes.at[1]]]) {
    holedTab(t, cx, RW / 2, tab, L.holes.diameter / 2, 0, B);
    box(t, x0, x0 + tab, 0, ty0, 0, B);
    box(t, x0, x0 + tab, ty1, RW, 0, B);
  }
  // side walls, thinned on the outside where the coil is wound
  const { from: c0, to: c1, recess: cr } = L.coil;
  for (const [y0, y1, yr0, yr1] of [[0, W, cr, W], [RW - W, RW, RW - W, RW - cr]]) {
    box(t, 0, c0, y0, y1, B, RH);
    box(t, c0, c1, yr0, yr1, B, RH);
    box(t, c1, RL, y0, y1, B, RH);
  }
  // end stops on the channel floor: the slider travels L.stroke between them
  for (const [x0, x1] of L.stops) box(t, x0, x1, W, RW - W, B, B + 1.5);
  // slider: a block with the magnet pocket open on top
  const { length: SL, width: SW, height: SH, pocket: [PX, PY, PZ] } = L.slider;
  const sy = 9, px0 = (SL - PX) / 2, px1 = px0 + PX, py0 = sy + (SW - PY) / 2, py1 = py0 + PY, zp = SH - PZ;
  box(t, 0, SL, sy, sy + SW, 0, zp);
  box(t, 0, px0, sy, sy + SW, zp, SH);
  box(t, px1, SL, sy, sy + SW, zp, SH);
  box(t, px0, px1, sy, py0, zp, SH);
  box(t, px0, px1, py1, sy + SW, zp, SH);
  return t;
}

const fmt = (v) => (Math.abs(v) < 1e-9 ? 0 : +v.toFixed(4)).toString();

export function linemoteSTL() {
  const lines = ['solid linemote_1'];
  for (const [a, b, c] of linemoteTriangles()) {
    const u = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], v = [c[0] - a[0], c[1] - a[1], c[2] - a[2]];
    const n = [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]];
    const len = Math.hypot(...n) || 1;
    lines.push(' facet normal ' + n.map((x) => fmt(x / len)).join(' '), '  outer loop',
      ...[a, b, c].map((p) => '   vertex ' + p.map(fmt).join(' ')), '  endloop', ' endfacet');
  }
  lines.push('endsolid linemote_1');
  return lines.join('\n') + '\n';
}

const SOURCES = [
  ['The basis: fully 3D-printed electric linear motor', 'Cañada, Bigelow, Velásquez-García · MIT News, 2026-02-18 · DOI 10.1080/17452759.2026.2613185',
    'https://news.mit.edu/2026/3d-printing-platform-rapidly-produces-complex-electric-machines-0218'],
  ['Same actuator family: stamped skeletal muscle that pulls in more than one direction', 'Raman group · MIT News, 2025-03-17',
    'https://news.mit.edu/2025/artificial-muscle-flexes-multiple-directions-offering-path-soft-wiggly-robots-0317'],
  ['Same actuator family: electrofluidic fiber muscle', 'Afsar, Cacucciolo · Zenodo, 2025-12-11',
    'https://zenodo.org/records/17902764'],
];

async function run(text, api) {
  const { showPage, esc } = api;
  if (!wantsLinemote(text)) return 'none';
  const L = LINEMOTE;
  const row = (k, v) => '<tr><td style="color:#8a8a8a;padding:2px 14px 2px 0">' + esc(k) + '</td><td>' + esc(v) + '</td></tr>';
  showPage((p) => {
    p.innerHTML = '<h2>Linemote-1</h2>'
      + '<div class="sub">finger-scale linear actuator · original design · not yet printed or tested</div>'
      + '<p>A printed rail, a printed slider carrying a small magnet, and a copper coil wound around the rail. Current in the coil pushes or pulls the slider a few millimetres. It is the smallest printable descendant of the printed linear motor below: one part, no body.</p>'
      + '<table style="border-collapse:collapse;margin:8px 0">'
      + row('Rail', L.rail.length + ' × ' + L.rail.width + ' × ' + L.rail.height + ' mm, channel ' + L.rail.channel + ' mm wide')
      + row('Slider', L.slider.length + ' × ' + L.slider.width + ' × ' + L.slider.height + ' mm, magnet pocket ' + L.slider.pocket.join(' × ') + ' mm')
      + row('Stroke', L.stroke + ' mm, between two printed end stops')
      + row('Coil channel', (L.coil.to - L.coil.from) + ' mm long, ' + L.coil.recess + ' mm deep, around the rail middle')
      + row('Mount holes', '2 × Ø' + L.holes.diameter + ' mm, through the base at each end')
      + '</table>'
      + '<p style="margin:8px 0 4px"><b>Materials</b></p><ul style="margin:0 0 0 18px;padding:0">'
      + '<li>PLA or PETG for the rail and the slider (0.4 mm nozzle, 0.1 mm layers)</li>'
      + '<li>' + esc(L.magnet) + ' magnet for the slider</li>'
      + '<li>0.15 mm enamelled copper wire, about 70 turns in the coil channel</li>'
      + '<li>Optional: TPU pad on the slider face</li></ul>'
      + '<p style="margin:8px 0 4px"><b>One post-step: magnetize</b></p>'
      + '<p style="margin:0">Magnetize the core after printing, as the MIT process does for its printed hard magnets. With a bought magnet it arrives magnetized: press it into the pocket, pole up. Then wind the coil and drive it from a low-voltage supply.</p>'
      + '<p style="margin:8px 0 4px"><b>Sources</b></p><ol style="margin:0 0 0 18px;padding:0">'
      + SOURCES.map(([what, who, url]) => '<li>' + esc(what) + ' · ' + esc(who) + ' · <a href="' + esc(url) + '" target="_blank" rel="noopener">' + esc(url.replace(/^https:\/\//, '')) + '</a></li>').join('')
      + '</ol>'
      + '<p style="margin:8px 0 0;color:#8a8a8a">Safety: not medical, not load-bearing, low voltage only. Small magnets are dangerous if swallowed: keep the magnet and the finished part away from children and pets.</p>'
      + '<p style="margin:12px 0 0"><button type="button" data-linemote-stl>Download STL</button> <span class="sub" data-linemote-note>linemote-1.stl · rail and slider on one plate, millimetres</span></p>'
      + '<div class="src">Original name and design by A-to-Mind. Dimensions are a first design, not a tested part.</div>';
    const btn = p.querySelector('[data-linemote-stl]');
    if (btn) btn.addEventListener('click', () => {
      const blob = new Blob([linemoteSTL()], { type: 'model/stl' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = 'linemote-1.stl';
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(a.href), 4000);
    });
  });
  return 'linemote';
}

export default {
  name: 'part',
  examples: [
    'summon linemote-1',
    'linemote',
    'show me linemote 1',
    'summon a printable actuator spec',
    'download the printable linear actuator',
  ],
  nearMisses: [
    'what is a linear motor',
    'remote control',
    'make a 3d cube',
    'line graph of sales',
  ],
  match(lower, text) { return wantsLinemote(text); },
  run,
};
