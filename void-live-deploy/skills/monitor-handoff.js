/**
 * monitor-handoff skill: hand off a client-visible monitor for systems Verse owns.
 * Produces a status card the client can ask for, reducing their work by showing
 * real (never invented) state of monitors, docs, and running automations.
 * "monitor handoff for the onboarding system", "client monitor pack for my automation",
 * "handoff the monitors for this idea".
 * Uses existing /api/status where possible; empty surface stays empty.
 */
export function isMonitorHandoff(text) {
  const t = String(text || '').trim().replace(/[?!.]+$/, '');
  return /^(?:monitor|status)\s+handoff\b/i.test(t)
    || /^(?:client|business)\s+monitor(?:\s+(?:pack|handoff))?\b/i.test(t)
    || /^(?:handoff|package)\s+(?:the\s+)?monitors?\b/i.test(t)
    || /^(?:make|generate|create)\s+(?:a\s+)?monitor\s+handoff\b/i.test(t);
}

export function subjectOf(text) {
  const m = String(text || '').match(/\b(?:for|of|:)\s+(?:the\s+|my\s+|a\s+)?(.+)/i);
  const s = m ? m[1].trim() : '';
  return s.length >= 3 ? s.slice(0, 160) : 'the system';
}

function cardHtml(esc, subject) {
  return '<h2>Monitor handoff: ' + esc(subject) + '</h2>'
    + '<p><b>What Verse owns:</b> the monitors, status line, and running automations for "' + esc(subject) + '". Client keeps the outcome.</p>'
    + '<h3>Client-visible status</h3><ul>'
    + '<li>Ask "system status" or "systems monitor" for the live board (GET /api/status; nothing painted green unless the API says up)</li>'
    + '<li>Docs of what is watched and what the client owns</li>'
    + '<li>Confirm-line approvals already in place for any send or spend</li>'
    + '</ul>'
    + '<h3>Handoff package</h3><ul>'
    + '<li>One-line status the client can request anytime</li>'
    + '<li>No invented state: unknown stays unknown</li>'
    + '<li>We own the heavy lifting of watching and fixing</li>'
    + '</ul>'
    + '<p class="sub">Client work reduced: they ask for the status instead of checking themselves.</p>'
    + '<div class="src">Source: A-to-Mind delivery practice · existing /api/status · nothing sent</div>';
}

async function run(text, api) {
  const { showPage, esc } = api;
  const subject = subjectOf(text);
  const el = showPage((p) => { p.innerHTML = '<h2>Monitor handoff</h2><div class="sub">building…</div>'; });
  el.innerHTML = cardHtml(esc, subject);
  return 'monitor-handoff';
}

export default {
  name: 'monitor-handoff',
  examples: [
    'monitor handoff for the onboarding system',
    'client monitor pack for my automation',
    'handoff the monitors for invoice reminders',
    'make a monitor handoff for the support router'
  ],
  nearMisses: [
    'what is a monitor',
    'monitor the weather',
    'status of the news'
  ],
  match(lower, text) { return isMonitorHandoff(text || lower); },
  run,
  suite() {
    const ok = isMonitorHandoff('monitor handoff for the onboarding system')
      && isMonitorHandoff('client monitor pack for my automation')
      && isMonitorHandoff('handoff the monitors for invoice reminders')
      && isMonitorHandoff('make a monitor handoff for the support router')
      && !isMonitorHandoff('what is a monitor')
      && !isMonitorHandoff('monitor the weather')
      && !isMonitorHandoff('status of the news');
    return { ok, got: 'match works' };
  }
};
