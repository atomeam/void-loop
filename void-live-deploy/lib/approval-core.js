// The confirm line (plan item 7), built on ApprovalEvent v0.
// One plain line before anything that sends, books or spends; changed request or no answer = it doesn't run.
// Shared by the page (import('/lib/approval-core.js')) and the server (functions/api/approval.js) so the
// policy, the wording and the fingerprint can never drift apart. Read-only asks never reach this file's gate.

export const POLICY_VERSION = 'void-confirm-v0.1';
export const EVENT_REQUESTED = 'a2m.approval.requested';
export const EVENT_DECISION = 'a2m.approval.decision';
// Cloudflare Workflows event types must match ^[a-zA-Z0-9_][a-zA-Z0-9-_]*$ (no dots), so the same decision
// event travels as this type when it is handed to step.waitForEvent / instance.sendEvent.
export const WORKFLOW_EVENT_TYPE = 'a2m-approval-decision';
export const DECISIONS = ['approve', 'reject', 'timeout', 'escalate'];
export const NEEDS_REASON = ['reject', 'escalate'];
export const CONFIRM_TTL_MS = 2 * 60 * 1000; // how long the line waits; after that it fails closed
export const ORG_ID = 'a2m';
export const WORKFLOW_ID = 'void.ask';

// Every action that sends, books or spends. Anything not listed here is read-only and is never gated.
export const GATED = {
  'email.send': { rule: 'send.email', kind: 'send', service: 'email', board: 'send an email' },
  'message.send': { rule: 'send.message', kind: 'send', service: 'messaging', board: 'send a message' },
  'release.publish': { rule: 'send.post', kind: 'send', service: 'GitHub', board: 'post release notes' },
  'calendar.book': { rule: 'book.calendar', kind: 'book', service: 'your calendar', board: 'add to my calendar' },
  'booking.make': { rule: 'book.booking', kind: 'book', service: 'booking', board: 'make a booking' },
  'order.place': { rule: 'spend.order', kind: 'spend', service: 'shopping', board: 'buy something' },
  'payment.send': { rule: 'spend.payment', kind: 'spend', service: 'payments', board: 'pay someone' },
  // A standing spend on a stronger model, paid only from what Void earned (STANDING.md; lib/router.js). The newest one wins; $0 stops it.
  'models.spend': { rule: 'spend.models', kind: 'spend', service: 'model spending', board: 'let Void pay for a stronger model' },
};
export const isGated = (toolName) => Object.prototype.hasOwnProperty.call(GATED, toolName);
export const NOTHING = { send: 'nothing sent', book: 'nothing booked', spend: 'nothing spent' };
export const DONE = { send: 'sent', book: 'booked', spend: 'done' };

// Stable JSON: keys sorted at every level, so the same request always has the same fingerprint.
export function canonical(v) {
  if (Array.isArray(v)) return '[' + v.map(canonical).join(',') + ']';
  if (v && typeof v === 'object') return '{' + Object.keys(v).sort().filter((k) => v[k] !== undefined).map((k) => JSON.stringify(k) + ':' + canonical(v[k])).join(',') + '}';
  return JSON.stringify(v === undefined ? null : v);
}
export async function fingerprint(toolName, args) {
  const bytes = new TextEncoder().encode(canonical({ tool: toolName, args: args || {} }));
  const h = await crypto.subtle.digest('SHA-256', bytes);
  return 'sha256:' + [...new Uint8Array(h)].map((x) => x.toString(16).padStart(2, '0')).join('');
}

// The cost is part of the args, so a changed price changes the fingerprint.
export function budgetImpact(toolName, args) {
  const c = args && args.cost;
  if (!c || typeof c.amount !== 'number') return null;
  return { amount: c.amount, currency: c.currency || 'USD', kind: (GATED[toolName] || {}).kind || 'spend' };
}
export function money(c) {
  if (!c) return '';
  const n = Number.isInteger(c.amount) ? String(c.amount) : c.amount.toFixed(2);
  const sym = { USD: '$', EUR: '€', GBP: '£' }[c.currency];
  return sym ? sym + n : n + ' ' + c.currency;
}

// The line itself: what will happen, to whom or where, and the cost if any. No jargon.
export function confirmLine(toolName, args) {
  const a = args || {};
  const cost = a.cost ? money(a.cost) : '';
  switch (toolName) {
    case 'email.send': return `Send this email to ${a.to}?`;
    case 'message.send': return `Send this message to ${a.to}?`;
    case 'release.publish': return `Post these release notes to ${a.where}?`;
    case 'calendar.book': return `Add “${a.what}” to your calendar${a.when ? ' ' + a.when : ''}?`;
    case 'booking.make': return `Book ${a.what}${cost ? ' for ' + cost : ''}?`;
    case 'order.place': return cost ? `Buy ${a.item} for ${cost}?` : `Buy ${a.item}? The price isn't known yet.`;
    case 'payment.send': return `Pay ${a.to} ${cost}?`;
    case 'models.spend': return a.cost && a.cost.amount > 0 ? `Let Void spend up to ${cost} a ${a.per || 'month'} of what it earned on a stronger model?` : 'Stop Void paying for a stronger model?';
    default: return '';
  }
}

function parseCost(s) {
  const m = String(s || '').trim().match(/^(?:([$€£])\s*(\d+(?:\.\d{1,2})?)|(\d+(?:\.\d{1,2})?)\s*(usd|dollars?|eur|euros?|gbp|pounds?))$/i);
  if (!m) return null;
  const amount = parseFloat(m[2] || m[3]);
  const cur = m[1] ? { $: 'USD', '€': 'EUR', '£': 'GBP' }[m[1]] : /^(usd|dollar)/i.test(m[4]) ? 'USD' : /^eur/i.test(m[4]) ? 'EUR' : 'GBP';
  return { amount, currency: cur };
}
const clip = (s, n) => String(s || '').trim().replace(/[.!?]+$/, '').slice(0, n);
const COST = '([$€£]\\s*\\d+(?:\\.\\d{1,2})?|\\d+(?:\\.\\d{1,2})?\\s*(?:usd|dollars?|eur|euros?|gbp|pounds?))';

// Which asks send, book or spend. Returns { toolName, args } or null (null = read-only, never gated).
// Only imperative asks match; questions like "how do I send an email" stay with the answer engine.
export function parseGatedAsk(text) {
  const t = String(text || '').trim().replace(/\s+/g, ' ');
  const s = t.replace(/^(?:please\s+|(?:can|could|would|will)\s+you\s+(?:please\s+)?)/i, '').replace(/\s*(?:please)?[.!?]*$/i, '');
  let m;
  if ((m = s.match(/^(?:send|write and send)\s+(?:an?\s+)?(?:e-?mail|mail)\s+to\s+(.+?)(?:\s+(?:saying|that says|to say|about|with)\s+(.+))?$/i))
      || (m = s.match(/^e-?mail\s+(.+?)(?:\s+(?:saying|that says|to say|about|with)\s+(.+))?$/i))) {
    return { toolName: 'email.send', args: { to: clip(m[1], 120), body: clip(m[2], 2000) } };
  }
  // "let Void spend up to $5 a month on a stronger model" / "let Void pay for a stronger model up to $5 a month" / "stop paying for stronger models"
  const MODELS = '(?:a\\s+)?(?:stronger|better|smarter|paid)\\s+(?:ai\\s+)?models?';
  const EARNED = '(?:\\s+(?:from|out of)\\s+(?:what\\s+(?:it|you)(?:\\s+ha(?:s|ve))?\\s+earned|(?:its|your)\\s+earnings))?';
  if ((m = s.match(new RegExp('^(?:let|allow)\\s+(?:void|yourself|you)\\s+(?:to\\s+)?(?:pay|spend)\\s+(?:up\\s+to\\s+)?' + COST + '\\s+(?:a|per|each)\\s+(day|week|month)\\s+(?:on|for)\\s+' + MODELS + EARNED + '$', 'i')))
      || (m = s.match(new RegExp('^(?:let|allow)\\s+(?:void|yourself|you)\\s+(?:to\\s+)?pay\\s+for\\s+' + MODELS + '\\s+(?:up\\s+to\\s+)?' + COST + '\\s+(?:a|per|each)\\s+(day|week|month)' + EARNED + '$', 'i')))) {
    const cost = parseCost(m[1]);
    if (cost && cost.currency === 'USD') return { toolName: 'models.spend', args: { model: '@cf/deepseek-ai/deepseek-v4-flash-0731', cost, per: m[2].toLowerCase() } };
  }
  if (new RegExp('^(?:stop|don\'?t)\\s+(?:void\\s+)?(?:paying|pay|spending)\\s+(?:for|on)\\s+' + MODELS + '$', 'i').test(s)) {
    return { toolName: 'models.spend', args: { model: '@cf/deepseek-ai/deepseek-v4-flash-0731', cost: { amount: 0, currency: 'USD' }, per: 'month' } };
  }
  if ((m = s.match(new RegExp('^(?:pay|send)\\s+' + COST + '\\s+to\\s+(.+)$', 'i'))) || (m = s.match(new RegExp('^pay\\s+(.+?)\\s+' + COST + '$', 'i')))) {
    const costFirst = /^\s*[$€£\d]/.test(m[1]);
    const cost = parseCost(costFirst ? m[1] : m[2]);
    if (cost) return { toolName: 'payment.send', args: { to: clip(costFirst ? m[2] : m[1], 120), cost } };
  }
  if ((m = s.match(/^(?:send|write and send)\s+(?:a\s+)?(?:text|message|dm|sms)\s+to\s+(.+?)(?:\s+(?:saying|that says|to say)\s+(.+))?$/i))
      || (m = s.match(/^(?:text|message)\s+(.+?)\s+(?:saying|that says|to say)\s+(.+)$/i))) {
    return { toolName: 'message.send', args: { to: clip(m[1], 120), body: clip(m[2], 2000) } };
  }
  if ((m = s.match(/^(?:post|publish)\s+(?:the\s+|my\s+|these\s+)?release notes\s+(?:to|on|for)\s+(.+)$/i))) {
    return { toolName: 'release.publish', args: { where: clip(m[1], 120) } };
  }
  // Your own calendar is yours (skills/calendar.js saves it in this browser, no yes needed). Only asks that reach another person are gated.
  if ((m = s.match(/^schedule\s+(?:a\s+|an\s+)?((?:meeting|call)\s+with\s+.+?)(?:\s+((?:for|on|at)\s+.+))?$/i))
      || (m = s.match(/^book\s+(?:a\s+|an\s+)?((?:meeting|call)\s+with\s+.+?)(?:\s+((?:for|on|at)\s+.+))?$/i))) {
    return { toolName: 'calendar.book', args: { what: clip(m[1], 160), when: clip(m[2], 80) } };
  }
  if ((m = s.match(/^(?:book|reserve)\s+((?:a|an|the|me a|us a|\d+)\s+.+?|(?:tickets?|flights?|rooms?|tables?|hotels?|seats?)\b.*?)(?:\s+for\s+([$€£]\s*\d+(?:\.\d{1,2})?))?$/i))) {
    const cost = m[2] ? parseCost(m[2]) : null;
    return { toolName: 'booking.make', args: cost ? { what: clip(m[1], 160), cost } : { what: clip(m[1], 160) } };
  }
  if ((m = s.match(new RegExp('^(?:buy|order|purchase)\\s+(?!of\\b|by\\b|in\\b)(?:me\\s+|us\\s+)?(.+?)(?:\\s+for\\s+' + COST + ')?$', 'i')))) {
    const cost = m[2] ? parseCost(m[2]) : null;
    return { toolName: 'order.place', args: cost ? { item: clip(m[1], 160), cost } : { item: clip(m[1], 160) } };
  }
  return null;
}

// Rules for a decision event. Returns '' when it is well formed, otherwise what is wrong.
export function checkDecision(d) {
  if (!d || typeof d !== 'object') return 'no decision';
  if (!d.approvalId) return 'approvalId missing';
  if (d.correlateKey && d.correlateKey !== d.approvalId) return 'correlateKey must equal approvalId';
  if (!DECISIONS.includes(d.decision)) return 'decision must be approve, reject, timeout or escalate';
  if (NEEDS_REASON.includes(d.decision) && !String(d.reason || '').trim()) return d.decision + ' needs a reason';
  if (!d.actor) return 'actor missing';
  return '';
}
