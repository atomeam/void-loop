/**
 * system-handoff skill — the handoff package for a system Verse is taking on.
 * Built from the delivery practice already on main (delivery-pack, system-status,
 * system-blueprint): ownership, docs, and the status ask. "hand off the automation"
 * and "package the status handoff" are the same package. A client handoff stays with
 * client-handoff. It does not invent monitors or a green check. Nothing is sent.
 */
export function isSystemHandoff(text) {
  const t = String(text || '').trim().replace(/[?!.]+$/, '');
  return /^(?:system\s+handoff|handoff\s+(?:the|this|a)\s+system|make\s+a\s+system\s+handoff|hand\s*off\s+the\s+automation|package\s+the\s+status\s+handoff)\b/i.test(t);
}

export function systemOf(text) {
  const m = String(text || '').match(/\b(?:for|of|:)\s+(?:the\s+|my\s+|a\s+)?(.+)/i);
  const s = m ? m[1].trim() : '';
  return s.length >= 3 ? s.slice(0, 160) : 'the system';
}

function run(text, api) {
  const { showPage, esc } = api;
  const name = systemOf(text);
  showPage((el) => {
    el.innerHTML = '<h2>System handoff: ' + esc(name) + '</h2>'
      + '<p>Verse owns the heavy lifting. The client keeps the outcome.</p>'
      + '<h3>Package</h3><ul>'
      + '<li>Plan: ask "blueprint this: ' + esc(name) + '"</li>'
      + '<li>Status: ask "system status for ' + esc(name) + '" (a real check, not a sample)</li>'
      + '<li>Docs: what runs, what the client owns, what Verse owns</li>'
      + '<li>Automations: only those already on the confirm line</li>'
      + '</ul>'
      + '<p class="sub">No status is invented here. A live check is a separate ask.</p>'
      + '<div class="src">Source: A-to-Mind system handoff · nothing sent</div>';
  });
  return 'system-handoff';
}

export const builtWith = ['delivery-pack', 'system-status'];
export default {
  name: 'system-handoff',
  examples: [
    'system handoff for the onboarding automation',
    'make a system handoff for invoice reminders',
    'handoff the system: support ticket router',
    'handoff this system: client onboarding automation',
    'package the status handoff for my CRM sync',
    'hand off the automation for weekly reports',
  ],
  nearMisses: [
    'client handoff for the onboarding automation',
    'system status for billing',
    'what is a system',
    'delivery pack for my idea',
    'clarify this business idea',
  ],
  match(lower, text) { return isSystemHandoff(text || lower); },
  run,
};
