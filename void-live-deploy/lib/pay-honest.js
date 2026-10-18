// Asks about testing or taking payments on Verse are answered from verified facts only (a fix item, 2026-10-15: asked how to test
// payments, the model invented AI payment providers with fee and settlement scores, told the asker to make real one-cent charges
// and log in to dashboards, and said Cash App and crypto already work). Nothing here names a provider, a fee or a live feature
// that the store data (lib/store.js) and the live check do not confirm; the steps point to the verified doc instead.
export const PAY_DOC = 'https://github.com/atomeam/void-loop/blob/main/docs/payments.md';
const PAY = /\b(?:pay(?:ment|ments|ing)?|checkout|charge|charges|refunds?|stripe|gumroad|paypal|cash\s?app|venmo|crypto(?:currency)?|bitcoin|settlement|processor|payment\s+providers?)\b/i;
const ABOUT_US = /\b(?:can\s+i\s+pay|test(?:ing)?|try|set\s*up|accept|take|work|works|working|support|supported|enable|live|integrat\w*|which|best|options?|providers?|fees?)\b/i;
/** an ask about how payments work or are tested here. Pure. */
export function isPayAsk(ask) { const t = String(ask || ''); return PAY.test(t) && ABOUT_US.test(t) && !/\bhow\s+much\s+(?:is|does|do)\b/i.test(t); }
/** the honest answer: what is verified, what is not, and where the real steps are. Pure. */
export function payAnswer() {
  return 'I won\'t guess here. The only checkout Verse uses today is the Gumroad link on a live product in its store; anything else (Cash App, crypto, other providers) is not live unless the store says so. '
    + 'I don\'t have verified fees or settlement times, so I won\'t quote any. To test, use the provider\'s own test mode, never real charges, and follow the verified steps in docs/payments.md (' + PAY_DOC + ').';
}
// added to the model's answer rule everywhere: no invented products, figures or live claims
export const HONEST_RULE = 'Never invent named products, companies, prices, fees, scores or statistics. If you are not sure something exists or is true, say you are not sure. Never say a feature of this site works or is live unless the facts you were given say so.';
