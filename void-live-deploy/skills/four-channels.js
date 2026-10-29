/**
 * four-channels skill - "answer in four channels: <question> Claim: ... Doubt: ... Method: ... Risk: ...": a stage card with
 * claim, doubt, method and risk side by side, built from the person's own text split by those markers. A channel the person
 * left out shows a deterministic prompt (a question to answer, not an answer). No channel may repeat another channel's
 * sentence: a repeat is shown as a collision warning and is not rendered a second time. The synthesis box is left empty for
 * the person to fill. Asked for by the owner (2026-10-18), from his operating laws for thinking with a machine. Device-local.
 */
import { escHtml, addThing, cardEl, keepOut } from '../lib/stage-pack.js';

export const CHANNELS = ['claim', 'doubt', 'method', 'risk'];

/** the text after "answer in four channels" ('' when none), or null when it is not that ask. Pure. */
export function parseFour(text) {
  const m = /^(?:please\s+)?(?:answer\s+(?:this\s+|it\s+|the\s+question\s+)?in\s+four\s+channels|four[- ]channels?\s+answer)\s*(?:[:\-]\s*|\s+(?:for|to|on|about)\s+)?([\s\S]*)$/i.exec(String(text || '').trim());
  return m ? m[1].trim().slice(0, 2000) : null;
}

/** split a text into { question, given: {claim,doubt,method,risk} } by the Claim:/Doubt:/Method:/Risk: markers. Pure. */
export function split(text) {
  const t = String(text || ''), re = /\b(claim|doubt|method|risk)\s*:/ig, marks = [];
  let m;
  while ((m = re.exec(t))) marks.push({ key: m[1].toLowerCase(), start: m.index, end: m.index + m[0].length });
  const given = {};
  marks.forEach((k, i) => { const body = t.slice(k.end, i + 1 < marks.length ? marks[i + 1].start : t.length).trim(); given[k.key] = ((given[k.key] || '') + ' ' + body).trim(); });
  return { question: (marks.length ? t.slice(0, marks[0].start) : t).trim(), given };
}

/** the prompt a missing channel shows: a question for the person to answer, never an answer. Pure. */
export function template(channel, question) {
  const q = String(question || '').trim().replace(/[?.!]+$/, '') || 'this';
  return {
    claim: 'What do you assert about "' + q + '", in one sentence?',
    doubt: 'What would have to be true for "' + q + '" to be wrong?',
    method: 'How will you find out whether "' + q + '" holds, and by when?',
    risk: 'What does it cost, and who pays, if you are wrong about "' + q + '"?',
  }[channel];
}

const sentences = (s) => String(s || '').split(/(?<=[.!?])\s+|\n+/).map((x) => x.trim()).filter(Boolean);
const norm = (s) => s.toLowerCase().replace(/[^a-z0-9\s]/g, '').replace(/\s+/g, ' ').trim();

/** the four channels for a text: { question, cols: {channel: [{text, prompt}]}, collisions: [{sentence, channels:[first, again]}] }.
 *  A sentence already used by an earlier channel is dropped from the later one and reported, never rendered twice. Pure. */
export function channels(text) {
  const { question, given } = split(text), cols = {}, collisions = [], seen = new Map();
  for (const ch of CHANNELS) {
    cols[ch] = [];
    const own = new Set();
    for (const s of sentences(given[ch])) {
      const k = norm(s);
      if (!k || own.has(k)) continue;
      own.add(k);
      if (seen.has(k)) { collisions.push({ sentence: s, channels: [seen.get(k), ch] }); continue; }
      seen.set(k, ch);
      cols[ch].push({ text: s, prompt: false });
    }
    if (!cols[ch].length && !given[ch]) cols[ch].push({ text: template(ch, question), prompt: true });
  }
  return { question, cols, collisions };
}

function mount(th, stageApi) {
  const el = cardEl(th, stageApi, 'four-channels');
  el.style.maxWidth = 'min(94vw,760px)';
  el.innerHTML = '<b>Four channels</b>';
  const box = document.createElement('textarea');
  box.className = 'fc-text'; box.rows = 3; box.value = th.text || ''; box.setAttribute('aria-label', 'the question, then Claim: Doubt: Method: Risk:');
  box.placeholder = 'The question? Claim: ... Doubt: ... Method: ... Risk: ...';
  box.style.cssText = 'display:block;width:100%;box-sizing:border-box;margin:8px 0;font:inherit;background:rgba(255,255,255,.07);color:inherit;border:1px solid rgba(255,255,255,.18);border-radius:8px;padding:6px';
  const warn = document.createElement('div'); warn.className = 'fc-warn'; warn.setAttribute('role', 'alert'); warn.style.cssText = 'color:#ffb86b;font-size:12px;margin-bottom:6px';
  const grid = document.createElement('div'); grid.className = 'fc-grid'; grid.style.cssText = 'display:grid;grid-template-columns:repeat(auto-fit,minmax(130px,1fr));gap:8px';
  const syn = document.createElement('textarea');
  syn.className = 'fc-synthesis'; syn.rows = 2; syn.value = th.synthesis || ''; syn.setAttribute('aria-label', 'your synthesis'); syn.placeholder = 'Your synthesis (yours to write; left empty on purpose)';
  syn.style.cssText = box.style.cssText;
  const paint = () => {
    const r = channels(box.value);
    warn.textContent = r.collisions.length ? 'Collision: ' + r.collisions.map((c) => '"' + c.sentence + '" is already in ' + c.channels[0] + ', so ' + c.channels[1] + ' does not repeat it').join(' · ') : '';
    grid.innerHTML = '';
    for (const ch of CHANNELS) {
      const col = document.createElement('div'); col.className = 'fc-col'; col.dataset.channel = ch; col.style.cssText = 'border:1px solid rgba(255,255,255,.14);border-radius:10px;padding:6px 8px;font-size:13px';
      col.innerHTML = '<b style="text-transform:capitalize">' + ch + '</b>' + r.cols[ch].map((s) => '<div class="fc-s"' + (s.prompt ? ' data-prompt="1" style="opacity:.6;font-style:italic"' : '') + '>' + escHtml(s.text) + '</div>').join('');
      grid.appendChild(col);
    }
  };
  box.addEventListener('input', () => { th.text = box.value; stageApi.save(); paint(); });
  syn.addEventListener('input', () => { th.synthesis = syn.value; stageApi.save(); });
  keepOut(box); keepOut(syn);
  el.append(box, warn, grid, syn);
  paint();
  stageApi.bindDrag(el, th);
  stageApi.stage.appendChild(el);
}

/** the stage kind's ask hook: put the card on the stage with the question and markers, or '' */
export function ask(lower, text, stageApi) {
  const body = parseFour(text);
  if (body === null) return '';
  addThing(stageApi, 'channels', { text: body, synthesis: '' });
  stageApi.save(); stageApi.render();
  return 'four-channels';
}

export default {
  name: 'four-channels',
  examples: ['answer in four channels: should we move to Berlin?', 'answer in four channels', 'answer this in four channels: is the plan sound? Claim: yes. Doubt: rent. Method: ask Sam. Risk: cost.'],
  nearMisses: ['four channel audio receiver', 'answer in four words', 'what is a four channel amp', 'answer in two sentences'],
  parseFour,
  match(lower, text) { return parseFour(text || lower) !== null; },
  async run(text, api) { return ask(String(text || '').toLowerCase(), text, api.stage) ? 'four-channels' : 'none'; },
  stageKinds: { channels: { mount, ask } },
};
