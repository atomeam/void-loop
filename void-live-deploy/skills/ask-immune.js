/**
 * ask-immune skill - "immune check: <your ask>" / "check my ask for vague goals": a stage card that scans a pasted ask or
 * goal for known pathogens and mounts one response per pathogen. A vague goal (a goal word with nothing measurable) gets a
 * forced definition field; scope creep ("and also", "everything") is quarantined (struck out of the clean ask); false
 * precision (an invented decimal with no source) puts the card in fever, which disables Accept until a clarity marker
 * (a number with a unit, a date, a named person) appears. Pathogens met before are remembered as antibodies (a count).
 * Asked for by the owner (2026-10-18), from his operating laws for thinking with a machine. Device-local; nothing is sent anywhere.
 */
import { escHtml, addThing, cardEl, keepOut } from '../lib/stage-pack.js';

/** the text after "immune check" / "check my ask for vague goals" ('' when none), or null when it is not that ask. Pure. */
export function parseImmune(text) {
  const m = /^(?:please\s+)?(?:run\s+(?:an?\s+|the\s+)?)?(?:immune\s+check|check\s+my\s+(?:ask|goal)\s+for\s+vague\s+goals?)\s*(?:[:\-]\s*|\s+(?:on|for)\s+)?([\s\S]*)$/i.exec(String(text || '').trim());
  return m ? m[1].trim().slice(0, 1200) : null;
}

const GOAL = /\b(?:improve|better|best|optimi[sz]e|enhance|grow|boost|increase|reduce|faster|stronger|simpler|easier|good|great|nice|more|less|scale|succeed|successful)\b/i;
const NUMBER_UNIT = /(?:[$€£]\s?\d[\d,]*(?:\.\d+)?|\b\d[\d,]*(?:\.\d+)?\s?(?:%|percent|ms|s|sec|secs|seconds?|min|mins|minutes?|hrs?|hours?|days?|weeks?|months?|years?|users?|people|customers?|clients?|items?|pages?|words?|kg|km|mb|gb|dollars?|usd|eur|points?|signups?|sales)\b)/i;
const DATE = /\b(?:\d{4}-\d{2}-\d{2}|(?:jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)[a-z]*\.?\s+\d{1,2}(?:st|nd|rd|th)?|\d{1,2}(?:st|nd|rd|th)?\s+(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*|q[1-4]\s*\d{0,4}|(?:mon|tues|wednes|thurs|fri|satur|sun)day|tomorrow|tonight|end of (?:day|week|month|quarter|year))\b/i;
const NOT_PEOPLE = /^(?:mon|tues|wednes|thurs|fri|satur|sun)day$|^(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)/i;
const SCOPE = /\b(?:and also|and then also|as well as|while you'?re at it|while we'?re at it|on top of that|everything|all of it|anything else|et cetera|etc\.?)\b/ig;
const SOURCE = /\b(?:source|according to|per|cited|citing|https?:\/\/|measured|survey|study|report(?:ed)? by)\b/i;
const PRECISE = /\b\d+\.\d{2,}\s*%?|\b\d+\.\d+\s*%/g;

/** is there a named person: a capitalised name after with/for/by/to/ask/owner, that is not a weekday or a month. Pure. */
export function hasPerson(text) {
  const re = /\b(?:with|for|by|to|ask|owner:?|assigned to|from)\s+(?:Dr\.?\s+|Mr\.?\s+|Ms\.?\s+|Mrs\.?\s+)?([A-Z][a-z]{2,})\b/g;
  let m;
  while ((m = re.exec(String(text || '')))) if (!NOT_PEOPLE.test(m[1])) return true;
  return false;
}

/** which clarity markers the text carries: { unit, date, person, count }. Pure. */
export function clarity(text) {
  const t = String(text || '');
  const unit = NUMBER_UNIT.test(t), date = DATE.test(t), person = hasPerson(t);
  return { unit, date, person, count: +unit + +date + +person };
}

/** the pathogens in a text: [{ id: 'vague'|'scope'|'precision', phrase }] in the order they sit. Pure. */
export function scan(text) {
  const t = String(text || ''), found = [];
  const g = GOAL.exec(t);
  if (g && !NUMBER_UNIT.test(t) && !DATE.test(t)) found.push({ id: 'vague', phrase: g[0], at: g.index });
  for (const m of t.matchAll(SCOPE)) found.push({ id: 'scope', phrase: m[0], at: m.index });
  if (!SOURCE.test(t)) for (const m of t.matchAll(PRECISE)) found.push({ id: 'precision', phrase: m[0].trim(), at: m.index });
  return found.sort((a, b) => a.at - b.at).map(({ id, phrase }) => ({ id, phrase }));
}

export const RESPONSE = { vague: 'definition field', scope: 'quarantine', precision: 'fever' };

/** the ask with every scope phrase struck out (the quarantine), spaces tidied. Pure. */
export function quarantine(text) {
  return String(text || '').replace(SCOPE, '').replace(/\s{2,}/g, ' ').replace(/\s+([,.;:!?])/g, '$1').trim();
}

/** the verdict: pathogens, clarity, fever, and whether Accept is enabled. defs = what was typed in the definition field. Pure. */
export function verdict(text, defs = '') {
  const pathogens = scan(text), ids = new Set(pathogens.map((p) => p.id));
  const cl = clarity(String(text || '') + ' ' + String(defs || ''));
  const needsDef = ids.has('vague') && !String(defs || '').trim();
  const fever = pathogens.length > 0 && cl.count === 0;
  return { pathogens, ids: [...ids], clarity: cl, needsDef, fever, quarantined: quarantine(text), canAccept: !!String(text || '').trim() && !fever && !needsDef };
}

/** antibodies after meeting these pathogens: a count per kind, once per kind per check. Pure. */
export function meet(antibodies, pathogens) {
  const out = { ...(antibodies || {}) };
  for (const id of new Set((pathogens || []).map((p) => p.id))) out[id] = (out[id] || 0) + 1;
  return out;
}

const NAMES = { vague: 'vague goal', scope: 'scope creep', precision: 'false precision' };

function mount(th, stageApi) {
  const el = cardEl(th, stageApi, 'ask-immune');
  th.antibodies = th.antibodies || {};
  el.innerHTML = '<b>Immune check</b> <span class="im-anti" style="opacity:.75;font-size:12px"></span>';
  const box = document.createElement('textarea');
  box.className = 'im-text'; box.rows = 3; box.value = th.text || ''; box.setAttribute('aria-label', 'the ask to check'); box.placeholder = 'paste an ask or goal';
  box.style.cssText = 'display:block;width:100%;box-sizing:border-box;margin:8px 0;font:inherit;background:rgba(255,255,255,.07);color:inherit;border:1px solid rgba(255,255,255,.18);border-radius:8px;padding:6px';
  const out = document.createElement('div'); out.className = 'im-out';
  const def = document.createElement('input');
  def.className = 'im-def'; def.value = th.definition || ''; def.setAttribute('aria-label', 'what would done look like, measured how');
  def.placeholder = 'Define it: what would done look like, measured how?';
  def.style.cssText = 'display:block;width:100%;box-sizing:border-box;margin:6px 0;font:inherit;background:rgba(255,255,255,.07);color:inherit;border:1px solid rgba(255,255,255,.18);border-radius:8px;padding:4px 6px';
  const bar = document.createElement('div'); bar.style.cssText = 'display:flex;gap:6px;align-items:center;flex-wrap:wrap';
  const mk = (label, cls) => { const b = document.createElement('button'); b.type = 'button'; b.className = cls; b.textContent = label; b.style.cssText = 'font:inherit;padding:3px 12px;border-radius:12px;border:1px solid rgba(255,255,255,.3);background:transparent;color:inherit;cursor:pointer'; keepOut(b); bar.appendChild(b); return b; };
  const check = mk('Check', 'im-check'), accept = mk('Accept', 'im-accept');
  const state = document.createElement('span'); state.className = 'im-state'; state.style.cssText = 'font-size:12px;opacity:.85';
  bar.appendChild(state);
  const antiEl = el.querySelector('.im-anti');
  const paintAnti = () => { const a = th.antibodies, parts = Object.keys(NAMES).filter((k) => a[k]).map((k) => NAMES[k] + ' x' + a[k]); antiEl.textContent = parts.length ? '· antibodies: ' + parts.join(', ') : ''; };
  const paint = () => {
    const v = verdict(box.value, def.value);
    el.dataset.fever = v.fever ? '1' : '';
    el.style.borderColor = v.fever ? '#ff7a59' : 'rgba(255,255,255,.14)';
    out.innerHTML = '';
    for (const p of v.pathogens) {
      const row = document.createElement('div'); row.className = 'im-path'; row.dataset.pathogen = p.id; row.style.cssText = 'font-size:13px;margin:2px 0';
      row.innerHTML = '<b>' + escHtml(NAMES[p.id]) + '</b>: <s style="opacity:.7">' + escHtml(p.phrase) + '</s> &rarr; ' + escHtml(RESPONSE[p.id]);
      out.appendChild(row);
    }
    if (v.ids.includes('scope')) { const q = document.createElement('div'); q.className = 'im-clean'; q.style.cssText = 'font-size:13px;margin:4px 0;opacity:.9'; q.textContent = 'Clean ask: ' + v.quarantined; out.appendChild(q); }
    def.style.display = v.ids.includes('vague') ? 'block' : 'none';
    accept.disabled = !v.canAccept; accept.style.opacity = v.canAccept ? '1' : '.4'; accept.style.cursor = v.canAccept ? 'pointer' : 'not-allowed';
    state.textContent = v.fever ? 'Fever: add a number with a unit, a date, or a named person.' : v.needsDef ? 'Define the goal to accept.' : th.accepted ? 'Accepted.' : '';
    paintAnti();
  };
  box.addEventListener('input', () => { th.text = box.value; th.accepted = false; stageApi.save(); paint(); });
  def.addEventListener('input', () => { th.definition = def.value; stageApi.save(); paint(); });
  check.addEventListener('click', (e) => { e.stopPropagation(); th.antibodies = meet(th.antibodies, scan(box.value)); stageApi.save(); paint(); });
  accept.addEventListener('click', (e) => { e.stopPropagation(); if (accept.disabled) return; th.accepted = true; stageApi.save(); paint(); });
  keepOut(box); keepOut(def);
  el.append(box, out, def, bar);
  paint();
  stageApi.bindDrag(el, th);
  stageApi.stage.appendChild(el);
}

/** the stage kind's ask hook: put the card on the stage (with the pasted text), or '' */
export function ask(lower, text, stageApi) {
  const body = parseImmune(text);
  if (body === null) return '';
  addThing(stageApi, 'immune', { text: body, definition: '', antibodies: {}, accepted: false });
  stageApi.save(); stageApi.render();
  return 'ask-immune';
}

export default {
  name: 'ask-immune',
  examples: ['immune check: make the app better and also fix everything', 'check my ask for vague goals', 'immune check'],
  nearMisses: ['what is the immune system', 'check my spelling', 'check my ask for typos', 'how do I boost my immune system'],
  parseImmune,
  match(lower, text) { return parseImmune(text || lower) !== null; },
  async run(text, api) { return ask(String(text || '').toLowerCase(), text, api.stage) ? 'ask-immune' : 'none'; },
  stageKinds: { immune: { mount, ask } },
};
