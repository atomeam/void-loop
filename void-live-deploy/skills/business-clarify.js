/**
 * business-clarify skill — capture and clarify a business idea into a system plan that Verse can own the heavy lifting for.
 * Turns a vague idea into structured fields: the idea, the problem it solves, systems to design/build/connect, automations that reduce client work, handoff points (status/docs/running jobs), and next delivery step.
 * "clarify this business idea", "turn this idea into a system plan", "structure this business idea", "make this idea something Verse can run".
 * Rules-based so it works offline; the card stays on the stage for editing and handoff.
 */
const FIELDS = ['idea', 'problem', 'systems', 'automations', 'handoff', 'next'];
const LABELS = { idea: 'The idea', problem: 'Problem it solves', systems: 'Systems to design / build / connect', automations: 'Automations that take over the heavy lifting', handoff: 'Handoff (status, docs, running jobs)', next: 'Next delivery step' };

function structure(text) {
  const t = String(text || '').trim();
  if (!t) return { idea: '', problem: '', systems: '', automations: '', handoff: '', next: '' };
  // simple extraction: first sentence is idea, rest split roughly
  const sentences = t.split(/[.!?]+/).map(s => s.trim()).filter(Boolean);
  return {
    idea: sentences[0] || t.slice(0, 120),
    problem: sentences[1] || 'Clarify the pain this removes for the business.',
    systems: 'Design the core flow, connect data sources, build the stages that turn the idea into running work.',
    automations: 'Identify the repeated steps Verse can run and monitor so the client does less.',
    handoff: 'Status card, docs of the system, and the running automations handed to the client.',
    next: 'Ship the first system slice and a status handoff.',
  };
}

function mount(api, data) {
  const el = document.createElement('div');
  el.className = 'thing kept-card';
  el.style.cssText = 'width:min(420px, calc(100vw - 20px)); padding:12px; background:rgba(0,0,0,.4); border-radius:12px;';
  const title = document.createElement('div'); title.className = 'g-title'; title.textContent = 'Business idea clarified';
  el.append(title);
  for (const k of FIELDS) {
    const lab = document.createElement('div'); lab.style.cssText = 'margin-top:10px; font-size:12px; opacity:.7'; lab.textContent = LABELS[k];
    const ta = document.createElement('textarea'); ta.style.cssText = 'width:100%; min-height:48px; margin-top:4px; font:inherit; background:rgba(255,255,255,.06); color:inherit; border:1px solid rgba(255,255,255,.16); border-radius:8px; padding:6px;';
    ta.value = data[k] || '';
    el.append(lab, ta);
  }
  const note = document.createElement('div'); note.style.cssText = 'margin-top:8px; font-size:11px; opacity:.6'; note.textContent = 'Edit in place · copy for the client · Verse owns the heavy lifting from here.';
  el.append(note);
  if (api && api.mount) api.mount(el); else document.body.append(el);
  return el;
}

export default {
  name: 'business-clarify',
  examples: [
    'clarify this business idea: a tool that turns customer emails into running automations',
    'turn this idea into a system plan: weekly status reports that write themselves',
    'structure this business idea for Verse to own the heavy lifting',
    'make this idea a system plan: client onboarding that runs itself'
  ],
  nearMisses: [
    'write a proposal for this request',
    'what is a business',
    'business news',
    'clarify the weather'
  ],
  match(lower, text) {
    const t = String(text || lower || '').toLowerCase();
    return /\b(clarify|structure|turn this idea|make this idea)\b.*\b(business idea|idea into|system plan|heavy lifting)\b/i.test(t)
      || /\b(business idea|system plan)\b.*\b(clarify|structure|turn|make)\b/i.test(t);
  },
  run(text, api) {
    const data = structure(text);
    mount(api, data);
    if (api && api.say) api.say('Clarified the business idea into a system plan. Edit the card, then hand the heavy lifting to Verse.');
  }
};
