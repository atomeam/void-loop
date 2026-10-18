/**
 * outline-note skill — nested bullet notes (tools pack 1, owner 2026-10-18). "nested bullet note", "outline note: groceries; > milk; > > oat; > bread"
 * puts a note on the stage whose lines nest: Tab indents the lines you selected (one level under the line above), Shift+Tab steps back,
 * Enter starts the next bullet at the same level (Enter on an empty bullet steps out). The nested list is drawn under the box as you type.
 * Saved with the stage (th.text is the indented text), device-local. A new one only when asked; "another outline" makes a second.
 */
import { outlineParse, outlineFromAsk, outlineText, shiftLines, enterBullet } from '../lib/note-tools.js';
import { addThing, cardEl, keepOut, firstOf } from '../lib/stage-pack.js';

const KINDS = String.raw`(?:nested\s+(?:bullet\s+)?(?:notes?|lists?|bullets)|(?:bullet\s+)?outline(?:\s+note)?|outline\s+note|nested\s+bullet\s+note|indented\s+(?:bullet\s+)?notes?)`;
const MAKE = new RegExp('^(?:please\\s+)?(?:(?:make|add|create|start|open|show|give|write)\\s+(?:me\\s+)?)?(?:(?:a|an|another|new|my)\\s+)*(' + KINDS + ')\\s*(?::\\s*([\\s\\S]*))?$', 'i');

/** { fresh, items } for an outline ask, or null. Pure. */
export function outlineIntent(raw) {
  const t = String(raw || '').trim().replace(/[.!]+$/, '');
  const m = MAKE.exec(t);
  if (!m) return null;
  if (m[2] === undefined && !/^(?:please\s+)?(?:make|add|create|start|open|show|give|write)\s/i.test(t) && !/note|nested|bullet|indented/i.test(m[1])) return null; // a bare "outline" is not ours
  return { fresh: /\b(another|new)\b/i.test(t), items: m[2] ? outlineFromAsk(m[2]) : [] };
}

function mount(th, stageApi) {
  const el = cardEl(th, stageApi, 'outline-note');
  el.style.width = 'min(92vw,300px)';
  const title = document.createElement('div');
  title.className = 'outline-title'; title.contentEditable = 'true'; title.spellcheck = false; title.textContent = th.title || ''; title.dataset.placeholder = 'Outline';
  title.style.cssText = 'font-weight:600;min-height:1.3em;margin-bottom:6px;outline:none;border-bottom:1px dashed rgba(255,255,255,.2)';
  title.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); title.blur(); } });
  title.addEventListener('input', () => { th.title = title.textContent || ''; stageApi.save(); });
  keepOut(title);
  const area = document.createElement('textarea');
  area.className = 'outline-area'; area.spellcheck = false; area.rows = Math.min(10, Math.max(3, (th.text || '').split('\n').length + 1));
  area.setAttribute('aria-label', 'nested bullets: Tab indents, Shift+Tab steps back');
  area.placeholder = '- first idea\n  - a detail under it';
  area.value = th.text || '';
  area.style.cssText = 'width:100%;box-sizing:border-box;background:rgba(255,255,255,.06);color:inherit;border:1px solid rgba(255,255,255,.14);border-radius:8px;padding:8px;font:13px/1.45 ui-monospace,Menlo,monospace;resize:vertical';
  const view = document.createElement('ul');
  view.className = 'outline-view'; view.style.cssText = 'margin:8px 0 0;padding-left:0;list-style:none';
  const draw = () => {
    view.textContent = '';
    for (const i of outlineParse(area.value)) {
      const li = document.createElement('li'); li.dataset.depth = String(i.depth);
      li.style.cssText = 'margin:2px 0;padding-left:' + (i.depth * 18) + 'px';
      const dot = document.createElement('span'); dot.setAttribute('aria-hidden', 'true'); dot.style.opacity = '.55'; dot.textContent = i.depth % 2 ? '\u25e6' : '\u2022';
      li.append(dot, ' ' + i.text);
      view.appendChild(li);
    }
  };
  const put = (r) => { area.value = r.text; area.setSelectionRange(r.start != null ? r.start : r.pos, r.end != null ? r.end : r.pos); th.text = area.value; stageApi.save(); draw(); };
  area.addEventListener('keydown', (e) => {
    if (e.key === 'Tab') { e.preventDefault(); put(shiftLines(area.value, area.selectionStart, area.selectionEnd, e.shiftKey ? -1 : 1)); }
    else if (e.key === 'Enter' && !e.shiftKey && area.selectionStart === area.selectionEnd) { e.preventDefault(); put(enterBullet(area.value, area.selectionStart)); }
  });
  area.addEventListener('input', () => { th.text = area.value; stageApi.save(); draw(); });
  keepOut(area);
  draw();
  el.append(title, area, view);
  stageApi.bindDrag(el, th);
  stageApi.stage.appendChild(el);
}

/** the stage kind's ask hook: a new outline, or words for the one there; 'outline-note' or '' */
export function ask(lower, text, stageApi) {
  const q = outlineIntent(text);
  if (!q) return '';
  let th = q.fresh ? null : firstOf(stageApi, 'outline');
  if (!th) th = addThing(stageApi, 'outline', { title: '', text: '' });
  if (q.items.length) th.text = (th.text ? th.text.replace(/\s+$/, '') + '\n' : '') + outlineText(q.items);
  else if (!th.text) th.text = '- ';
  stageApi.select(th.id); stageApi.save(); stageApi.render();
  return 'outline-note';
}

export default {
  name: 'outline-note',
  examples: ['nested bullet note', 'outline note: groceries; > milk; > > oat; > bread', 'make a nested bullet list', 'another outline note'],
  nearMisses: ['what is an outline', 'outline of the roman empire', 'write an outline for my essay on cats', 'add milk to my list', 'bullet points about space'],
  outlineIntent,
  match(lower, text) { return !!outlineIntent(text || lower); },
  async run(text, api) { const d = ask('', text, api.stage); if (d) api.say('outline on the stage · Tab nests a line, Shift+Tab steps back'); return d ? 'outline-note' : 'none'; },
  stageKinds: { outline: { mount, ensure: (stageApi) => firstOf(stageApi, 'outline') || addThing(stageApi, 'outline', { title: '', text: '- ' }), ask } },
};
