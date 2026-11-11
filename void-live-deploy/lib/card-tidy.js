// A crowd of cards, and where a flick rests. A pinned card stays unless it is off the area, overlaps another pin, or the others cannot fit.
const HEAD = /^(?:please\s+)?(?:draw\b|make\s+(?:a\s+|me\s+)?(?:\d+\s*(?:min(?:ute)?|sec(?:ond)?)s?\s+)?(?:timer|clock|note|sticky|cartoon|list|counter)\b|(?:add\s+(?:a\s+)?)?(?:\d+\s*(?:min(?:ute)?|sec(?:ond)?)s?\s+)?(?:timer|clock|note|sticky|weather|cartoon|news|countdown|stopwatch|list|counter|joke|fact|define|convert|translate)\b)/i;

export function splitAsks(text) {
  const t = String(text || '').trim();
  if (!t || t.length > 180 || /[:?]/.test(t)) return null;
  // Shield only the prepositional "between X and Y" span so a compound prompt is not torn in half:
  // "Check the contrast ratio between #0d0d14 and #7dd3fc and generate a QR code for https://a-to-mind.com"
  // keeps the two colours together and splits only before "generate". Noun lists like "timer and draw and
  // weather" still split normally because they carry no "between". (owner live test, 2026-11-11)
  const MASK = '\u0000';
  const masked = t.replace(/\b(between\s+\S+(?:\s+\S+){0,3}?)\s+and\s+(\S+)/gi, '$1' + MASK + '$2');
  const parts = masked.split(/\s+and\s+/i).map((s) => s.trim().replace(new RegExp(MASK, 'g'), ' and ')).filter(Boolean);
  if (parts.length < 2 || parts.length > 5) return null;
  if (parts.some((p) => p.length > 42 || !HEAD.test(p))) return null;
  return parts;
}

const hit = (a, b, gap) => a.x < b.x + b.w + gap && b.x < a.x + a.w + gap && a.y < b.y + b.h + gap && b.y < a.y + a.h + gap;

export function coast(s) {
  let x = +s.x || 0, y = +s.y || 0, vx = +s.vx || 0, vy = +s.vy || 0;
  const w = +s.w || 0, h = +s.h || 0, stageW = +s.stageW || 0, stageH = +s.stageH || 0;
  const fr = s.friction > 0 && s.friction < 1 ? s.friction : 0.955;
  const frames = [{ x, y }];
  const off = (px, py) => px + w < 0 || py + h < 0 || (stageW && px > stageW) || (stageH && py > stageH);
  if (off(x, y)) return { x, y, off: true, frames };
  for (let i = 0; i < 90; i++) {
    vx *= fr; vy *= fr;
    x += vx * 16; y += vy * 16;
    if (off(x, y)) return { x, y, off: true, frames };
    frames.push({ x, y });
    if (Math.hypot(vx, vy) < 0.05) break;
  }
  if (stageW) x = Math.max(8, Math.min(x, Math.max(8, stageW - w - 8)));
  if (stageH) y = Math.max(8, Math.min(y, Math.max(8, stageH - h - 8)));
  return { x: Math.round(x), y: Math.round(y), off: false, frames };
}

function grid(group, W, H, floor) {
  const gap = 10, edge = 8, aw = W - edge * 2, ah = H - edge * 2, n = group.length, moves = {};
  if (!n) return moves;
  // 148px is enough for a stage thing. floor is a wider minimum (an answer card on a phone): half a phone is narrower than the card's own row.
  const minW = Math.min(Math.max(148, +floor || 0), aw);
  let cols = 1;
  while (cols < n && (aw - cols * gap) / (cols + 1) >= minW) cols++;
  const rows = Math.ceil(n / cols);
  const cw = (aw - (cols - 1) * gap) / cols;
  const ch = Math.max(56, (ah - (rows - 1) * gap) / rows);
  group.forEach((c, i) => {
    const col = i % cols, row = Math.floor(i / cols);
    moves[c.id] = { x: Math.round(edge + col * (cw + gap)), y: Math.round(edge + row * (ch + gap)), w: Math.round(cw), h: Math.round(Math.min(ch, ah)) };
  });
  return moves;
}

export function tidy(cards, area, floor) {
  const gap = 10, edge = 8;
  const list = (cards || []).filter((c) => c && c.id != null && c.w > 0 && c.h > 0);
  const W = Math.max(0, +(area && area.w) || 0), H = Math.max(0, +(area && area.h) || 0);
  if (!list.length || W < 40 || H < 40) return {};
  const inside = (c) => c.x >= -1 && c.y >= -1 && c.x + c.w <= W + 1 && c.y + c.h <= H + 1;
  const pins = list.filter((c) => c.pinned);
  const pinned = pins.filter(inside);
  const bad = pinned.length !== pins.length || pinned.some((a, i) => pinned.slice(i + 1).some((b) => hit(a, b, gap)));
  if (!pinned.length || bad) return grid(list, W, H, floor);
  const free = list.filter((c) => !c.pinned);
  if (!free.length) return {};
  const slots = Object.values(grid(list, W, H, floor)).filter((s) => !pinned.some((p) => hit(s, p, gap)));
  if (slots.length < free.length) return grid(list, W, H, floor);
  const moves = {};
  free.forEach((c, i) => { moves[c.id] = slots[i]; });
  return moves;
}
