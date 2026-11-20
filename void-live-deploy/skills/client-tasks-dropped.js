/**
 * client-tasks-dropped skill — list the specific client tasks that drop
 * when Verse owns the systems for a business idea. Makes "we own the heavy lifting"
 * concrete for selling and delivery. Rules-based, offline. Nothing is sent.
 * "tasks dropped for automate client onboarding", "what client work drops for the SaaS idea",
 * "client tasks that drop: invoice reminders".
 */
export function isClientTasksDropped(text) {
  const t = String(text || '').trim().replace(/[?!.]+$/, '');
  return /^(?:tasks?\s+dropped|client\s+tasks?\s+(?:that\s+)?drop|what\s+client\s+work\s+drops|client\s+work\s+that\s+drops)\b/i.test(t)
    || /^(?:make|generate|create|list|show)\s+(?:a\s+)?(?:tasks?\s+dropped|client\s+tasks?\s+dropped|client\s+work\s+dropped)\b/i.test(t)
    || /\bfor\s+(?:my\s+|the\s+|a\s+)?(?:idea|business|system|automation)\b/i.test(t) && /(?:drop|dropped|no longer|client does less)/i.test(t);
}

export function subjectOf(text) {
  const m = String(text || '').match(/\b(?:for|of|:)\s+(?:the\s+|my\s+|a\s+)?(.+)/i);
  const s = m ? m[1].trim().replace(/[?!.]+$/, '') : '';
  return s.length >= 3 ? s.slice(0, 160) : 'the business idea';
}

export function droppedFor(subject) {
  const name = subjectOf(subject);
  return {
    subject: name,
    dropped: [
      'Manual capture of the idea or ask — Verse intake turns it into requirements',
      'Designing the workflow by hand — systems design pack owns the flow',
      'Connecting tools one by one — connections pack wires existing tools first',
      'Writing and running tests — suite checks and ready-checks prove the handoff',
      'Watching for failures — monitor-pack and incident-pack keep the watch',
      'Writing status updates — client-status and progress-report cards do it',
      'Packaging the handoff — delivery-pack and handoff-checklist list what is ready'
    ],
    clientKeeps: 'The outcome, the yes on the confirm line, and the final review of results'
  };
}

async function run(text, api) {
  const { showPage, esc } = api;
  const name = subjectOf(text);
  const pack = droppedFor(text);
  showPage((el) => {
    const items = pack.dropped.map(i => '<li>' + esc(i) + '</li>').join('');
    el.innerHTML = '<h2>Client tasks dropped: ' + esc(name) + '</h2>'
      + '<p class="sub">These are the tasks the client no longer does once Verse owns the systems.</p>'
      + '<ul>' + items + '</ul>'
      + '<p><strong>Client keeps:</strong> ' + esc(pack.clientKeeps) + '</p>'
      + '<p class="sub">Nothing is invented as already built. Ask for the delivery pack or handoff checklist next.</p>'
      + '<div class="src">Source: A-to-Mind heavy-lift practice · nothing sent</div>';
  });
  return 'client-tasks-dropped';
}

export default {
  name: 'client-tasks-dropped',
  examples: [
    'tasks dropped for automate client onboarding',
    'what client work drops for the SaaS idea',
    'client tasks that drop: invoice reminders',
    'make a client tasks dropped pack for the support ticket router'
  ],
  nearMisses: [
    'what is a task',
    'drop the client',
    'client status for onboarding',
    'handoff checklist'
  ],
  match: (low, raw) => isClientTasksDropped(raw || low),
  run,
  suite() {
    const ok = isClientTasksDropped('tasks dropped for automate client onboarding')
      && isClientTasksDropped('what client work drops for the SaaS idea')
      && isClientTasksDropped('client tasks that drop: invoice reminders')
      && isClientTasksDropped('make a client tasks dropped pack for the support ticket router')
      && !isClientTasksDropped('what is a task')
      && !isClientTasksDropped('drop the client')
      && !isClientTasksDropped('handoff checklist');
    return { ok, got: 'match works' };
  }
};
