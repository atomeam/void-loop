// The secret every payer is told (owner, 2026-11-19: "everyone who pays Verse is told the secret: even Atom's cut is reinvested to improve everything").
// One string, here, and every place a payer sees a confirmation reads it: the store receipt (paid, and its saved text), the membership page, the team's
// member welcome, and the order the store's API returns. A new payment or thank-you page imports PAYER_SECRET from this file; tools/payer-secret.test.mjs
// fails when a page says "thank you" to a payer without it. Pure, no network. Tests: tools/payer-secret.test.mjs.

/** the line, in plain words, framed as a little secret. Change it here and every payer sees the change. */
export const PAYER_SECRET = "Here's a secret: even Atom's own cut goes back into making everything in Verse better.";

/** the line as text: after a sentence, with a space. */
export const withSecret = (text) => String(text || '').replace(/\s+$/, '') + ' ' + PAYER_SECRET;

/** the line as one quiet paragraph of HTML (it holds no markup of its own); `esc` is the page's escaper. */
export function secretHtml(esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]))) {
  return '<p class="payer-secret note" data-payer-secret>' + esc(PAYER_SECRET) + '</p>';
}
