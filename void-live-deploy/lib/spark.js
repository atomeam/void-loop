// A sparkline: one small SVG polyline from a list of points, the last point marked. Pure (no DOM): the Site Test stability
// trend (skills/growth.js) and the self card's growth velocity (lib/self-blocks.js) both draw with it. Tests: tools/spark.test.mjs.

/** sparkSvg(points, w, h, opts) -> '<svg class="…">…</svg>', or '' with no points.
 *  points  [{ [key]: number }], oldest first, drawn left to right, 0..max bottom to top (a value past max sits at the top)
 *  opts    key 'health' (the field read), max 100 (the value at the top), cls 'st-spark' (the svg's class), ticks false (a tick under each point),
 *          segmentColors null (one colour or null per segment, points.length - 1 of them: a coloured segment is drawn again over the line
 *          in that colour, class sp-seg; the self card's friction overlay). Without it the output is what it always was. */
export function sparkSvg(points, w = 72, h = 18, opts = {}) {
  if (!points || !points.length) return '';
  const key = opts.key || 'health', max = opts.max > 0 ? opts.max : 100, cls = opts.cls || 'st-spark';
  const xs = (i) => (points.length === 1 ? w - 3 : 3 + (i * (w - 6)) / (points.length - 1)), ys = (v) => (h - 2 - (Math.max(0, Math.min(max, v)) * (h - 4)) / max).toFixed(1);
  const last = points[points.length - 1], pts = points.map((p, i) => xs(i).toFixed(1) + ',' + ys(p[key])).join(' ');
  const ticks = opts.ticks ? points.map((_, i) => '<line class="sp-tick" x1="' + xs(i).toFixed(1) + '" y1="' + (h - 2) + '" x2="' + xs(i).toFixed(1) + '" y2="' + h + '" stroke="currentColor" stroke-opacity=".45" stroke-width="1"/>').join('') : '';
  const segs = Array.isArray(opts.segmentColors) ? opts.segmentColors.slice(0, points.length - 1).map((c, i) => (c ? '<line class="sp-seg" x1="' + xs(i).toFixed(1) + '" y1="' + ys(points[i][key]) + '" x2="' + xs(i + 1).toFixed(1) + '" y2="' + ys(points[i + 1][key]) + '" stroke="' + String(c).replace(/[^\w(),.%# -]/g, '') + '" stroke-width="1.5" stroke-linecap="round"/>' : '')).join('') : '';
  return '<svg class="' + cls + '" width="' + w + '" height="' + h + '" viewBox="0 0 ' + w + ' ' + h + '" aria-hidden="true">' + ticks + '<polyline points="' + pts + '" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/>'
    + segs + '<circle cx="' + xs(points.length - 1).toFixed(1) + '" cy="' + ys(last[key]) + '" r="2" fill="currentColor"/></svg>';
}
