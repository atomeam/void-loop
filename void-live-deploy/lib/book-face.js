// The faces of the 3D Verse Book (skills/mini/book.js): one page of skills/guide.json laid out on a sheet of paper, as a list of
// things to draw plus the places a tap lands. Pure, so it runs without a browser: the caller gives it a measure(text, font)
// function (a canvas' measureText in the page, a fixed width in the tests) and paints the result with paint(). The same page data
// the flat book reads (lib/guide.js, tools/guide.mjs), so the 3D book can never show a different page.
import { hueOf, seedOf, TIERS, TIER_MEANING } from './guide.js';

export const PAGE_W = 400, PAGE_H = 566; // the sheet's own units; the texture is drawn at a multiple of them
const SERIF = 'Georgia, "Times New Roman", serif', SANS = 'system-ui, -apple-system, "Segoe UI", sans-serif';
const INK = '#16111c', SOFT = '#473f50', PAPER = '#f3ead6'; // darker than a flat page: the lights and tone mapping wash paper out

/** wrap text to a width: lines. Pure given measure(text, font). */
export function wrap(text, font, width, measure, maxLines = 99) {
  const words = String(text || '').replace(/\s+/g, ' ').trim().split(' ').filter(Boolean), lines = [];
  let cur = '';
  for (const w of words) {
    const next = cur ? cur + ' ' + w : w;
    if (cur && measure(next, font) > width) { lines.push(cur); cur = w; } else cur = next;
  }
  if (cur) lines.push(cur);
  for (let i = 0; i < lines.length; i++) { // one word wider than the sheet (a long address) is cut with an ellipsis, never left to run off the page
    if (measure(lines[i], font) <= width) continue;
    let l = lines[i]; while (l.length > 1 && measure(l + '…', font) > width) l = l.slice(0, -1); lines[i] = l + '…'; // ellipsis-ok: drawn picture or short label, the full text is on the card
  }
  if (lines.length > maxLines) { lines.length = maxLines; lines[maxLines - 1] = lines[maxLines - 1].replace(/\s*\S*$/, '') + '…'; } // ellipsis-ok: drawn picture or short label, the full text is on the card
  return lines;
}

/**
 * One face: { ops, hits, n, gutter }. ops are { k: 'text', s, x, y, font, fill, align } | { k: 'rect', x, y, w, h, fill, r } |
 * { k: 'glyph', name, chapter, x, y, size } | { k: 'glow', x, y, r, hue } | { k: 'rule', x1, y1, x2, y2, stroke }; hits are { x, y, w, h, ask } or { x, y, w, h, page }
 * (a tap inside runs the ask on the stage, or jumps to the page). `side` is 'left' or 'right': which way the gutter is.
 * page is null for a blank sheet (no page on that side of the spread).
 */
export function layoutFace(page, book, side, measure) {
  const ops = [], hits = [], M = 34, IN = side === 'left' ? 30 : 42, OUT = side === 'left' ? 42 : 30; // the inner margin is wider, the gutter eats some
  const x0 = side === 'left' ? OUT : IN, w = PAGE_W - IN - OUT;
  const out = { ops, hits, n: page ? page.n : 0, gutter: side === 'left' ? 'right' : 'left' };
  if (!page) return out;
  const chap = ((book && book.chapters) || []).find((c) => c.id === page.chapter) || {};
  const hue = hueOf(page.chapter), accent = 'hsl(' + hue + ',52%,36%)', t = (s, x, y, font, fill, align = 'left') => ops.push({ k: 'text', s, x, y, font, fill, align });
  let y = M + 12;
  const footer = () => {
    ops.push({ k: 'rule', x1: x0, y1: PAGE_H - 46, x2: x0 + w, y2: PAGE_H - 46, stroke: 'rgba(43,36,49,.22)' });
    t(chap.name || '', x0, PAGE_H - 24, '13px ' + SANS, SOFT);
    t(String(page.n), x0 + w, PAGE_H - 24, '13px ' + SANS, SOFT, 'right');
  };
  const para = (text, size, color, gap, maxLines) => { const font = size + 'px ' + SERIF; for (const l of wrap(text, font, w, measure, maxLines)) { t(l, x0, y, font, color); y += size * 1.42; } y += gap; };
  const asks = (list, label) => {
    if (!list || !list.length) return;
    t(label || 'Try it: tap one', x0, y, '12px ' + SANS, SOFT); y += 10;
    for (const a of list.slice(0, 5)) {
      const font = '600 16px ' + SANS, ls = wrap(a, font, w - 22, measure, 2);
      hits.push({ x: x0 - 4, y: y, w: w + 8, h: ls.length * 21 + 8, ask: a });
      ops.push({ k: 'rect', x: x0 - 4, y: y, w: w + 8, h: ls.length * 21 + 8, fill: 'hsla(' + hue + ',55%,45%,.10)', r: 8 });
      ls.forEach((l, i) => t((i ? '   ' : '› ') + l, x0 + 4, y + 22 + i * 21 - 2, font, accent));
      y += ls.length * 21 + 14;
    }
  };

  if (page.kind === 'cover') {
    t('a-to-mind.com', x0 + w / 2, y + 10, '13px ' + SANS, SOFT, 'center'); y += 36;
    ops.push({ k: 'glyph', name: 'v01d', chapter: 'front', x: x0 + w / 2 - 90, y: y, size: 180 }); y += 214;
    t(page.title || 'The Verse Book', x0 + w / 2, y, '700 30px ' + SERIF, INK, 'center'); y += 34;
    for (const l of wrap(page.line, '17px ' + SERIF, w, measure, 3)) { t(l, x0 + w / 2, y, '17px ' + SERIF, SOFT, 'center'); y += 25; }
    const tot = (book && book.totals) || {};
    y += 12; t([tot.skills + ' skills', tot.games + ' games', tot.minis + ' 3D miniatures', tot.pages + ' pages'].join(' · '), x0 + w / 2, y, '13px ' + SANS, SOFT, 'center');
    y += 26; t('Tap the edge of a page to turn it.', x0 + w / 2, y, 'italic 13px ' + SERIF, SOFT, 'center');
    return out;
  }
  if (page.kind === 'toc') {
    t('Start here', x0, y, '13px ' + SANS, SOFT); y += 30; t(page.title || 'Contents', x0, y, '700 26px ' + SERIF, INK); y += 28;
    for (const c of ((book && book.chapters) || []).filter((c) => c.id !== 'front')) {
      if (y > PAGE_H - 66) break;
      hits.push({ x: x0 - 4, y: y - 17, w: w + 8, h: 25, page: c.from });
      t(c.name, x0, y, '600 16px ' + SANS, 'hsl(' + hueOf(c.id) + ',52%,34%)'); t(c.from + '–' + c.to, x0 + w, y, '14px ' + SANS, SOFT, 'right'); y += 27;
    }
    footer(); return out;
  }
  if (page.kind === 'index') {
    t('Index', x0, y, '13px ' + SANS, SOFT); y += 28; t(page.title || 'Index', x0, y, '700 22px ' + SERIF, INK); y += 24;
    // two columns: the flat book fits 36 entries on an index page and so must this one
    const rows = Math.floor((PAGE_H - 70 - y) / 19), cw = (w - 14) / 2, font = '13px ' + SANS;
    (page.entries || []).slice(0, rows * 2).forEach((e, i) => {
      const col = Math.floor(i / rows), ex = x0 + col * (cw + 14), ey = y + (i % rows) * 19;
      hits.push({ x: ex - 3, y: ey - 14, w: cw + 6, h: 19, page: e.page });
      let name = e.name; while (name.length > 1 && measure(name, font) > cw - 26) name = name.slice(0, -1) + (name.endsWith('…') ? '' : '');
      if (name !== e.name) name = name.slice(0, -1) + '…'; // ellipsis-ok: drawn picture or short label, the full text is on the card
      t(name, ex, ey, font, INK); t(String(e.page), ex + cw, ey, '12px ' + SANS, SOFT, 'right');
    });
    footer(); return out;
  }
  if (page.kind === 'opener') {
    t('Chapter', x0, y, '13px ' + SANS, SOFT); y += 40;
    // a long chapter name ("Safety and small delights") steps the title down until it fits the sheet, never off it
    let ts = 32; while (ts > 18 && measure(page.title, '700 ' + ts + 'px ' + SERIF) > w - 8) ts -= 2;
    t(page.title, x0, y, '700 ' + ts + 'px ' + SERIF, INK); y += 16;
    ops.push({ k: 'glyph', name: page.chapter, chapter: page.chapter, x: x0 + w / 2 - 80, y: y + 6, size: 160 }); y += 190;
    for (const l of wrap(page.line, '17px ' + SERIF, w, measure, 4)) { t(l, x0 + w / 2, y, '17px ' + SERIF, SOFT, 'center'); y += 25; }
    const n = (page.skills || []).length;
    t(n + (page.chapter === 'minis' ? ' miniatures' : ' skills') + (chap.from ? ' · pages ' + chap.from + '–' + chap.to : ''), x0 + w / 2, y + 8, '13px ' + SANS, SOFT, 'center');
    footer(); return out;
  }
  if (page.kind === 'how') {
    t('Start here', x0, y, '13px ' + SANS, SOFT); y += 34; t(page.title, x0, y, '700 26px ' + SERIF, INK); y += 26;
    para('The stage is the dark space behind this book. The box at the bottom is where you ask, in plain words.', 15, INK, 6, 4);
    para('Say what you want and it appears on the stage. Tap any ask in this book to run it.', 15, INK, 8, 3);
    asks((page.core || []).flatMap((c) => c.examples.slice(0, 1)), 'A few to start with');
    footer(); return out;
  }
  if (page.kind === 'legend') {
    t('Start here', x0, y, '13px ' + SANS, SOFT); y += 34; t(page.title, x0, y, '700 26px ' + SERIF, INK); y += 22;
    para('Each page is one thing Verse does. The rating is earned from evidence, never claimed:', 15, INK, 4, 3);
    TIERS.slice().reverse().forEach((k, i) => {
      const col = ['hsl(150,45%,32%)', 'hsl(225,50%,42%)', 'hsl(40,60%,36%)', 'hsl(0,0%,40%)'][i];
      t(k, x0, y, '700 16px ' + SANS, col); y += 20;
      for (const l of wrap(TIER_MEANING[k] || '', '13px ' + SERIF, w, measure, 2)) { t(l, x0, y, '13px ' + SERIF, SOFT); y += 17; }
      y += 8;
    });
    footer(); return out;
  }
  // a skill, a boxed game, a miniature
  const kicker = page.kind === 'mini' ? '3D miniature' : page.game ? 'On the rack' : (chap.name || '');
  t(kicker, x0, y, '13px ' + SANS, SOFT); y += 8;
  if (page.glow) ops.push({ k: 'glow', x: x0 + 37, y: y + 37, r: 62, hue: hueOf(page.chapter) }); // a proven skill's glyph glows (success_rate > 0.9)
  ops.push({ k: 'glyph', name: page.name || page.title, chapter: page.chapter, x: x0, y: y, size: 74 });
  const tx = x0 + 88;
  const head = wrap(page.title, '700 26px ' + SERIF, w - 88, measure, 2); let hy = y + 32;
  for (const l of head) { t(l, tx, hy, '700 26px ' + SERIF, INK); hy += 30; }
  y = Math.max(y + 90, hy + 8);
  para(page.line, 15, INK, 8, 7);
  if (page.kind === 'mini' && page.card) { for (const l of wrap('Carried by ' + page.card + '.', '13px ' + SERIF, w, measure, 2)) { t(l, x0, y, '13px ' + SERIF, SOFT); y += 17; } y += 6; }
  asks(page.examples);
  if (page.tier) {
    const label = (page.glow ? 'proven glow · ' + page.glow + '% of its benchmark asks pass · ' : '') + page.tier + (page.why ? ' · ' + page.why : ''), col = { proven: 'hsl(150,45%,32%)', checked: 'hsl(225,50%,42%)', tested: 'hsl(40,60%,36%)', experiment: 'hsl(0,0%,40%)' }[page.tier] || SOFT;
    const ls = wrap(label, '12px ' + SANS, w - 8, measure, 2), top = PAGE_H - 66 - ls.length * 16;
    ls.forEach((l, i) => t(l, x0, top + 14 + i * 16, '12px ' + SANS, col));
  }
  footer(); return out;
}

/** a small seeded random generator (mulberry32), so a glyph is the same on every visit */
export function rng(seed) { let a = seed >>> 0; return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

/** the shapes of a glyph: arcs and dots drawn from its name's seed in its chapter's hue. Pure: [{ t, ... }] in a 0..1 square. */
export function glyphShapes(name, chapter) {
  const r = rng(seedOf(String(name) + '|' + chapter)), hue = hueOf(chapter), out = [];
  const n = 5 + Math.floor(r() * 3);
  for (let i = 0; i < n; i++) out.push({ t: i % 3 === 2 ? 'dot' : 'arc', cx: 0.5, cy: 0.5, r: 0.14 + i * 0.065 + r() * 0.03, a0: r() * Math.PI * 2, a1: r() * Math.PI * 2 + 1.4, w: 0.018 + r() * 0.02, hue: hue + (r() - 0.5) * 30, l: 34 + r() * 16, dx: (r() - 0.5) * 0.5, dy: (r() - 0.5) * 0.5 });
  return out;
}

/** paint a layout onto a 2D canvas context at scale k (sheet units to pixels) */
export function paint(g, layout, k, w = PAGE_W, h = PAGE_H) {
  const grad = g.createLinearGradient(layout.gutter === 'left' ? 0 : w * k, 0, layout.gutter === 'left' ? w * k * 0.22 : w * k * 0.78, 0);
  g.fillStyle = PAPER; g.fillRect(0, 0, w * k, h * k);
  grad.addColorStop(0, 'rgba(90,66,40,.38)'); grad.addColorStop(1, 'rgba(90,66,40,0)'); g.fillStyle = grad; g.fillRect(0, 0, w * k, h * k);
  g.globalAlpha = 0.05; for (let i = 0; i < 260; i++) { g.fillStyle = i % 2 ? '#7a6445' : '#fff'; g.fillRect((seedOf('p' + layout.n + i) % (w * k)), (seedOf('q' + layout.n + i) % (h * k)), 1.5 * k, 1.5 * k); } g.globalAlpha = 1;
  for (const o of layout.ops) {
    if (o.k === 'rect') { g.fillStyle = o.fill; if (g.roundRect && o.r) { g.beginPath(); g.roundRect(o.x * k, o.y * k, o.w * k, o.h * k, o.r * k); g.fill(); } else g.fillRect(o.x * k, o.y * k, o.w * k, o.h * k); }
    else if (o.k === 'rule') { g.strokeStyle = o.stroke; g.lineWidth = k; g.beginPath(); g.moveTo(o.x1 * k, o.y1 * k); g.lineTo(o.x2 * k, o.y2 * k); g.stroke(); }
    else if (o.k === 'text') { g.font = o.font.replace(/(\d+(?:\.\d+)?)px/, (m, s) => (parseFloat(s) * k) + 'px'); g.fillStyle = o.fill; g.textAlign = o.align; g.textBaseline = 'alphabetic'; g.fillText(o.s, o.x * k, o.y * k); }
    else if (o.k === 'glow') {
      const gr = g.createRadialGradient(o.x * k, o.y * k, 0, o.x * k, o.y * k, o.r * k);
      gr.addColorStop(0, 'hsla(' + o.hue + ',90%,62%,.55)'); gr.addColorStop(1, 'hsla(' + o.hue + ',90%,62%,0)');
      g.fillStyle = gr; g.fillRect((o.x - o.r) * k, (o.y - o.r) * k, o.r * 2 * k, o.r * 2 * k);
    }
    else if (o.k === 'glyph') {
      const s = o.size * k, x = o.x * k, y = o.y * k;
      g.save(); g.lineCap = 'round';
      for (const sh of glyphShapes(o.name, o.chapter)) {
        g.strokeStyle = g.fillStyle = 'hsl(' + sh.hue + ',55%,' + sh.l + '%)';
        if (sh.t === 'arc') { g.lineWidth = sh.w * s; g.beginPath(); g.arc(x + s * (sh.cx + sh.dx * 0.15), y + s * (sh.cy + sh.dy * 0.15), sh.r * s, sh.a0, sh.a1); g.stroke(); }
        else { g.beginPath(); g.arc(x + s * (sh.cx + sh.dx * 0.5), y + s * (sh.cy + sh.dy * 0.5), s * 0.035, 0, Math.PI * 2); g.fill(); }
      }
      g.restore();
    }
  }
}

/** the hit under a point of the sheet (x, y in sheet units), or null. Pure. */
export function hitAt(layout, x, y) { return (layout.hits || []).find((h) => x >= h.x && x <= h.x + h.w && y >= h.y && y <= h.y + h.h) || null; }

/** which edge a tap on the sheet turns: 'next' for the right page's outer margin, 'prev' for the left page's, else null. Pure. */
export function edgeAt(side, x) { return side === 'right' && x > PAGE_W * 0.86 ? 'next' : side === 'left' && x < PAGE_W * 0.14 ? 'prev' : null; }
