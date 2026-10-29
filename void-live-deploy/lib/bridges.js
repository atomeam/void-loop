// Bridges between stage kinds (asked by Verse, 2026-10-16: a kept card into a notepad line, a dropped thing into a list
// entry, a list entry into a notepad line, two figures' argument and a self-play rating written down). Pure: what one kind
// hands another, as text, and whether two boxes on the stage overlap. The DOM work stays in the skills that call these.

const squeeze = (s) => String(s || '').replace(/\s+/g, ' ').trim();

/** the words of a kept card's saved html: the answer and what it answered, without the buttons, art, title and footer. Browser only. */
export function plainOf(html) {
  try {
    const body = new DOMParser().parseFromString(String(html || ''), 'text/html').body;
    body.querySelectorAll('button, svg, canvas, script, style, .vc-title, .vc-art, .vc-type, .vc-foot, .vc-arrows, .src').forEach((e) => e.remove());
    return squeeze([...body.children].map((e) => e.textContent).join(' ') || body.textContent);
  } catch (_) { return ''; }
}

/** a kept card as one notepad line: its name (or the ask it kept) and its words, at most `max` characters. Pure. */
export function keptNote(th, plain = '', max = 600) {
  if (!th) return '';
  const head = squeeze(th.name || th.ask || 'kept card'), body = squeeze(plain);
  const line = body && body !== head ? head + ': ' + body : head;
  return line;
}

/** what a stage thing dropped on a list becomes: its words, or its name, or nothing (a figure, a game). Pure. */
export function entryFor(th, plain = '') {
  if (!th || !th.kind) return '';
  const k = th.kind;
  if (k === 'list' || k === 'figure' || k === 'pong' || k === 'snake') return '';
  const text = k === 'sticky' || k === 'label' ? th.text : k === 'notepad' ? (th.title || th.text) : k === 'kept' ? (th.name || th.ask || plain) : k === 'link' ? (th.title || th.url) : k === 'timer' ? 'timer ' + Math.round((th.duration || 0) / 60000) + ' min' : k === 'counter' ? 'count ' + (th.value || 0) : (th.title || th.name || th.label || k);
  return squeeze(String(text || '').split('\n')[0]).slice(0, 120);
}

/** a list entry as a notepad line, ticked ones marked. Pure. */
export const itemLine = (item) => (item && item.text ? (item.done ? '☑ ' : '☐ ') + squeeze(item.text) : '');

/** two boxes {x,y,w,h} share any area. Pure. */
export const boxOverlap = (a, b) => !!(a && b) && a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;

/** the ids whose boxes overlap the box of `id` (boxes: { id: {x,y,w,h} }). Pure. */
export function overlapping(boxes, id) {
  const me = boxes && boxes[id];
  if (!me) return [];
  return Object.keys(boxes).filter((k) => k !== id && boxOverlap(me, boxes[k]));
}

/** what two figures did, as a dated notepad line ("18:40 the police officer and the thief spar: …"). Pure. */
export function togetherLine(c, now = new Date()) {
  if (!c || !c.why) return '';
  const hh = String(now.getHours()).padStart(2, '0') + ':' + String(now.getMinutes()).padStart(2, '0');
  return hh + ' ' + c.why;
}

/** a self-play rating as a notepad line to finish ("self-play connect four, Oct 16: rated 1609 (+62 since Oct 10). Why: "). Pure. */
export function arenaNoteLine(game, a, delta = '', now = new Date()) {
  const title = { connect4: 'connect four', othello: 'othello' }[game] || String(game || 'this game');
  const L = (a && Array.isArray(a.ladder) ? a.ladder : []).filter((s) => Number.isFinite(+s.rating));
  const top = L.length ? Math.max(...L.map((s) => Math.round(+s.rating))) : null;
  const day = now.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  return 'self-play ' + title + ', ' + day + ': ' + (top === null ? 'no rating yet' : 'rated ' + top + (delta ? ' (' + delta + ')' : '')) + '. Why: ';
}
