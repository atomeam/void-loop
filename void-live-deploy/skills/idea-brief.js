/**
 * idea-brief skill — capture and clarify a business idea into a system brief that Verse can own the heavy lifting for.
 * Produces a structured handoff: goal, actors, steps, connections needed, status/docs/automations to hand off, monitoring points.
 * Reduces client work by turning a rough idea into a clear delivery package. Pure rules, no model, empty surface stays empty.
 * "clarify idea: automate invoice reminders", "system brief for client onboarding", "handoff pack for the CRM sync".
 */
export function briefOf(text) {
  const t = String(text || '').trim().replace(/\s+/g, ' ');
  const m = /^(?:clarify(?:\s+this)?\s+idea|system\s+brief|handoff(?:\s+pack|\s+brief)?)\s*(?:for|:)?\s*(.+)$/i.exec(t);
  if (!m) return null;
  const idea = m[1].replace(/[.!?]+$/, '').trim();
  if (idea.length < 8 || idea.length > 280) return null;
  return { idea };
}

const sections = (idea) => {
  const lower = idea.toLowerCase();
  const isAuto = /automat|workflow|zap|n8n|make|remind|sync|report|onboard|invoice|crm|email/.test(lower);
  const goal = `Own the heavy lifting for: ${idea}. Verse clarifies, designs, connects, tests, monitors and hands off a running system so the client does less.`;
  const actors = isAuto ? 'Client (approves), Verse (builds and monitors), end users or systems that trigger steps.' : 'Client (owns the outcome), Verse (designs and delivers the system).';
  const steps = isAuto
    ? ['Capture the trigger and desired outcome.', 'Map the current manual steps.', 'Connect the tools already in use (or the cheapest fit).', 'Build the automation with an approve card before any send or spend.', 'Test with real sample data.', 'Hand off status, docs and the running rule.', 'Monitor and fix when it breaks.']
    : ['Clarify the goal and success measure.', 'List the pieces already built or available.', 'Design the smallest system that delivers the outcome.', 'Build, connect and test.', 'Package the handoff: status, docs, running automations.', 'Monitor for the first weeks.'];
  const connections = isAuto ? 'Existing tools (Zapier, Make, n8n, email, CRM, sheets). Verse reuses what is already connected before adding new ones.' : 'Whatever the idea names; check domains/void.existing-tools.md first.';
  const handoff = 'Status card the client can open, short docs of what runs and when, the automation rule with its approve path, and a contact line for when it breaks.';
  const monitoring = 'Daily or on-error check of the rule, a page that shows last run and result, fix pages for the common errors people paste.';
  return { goal, actors, steps, connections, handoff, monitoring };
};

export function cardHtml(brief) {
  const s = sections(brief.idea);
  const list = (arr) => arr.map(x => `<li>${x}</li>`).join('');
  return `<div class="idea-brief-card" style="font:14px/1.45 system-ui;max-width:42rem;padding:1rem 1.1rem;background:rgba(0,0,0,.25);border-radius:10px">
    <div style="font-weight:600;margin-bottom:.4rem">System brief</div>
    <div style="color:#9a9aa2;margin-bottom:.6rem">${s.goal}</div>
    <div><strong>Actors</strong><br>${s.actors}</div>
    <div style="margin-top:.5rem"><strong>Steps</strong><ol style="margin:.2rem 0 .4rem 1.2rem">${list(s.steps)}</ol></div>
    <div><strong>Connections</strong><br>${s.connections}</div>
    <div style="margin-top:.5rem"><strong>Handoff</strong><br>${s.handoff}</div>
    <div style="margin-top:.5rem"><strong>Monitoring</strong><br>${s.monitoring}</div>
    <div style="margin-top:.6rem;color:#9a9aa2;font-size:12px">Copy this brief into the stage or a note. Nothing is sent. Approve before any automation runs.</div>
  </div>`;
}

export const suite = () => {
  const ok = (a) => !!briefOf(a);
  const bad = (a) => !briefOf(a);
  const checks = [
    ok('clarify idea: automate invoice reminders for late payments'),
    ok('system brief for client onboarding checklist'),
    ok('handoff pack for the CRM sync that updates deals every night'),
    bad('what is the weather'),
    bad('clarify idea'),
    bad('system brief for hi'),
  ];
  const failed = checks.filter(c => !c).length;
  return { ok: failed === 0, got: failed ? failed + ' checks failed' : 'all clear' };
};

export default {
  name: 'idea-brief',
  examples: [
    'clarify idea: automate invoice reminders for late payments',
    'system brief for client onboarding checklist',
    'handoff pack for the CRM sync that updates deals every night',
    'clarify this idea: weekly status report that pulls from the project board',
  ],
  nearMisses: ['what is the weather', 'tell me about chess', 'make a proposal', 'show my automations'],
  match(lower, text) { return !!briefOf(text || lower); },
  run(text, stage) {
    const b = briefOf(text);
    if (!b) return null;
    const html = cardHtml(b);
    if (stage && stage.addCard) stage.addCard({ html, title: 'System brief' });
    return { card: html, brief: b };
  },
  suite,
};
