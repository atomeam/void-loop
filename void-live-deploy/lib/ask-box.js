// One length for an ask, from the box to the server (lib/answer-honesty.js ASK_MAX is the same number).
export const ASK_CAP = 4000;
export const clipAsk = (s) => String(s == null ? '' : s).trim().slice(0, ASK_CAP);

/** a one-line box that grows with the text. Enter sends. Shift+Enter keeps a new line. */
export function askBox(el) {
  if (!el) return el;
  el.maxLength = ASK_CAP;
  const grow = () => { el.style.height = 'auto'; const h = el.scrollHeight; el.style.height = Math.min(h || 40, 144) + 'px'; };
  el.addEventListener('input', grow);
  el.addEventListener('keydown', (e) => {
    if (e.key !== 'Enter' || e.shiftKey || e.isComposing) return;
    e.preventDefault();
    if (el.form) el.form.requestSubmit();
  });
  grow();
  return el;
}
