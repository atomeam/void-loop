/**
 * eigenwork skill - "factor my goal launch a podcast" splits a goal into effort modes (research, decision, craft, social).
 * The person tags their own steps with a mode ("research: read three papers | 40" - the number is percent done); progress is
 * kept per mode; the goal can be marked done only when every REQUIRED mode has non-zero progress. Asked for by the owner
 * (2026-10-18). Kept on this device with the stage; nothing is sent anywhere.
 */
import { addThing, cardEl, keepOut, tidy, escHtml } from '../lib/stage-pack.js';

export const MODES = ['research', 'decision', 'craft', 'social'];

/** the goal an ask names ('' for a bare "factor my goal"), or null when it is not an eigenwork ask. Pure. */
export function parseGoal(text) {
  const m = /^(?:please\s+)?factor\s+(?:out\s+)?my\s+goal\s*(?:[:\-]\s*|\s+(?:of|to|for)\s+|\s+)?(.*)$/i.exec(tidy(text));
  return m ? m[1].trim().slice(0, 80) : null;
}

/** steps from lines "mode: text | percent"; a line with no known mode is skipped; percent is 0..100 (default 0). Pure. */
export function parseSteps(src) {
  const out = [];
  for (const line of String(src || '').split(/\r?\n/)) {
    const m = /^\s*(research|decision|craft|social)\s*:\s*(.*?)\s*(?:\|\s*(-?\d+(?:\.\d+)?)\s*%?)?\s*$/i.exec(line);
    if (m) out.push({ mode: m[1].toLowerCase(), text: m[2].slice(0, 80), pct: Math.min(100, Math.max(0, m[3] === undefined ? 0 : Number(m[3]))) });
  }
  return out;
}

/** progress per mode 0..100: the mean percent of that mode's steps; a mode with no steps is 0. Pure. */
export function modeProgress(steps) {
  const r = {};
  for (const mo of MODES) {
    const s = steps.filter((x) => x.mode === mo);
    r[mo] = s.length ? Math.round((s.reduce((a, x) => a + x.pct, 0) / s.length) * 100) / 100 : 0;
  }
  return r;
}

/** { ok, missing[], none } - done is allowed only when at least one mode is required and every required mode has progress above 0. Pure. */
export function canFinish(steps, required) {
  const req = MODES.filter((m) => (required || []).includes(m)), p = modeProgress(steps);
  const missing = req.filter((m) => !(p[m] > 0));
  return { ok: req.length > 0 && missing.length === 0, missing, none: req.length === 0 };
}

function mount(th, stageApi) {
  const el = cardEl(th, stageApi, 'eigenwork');
  th.required = Array.isArray(th.required) ? th.required : MODES.slice();
  th.src = typeof th.src === 'string' ? th.src : '';
  const head = document.createElement('div'); head.innerHTML = '<b>Eigenwork</b> · ' + escHtml(th.goal || 'my goal'); head.style.marginBottom = '6px'; el.appendChild(head);
  const bars = document.createElement('div'); el.appendChild(bars);
  const ta = document.createElement('textarea'); ta.rows = 4; ta.value = th.src; ta.setAttribute('aria-label', 'steps for ' + (th.goal || 'my goal'));
  ta.placeholder = 'research: read three papers | 40\ndecision: pick a launch date | 0\ncraft: record episode one | 10\nsocial: ask two friends to listen | 0';
  ta.style.cssText = 'width:100%;box-sizing:border-box;margin-top:8px;font:inherit;background:rgba(255,255,255,.07);color:inherit;border:1px solid rgba(255,255,255,.18);border-radius:8px;padding:6px';
  keepOut(ta); el.appendChild(ta);
  const status = document.createElement('div'); status.className = 'ew-status'; status.style.cssText = 'margin-top:6px;font-size:12px'; el.appendChild(status);
  const done = document.createElement('button'); done.type = 'button'; done.className = 'ew-done'; done.textContent = 'Mark done';
  done.style.cssText = 'margin-top:6px;font:inherit;padding:3px 12px;border-radius:12px;border:1px solid rgba(255,255,255,.3);background:transparent;color:inherit;cursor:pointer';
  keepOut(done); el.appendChild(done);
  const paint = () => {
    const steps = parseSteps(th.src), p = modeProgress(steps), c = canFinish(steps, th.required);
    bars.innerHTML = '';
    for (const mo of MODES) {
      const row = document.createElement('label'); row.className = 'ew-mode'; row.dataset.mode = mo; row.style.cssText = 'display:flex;align-items:center;gap:8px;margin:3px 0';
      const cb = document.createElement('input'); cb.type = 'checkbox'; cb.checked = th.required.includes(mo); cb.setAttribute('aria-label', mo + ' is required');
      cb.addEventListener('change', () => { th.required = cb.checked ? [...new Set([...th.required, mo])] : th.required.filter((x) => x !== mo); stageApi.save(); paint(); });
      keepOut(cb);
      const name = document.createElement('span'); name.textContent = mo; name.style.cssText = 'width:64px';
      const track = document.createElement('span'); track.style.cssText = 'flex:1;height:8px;border-radius:4px;background:rgba(255,255,255,.14);overflow:hidden;min-width:120px';
      const fill = document.createElement('span'); fill.className = 'ew-fill'; fill.style.cssText = 'display:block;height:100%;width:' + p[mo] + '%;background:' + (p[mo] > 0 ? '#78dc96' : '#8fb4ff');
      track.appendChild(fill);
      const num = document.createElement('span'); num.className = 'ew-pct'; num.textContent = p[mo] + '%'; num.style.cssText = 'width:44px;text-align:right';
      row.append(cb, name, track, num); bars.appendChild(row);
    }
    status.textContent = th.finished ? 'Done. Every required mode moved.' : c.none ? 'Tick at least one required mode.' : c.ok ? 'Every required mode has moved: you can mark it done.' : 'Not done: nothing yet in ' + c.missing.join(', ') + '.';
    done.disabled = !!th.finished; done.setAttribute('aria-disabled', c.ok ? 'false' : 'true'); done.style.opacity = c.ok ? '1' : '.5';
  };
  ta.addEventListener('input', () => { th.src = ta.value; stageApi.save(); paint(); });
  done.addEventListener('click', (e) => { e.stopPropagation(); if (canFinish(parseSteps(th.src), th.required).ok) { th.finished = true; stageApi.save(); } paint(); });
  paint();
  stageApi.bindDrag(el, th);
  stageApi.stage.appendChild(el);
}

/** the stage kind's ask hook */
export function ask(lower, text, stageApi) {
  const goal = parseGoal(text);
  if (goal === null) return '';
  addThing(stageApi, 'eigenwork', { goal: goal || 'my goal', src: '', required: MODES.slice() });
  stageApi.save(); stageApi.render();
  return 'eigenwork';
}

export default {
  name: 'eigenwork',
  examples: ['factor my goal launch a podcast', 'factor my goal: learn spanish'],
  nearMisses: ['factor 144 into primes', 'what are the factors of success', 'factor analysis of my survey'],
  parseGoal,
  match(lower, text) { return parseGoal(text || lower) !== null; },
  async run(text, api) { return ask(String(text || '').toLowerCase(), text, api.stage) ? 'eigenwork' : 'none'; },
  stageKinds: { eigenwork: { mount, ask } },
};
