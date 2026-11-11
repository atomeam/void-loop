/**
 * delivery-board skill — a client-visible board that aggregates ownership, progress, monitors and next handoff
 * for systems Verse owns so the client does less chasing and delivery stays reliable.
 * Rules-based, offline. Nothing is sent.
 * "delivery board for the onboarding flow", "client board on invoice reminders",
 * "show the delivery board for the support router".
 */
export function isDeliveryBoard(text) {
  const t = String(text || '').trim().replace(/[?!.]+$/, '');
  return /^(?:delivery|client)\s+board\b/i.test(t)
    || /^(?:show|make|generate|create)\s+(?:a\s+|the\s+)?(?:delivery|client)\s+board\b/i.test(t)
    || /^(?:delivery\s+board)\s+(?:for|of|on)\b/i.test(t);
}

export function subjectOf(text) {
  const m = String(text || '').match(/\b(?:for|of|on|:)\s+(?:the\s+|my\s+|a\s+)?(.+)/i);
  const s = m ? m[1].trim().replace(/[?!.]+$/, '') : '';
  return s.length >= 3 ? s.slice(0, 160) : 'the systems';
}

export function boardFor(subject) {
  const name = subjectOf(subject);
  return {
    subject: name,
    owns: [
      'Design, build and connect the systems',
      'Run the monitors and alerts (monitor-pack)',
      'Own the verification (verify-pack)',
      'Package status, docs and handoff'
    ],
    progress: 'First slices live; ownership clear; monitors running',
    monitors: ['Daily status card', 'Failure alerts behind the confirm line'],
    nextHandoff: 'Full delivery pack + client can summon this board anytime'
  };
}

async function run(text, api) {
  const { showPage, esc } = api;
  const name = subjectOf(text);
  const board = boardFor(text);
  showPage((el) => {
    const owns = board.owns.map(i => '<li>' + esc(i) + '</li>').join('');
    el.innerHTML = '<h2>Delivery board: ' + esc(name) + '</h2>'
      + '<p class="sub">Verse owns the heavy lifting. This board keeps ownership, progress, monitors and the next handoff in one place so the client does less chasing.</p>'
      + '<h3>What Verse owns</h3><ul>' + owns + '</ul>'
      + '<h3>Progress</h3><p>' + esc(board.progress) + '</p>'
      + '<h3>Monitors Verse owns</h3><ul>' + board.monitors.map(i => '<li>' + esc(i) + '</li>').join('') + '</ul>'
      + '<h3>Next handoff</h3><p>' + esc(board.nextHandoff) + '</p>'
      + '<p class="sub">Nothing is invented as already done. Ask for the progress report or ownership pack for more detail.</p>'
      + '<div class="src">Source: A-to-Mind delivery board · we own the heavy lifting</div>';
  });
  return 'delivery-board';
}

export const builtWith = ['progress-report', 'ownership-pack', 'monitor-pack', 'system-status', 'delivery-pack'];
export default {
  name: 'delivery-board',
  examples: [
    'delivery board for the onboarding flow',
    'client board on invoice reminders',
    'show the delivery board for the support router',
    'make a delivery board for weekly status reports'
  ],
  nearMisses: [
    'what is a board',
    'status board',
    'progress report',
    'delivery pack'
  ],
  match: (low, raw) => isDeliveryBoard(raw || low),
  run,
  suite() {
    const ok = this.examples.every(isDeliveryBoard) && !this.nearMisses.some(isDeliveryBoard);
    return { ok, got: ok ? 'match works' : 'match broke' };
  }
};
