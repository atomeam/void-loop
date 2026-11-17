/**
 * process-map skill — map a business process end-to-end and mark where Verse owns the heavy lifting
 * so the client does less tracking, building and monitoring.
 * Rules-based, offline. Nothing is sent.
 * "process map for client onboarding", "map the process for invoice reminders",
 * "show the process map for support tickets".
 */
export function isProcessMap(text) {
  const t = String(text || '').trim().replace(/[?!.]+$/, '');
  return /^(?:process)\s+(?:map|chart)\b/i.test(t)
    || /^(?:map)\s+(?:the\s+)?(?:process|flow|steps)\b/i.test(t)
    || /^(?:show)\s+(?:the\s+)?process\s+map\b/i.test(t);
}

export function subjectOf(text) {
  const m = String(text || '').match(/\b(?:for|of|on|:)\s+(?:the\s+|my\s+|a\s+)?(.+)/i);
  const s = m ? m[1].trim().replace(/[?!.]+$/, '') : '';
  return s.length >= 3 ? s.slice(0, 160) : 'the described process';
}

export function stepsFor(subject) {
  const name = subjectOf(subject);
  return {
    subject: name,
    steps: [
      { step: 'Capture the request', owns: 'Verse (intake skill + confirm line)', client: 'States the outcome' },
      { step: 'Clarify requirements', owns: 'Verse (client-intake / idea-to-system)', client: 'Approves the clarified idea' },
      { step: 'Design and build the system', owns: 'Verse', client: 'Reviews the slice' },
      { step: 'Connect existing tools', owns: 'Verse (connect-pack / reuse-tools)', client: 'None' },
      { step: 'Test and verify', owns: 'Verse (verify-pack)', client: 'None' },
      { step: 'Monitor and status', owns: 'Verse (monitor-pack + status card)', client: 'Sees the status line' },
      { step: 'Handoff package', owns: 'Verse (full-handoff / delivery-pack)', client: 'Receives the package' }
    ],
    lift: 'Client work drops to stating the outcome and approving the clarified idea; Verse owns design, build, connect, test, monitor and handoff.'
  };
}

async function run(text, api) {
  const { showPage, esc } = api;
  const name = subjectOf(text);
  const pack = stepsFor(text);
  const rows = pack.steps.map(s => '<tr><td>' + esc(s.step) + '</td><td>' + esc(s.owns) + '</td><td>' + esc(s.client) + '</td></tr>').join('');
  showPage((el) => {
    el.innerHTML = '<h2>Process map: ' + esc(name) + '</h2>'
      + '<p class="sub">End-to-end map. Verse takes the hard work so the client does less.</p>'
      + '<table><thead><tr><th>Step</th><th>Verse owns</th><th>Client does</th></tr></thead><tbody>' + rows + '</tbody></table>'
      + '<h3>How the client does less</h3><p>' + esc(pack.lift) + '</p>'
      + '<p class="sub">Ask for the ownership pack or system slice next. Nothing is built yet.</p>'
      + '<div class="src">Source: A-to-Mind process map</div>';
  });
  return 'process-map';
}

export const builtWith = ['client-intake', 'idea-to-system', 'connect-pack', 'verify-pack', 'monitor-pack', 'delivery-pack'];
export default {
  name: 'process-map',
  examples: [
    'process map for client onboarding',
    'map the process for invoice reminders',
    'show the process map for support tickets',
    'process chart of weekly status reports'
  ],
  nearMisses: [
    'what is a process',
    'map of the world',
    'process status',
    'show the map'
  ],
  match: (low, raw) => isProcessMap(raw || low),
  run,
  suite() {
    const ok = this.examples.every(isProcessMap) && !this.nearMisses.some(isProcessMap);
    return { ok, got: ok ? 'match works' : 'match broke' };
  }
};
