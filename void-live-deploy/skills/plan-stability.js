/**
 * plan-stability skill - "is my plan stable": a plan is a start value and a chain of numeric steps, each "input x multiplier
 * +-uncertainty%" (value = value * multiplier + input). The card nudges every input by up to +-5% (and every multiplier within
 * its stated uncertainty) many times with a seeded random generator, so the same plan always gives the same answer, and
 * estimates the divergence rate per step, a Lyapunov-style exponent: positive means errors grow ("brittle" until the plan is
 * redesigned), negative means they shrink ("stable"). Asked for by the owner (2026-10-18). Kept on this device with the stage;
 * nothing is sent anywhere.
 */
import { addThing, cardEl, keepOut, tidy } from '../lib/stage-pack.js';

export const TRIALS = 400;
export const NUDGE = 0.05;
export const EDGE = 0.001; // |exponent| under this is "neutral"

/** true for "is my plan stable" in its plain phrasings. Pure. */
export function isStabilityAsk(text) {
  return /^(?:please\s+)?(?:is|how)\s+(?:my\s+)?plan\s+(?:stable|brittle)\??(?:\s+please)?$/i.test(tidy(text)) || /^(?:please\s+)?(?:test|check)\s+(?:the\s+)?stability\s+of\s+my\s+plan$/i.test(tidy(text));
}

/** seeded generator (mulberry32): the same seed gives the same numbers. Pure. */
export function prng(seed) {
  let a = seed >>> 0;
  return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

/** { start, steps:[{input, mult, unc}] } from text: first line "start 100" (or a bare number), then one step per line or ";":
 *  "20 x0.9 +-10%" - input 20, multiplier 0.9, 10% uncertainty (unc optional, default 0). Pure. */
export function parsePlan(src) {
  const parts = String(src || '').split(/\r?\n|;/).map((s) => s.trim()).filter(Boolean);
  let start = 1;
  const steps = [];
  for (const p of parts) {
    const s = /^(?:start\s*)?(-?\d+(?:\.\d+)?)$/i.exec(p) || /^start\s*[:=]?\s*(-?\d+(?:\.\d+)?)$/i.exec(p);
    if (s && !steps.length) { start = Number(s[1]); continue; }
    const m = /^(-?\d+(?:\.\d+)?)\s*[x*]\s*(-?\d+(?:\.\d+)?)(?:\s*(?:\+-|\+\/-|±)\s*(\d+(?:\.\d+)?)\s*%?)?$/i.exec(p);
    if (m) steps.push({ input: Number(m[1]), mult: Number(m[2]), unc: Math.min(100, Number(m[3] || 0)) / 100 });
  }
  return { start, steps };
}

const run = (start, steps) => steps.reduce((v, s) => v * s.mult + s.input, start);

/** divergence per step: mean over trials of ln(relative output error / relative input nudge) / number of steps. Positive
 *  grows, negative shrinks. { exponent, state, trials }. Pure and deterministic for a given plan and seed. */
export function stability(plan, seed = 1, trials = TRIALS) {
  const n = plan.steps.length;
  if (!n) return { exponent: 0, state: 'empty', trials: 0 };
  const rnd = prng(seed), ref = run(plan.start, plan.steps), scale = Math.max(Math.abs(ref), 1e-9);
  let sum = 0, used = 0;
  for (let t = 0; t < trials; t++) {
    const eIn = [];
    const pert = (v, u) => { const e = (rnd() * 2 - 1) * u; eIn.push(e); return v * (1 + e); };
    const start = pert(plan.start, NUDGE);
    const steps = plan.steps.map((s) => ({ input: pert(s.input, NUDGE), mult: s.mult * (1 + (rnd() * 2 - 1) * s.unc), unc: 0 }));
    const inRms = Math.sqrt(eIn.reduce((a, e) => a + e * e, 0) / eIn.length);
    const outErr = Math.abs(run(start, steps) - ref) / scale;
    if (inRms > 1e-12 && outErr > 1e-15) { sum += Math.log(outErr / inRms); used++; }
  }
  const exponent = used ? sum / used / n : -Infinity;
  const e = Math.round(exponent * 10000) / 10000;
  return { exponent: e, state: e > EDGE ? 'brittle' : e < -EDGE ? 'stable' : 'neutral', trials: used };
}

function mount(th, stageApi) {
  const el = cardEl(th, stageApi, 'plan-stability');
  const head = document.createElement('div'); head.innerHTML = '<b>Plan stability</b>'; head.style.marginBottom = '6px'; el.appendChild(head);
  const ta = document.createElement('textarea'); ta.rows = 5; ta.value = th.src || ''; ta.setAttribute('aria-label', 'plan steps');
  ta.placeholder = 'start 100\n20 x1.1 +-5%\n0 x0.9 +-10%\n5 x1.2 +-5%';
  ta.style.cssText = 'width:100%;box-sizing:border-box;font:inherit;background:rgba(255,255,255,.07);color:inherit;border:1px solid rgba(255,255,255,.18);border-radius:8px;padding:6px';
  keepOut(ta); el.appendChild(ta);
  const out = document.createElement('div'); out.className = 'ps-out'; out.setAttribute('aria-live', 'polite'); out.style.cssText = 'margin-top:8px;font-size:13px'; el.appendChild(out);
  const hint = document.createElement('div'); hint.textContent = 'each step: input x multiplier +-uncertainty% · value = value x multiplier + input · inputs nudged +-5%'; hint.style.cssText = 'font-size:11px;opacity:.7;margin-top:4px'; el.appendChild(hint);
  const paint = () => {
    const r = stability(parsePlan(th.src));
    const word = r.state === 'brittle' ? 'Brittle: small errors grow. Redesign it.' : r.state === 'stable' ? 'Stable: small errors shrink.' : r.state === 'neutral' ? 'Neutral: errors neither grow nor shrink.' : 'Add steps to test.';
    out.dataset.state = r.state;
    out.textContent = (r.state === 'empty' ? '' : 'Divergence per step ' + (r.exponent > 0 ? '+' : '') + r.exponent + ' · ') + word;
    out.style.color = r.state === 'brittle' ? '#ff8a8a' : r.state === 'stable' ? '#78dc96' : 'inherit';
  };
  ta.addEventListener('input', () => { th.src = ta.value; stageApi.save(); paint(); });
  paint();
  stageApi.bindDrag(el, th);
  stageApi.stage.appendChild(el);
}

export function ask(lower, text, stageApi) {
  if (!isStabilityAsk(text)) return '';
  addThing(stageApi, 'planstab', { src: '' });
  stageApi.save(); stageApi.render();
  return 'plan-stability';
}

export default {
  name: 'plan-stability',
  examples: ['is my plan stable', 'is my plan brittle'],
  nearMisses: ['is my house stable', 'what is stable diffusion', 'is my plan to move worth it'],
  isStabilityAsk,
  match(lower, text) { return isStabilityAsk(text || lower); },
  async run(text, api) { return ask(String(text || '').toLowerCase(), text, api.stage) ? 'plan-stability' : 'none'; },
  stageKinds: { planstab: { mount, ask } },
};
