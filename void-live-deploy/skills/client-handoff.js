/**
 * client-handoff skill — a shareable handoff card for one system Verse owns.
 * "client handoff for the onboarding automation". The card names what Verse owns and
 * what the client keeps: business-clarify, system-status, and the confirm line.
 * "system handoff" stays with system-handoff. "handoff pack" stays with delivery-pack.
 * It does not invent a green status. Nothing is sent.
 */
import { isDeliveryPack } from './delivery-pack.js';

/** a client-handoff ask, and not a delivery pack. Pure. */
export function isClientHandoff(text) {
  const t = String(text || '').trim().replace(/[?!.]+$/, '');
  if (!t || isDeliveryPack(t)) return false;
  return /^(?:client|business)\s+handoff\b/i.test(t)
    || /^(?:make|generate|create|package)\s+(?:a\s+)?client\s+handoff\b/i.test(t);
}

/** the system the ask names, or "the system". Pure. */
export function subjectOf(text) {
  const m = String(text || '').match(/\b(?:for|of|:)\s+(?:the\s+|my\s+|a\s+)?(.+)/i);
  const s = m ? m[1].trim().replace(/[?!.]+$/, '') : '';
  return s.length >= 3 ? s.slice(0, 160) : 'the system';
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
    'Verse owns the running system. The client keeps the outcome.',
    'What Verse owns:',
    ...p.owns.map((x) => '- ' + x),
    'Covers: ' + p.covers.join(', ') + '.',
    'Status: ask "system status for ' + p.subject + '" (a real check, not a sample).',
    'Docs: how it runs, what the client owns, and what Verse owns.',
    'Monitors: the status line and the incident log.',
    'No status is invented here. Nothing is sent from this card.',
  ];
  return [
    '<h2>Client handoff: ' + e(p.subject) + '</h2>',
    '<p><b>Clarified:</b> Verse owns the running system for "' + e(p.subject) + '". The client keeps the outcome.</p>',
    '<h3>What Verse owns</h3><ul>',
    ...p.owns.map((x) => '<li>' + e(x) + '</li>'),
    '</ul>',
    '<h3>What the client keeps</h3><ul>',
    '<li>Status: ask "system status for ' + e(p.subject) + '" for a live check (system-status)</li>',
    '<li>Docs: how it runs, what the client owns vs what Verse owns</li>',
    '<li>Monitors: the status line and the incident log the client can see</li>',
    '<li>The outcome and the decision to change it</li>',
    '</ul>',
    '<p class="sub">No status is invented here. A live check is a separate ask.</p>',
    '<pre class="share">' + e(lines.join('\n')) + '</pre>',
    '<div class="src">Source: A-to-Mind delivery practice · nothing sent</div>',
  ].join('');
}

export default {
  name: 'client-handoff',
  examples: [
    'client handoff for the onboarding automation',
    'make a client handoff for the invoice flow',
    'business handoff for weekly status reports',
    'package a client handoff for the support ticket router',
    'generate a client handoff for the client portal',
  ],
  nearMisses: [
    'handoff pack for my SaaS idea',
    'delivery package: invoice reminders',
    'what is a handoff',
    'package.json',
    'system handoff for the invoice flow',
    'handoff this system: client onboarding automation',
    'system status for the site',
  ],
  match(lower, text) { return isClientHandoff(text || lower); },
  run(text, api) {
    const { showPage, esc } = api || {};
    const html = cardHtml(esc, text);
    if (typeof showPage === 'function') showPage((el) => { el.innerHTML = html; }); // void-review: ok (cardHtml escapes the ask)
    return 'client-handoff';
  },
};
