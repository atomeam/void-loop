/**
 * client-handoff: a shareable card for one clarified system Verse owns.
 * "client handoff for the onboarding automation", "make a client handoff for the invoice flow".
 * "handoff pack" and "delivery package" stay with delivery-pack (rank 1192). This card names the
 * skills that already do the work: business-clarify, system-status, and confirm-line automations.
 * It covers status, docs, and monitors. Nothing is sent, and nothing is spent.
 */
import { isDeliveryPack } from './delivery-pack.js';

// "handoff pack" and "delivery package" stay with delivery-pack. "system status" stays with system-status.
// "system handoff" and "handoff this system" are the same card (the phrases from helper/system-handoff).
const START = /^(?:client|business|system)\s+handoff\b|^(?:make|generate|create|package)\s+(?:a\s+)?client\s+handoff\b|^(?:hand\s*off|handoff)\s+(?:(?:this|the)\s+)?(?:system|automation|flow)\b|^(?:package|make|create|generate)\s+(?:the\s+)?status\s+handoff\b/i;

/** a client-handoff ask, and not a delivery pack. Pure. */
export function isClientHandoff(text) {
  const t = String(text || '').trim().replace(/[?!.]+$/, '');
  if (!t || isDeliveryPack(t)) return false;
  return START.test(t);
}

/** the system the ask names, or "the system". Pure. */
export function subjectOf(text) {
  const t = String(text || '');
  const m = t.match(/\b(?:for|of)\s+(?:the\s+|my\s+|a\s+)?(.+)/i) || t.match(/[:-]\s*(.+)/);
  const name = m ? m[1].trim().replace(/[?!.]+$/, '') : '';
  return name || 'the system';
}

/** what the card says Verse owns, and the three covers (status, docs, monitors). Pure. */
export function packageOf(subject) {
  const name = subjectOf(subject);
  return {
    subject: name,
    owns: [
      'Capture and clarify the ask into a system plan (business-clarify)',
      'Status line, monitors and the incident log the client can see (system-status)',
      'Running automations gated by the confirm line',
    ],
    covers: ['status', 'docs', 'monitors'],
  };
}

const escapeHtml = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

/** the card, as HTML a client can copy. esc is the page's escaper. Pure. */
export function cardHtml(esc, subject) {
  const e = typeof esc === 'function' ? esc : escapeHtml;
  const p = packageOf(subject);
  const lines = [
    'Client handoff: ' + p.subject,
    'Verse owns the heavy lifting. The client keeps the outcome.',
    'What Verse owns:',
    ...p.owns.map((x) => '- ' + x),
    'Covers: ' + p.covers.join(', ') + '.',
    'Status: ask "system status for ' + p.subject + '".',
    'Docs: how it runs, what the client owns, and what Verse owns.',
    'Monitors: the status line and the incident log.',
    'Automations stay behind the confirm line. Nothing is sent from this card.',
  ];
  return [
    '<h2>Client handoff: ' + e(p.subject) + '</h2>',
    '<p><strong>Clarified:</strong> Verse owns the heavy lifting for "' + e(p.subject) + '" so the client does less.</p>',
    '<h3>What Verse owns</h3><ul>',
    ...p.owns.map((x) => '<li>' + e(x) + '</li>'),
    '</ul>',
    '<h3>Handoff package for the client</h3><ul>',
    '<li>Status: ask "system status for ' + e(p.subject) + '" for a live check (system-status)</li>',
    '<li>Docs: how it runs, what the client owns vs what Verse owns</li>',
    '<li>Monitors: the status line and the incident log the client can see</li>',
    '<li>Automations: already gated by the confirm line</li>',
    '</ul>',
    '<p class="sub">We own the heavy lifting. Client keeps the outcome.</p>',
    '<pre class="share">' + e(lines.join('\n')) + '</pre>',
  ].join('');
}

const EXAMPLES = [
  'client handoff for the onboarding automation',
  'business handoff for weekly status reports',
  'make a client handoff for the invoice flow',
  'package a client handoff for the support ticket router',
  'generate a client handoff for the client portal',
  'system handoff for the invoice flow',
  'handoff this system: client onboarding automation',
  'hand off the automation for weekly reports',
];
const NEAR = [
  'handoff pack for my SaaS idea',
  'delivery package: invoice reminders that run themselves',
  'package this idea: automate client onboarding',
  'what is a handoff',
  'client list',
  'package.json',
  'handoff the baton',
  'system status for the site',
  'clarify this business idea',
];

export default {
  name: 'client-handoff',
  examples: EXAMPLES,
  nearMisses: NEAR,
  match(lower, text) { return isClientHandoff(text || lower); },
  async run(text, api) {
    const { showPage, esc } = api || {};
    const html = cardHtml(esc || escapeHtml, text);
    if (typeof showPage === 'function') {
      const el = showPage((p) => { p.innerHTML = '<h2>Client handoff</h2><div class="sub">building…</div>'; });
      if (el) el.innerHTML = html; // void-review: ok (cardHtml escapes the ask before this string is written)
    }
    return 'client-handoff';
  },
  suite() {
    const ok = EXAMPLES.every(isClientHandoff) && NEAR.every((a) => !isClientHandoff(a));
    return { ok, got: ok ? 'match works' : 'match broke' };
  },
};
