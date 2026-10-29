// "Busy blocks" for one day (tools pack 2, owner 2026-10-18, item 34): a sketch of when you are taken and when you are free,
// typed in words ("standup 9-9:30, lunch 12-1, review 2:30-4"). No calendar is read and nothing is synced or sent. Pure.
import { clockMinutes, clockText, lengthText, spanMinutes } from './date-words.js';

const T = '(\\d{1,2}(?::\\d{2})?\\s*(?:[ap]\\.?m\\.?)?|noon|midnight)';
const RANGE_RE = new RegExp('\\b' + T + '\\s*(?:to|until|till|-|–|—)\\s*' + T + '\\b', 'i');
export const MAX_BLOCKS = 24;

/** one block from "standup 9-9:30" or "9-9:30 standup" -> { label, start, end } (minutes after midnight) or null. Pure. */
export function parseBlock(s) {
  const src = String(s || '').trim(), m = RANGE_RE.exec(src);
  if (!m) return null;
  const a = clockMinutes(m[1].replace(/\s+/g, '')), b = clockMinutes(m[2].replace(/\s+/g, ''));
  if (a === null || b === null) return null;
  const len = spanMinutes(a, b);
  if (!len) return null;
  const end = Math.min(1440, a + len);
  const label = (src.slice(0, m.index) + ' ' + src.slice(m.index + m[0].length)).replace(/\b(?:from|at|in|for|is|a|the)\s*$/i, '').replace(/^\s*(?:from|at|a|the)\s+/i, '').replace(/[:\-,;]+\s*$/g, '').replace(/^[:\-,;\s]+/, '').replace(/\s+/g, ' ').trim().slice(0, 40);
  return { label: label || 'busy', start: a, end };
}

/** the blocks an ask names: "busy blocks: standup 9-9:30, lunch 12-1 and review 2:30-4" (up to MAX_BLOCKS). Pure. */
export function parseBlocks(text) {
  const body = String(text || '').replace(/^[^:]*:\s*/, (m) => (/busy|block|day|sketch/i.test(m) ? '' : m));
  const parts = body.split(/\s*(?:,|;|\n|\band\b|&)\s*/i);
  const out = [];
  for (const p of parts) { const b = parseBlock(p); if (b) out.push(b); }
  return out.slice(0, MAX_BLOCKS);
}

/** what the ask wants: { act: 'show', blocks } | { act: 'add', blocks } | { act: 'clear' } | null. Pure. */
export function blockIntent(text) {
  const t = String(text || '').trim().replace(/[?!.]+$/, '').replace(/\s+/g, ' ');
  if (/^(?:please\s+)?(?:clear|remove|delete|hide|close)\s+(?:the\s+|my\s+)?busy[\s-]blocks?(?:\s+(?:card|sketch))?$/i.test(t)) return { act: 'clear' };
  let m = /^(?:please\s+)?add\s+(?:a\s+|another\s+)?busy[\s-]block\s*[:,-]?\s*(.+)$/i.exec(t);
  if (m) { const blocks = parseBlocks(m[1]); return blocks.length ? { act: 'add', blocks } : null; }
  m = /^(?:please\s+)?(?:(?:show|make|sketch|draw|give|build|start|open)\s+(?:me\s+)?(?:a\s+|my\s+|the\s+)?)?(?:busy[\s-]blocks?|(?:busy|day)[\s-]sketch|sketch\s+(?:of\s+)?my\s+day|day\s+blocks?)(?:\s+(?:card|sketch))?(?:\s*(?::|for|with)\s*(.*))?$/i.exec(t);
  if (m) return { act: 'show', blocks: m[1] ? parseBlocks(m[1]) : [] };
  return null;
}

/** the blocks sorted, with overlaps joined: [{start,end}]. Pure. */
export function merged(blocks) {
  const sorted = (blocks || []).map((b) => ({ start: b.start, end: b.end })).sort((a, b) => a.start - b.start || a.end - b.end), out = [];
  for (const b of sorted) { const last = out[out.length - 1]; if (last && b.start <= last.end) last.end = Math.max(last.end, b.end); else out.push(b); }
  return out;
}

/** the day's window: 8:00 to 18:00, widened to hold every block (whole hours). Pure. */
export function windowOf(blocks) {
  let lo = 480, hi = 1080;
  for (const b of blocks || []) { lo = Math.min(lo, Math.floor(b.start / 60) * 60); hi = Math.max(hi, Math.ceil(b.end / 60) * 60); }
  return { start: lo, end: Math.min(1440, hi) };
}

/** the free gaps inside the window. Pure. */
export function freeGaps(blocks, win = windowOf(blocks)) {
  const gaps = []; let at = win.start;
  for (const b of merged(blocks)) { if (b.start > at) gaps.push({ start: at, end: Math.min(b.start, win.end) }); at = Math.max(at, b.end); }
  if (at < win.end) gaps.push({ start: at, end: win.end });
  return gaps.filter((g) => g.end > g.start);
}

/** pairs of blocks that overlap (by index). Pure. */
export function clashes(blocks) {
  const out = [], list = blocks || [];
  for (let i = 0; i < list.length; i++) for (let j = i + 1; j < list.length; j++) if (list[i].start < list[j].end && list[j].start < list[i].end) out.push([i, j]);
  return out;
}

/** the numbers under the bar: busy minutes (overlaps counted once), free minutes in the window, the longest free gap, the clash count. Pure. */
export function summary(blocks) {
  const win = windowOf(blocks), busy = merged(blocks).reduce((s, b) => s + Math.max(0, Math.min(b.end, win.end) - Math.max(b.start, win.start)), 0);
  const gaps = freeGaps(blocks, win), longest = gaps.reduce((m, g) => (g.end - g.start > (m ? m.end - m.start : 0) ? g : m), null);
  return { win, busy, free: (win.end - win.start) - busy, gaps, longest, clashes: clashes(blocks).length };
}

export { clockText, lengthText };
