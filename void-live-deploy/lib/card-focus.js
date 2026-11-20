// The card takes keyboard focus when it opens, so the arrow keys play it at once (the audit: after "play snake" the ask box kept focus and the
// arrows did nothing until the board was clicked). Only a card the person just asked for takes it: one brought back after a reload does not
// pull focus away from the ask box. "Just asked" is an Enter in the ask box or a tap on its button within 30 s, or a link that carries the ask.
let askedAt = 0;
if (typeof document !== 'undefined') {
  const mark = () => { askedAt = Date.now(); };
  document.addEventListener('keydown', (e) => { if (e.key === 'Enter' && e.target && e.target.id === 'input') mark(); }, true);
  document.addEventListener('click', (e) => { if (e.target && e.target.closest && e.target.closest('#go')) mark(); }, true);
}
/** true when a card that opens now was just asked for. `now`, `search`, `age` (ms since the page opened) are injectable for the test. */
export function justAsked(now = Date.now(), at = askedAt, search = typeof location !== 'undefined' ? location.search : '', age = typeof performance !== 'undefined' ? performance.now() : 1e9) {
  if (at && now - at < 30000) return true;
  return /[?&](?:q|ask)=/.test(search) && age < 30000;
}
/** give the card keyboard focus when it was just asked for and the person is not typing somewhere else. */
export function takeFocus(el, active = typeof document !== 'undefined' ? document.activeElement : null) {
  if (!el || !justAsked()) return false;
  const typing = active && active !== document.body && active.id !== 'input' && (/^(INPUT|TEXTAREA|SELECT)$/.test(active.tagName) || active.isContentEditable);
  if (typing) return false;
  try { el.focus({ preventScroll: true }); } catch (_) { return false; }
  return true;
}
