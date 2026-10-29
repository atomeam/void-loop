/**
 * gauge-feedback skill - "clean this feedback <text> | work: <the work, in a few words>" splits feedback into statements, flags
 * the ego in each one (blame: "you always/never"; flattery: "brilliant", "genius"; status: "rookie", "as your manager") and
 * rewrites each into three frames by template: neutral, kind and blunt. Only a statement that is about the work (it shares a
 * noun with the work text the person gives) goes into the "permanent record"; the others are shown struck. Fixed word lists and
 * templates, no model, nothing sent anywhere. Asked for by the owner (2026-10-18; gauge-fixing feedback).
 */
import { addThing, cardEl, keepOut } from '../lib/stage-pack.js';
import { h, pill, copyText } from '../lib/stage-math.js';

export const MAX_STATEMENTS = 20;
const BLAME = [/\byou(?:'re| are)? (?:always|never)\b/i, /\byour fault\b/i, /\byou (?:obviously|clearly|again)\b/i, /\btypical\b/i, /\balways\b/i, /\bnever\b/i];
const FLATTERY = /\b(?:brilliant|genius|amazing|incredible|perfect|flawless|best ever|so talented|a star|superb|stunning)\b/i;
const STATUS = /\b(?:rookie|amateur|newbie|junior|beginner|as your (?:manager|boss|lead)|as the (?:lead|boss|manager)|beneath|unprofessional|in my (?:years|experience))\b/i;
const STOP = new Set('this that with from have been were what when your their there which would could should about into than then them they will just also very more most some such only over under after before again because while where these those being doing make made does done'.split(' '));

/** the feedback and the work text of a "clean this feedback ..." ask: { feedback, work } or null. Pure. */
export function parseFeedback(text) {
  const m = /^\s*(?:please\s+)?(?:clean(?:\s+up)?|de-?ego|fix|rewrite)\s+(?:this|my|the)\s+feedback\s*(?:[:\-])?\s*([\s\S]+)$/i.exec(String(text || ''));
  if (!m) return null;
  let body = m[1].trim(), work = '';
  const w = /(?:^|\s)[|;]?\s*(?:work|about|re|on)\s*:\s*([\s\S]+)$/i.exec(body);
  if (w) { work = w[1].trim(); body = body.slice(0, w.index).replace(/[|;\s]+$/, '').trim(); }
  return body.length >= 6 ? { feedback: body.slice(0, 3000), work: work.slice(0, 1000) } : null;
}

/** the nouns of the work text: words of 4+ letters that are not stop words, lower-cased, trailing s folded. Pure. */
export function workWords(work) {
  const out = new Set();
  for (const w of String(work || '').toLowerCase().match(/[a-z]{4,}/g) || []) if (!STOP.has(w)) out.add(w.replace(/s$/, ''));
  return out;
}

/** statements: split on sentence ends and line breaks. Pure. */
export function statementsOf(feedback) {
  return String(feedback || '').split(/(?<=[.!?])\s+|\n+/).map((s) => s.trim()).filter(Boolean).slice(0, MAX_STATEMENTS);
}

/** which ego terms a statement carries: { blame:[], flattery:[], status:[] }. Pure. */
export function egoOf(s) {
  const hit = (re) => { const m = re.exec(s); return m ? [m[0].toLowerCase()] : []; };
  const blame = [];
  for (const re of BLAME) { const m = re.exec(s); if (m && !blame.some((b) => b.includes(m[0].toLowerCase()) || m[0].toLowerCase().includes(b))) blame.push(m[0].toLowerCase()); }
  return { blame, flattery: hit(FLATTERY), status: hit(STATUS) };
}

/** the statement with its ego taken out: you -> this draft, always -> often, never -> not yet, praise and rank words dropped. Pure. */
export function core(s) {
  let t = String(s).replace(/[.!?]+$/, '');
  t = t.replace(new RegExp(FLATTERY.source + '[,!]?', 'gi'), '').replace(new RegExp(STATUS.source + '[,]?', 'gi'), '');
  t = t.replace(/\byour fault\b/gi, 'a gap').replace(/\byou(?:'re| are)? always\b/gi, 'this draft often').replace(/\byou(?:'re| are)? never\b/gi, 'this draft does not yet').replace(/\balways\b/gi, 'often').replace(/\bnever\b/gi, 'not yet').replace(/\b(?:typical|obviously|clearly)\b[,]?/gi, '');
  t = t.replace(/\byou\b/gi, 'this draft').replace(/\byour\b/gi, 'the');
  return t.replace(/\s{2,}/g, ' ').replace(/\s+([,.;])/g, '$1').trim().replace(/^[,;\s]+/, '');
}

const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);

/** the three frames of one statement. Pure. */
export function frames(s) {
  const c = core(s);
  return { neutral: 'Observation: ' + c + '.', kind: 'Something worth looking at together: ' + c + '. Thanks for the work so far.', blunt: cap(c) + '. Change it.' };
}

/** the whole review: every statement with its ego, frames and whether it stays in the permanent record. Pure. */
export function review({ feedback, work }) {
  const words = workWords(work);
  const items = statementsOf(feedback).map((s) => {
    const ego = egoOf(s), c = core(s);
    const about = (c.toLowerCase().match(/[a-z]{4,}/g) || []).filter((w) => words.has(w.replace(/s$/, '')));
    return { text: s, ego, flagged: !!(ego.blame.length || ego.flattery.length || ego.status.length), about: [...new Set(about)], keep: about.length > 0, frames: frames(s) };
  });
  return { items, record: items.filter((i) => i.keep).map((i) => i.frames.neutral.replace(/^Observation: /, '')), needsWork: words.size === 0 };
}

function mount(th, stageApi) {
  const el = cardEl(th, stageApi, 'gauge-feedback');
  el.style.maxWidth = 'min(92vw,560px)';
  const r = review({ feedback: th.feedback || '', work: th.work || '' });
  el.append(h('b', {}, 'Clean feedback'));
  const work = h('input', { value: th.work || '', placeholder: 'the work, in a few words (what the feedback is about)', 'aria-label': 'the work', style: 'display:block;width:100%;margin:6px 0;font:inherit;font-size:12px;background:rgba(255,255,255,.07);color:inherit;border:1px solid rgba(255,255,255,.18);border-radius:6px;padding:2px 6px' });
  work.addEventListener('change', () => { th.work = work.value.slice(0, 1000); stageApi.save(); stageApi.render(); });
  keepOut(work); el.append(work);
  if (r.needsWork) el.append(h('div', { style: 'font-size:12px;opacity:.8' }, 'Tell me what the work is about, and only statements about it will be kept.'));
  const list = h('div', { className: 'gf-statements' });
  for (const it of r.items) {
    const row = h('div', { className: 'gf-item ' + (it.keep ? 'gf-kept' : 'gf-struck'), style: 'margin:6px 0;padding:6px 8px;border-radius:6px;background:rgba(255,255,255,.04)' },
      h('div', { style: it.keep ? '' : 'text-decoration:line-through;opacity:.5' }, it.text),
      it.flagged ? h('div', { style: 'font-size:11px;color:#ffd166' }, 'ego: ' + [...it.ego.blame, ...it.ego.flattery, ...it.ego.status].join(', ')) : null);
    if (it.keep) for (const f of ['neutral', 'kind', 'blunt']) row.append(h('div', { className: 'gf-frame', dataset: { frame: f }, style: 'font-size:12px;margin-top:2px' }, h('b', {}, f + ': '), it.frames[f]));
    list.append(row);
  }
  el.append(list);
  el.append(h('div', { style: 'margin-top:8px' }, h('b', {}, 'Permanent record'), r.record.length ? h('ul', { className: 'gf-record', style: 'margin:4px 0 4px 18px;padding:0' }, r.record.map((x) => h('li', {}, x))) : h('div', { className: 'gf-record', style: 'font-size:12px;opacity:.7' }, 'nothing about the work yet')));
  const st = h('span', { style: 'font-size:12px;opacity:.8;margin-left:8px' });
  el.append(pill('copy record', async () => { st.textContent = (await copyText(r.record.join('\n'))) ? 'copied' : 'select the list to copy'; }), st);
  stageApi.bindDrag(el, th);
  stageApi.stage.appendChild(el);
}

export function ask(lower, text, stageApi) {
  const p = parseFeedback(text);
  if (!p) return '';
  addThing(stageApi, 'gaugefeedback', { feedback: p.feedback, work: p.work });
  stageApi.save(); stageApi.render();
  return 'gauge-feedback';
}

export default {
  name: 'gauge-feedback',
  examples: ['clean this feedback: You always miss the deadline. The login page is brilliant. | work: login page deadline', 'clean this feedback you never test the checkout flow'],
  nearMisses: ['give me feedback on my essay', 'clean this room', 'how do I give better feedback'],
  parseFeedback,
  match(lower, text) { return !!parseFeedback(text || lower); },
  async run(text, api) { return ask(String(text || '').toLowerCase(), text, api.stage) ? 'gauge-feedback' : 'none'; },
  stageKinds: { gaugefeedback: { mount, ask } },
};
