/**
 * counterfactual-draft skill — "what if my assumption is false: people want speed. Document: We ship fast. People want speed, so we skip polish."
 * / "write the opposite of my plan": a stage card with the document and, collapsed under it, a shadow document (the assumption
 * negated and every sentence that depends on it flipped by a fixed template). Opening the shadow marks the fracture line in
 * the main text: the first sentence that depends on the assumption. No model, nothing is sent anywhere.
 * Asked for by the owner (2026-10-18, "operating laws for serious thought with a machine").
 */
import { addThing, cardEl, keepOut, tidy } from '../lib/stage-pack.js';

/** { assumption, doc } from an ask, { assumption:'', doc:'' } for the bare ask, or null. Pure. */
export function parseCounter(text) {
  const t = tidy(text);
  const m = /^(?:please\s+)?(?:write\s+(?:me\s+)?the\s+opposite\s+of\s+my\s+plan|what\s+if\s+my\s+(?:key\s+)?assumption\s+(?:is|were|was)\s+(?:false|wrong))\s*(?:[:\-]\s*(.+))?$/i.exec(t);
  if (!m) return null;
  if (!m[1]) return { assumption: '', doc: '' };
  const parts = /^(.*?)\s*\bdocument\s*:\s*(.+)$/i.exec(m[1]);
  if (!parts) return { assumption: m[1].trim().slice(0, 200), doc: '' };
  return { assumption: parts[1].replace(/^assumption\s*:\s*/i, '').replace(/[.!?]+$/, '').trim().slice(0, 200), doc: parts[2].trim().slice(0, 1500) };
}

/** sentences of a document, trimmed. Pure. */
export const sentences = (doc) => (String(doc || '').match(/[^.!?]+[.!?]*/g) || []).map((s) => s.trim()).filter(Boolean);

const STOP = new Set('the a an and or but of to in on for with is are was were be been it its this that these those we our you your they their will would can could should not no so as at by from if then than there here have has had do does did into about over more most very just also one two'.split(' '));
const stem = (w) => w.replace(/(ing|ed|es|s)$/, '');
/** content words of a text (lower case, stop words and short words out, plural/tense trimmed). Pure. */
export const contentWords = (s) => [...new Set((String(s || '').toLowerCase().match(/[a-z0-9']+/g) || []).filter((w) => w.length > 3 && !STOP.has(w)).map(stem))];

const CONSEQUENCE = /^(?:so|therefore|thus|hence|which\s+means|as\s+a\s+result|that\s+is\s+why)\b/i;

/** per sentence: does it depend on the assumption? It shares a content word with it, or it follows a dependent sentence with a consequence word. Pure. */
export function dependents(assumption, doc) {
  const a = new Set(contentWords(assumption));
  let prev = false;
  return sentences(doc).map((s) => {
    const dep = contentWords(s).some((w) => a.has(w)) || (prev && CONSEQUENCE.test(s));
    prev = dep;
    return { text: s, dep };
  });
}

/** the index of the fracture line (first dependent sentence), or -1. Pure. */
export const fractureOf = (assumption, doc) => dependents(assumption, doc).findIndex((x) => x.dep);

/** flip one claim by a fixed template. Pure. */
export function flip(sentence) {
  const s = String(sentence).trim(), end = /[.!?]$/.test(s) ? s.slice(-1) : '.', body = s.replace(/[.!?]+$/, '');
  const un = [[/\b(is|are|was|were|will|would|can|could|should|does|do|did|has|have)\s+not\b/i, '$1'], [/\bcannot\b/i, 'can'], [/\bwon't\b/i, 'will'], [/\bisn't\b/i, 'is'], [/\baren't\b/i, 'are'], [/\bdon't\b/i, 'do'], [/\bdoesn't\b/i, 'does']];
  for (const [re, to] of un) if (re.test(body)) return body.replace(re, to) + end;
  const neg = [[/\bcan\b/i, 'cannot'], [/\b(is|are|was|were|will|would|could|should|does|do|did|has|have)\b/i, '$1 not']];
  for (const [re, to] of neg) if (re.test(body)) return body.replace(re, to) + end;
  return 'It is not the case that ' + body.charAt(0).toLowerCase() + body.slice(1) + end;
}

/** the shadow document: assumption negated, dependent sentences flipped, the rest kept. Pure. */
export function shadowOf(assumption, doc) {
  const a = String(assumption || '').trim().replace(/[.!?]+$/, '');
  return ['Suppose this is false: ' + a + '.', ...dependents(a, doc).map((x) => (x.dep ? flip(x.text) : x.text))].join(' ');
}

function mount(th, stageApi) {
  const el = cardEl(th, stageApi, 'counterfactual-draft');
  const { save, render } = stageApi;
  const head = document.createElement('div'); head.innerHTML = '<b>Counterfactual draft</b>'; head.style.marginBottom = '6px'; el.appendChild(head);
  const field = (label, value, tag, onChange) => {
    const l = document.createElement('label'); l.style.cssText = 'display:block;font-size:12px;opacity:.9;margin-top:4px'; l.textContent = label;
    const i = document.createElement(tag); i.value = value || ''; i.setAttribute('aria-label', label);
    i.style.cssText = 'display:block;width:100%;box-sizing:border-box;font:inherit;background:rgba(255,255,255,.07);color:inherit;border:1px solid rgba(255,255,255,.18);border-radius:6px;padding:3px 6px';
    if (tag === 'textarea') i.rows = 4;
    i.addEventListener('input', () => { onChange(i.value); save(); }); keepOut(i); l.appendChild(i); el.appendChild(l); return i;
  };
  field('Key assumption', th.assumption, 'input', (v) => { th.assumption = v.slice(0, 200); });
  field('Short document', th.doc, 'textarea', (v) => { th.doc = v.slice(0, 1500); });
  const done = document.createElement('div');
  if (th.assumption && th.doc) {
    const deps = dependents(th.assumption, th.doc), fr = deps.findIndex((x) => x.dep);
    const main = document.createElement('p'); main.className = 'cf-main'; main.style.cssText = 'margin:8px 0';
    deps.forEach((x) => { const s = document.createElement('span'); s.textContent = x.text + ' '; s.dataset.dep = x.dep ? '1' : ''; s.dataset.fracture = ''; s.className = 'cf-sentence'; main.appendChild(s); });
    const sh = document.createElement('details'); sh.className = 'cf-shadow';
    const sum = document.createElement('summary'); sum.textContent = 'Shadow document (the opposite)'; sum.style.cursor = 'pointer';
    const body = document.createElement('p'); body.className = 'cf-shadow-text'; body.textContent = shadowOf(th.assumption, th.doc);
    keepOut(sum); sh.append(sum, body);
    const note = document.createElement('div'); note.className = 'cf-note'; note.style.cssText = 'font-size:12px;min-height:1em'; note.setAttribute('aria-live', 'polite');
    sh.addEventListener('toggle', () => { // opening annotates the main text with the fracture line
      main.querySelectorAll('.cf-sentence').forEach((s, i) => {
        s.dataset.fracture = sh.open && i === fr ? '1' : '';
        s.style.cssText = sh.open && s.dataset.dep ? 'text-decoration:underline dotted;' + (i === fr ? 'background:rgba(255,209,102,.3);border-left:3px solid #ffd166;padding-left:4px' : '') : '';
      });
      note.textContent = sh.open ? (fr >= 0 ? 'Fracture line: "' + deps[fr].text + '" is the first sentence that stops holding.' : 'Nothing in the text depends on that assumption.') : '';
    });
    done.append(main, sh, note);
  }
  const go = document.createElement('button'); go.type = 'button'; go.textContent = 'Write the opposite'; go.className = 'cf-go';
  go.style.cssText = 'margin-top:6px;font:inherit;padding:2px 10px;border-radius:12px;border:1px solid rgba(255,255,255,.3);background:transparent;color:inherit;cursor:pointer';
  go.addEventListener('click', (e) => { e.stopPropagation(); save(); render(); }); keepOut(go);
  el.appendChild(go); el.appendChild(done);
  stageApi.bindDrag(el, th);
  stageApi.stage.appendChild(el);
}

export function ask(lower, text, stageApi) {
  const p = parseCounter(text);
  if (!p) return '';
  addThing(stageApi, 'counterfactual', { assumption: p.assumption, doc: p.doc });
  stageApi.save(); stageApi.render();
  return 'counterfactual-draft';
}

export default {
  name: 'counterfactual-draft',
  examples: ['write the opposite of my plan', 'what if my assumption is false', 'what if my assumption is false: people want speed. Document: We ship fast. People want speed, so we skip polish.'],
  nearMisses: ['write a plan for my week', 'what if it rains tomorrow', 'what is an assumption', 'write the opposite of a word'],
  parseCounter,
  match(lower, text) { return !!parseCounter(text || lower); },
  async run(text, api) { return ask(String(text || '').toLowerCase(), text, api.stage) ? 'counterfactual-draft' : 'none'; },
  stageKinds: { counterfactual: { mount, ask } },
};
