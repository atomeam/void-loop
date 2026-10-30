/**
 * study-cards skill — flashcards with spaced repeat, a quiz from a list, a language drill, a definition card, a code snippet
 * card, an algorithm steps card, a formula card, a cite-as stub and a glossary builder, as cards on the stage (tools pack 7,
 * owner 2026-10-18: items 151 to 160). "flashcards: hola = hello, gato = cat", "language drill: ...", "quiz me from my list: ...",
 * "glossary: term = meaning", "definition card for entropy: ...", "python code card for reverse: ...", "algorithm steps card for
 * binary search: 1. ... 2. ...", "formula card for energy: E = mc^2 where E energy, m mass", "cite as apa: Title by Name, 2020, url".
 * The review schedule (Leitner boxes, local days) and everything typed are kept on this device only, in the stage's own storage;
 * nothing is sent anywhere. All the logic is lib/study-cards.js (tests: tools/tools-pack-7.test.mjs). Every value goes in by textContent.
 */
import { addThing, cardEl, keepOut } from '../lib/stage-pack.js';
import * as S from '../lib/study-cards.js';

export const { parseStudy } = S;

const BTN = 'font:inherit;padding:3px 12px;border-radius:14px;border:1px solid rgba(255,255,255,.3);background:transparent;color:inherit;cursor:pointer;min-height:28px';
const FIELD = 'font:inherit;background:rgba(255,255,255,.07);color:inherit;border:1px solid rgba(255,255,255,.18);border-radius:8px;padding:4px 8px;color-scheme:dark;min-width:0';

/** a tiny element builder: textContent only, never markup */
function h(tag, css, text, attrs) {
  const e = document.createElement(tag);
  if (css) e.style.cssText = css;
  if (text != null) e.textContent = text;
  if (attrs) for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v);
  return e;
}
const label = (th) => ({ flash: 'Flashcards', drill: 'Language drill', glossary: 'Glossary', define: 'Definition card', code: 'Code card', algo: 'Algorithm steps', formula: 'Formula card', cite: 'Cite as' }[th.mode] || 'Study card');

function copyText(stageApi, text) {
  try { navigator.clipboard.writeText(text).then(() => stageApi.say('copied'), () => stageApi.say('copy did not work here')); } catch (_) { stageApi.say('copy did not work here'); }
}

function button(text, fn, cls, el) {
  const b = h('button', BTN, text, { type: 'button' });
  if (cls) b.className = cls;
  b.addEventListener('click', (e) => { e.stopPropagation(); fn(); });
  keepOut(b);
  el.appendChild(b);
  return b;
}
function field(ph, value, onInput, w) {
  const i = h('input', FIELD + ';width:' + (w || 140) + 'px', null, { placeholder: ph, 'aria-label': ph });
  i.value = value || '';
  if (onInput) i.addEventListener('input', () => onInput(i.value));
  keepOut(i);
  return i;
}

// ---- the deck -------------------------------------------------------------------------------------

function mountDeck(th, el, stageApi) {
  const { save, render } = stageApi, today = S.dayKey();
  th.cards = th.cards || [];
  const idx = S.nextCard(th.cards, today), due = S.dueCards(th.cards, today).length;
  const head = h('div', 'display:flex;gap:8px;align-items:baseline;flex-wrap:wrap;margin-bottom:8px');
  head.appendChild(h('b', '', th.title || label(th)));
  head.appendChild(h('span', 'opacity:.7;font-size:12px', th.cards.length + ' card' + (th.cards.length === 1 ? '' : 's') + ' · ' + due + ' due today', { class: 'sc-count' }));
  el.appendChild(head);
  if (th.note) el.appendChild(h('div', 'opacity:.75;font-size:12px;margin:-4px 0 6px', th.note, { class: 'sc-note' }));
  const apply = (good) => {
    th.reviews = (th.reviews || 0) + 1;
    th.cards[idx] = S.grade(th.cards[idx], good, today, th.reviews);
    th.rev = false; th.res = null; save(); render();
  };
  const body = h('div', 'margin:6px 0 10px');
  if (idx < 0) {
    const nd = S.nextDueDay(th.cards, today);
    body.appendChild(h('div', 'font-size:16px', th.cards.length ? 'All caught up.' : 'No cards yet — add one below.', { class: 'sc-done' }));
    if (nd) body.appendChild(h('div', 'opacity:.75;font-size:12px;margin-top:4px', 'Next card comes back ' + (S.daysBetween(today, nd) === 1 ? 'tomorrow' : 'in ' + S.daysBetween(today, nd) + ' days') + ' (' + nd + ').'));
  } else {
    const c = th.cards[idx], rev = th.dir === 'rev', front = rev ? c.a : c.q, back = rev ? c.q : c.a;
    body.dataset.box = String(c.box);
    body.appendChild(h('div', 'font-size:20px;padding:10px 12px;border-radius:12px;background:rgba(255,255,255,.07)', front, { class: 'sc-front' }));
    if (th.typed) {
      if (!th.res) {
        const row = h('div', 'display:flex;gap:6px;margin-top:8px;flex-wrap:wrap');
        const inp = field('your answer', '', null, 200); inp.className = 'sc-type';
        const check = () => { const r = S.checkAnswer(inp.value, back); th.res = { ok: r.ok, typed: inp.value.slice(0, 120) }; save(); render(); };
        inp.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); check(); } });
        row.appendChild(inp); button('Check', check, 'sc-check', row); body.appendChild(row);
      } else {
        body.appendChild(h('div', 'margin-top:8px;color:' + (th.res.ok ? 'var(--a11y-ok,#78dc96)' : 'var(--a11y-bad,#ffb4a8)'), th.res.ok ? 'Correct' : 'Not quite — it is: ' + back, { class: 'sc-result', 'data-ok': th.res.ok ? '1' : '0' }));
        const row = h('div', 'display:flex;gap:6px;margin-top:8px'); button('Next', () => apply(!!th.res.ok), 'sc-next', row); body.appendChild(row);
      }
    } else if (!th.rev) {
      const row = h('div', 'margin-top:8px'); button('Show answer', () => { th.rev = true; save(); render(); }, 'sc-show', row); body.appendChild(row);
    } else {
      body.appendChild(h('div', 'font-size:18px;margin-top:8px;padding:8px 12px;border-radius:12px;border:1px solid rgba(255,255,255,.18)', back, { class: 'sc-back' }));
      const row = h('div', 'display:flex;gap:6px;margin-top:8px'); button('Again', () => apply(false), 'sc-again', row); button('Good', () => apply(true), 'sc-good', row); body.appendChild(row);
    }
  }
  el.appendChild(body);
  const bar = h('div', 'display:flex;gap:6px;flex-wrap:wrap;align-items:center;border-top:1px solid rgba(255,255,255,.12);padding-top:8px');
  button(th.typed ? 'Typed answers: on' : 'Typed answers: off', () => { th.typed = !th.typed; th.rev = false; th.res = null; save(); render(); }, 'sc-typed', bar);
  button(th.dir === 'rev' ? 'Direction: answer → term' : 'Direction: term → answer', () => { th.dir = th.dir === 'rev' ? 'fwd' : 'rev'; th.rev = false; th.res = null; save(); render(); }, 'sc-dir', bar);
  const q = field('new front', '', null, 110), a = field('new back', '', null, 110);
  const add = () => { const p = S.splitPair(q.value + ' = ' + a.value); if (!p || th.cards.length >= S.MAX_CARDS) return; th.cards.push(S.newCard(p.q, p.a, today)); save(); render(); };
  q.className = 'sc-newq'; a.className = 'sc-newa'; a.addEventListener('keydown', (e) => { if (e.key === 'Enter') add(); });
  bar.append(q, a); button('Add', add, 'sc-add', bar);
  el.appendChild(bar);
}

// ---- the other cards ------------------------------------------------------------------------------

function mountGlossary(th, el, stageApi) {
  const { save, render } = stageApi;
  th.entries = th.entries || [];
  el.appendChild(h('div', 'margin-bottom:8px', null)).appendChild(h('b', '', th.title || 'Glossary'));
  const dl = h('dl', 'margin:0 0 8px;display:grid;grid-template-columns:auto 1fr auto;gap:2px 10px;font-size:14px', null, { class: 'sc-glossary' });
  if (!th.entries.length) dl.appendChild(h('div', 'opacity:.7;grid-column:1/-1', 'Nothing here yet. Add a term below.'));
  for (const en of th.entries) {
    dl.appendChild(h('dt', 'font-weight:600', en.t, { class: 'sc-term' }));
    dl.appendChild(h('dd', 'margin:0', en.d));
    const x = h('button', BTN + ';padding:0 8px;min-height:22px', '×', { type: 'button', 'aria-label': 'remove ' + en.t });
    x.addEventListener('click', (e) => { e.stopPropagation(); th.entries = th.entries.filter((z) => z !== en); save(); render(); }); keepOut(x); dl.appendChild(x);
  }
  el.appendChild(dl);
  const bar = h('div', 'display:flex;gap:6px;flex-wrap:wrap');
  const t = field('term', '', null, 110), d = field('meaning', '', null, 180); t.className = 'sc-gterm'; d.className = 'sc-gdef';
  const add = () => { const p = S.splitPair(t.value + ' = ' + d.value); if (!p) return; th.entries = S.glossaryAdd(th.entries, [p]); save(); render(); };
  d.addEventListener('keydown', (e) => { if (e.key === 'Enter') add(); });
  bar.append(t, d); button('Add', add, 'sc-gadd', bar);
  button('Copy', () => copyText(stageApi, th.entries.map((e) => e.t + ': ' + e.d).join('\n')), 'sc-copy', bar);
  el.appendChild(bar);
}

function mountDefine(th, el, stageApi) {
  el.appendChild(h('div', 'opacity:.7;font-size:12px;text-transform:uppercase;letter-spacing:.06em', 'Definition'));
  el.appendChild(h('div', 'font-size:22px;font-weight:600;margin:2px 0 6px', th.term, { class: 'sc-term' }));
  el.appendChild(h('div', 'font-size:15px', th.def, { class: 'sc-def' }));
  const row = h('div', 'margin-top:8px'); button('Copy', () => copyText(stageApi, th.term + ': ' + th.def), 'sc-copy', row); el.appendChild(row);
}

function mountCode(th, el, stageApi) {
  const head = h('div', 'display:flex;gap:8px;align-items:baseline;margin-bottom:6px');
  head.appendChild(h('b', '', th.name || 'Code snippet'));
  if (th.lang) head.appendChild(h('span', 'opacity:.7;font-size:12px', th.lang));
  el.appendChild(head);
  const pre = h('pre', 'margin:0;padding:10px 12px;border-radius:10px;background:rgba(0,0,0,.35);overflow:auto;max-height:320px;font:13px/1.45 ui-monospace,SFMono-Regular,Menlo,monospace;white-space:pre', null, { class: 'sc-code', tabindex: '0' });
  pre.appendChild(h('code', '', th.code));
  el.appendChild(pre);
  const row = h('div', 'margin-top:8px'); button('Copy code', () => copyText(stageApi, th.code), 'sc-copy', row); el.appendChild(row);
}

function mountAlgo(th, el, stageApi) {
  const { save, render } = stageApi;
  th.done = Array.isArray(th.done) ? th.done : [];
  el.appendChild(h('div', 'margin-bottom:6px')).appendChild(h('b', '', th.name || 'Algorithm steps'));
  const ol = h('ol', 'margin:0 0 8px;padding-left:0;list-style:none;display:grid;gap:4px', null, { class: 'sc-steps' });
  const nextIdx = th.steps.findIndex((_, i) => !th.done[i]);
  th.steps.forEach((s, i) => {
    const li = h('li', 'display:flex;gap:8px;align-items:flex-start;padding:4px 8px;border-radius:8px;' + (i === nextIdx ? 'background:rgba(143,180,255,.16)' : ''), null, { 'data-step': String(i), 'data-now': i === nextIdx ? '1' : '0' });
    const cb = h('input', 'margin-top:3px', null, { type: 'checkbox', 'aria-label': 'step ' + (i + 1) + ' done' });
    cb.checked = !!th.done[i];
    cb.addEventListener('change', () => { th.done[i] = cb.checked; save(); render(); }); keepOut(cb);
    li.append(cb, h('span', th.done[i] ? 'text-decoration:line-through;opacity:.6' : '', (i + 1) + '. ' + s));
    ol.appendChild(li);
  });
  el.appendChild(ol);
  const row = h('div', 'display:flex;gap:6px;align-items:center');
  button('Reset', () => { th.done = []; save(); render(); }, 'sc-reset', row);
  row.appendChild(h('span', 'opacity:.7;font-size:12px', th.done.filter(Boolean).length + ' of ' + th.steps.length + ' done'));
  el.appendChild(row);
}

/** the expression with ^2 and ^{n+1} as real superscripts */
function formulaNode(expr) {
  const out = h('div', 'font:22px/1.4 Georgia,serif;padding:8px 12px;border-radius:10px;background:rgba(255,255,255,.07)', null, { class: 'sc-expr' });
  const re = /\^(\{[^}]+\}|-?\w+)/g; let last = 0, m;
  while ((m = re.exec(expr))) {
    out.appendChild(document.createTextNode(expr.slice(last, m.index)));
    out.appendChild(h('sup', '', m[1].replace(/^\{|\}$/g, '')));
    last = m.index + m[0].length;
  }
  out.appendChild(document.createTextNode(expr.slice(last)));
  return out;
}
function mountFormula(th, el, stageApi) {
  el.appendChild(h('div', 'margin-bottom:6px')).appendChild(h('b', '', th.name || 'Formula'));
  el.appendChild(formulaNode(th.expr));
  if ((th.legend || []).length) {
    const dl = h('dl', 'margin:8px 0 0;display:grid;grid-template-columns:auto 1fr;gap:2px 10px;font-size:14px');
    for (const l of th.legend) { dl.appendChild(h('dt', 'font-family:Georgia,serif;font-style:italic', l.sym)); dl.appendChild(h('dd', 'margin:0', l.means)); }
    el.appendChild(dl);
  }
  const row = h('div', 'margin-top:8px'); button('Copy', () => copyText(stageApi, th.expr), 'sc-copy', row); el.appendChild(row);
}

function mountCite(th, el, stageApi) {
  const { save, render } = stageApi;
  el.appendChild(h('div', 'margin-bottom:6px')).appendChild(h('b', '', 'Cite as'));
  const row = h('div', 'display:flex;gap:6px;margin-bottom:8px');
  for (const st of ['apa', 'mla', 'chicago']) {
    const b = button(st.toUpperCase(), () => { th.style = st; save(); render(); }, 'sc-style', row);
    b.setAttribute('aria-pressed', th.style === st ? 'true' : 'false'); b.dataset.style = st;
    if (th.style === st) b.style.background = 'rgba(143,180,255,.25)';
  }
  el.appendChild(row);
  const text = S.formatCite(th.cite, th.style);
  el.appendChild(h('div', 'padding:8px 12px;border-radius:10px;background:rgba(255,255,255,.07);font-size:15px;user-select:text', text, { class: 'sc-cite' }));
  el.appendChild(h('div', 'opacity:.65;font-size:11px;margin-top:6px', 'A starting stub from what you gave: check it against your style guide.'));
  const r2 = h('div', 'margin-top:8px'); button('Copy', () => copyText(stageApi, text), 'sc-copy', r2); el.appendChild(r2);
}

function mount(th, stageApi) {
  const el = cardEl(th, stageApi, 'study-card');
  el.dataset.mode = th.mode;
  el.style.minWidth = '260px';
  try {
    ({ flash: mountDeck, drill: mountDeck, glossary: mountGlossary, define: mountDefine, code: mountCode, algo: mountAlgo, formula: mountFormula, cite: mountCite }[th.mode] || mountDefine)(th, el, stageApi);
  } catch (e) { el.textContent = 'This study card could not be drawn.'; }
  stageApi.bindDrag(el, th);
  stageApi.stage.appendChild(el);
}

/** the kind's ask: make the card (or extend the deck / glossary already there); the name of what happened, or '' */
export function ask(lower, text, stageApi) {
  const p = S.parseStudy(text);
  if (!p) return '';
  const today = S.dayKey(), things = stageApi.things();
  const find = (fn) => Object.values(things).find((t) => t && t.kind === 'study' && fn(t));
  if (p.mode === 'glossary-add') {
    let th = find((t) => t.mode === 'glossary') || addThing(stageApi, 'study', { mode: 'glossary', title: '', entries: [] });
    th.entries = S.glossaryAdd(th.entries, p.pairs); stageApi.select(th.id);
  } else if (p.mode === 'card-add') {
    let th = find((t) => t.mode === 'flash' || t.mode === 'drill');
    if (!th) th = addThing(stageApi, 'study', S.deckOf({ mode: 'flash', pairs: [] }, today));
    for (const x of p.pairs) if (th.cards.length < S.MAX_CARDS) th.cards.push(S.newCard(x.q, x.a, today));
    stageApi.select(th.id);
  } else if (p.mode === 'glossary') {
    const th = find((t) => t.mode === 'glossary');
    if (th && p.pairs.length) { th.entries = S.glossaryAdd(th.entries, p.pairs); stageApi.select(th.id); } else if (!th) addThing(stageApi, 'study', { mode: 'glossary', title: p.title, entries: S.glossaryAdd([], p.pairs) });
    else stageApi.select(th.id);
  } else if (p.mode === 'flash' || p.mode === 'drill' || p.mode === 'quiz') addThing(stageApi, 'study', S.deckOf(p, today));
  else if (p.mode === 'define') addThing(stageApi, 'study', { mode: 'define', term: p.term, def: p.def });
  else if (p.mode === 'code') addThing(stageApi, 'study', { mode: 'code', lang: p.lang, name: p.name, code: p.code });
  else if (p.mode === 'algo') addThing(stageApi, 'study', { mode: 'algo', name: p.name, steps: p.steps, done: [] });
  else if (p.mode === 'formula') addThing(stageApi, 'study', { mode: 'formula', name: p.name, expr: p.expr, legend: p.legend });
  else if (p.mode === 'cite') addThing(stageApi, 'study', { mode: 'cite', style: p.style, cite: p.cite });
  else return '';
  stageApi.save(); stageApi.render();
  return 'study-' + p.mode;
}

export default {
  name: 'study-cards',
  examples: ['flashcards: hola = hello, gato = cat', 'make flashcards for spanish verbs', 'language drill: bonjour = hello; merci = thanks', 'glossary: entropy = disorder; enthalpy = heat content',
    'definition card for entropy: a measure of disorder', 'formula card for energy: E = mc^2 where E energy, m mass, c speed of light', 'cite as apa: The Origin of Species by Charles Darwin, 1859'],
  nearMisses: ['what are flashcards', 'best flashcard app for medical school', 'how do I study for an exam', 'define serendipity', 'quiz me on this', 'what is a glossary', 'cite this as APA', 'what is a formula', 'make flashcards for me'],
  parseStudy,
  match(lower, text) { return !!S.parseStudy(text || lower); },
  async run(text, api) { return ask(String(text || '').toLowerCase(), text, api.stage) ? 'study-cards' : 'none'; },
  stageKinds: { study: { mount, ask } },
};
