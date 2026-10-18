/**
 * writing-aids skill — one stage card with a mode for each small text tool: "shorten this: ...", "bulletize this paragraph: ...",
 * "numbered steps from: ...", "sentence case: ...", "remove filler words: ...", "count unique words: ...", "reading level of: ...",
 * "outline from headings: ...", "reverse outline: ...", "suggest synonyms for the words in: ...", or just "writing aids" for an
 * empty card. The card keeps the text, a row of mode chips switches the tool, and the result follows what is typed. Asked for by the
 * owner (2026-10-18, items 121 to 130). Synonyms here are a short local list ("synonym for happy" is skills/words.js, from Datamuse);
 * "title case: ..." stays in skills/util.js (the card has the chip too). Rule-based, no network, nothing is sent anywhere.
 */
import { addThing, cardEl, keepOut } from '../lib/stage-pack.js';
import { MODES, MODE_LABEL, parseWritingAsk, transform, MAX_TEXT } from '../lib/writing-aids.js';

const btnCss = 'font:inherit;font-size:12px;padding:3px 10px;border-radius:12px;border:1px solid rgba(255,255,255,.3);background:transparent;color:inherit;cursor:pointer';

function mount(th, stageApi) {
  const el = cardEl(th, stageApi, 'writing-aids');
  th.mode = MODES.includes(th.mode) ? th.mode : 'shorten';
  th.text = String(th.text || '').slice(0, MAX_TEXT);
  el.style.width = 'min(88vw,460px)';
  const head = document.createElement('div'); head.innerHTML = '<b>Writing aids</b>'; head.style.marginBottom = '6px'; el.appendChild(head);
  const chips = document.createElement('div'); chips.style.cssText = 'display:flex;flex-wrap:wrap;gap:4px;margin-bottom:8px'; chips.setAttribute('role', 'group'); chips.setAttribute('aria-label', 'tool');
  const ta = document.createElement('textarea');
  ta.value = th.text; ta.rows = 4; ta.placeholder = 'Type or paste your text'; ta.setAttribute('aria-label', 'text to work on');
  ta.style.cssText = 'width:100%;box-sizing:border-box;font:inherit;background:rgba(255,255,255,.07);color:inherit;border:1px solid rgba(255,255,255,.18);border-radius:8px;padding:6px;resize:vertical';
  const out = document.createElement('pre'); out.className = 'wa-out'; out.setAttribute('aria-live', 'polite');
  out.style.cssText = 'white-space:pre-wrap;word-break:break-word;margin:8px 0 4px;padding:8px;border-radius:8px;background:rgba(255,255,255,.05);font:13px/1.4 system-ui,sans-serif;min-height:1.4em';
  const note = document.createElement('div'); note.className = 'wa-note'; note.style.cssText = 'font-size:12px;opacity:.75';
  const bar = document.createElement('div'); bar.style.cssText = 'margin-top:6px;display:flex;gap:6px';
  const copy = document.createElement('button'); copy.type = 'button'; copy.textContent = 'Copy result'; copy.style.cssText = btnCss;
  const use = document.createElement('button'); use.type = 'button'; use.textContent = 'Use as text'; use.title = 'Put the result back in the box'; use.style.cssText = btnCss;
  bar.append(copy, use);
  const paint = () => {
    const r = transform(th.mode, th.text);
    out.textContent = r.out; note.textContent = r.note; out.dataset.mode = th.mode;
    for (const c of chips.children) c.setAttribute('aria-pressed', c.dataset.mode === th.mode ? 'true' : 'false'), c.style.background = c.dataset.mode === th.mode ? 'rgba(143,180,255,.25)' : 'transparent';
  };
  for (const m of MODES) {
    const c = document.createElement('button'); c.type = 'button'; c.dataset.mode = m; c.textContent = MODE_LABEL[m]; c.style.cssText = btnCss;
    c.addEventListener('click', (e) => { e.stopPropagation(); th.mode = m; stageApi.save(); paint(); });
    keepOut(c); chips.appendChild(c);
  }
  ta.addEventListener('input', () => { th.text = ta.value.slice(0, MAX_TEXT); stageApi.save(); paint(); });
  copy.addEventListener('click', () => { try { navigator.clipboard.writeText(out.textContent); copy.textContent = 'Copied'; setTimeout(() => { copy.textContent = 'Copy result'; }, 1200); } catch (_) { copy.textContent = 'Select and copy'; } });
  use.addEventListener('click', () => { if (!out.textContent) return; th.text = out.textContent.slice(0, MAX_TEXT); ta.value = th.text; stageApi.save(); paint(); });
  for (const n of [ta, copy, use]) keepOut(n);
  el.append(chips, ta, out, note, bar);
  paint();
  stageApi.bindDrag(el, th);
  stageApi.stage.appendChild(el);
}

/** the stage kind's ask hook: put a writing card on the stage for a writing-aids ask; the skill's name, or '' */
export function ask(lower, text, stageApi) {
  const p = parseWritingAsk(text);
  if (!p) return '';
  addThing(stageApi, 'writing', { mode: p.mode, text: p.text });
  stageApi.save(); stageApi.render();
  return 'writing-aids';
}

export default {
  name: 'writing-aids',
  examples: ['writing aids', 'shorten this: In order to finish the report I basically just need to check the numbers', 'bulletize this paragraph: We met on Monday. The plan changed.', 'numbered steps from: first open the box then plug it in',
    'sentence case: HELLO THERE FRIEND', 'remove filler words: well um it was actually very good', 'count unique words: the cat and the dog', 'reading level of: The cat sat on the mat and looked at the sun.',
    'outline from headings: # Intro ## Why ## How', 'reverse outline: One idea here. Another idea there.', 'suggest synonyms for the words in: a very good idea'],
  nearMisses: ['shorten my commute', 'how do I shorten a url', 'how many unique words are in english', 'what is a reading level', 'bullet journal ideas', 'title case: the lord of the rings', 'synonym for happy', 'word count: a b c'],
  parseWritingAsk,
  match(lower, text) { return !!parseWritingAsk(text || lower); },
  async run(text, api) { return ask(String(text || '').toLowerCase(), text, api.stage) ? 'writing-aids' : 'none'; },
  stageKinds: { writing: { mount, ask } },
};
