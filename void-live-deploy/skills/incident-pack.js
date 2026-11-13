/**
 * incident-pack skill — package the incident path Verse owns for a system
 * (detect, confirm, respond, communicate, recover) so the client does no firefighting
 * and delivery stays reliable. Rules-based, offline. Nothing is sent or claimed as measured.
 * "incident pack for the onboarding flow", "client incident path for invoice automation".
 */
export function isIncidentPack(text) {
  const t = String(text || '').trim().replace(/[?!.]+$/, '');
  return /^(?:incident|firefight|outage)\s+(?:pack|path|response|plan)\b/i.test(t)
    || /^(?:show|make|generate|package)\s+(?:(?:a|an|the)\s+)?(?:incident|outage)\s+(?:pack|path)\b/i.test(t)
    || /\bclient\s+(?:incident|outage)\s+(?:path|response)\b/i.test(t);
}

export function subjectOf(text) {
  const m = String(text || '').match(/\b(?:for|of|on|:)\s+(?:the\s+|my\s+|a\s+)?(.+)/i);
  const s = m ? m[1].trim().replace(/[?!.]+$/, '') : '';
  return s.length >= 3 ? s.slice(0, 160) : 'the system';
}

export function pathFor(subject) {
  const name = subjectOf(subject);
  return {
    subject: name,
    detects: 'Monitors and status checks Verse watches (monitor-pack / reliability-pack)',
    responds: 'Verse confirms, owns the fix or escalation, and keeps the client informed via status cards',
    clientNever: [
      'Paging on-call or digging through raw logs',
      'Deciding the response steps',
      'Writing the incident note',
      'Chasing recovery status'
    ],
    next: 'Summon "status digest for ' + name + '" or "reliability pack for ' + name + '" anytime'
  };
}

async function run(text, api) {
  const { showPage } = api;
  const esc = typeof api.esc === 'function' ? api.esc : (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const p = pathFor(text);
  const list = (arr) => arr.map(i => '<li>' + esc(i) + '</li>').join('');
  showPage((el) => {
    el.innerHTML = '<h2>Incident pack: ' + esc(p.subject) + '</h2>'
      + '<p><strong>Detect:</strong> ' + esc(p.detects) + '</p>'
      + '<p><strong>Respond:</strong> ' + esc(p.responds) + '</p>'
      + '<h3>Client does none of this</h3><ul>' + list(p.clientNever) + '</ul>'
      + '<p><strong>Next:</strong> ' + esc(p.next) + '</p>'
      + '<p class="sub">Nothing is invented as already measured. Verse owns the path.</p>'
      + '<div class="src">Source: A-to-Mind incident pack · nothing sent</div>';
  });
  return 'incident-pack';
}

export const builtWith = ['monitor-pack', 'reliability-pack', 'status-digest', 'system-status'];
export default {
  name: 'incident-pack',
  examples: [
    'incident pack for the onboarding flow',
    'client incident path for invoice automation',
    'outage response for support router',
    'package the incident path for weekly reports'
  ],
  nearMisses: [
    'status digest',
    'reliability pack',
    'what broke',
    'incident'
  ],
  match: (low, raw) => isIncidentPack(raw || low),
  run,
  suite() {
    const ok = this.examples.every(isIncidentPack) && !this.nearMisses.some(isIncidentPack)
      && pathFor('incident pack for x').clientNever.length === 4;
    return { ok, got: ok ? 'match works; path lists four client-never lines' : 'mismatch' };
  }
};
