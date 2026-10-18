/**
 * hunting-question skill — "a question I'm avoiding: <q>" registers a question once. From then on, on every later visit, it
 * shows as one small line at the margin of the stage. It is never answered. It leaves only when the person writes a reason to
 * release it ("release my question <words> | reason: <why>") or marks it faced ("I faced <words>" or the button). Kept with the
 * stage on this device; nothing is sent anywhere. Asked for by the owner (2026-10-18).
 */
import { escHtml, addThing, firstOf, keepOut, tidy } from '../lib/stage-pack.js';
import { words, sameThing } from '../lib/stage-words.js';

const MAX_Q = 12;
const AP = "['’]";
const REG = new RegExp('^(?:please\\s+)?(?:a|the|another)\\s+question\\s+i(?:' + AP + 'm|\\s+am|\\s+keep)\\s+avoiding\\s*[:\\-]\\s*(.+)$', 'i');
const REL = /^(?:please\s+)?release\s+(?:my\s+|the\s+)?question\s*[:\-]?\s*(.+)$/i;
const FACED = /^(?:please\s+)?(?:i\s+faced|mark\s+(?:my\s+|the\s+)?question)\s*[:\-]?\s*(.+?)(?:\s+(?:as\s+)?faced)?$/i;

/** what an ask wants: { act:'register', q } | { act:'release', about, reason } | { act:'faced', about } | null. Pure. */
export function questionIntent(text) {
  const t = tidy(text);
  let m;
  if ((m = REG.exec(t))) { const q = m[1].trim().slice(0, 240); return words(q).length ? { act: 'register', q } : null; }
  if ((m = REL.exec(t))) { const parts = m[1].split(/\s*\|\s*/), r = /^reason\s*[:=]\s*(.+)$/i.exec((parts[1] || '').trim()); return words(parts[0]).length ? { act: 'release', about: parts[0].trim(), reason: r ? r[1].trim().slice(0, 240) : '' } : null; }
  if ((m = FACED.exec(t))) return words(m[1]).length ? { act: 'faced', about: m[1].trim() } : null;
  return null;
}

const open = (qs) => (qs || []).filter((q) => q.status === 'open');

/** register a question once (the same words twice is the same question). Pure. */
export function register(qs, q, now = Date.now()) {
  const list = (qs || []).map((x) => ({ ...x }));
  if (list.some((x) => x.status === 'open' && sameThing(x.q, q))) return { ok: false, reason: 'you are already avoiding that one', qs: list };
  if (open(list).length >= MAX_Q) return { ok: false, reason: 'twelve questions are already hunting you: face or release one first', qs: list };
  return { ok: true, qs: list.concat({ q: String(q).slice(0, 240), at: now, status: 'open', reason: '' }) };
}

/** release a question: needs a written reason (at least two content words); without one nothing changes. Pure. */
export function release(qs, about, reason, now = Date.now()) {
  const list = (qs || []).map((x) => ({ ...x }));
  const i = list.findIndex((x) => x.status === 'open' && sameThing(x.q, about, 0.5));
  if (i < 0) return { ok: false, reason: 'no hunting question like that', qs: list };
  if (words(reason).length < 2) return { ok: false, reason: 'a question is released only with a reason you write: add "| reason: ..."', qs: list };
  list[i].status = 'released'; list[i].reason = String(reason).trim(); list[i].done = now;
  return { ok: true, qs: list };
}

/** mark a question faced (no reason needed: you turned round). Pure. */
export function face(qs, about, now = Date.now()) {
  const list = (qs || []).map((x) => ({ ...x }));
  const i = list.findIndex((x) => x.status === 'open' && sameThing(x.q, about, 0.5));
  if (i < 0) return { ok: false, reason: 'no hunting question like that', qs: list };
  list[i].status = 'faced'; list[i].done = now;
  return { ok: true, qs: list };
}

/** the open question to show on a visit: they take turns, one line at a time. null when none are open. Pure. */
export function pick(qs, visit) {
  const o = open(qs);
  return o.length ? o[Math.abs(Math.trunc(visit || 0)) % o.length] : null;
}

let bumped = false; // one visit counts once per page load, however often the stage redraws

function mount(th, stageApi) {
  if (!bumped) { bumped = true; th.visits = (th.visits || 0) + 1; stageApi.save(); }
  const q = pick(th.qs, (th.visits || 1) - 1);
  if (!q) return;
  const el = document.createElement('div');
  el.className = 'hunting-question'; el.dataset.hunting = th.id;
  el.setAttribute('role', 'note');
  el.style.cssText = 'position:absolute;left:8px;bottom:8px;max-width:min(60vw,360px);z-index:24;font:12px/1.35 system-ui,sans-serif;color:#e8e8e8;opacity:.62;padding:4px 8px;border-left:2px solid #ff9b9b';
  el.innerHTML = '<span class="hq-text">' + escHtml(q.q) + '</span> ';
  const reasonBox = document.createElement('input');
  reasonBox.placeholder = 'a reason to release it'; reasonBox.setAttribute('aria-label', 'reason to release the question');
  reasonBox.style.cssText = 'display:none;font:12px system-ui;width:150px;background:rgba(255,255,255,.07);color:inherit;border:1px solid rgba(255,255,255,.18);border-radius:6px;padding:1px 4px';
  reasonBox.addEventListener('keydown', (e) => { e.stopPropagation(); if (e.key === 'Enter') { const r = release(th.qs, q.q, reasonBox.value); if (r.ok) { th.qs = r.qs; stageApi.save(); stageApi.render(); } else stageApi.say(r.reason); } });
  const btn = (label, fn) => { const b = document.createElement('button'); b.type = 'button'; b.textContent = label; b.style.cssText = 'font:11px system-ui;margin-left:4px;padding:0 6px;border-radius:10px;border:1px solid rgba(255,255,255,.3);background:transparent;color:inherit;cursor:pointer'; b.addEventListener('click', (e) => { e.stopPropagation(); fn(); }); keepOut(b); el.appendChild(b); };
  btn('faced', () => { const r = face(th.qs, q.q); if (r.ok) { th.qs = r.qs; stageApi.save(); stageApi.render(); } });
  btn('release', () => { reasonBox.style.display = 'inline-block'; reasonBox.focus(); });
  keepOut(reasonBox); el.appendChild(reasonBox);
  stageApi.stage.appendChild(el);
}

/** the stage kind's ask hook; the name of what happened, or '' */
export function ask(lower, text, stageApi) {
  const it = questionIntent(text);
  if (!it) return '';
  let th = firstOf(stageApi, 'hunted');
  if (it.act === 'register') {
    if (!th) th = addThing(stageApi, 'hunted', { qs: [], visits: 0 });
    const r = register(th.qs, it.q);
    if (!r.ok) { stageApi.say(r.reason); return 'hunting-question-refused'; }
    th.qs = r.qs; stageApi.say('registered: it will find you on later visits; it is not answered here');
  } else {
    if (!th) return '';
    const r = it.act === 'release' ? release(th.qs, it.about, it.reason) : face(th.qs, it.about);
    if (!r.ok) { if (!/reason/.test(r.reason)) return ''; stageApi.say(r.reason); return 'hunting-question-refused'; } // an "I faced ..." that is about nothing hunting is not ours
    th.qs = r.qs; stageApi.say(it.act === 'release' ? 'released, with your reason kept' : 'faced');
  }
  stageApi.save(); stageApi.render();
  return 'hunting-question';
}

/** release/faced asks belong to us only when a hunting question is saved on this device's stage (so "I faced a storm" is left alone). */
export function hasSavedQuestions(store) {
  try {
    const bag = store || (typeof localStorage !== 'undefined' ? localStorage : null);
    const saved = JSON.parse((bag && bag.getItem('a2m.void.state.v1')) || '{}');
    return Object.values(saved || {}).some((t) => t && t.kind === 'hunted' && open(t.qs).length);
  } catch (_) { return false; }
}

export default {
  name: 'hunting-question',
  examples: ["a question I'm avoiding: should I quit my job", 'a question I am avoiding: am I ready'],
  nearMisses: ['ask me a question', 'what is the question', 'the question of the day'],
  questionIntent,
  match(lower, text) { const it = questionIntent(text || lower); return !!it && (it.act === 'register' || hasSavedQuestions()); },
  async run(text, api) { return ask(String(text || '').toLowerCase(), text, api.stage) ? 'hunting-question' : 'none'; },
  stageKinds: { hunted: { mount, ask } },
};
