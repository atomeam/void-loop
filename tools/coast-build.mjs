// Builds void-live-deploy/lib/flights-coast.js, the coastlines under the great-circle map of /flights/map/ (and the other flights pages that draw a map), from Natural
// Earth's 1:110m coastline (ne_110m_coastline, public domain: naturalearthdata.com/about/terms-of-use; no permission or credit needed, credited anyway). Each line is
// quantised to a quarter of a degree, repeated points dropped, and written as a string: the first point and then the steps between points, every number zigzagged and
// written as base64url digits of five bits (a digit of 32 or more says another digit follows). About 12 KB for the whole world, decoded on the device by decodeCoast.
//   node tools/coast-build.mjs <ne_110m_coastline.geojson>
// Test: tools/flights.test.mjs (the decoder gets back the quantised points).
import fs from 'node:fs'; import path from 'node:path'; import { fileURLToPath } from 'node:url';
export const Q = 4, ABC = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';
const zz = (n) => (n < 0 ? -2 * n - 1 : 2 * n);
/** a whole number as base64url digits of five bits, the last digit under 32. Pure. */
export function varint(n) { let v = zz(n), s = ''; while (v >= 32) { s += ABC[32 + (v & 31)]; v >>>= 5; } return s + ABC[v]; }
/** the quantised lines of a GeoJSON of LineStrings and MultiLineStrings: [[[x, y], ...], ...] in quarter degrees. Pure. */
export function linesOf(geo) {
  const out = [];
  for (const f of geo.features || []) { const g = f.geometry || {}; for (const l of g.type === 'LineString' ? [g.coordinates] : g.type === 'MultiLineString' ? g.coordinates : []) {
    const pts = []; for (const [x, y] of l) { const p = [Math.round(x * Q), Math.round(y * Q)]; if (!pts.length || pts[pts.length - 1][0] !== p[0] || pts[pts.length - 1][1] !== p[1]) pts.push(p); }
    if (pts.length >= 2) out.push(pts); } }
  return out;
}
/** one line as a string: the first point, then the steps. Pure. */
export const encodeLine = (pts) => pts.map((p, i) => (i ? varint(p[0] - pts[i - 1][0]) + varint(p[1] - pts[i - 1][1]) : varint(p[0]) + varint(p[1]))).join('');
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const src = process.argv[2]; if (!src) { console.error('usage: node tools/coast-build.mjs ne_110m_coastline.geojson'); process.exit(2); }
  const lines = linesOf(JSON.parse(fs.readFileSync(src, 'utf8'))), enc = lines.map(encodeLine);
  const js = '// Coastlines of the world for the flights maps: Natural Earth 1:110m coastline (ne_110m_coastline), public domain, naturalearthdata.com. Made with Natural Earth.\n'
    + '// Written by tools/coast-build.mjs: one string per line, quarter-degree points as zigzag base64url varints (the first point, then the steps); lib/flights-core.js decodeCoast reads it.\n'
    + 'export const COAST_Q = ' + Q + ';\nexport const COAST = ' + JSON.stringify(enc) + ';\n';
  const dest = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'void-live-deploy', 'lib', 'flights-coast.js'); fs.writeFileSync(dest, js);
  console.log('wrote ' + lines.length + ' lines, ' + lines.reduce((a, l) => a + l.length, 0) + ' points, ' + (js.length / 1024).toFixed(1) + ' KB');
}
