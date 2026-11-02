/**
 * idea-clarify skill — "clarify this idea", "structure this business idea", "turn this idea into a plan"
 * Turns a raw business idea into an editable structured card: problem, audience, solution, unique angle, next steps, risks.
 * Helps capture and clarify ideas so delivery (design, build, handoff) starts from a clear brief. Nothing is sent.
 * Rules-based so it always works; empty stage stays empty.
 */
import { tidy } from '../lib/stage-pack.js';

const ASK_RE = /^(?:please\s+)?(?:(?:clarify|structure|organize|break down|turn into a plan|make a plan from|clarify this)\s+(?:this\s+)?(?:business\s+)?idea|idea\s+(?:clarify|structure|plan)|clarify\s+idea)(?:\s*[:\-–—]?\s*(.*))?$/i;

export function ideaOf(text) {
  const t = tidy(text);
  if (!t) return null;
  const m = ASK_RE.exec(t.replace(/[?!.]+$/, ''));
  if (!m) return null;
  const rest = (m[1] || '').trim();
  return { idea: rest };
}

const FIELDS = [
  ['problem', 'Problem'],
  ['audience', 'Who it is for'],
  ['solution', 'Solution'],
  ['unique', 'What makes it different'],
  ['next', 'Next steps'],
  ['risks', 'Risks / open questions'],
];

function ruleClarify(idea) {
  const base = (idea || '[paste the idea]').slice(0, 280);
  return {
    problem: base,
    audience: '[who has this problem]',
    solution: '[how we solve it]',
    unique: '[why us / this way]',
    next: '1. Clarify the brief\n2. Design the system\n3. Build and test\n4. Hand off with docs and running automations',
    risks: '[what could go wrong]',
  };
}

function mount(th, stageApi) {
  const el = (tag, css, text) => {
    const e = document.createElement(tag);
    if (css) e.style.cssText = css;
    if (text != null) e.textContent = text;
    return e;
  };
  const card = el('div');
  card.className = 'thing kept-card idea-clarify-card';
  card.dataset.id = th.id;
  card.style.cssText = 'left:' + (th.x || 40) + 'px;top:' + (th.y || 40) + 'px;width:min(480px, calc(100vw - 20px))';
  const head = el('div');
  head.className = 'g-head';
  head.innerHTML = '<span class="g-title">Idea clarified</span><span class="g-sub">editable · copy as Markdown for handoff</span>';
  card.append(head);
  const status = el('div', 'margin-top:6px;color:var(--muted,#9a9aa2);font-size:13px');
  status.setAttribute('aria-live', 'polite');
  card.append(status);
  stageApi.bindDrag(card, th);
  stageApi.stage.appendChild(card);

  const paste = el('div', 'margin-top:8px');
  const area = el('textarea', 'width:100%;min-height:80px;font:inherit;background:rgba(0,0,0,.22);color:inherit;border:1px solid rgba(255,255,255,.18);border-radius:8px;padding:6px 8px');
  area.placeholder = 'Paste the raw idea here';
  area.value = th.idea || '';
  const goBtn = el('button', null, 'Clarify');
  goBtn.type = 'button';
  goBtn.className = 'g-btn g-primary';
  goBtn.addEventListener('click', () => clarify(area.value));
  paste.append(area, goBtn);
  card.append(paste);

  const form = el('div', 'margin-top:8px;display:none');
  const inputs = {};
  for (const [k, label] of FIELDS) {
    const row = el('label', 'display:block;margin-top:8px;font-size:12px;color:var(--muted,#9a9aa2)', label);
    const f = el(k === 'next' || k === 'risks' ? 'textarea' : 'input', 'width:100%;min-height:34px;font:inherit;background:rgba(0,0,0,.22);color:inherit;border:1px solid rgba(255,255,255,.18);border-radius:8px;padding:6px 8px');
    f.dataset.field = k;
    f.addEventListener('input', () => {
      th.fields = th.fields || {};
      th.fields[k] = f.value;
      stageApi.save();
    });
    row.append(f);
    form.append(row);
    inputs[k] = f;
  }
  const bar = el('div', 'display:flex;gap:6px;flex-wrap:wrap;margin-top:10px');
  const md = () => '# Idea clarified\n\n' + FIELDS.map(([k, label]) => '## ' + label + '\n\n' + ((th.fields && th.fields[k]) || '')).join('\n\n') + '\n';
  const copyBtn = el('button', null, 'Copy Markdown');
  copyBtn.type = 'button';
  copyBtn.className = 'g-btn';
  copyBtn.addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(md());
      status.textContent = 'copied as Markdown for handoff';
    } catch (_) {
      status.textContent = 'select the text and copy';
    }
  });
  bar.append(copyBtn);
  form.append(bar);
  card.append(form);

  const paint = (fields) => {
    th.fields = fields;
    for (const [k] of FIELDS) inputs[k].value = fields[k] || '';
    paste.style.display = 'none';
    form.style.display = '';
    stageApi.save();
    status.textContent = 'Clarified by rule · edit any field · copy for client handoff';
  };
  const clarify = (idea) => {
    th.idea = idea;
    stageApi.save();
    status.textContent = 'clarifying…';
    const fields = ruleClarify(idea);
    paint(fields);
  };
  if (th.fields) paint(th.fields);
  else if (th.idea) clarify(th.idea);
}

async function run(text, api) {
  const p = ideaOf(text);
  if (!p) return 'none';
  api.summon('idea-clarify', { center: true, idea: p.idea });
  api.say(p.idea ? 'Idea clarified · structured brief ready to edit and hand off' : 'Idea · paste the raw idea into the card');
  return 'idea-clarify';
}

export default {
  name: 'idea-clarify',
  examples: ['clarify this idea', 'structure this business idea', 'turn this idea into a plan', 'clarify idea: we need automated invoicing'],
  nearMisses: ['what is an idea', 'idea for a movie', 'business plan template', 'clarify the rules'],
  match(lower, text) { return !!ideaOf(text); },
  run,
  stageKinds: { 'idea-clarify': { mount } },
  suite() {
    const ok = !!ideaOf('clarify this idea') && !!ideaOf('structure this business idea') && !ideaOf('what is an idea');
    return { ok, got: 'match works' };
  }
};
