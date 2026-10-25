/**
 * notepad skill — one notepad on the stage: "open a notepad", "notepad: buy bread", "write in the notepad call the vet",
 * "clear the notepad", "remove the notepad"; "make the notepad blue" edges it through the page's shared colours. A titled
 * pad with a 3D yellow legal pad above it (skills/mini/notepad.js) that rewrites as you type. Moved out of void.html in
 * cleanup step 6. The page asks `ask` (remove, clear, open/write) at the place its notepad code always ran (`askAt`).
 */

/** the ask opens or writes the notepad. Pure. */
export function wantsCreate(lower, raw = lower) {
  if (/\b(remove|delete|get rid|hide|clear)\b/.test(lower) && /\bnotepad\b/.test(lower)) return false;
  if (/^notepad\s*:/i.test(raw)) return true;
  if (/^\s*write\s+(?:in|on)\s+(?:the\s+)?notepad\b/i.test(raw)) return true;
  if (/^(a\s+)?notepad(\s+please)?\s*[.!]?\s*$/i.test(raw.trim())) return true;
  return /\b(make|add|create|open|new|show|spawn|put|place|drop)\b.*\bnotepad\b/.test(lower);
}

/** the words to write in it ('' when none). Pure. */
export function textOf(raw) {
  let m = raw.match(/^\s*notepad\s*:\s*([\s\S]*)$/i);
  if (m) return m[1].trim();
  m = raw.match(/^\s*write\s+(?:in|on)\s+(?:the\s+)?notepad\s+([\s\S]+?)\s*[.!]?\s*$/i);
  return m ? m[1].trim() : '';
}

/** the line an ask adds under what is already there ("add to the notepad: the vet called", "notepad add call the vet",
 *  "append X to the notepad"), or ''. Other kinds hand their words over the same way (lib/bridges.js). Pure. */
export function appendOf(raw) {
  const t = String(raw || '').trim();
  const m = t.match(/^(?:add|append|put)\s+(?:to|in|on)\s+(?:the\s+|my\s+)?notepad\s*:\s*([\s\S]+)$/i)
    || t.match(/^notepad\s+add\s+([\s\S]+?)\s*[.!]?\s*$/i)
    || t.match(/^(?:append|add)\s+([\s\S]+?)\s+(?:to|in|on)\s+(?:the\s+|my\s+)?notepad\s*[.!]?\s*$/i);
  return m ? m[1].trim() : '';
}

export const wantsClear = (lower) => /^(clear|empty)\s+(the\s+)?notepad\s*[.!]?\s*$/.test(lower);

export const wantsRemove = (lower) => /^(remove|delete|get\s+rid\s+of|hide)\s+(the\s+)?notepad\s*[.!]?\s*$/.test(lower)
  || /\b(remove|delete|get\s+rid\s+of|hide)\b.*\bnotepad\b/.test(lower);

/** the plain asks the skill takes before the page's own parser (a colour, a place or anything else goes on to the page's
 *  shared targeting, which reaches `ensure`). Pure. */
export const plainNotepad = (lower, raw = lower) => !/\b(remove|delete|get\s+rid|hide|clear|empty)\b/.test(lower)
  && (!!appendOf(raw) || /^(a\s+)?notepad(\s+please)?\s*[.!]?$/.test(lower) || /^notepad\s*:\s*\S/i.test(raw) || /^\s*write\s+(?:in|on)\s+(?:the\s+)?notepad\s+\S/i.test(raw)
    || /^(?:please\s+)?(?:open|make|add|create|give\s+me|new)\s+(?:me\s+)?(?:a\s+|the\s+|my\s+)?(?:new\s+)?notepad\s*[.!]?$/.test(lower));

const pads = (stageApi) => Object.values(stageApi.things()).filter((t) => t && t.kind === 'notepad');
const picked = (stageApi) => { const sel = stageApi.things()[stageApi.selected()]; return (sel && sel.kind === 'notepad' && sel) || pads(stageApi)[0] || null; };

/** the picked notepad, or the first one, or a new one; seed, when given, is written in it; it is picked */
export function ensure(stageApi, seed = '') {
  let note = picked(stageApi);
  if (!note) {
    const st = stageApi.stage, things = stageApi.things();
    note = { id: 'notepad_' + Math.random().toString(36).slice(2, 9), kind: 'notepad',
      x: Math.max(40, (st.clientWidth || 800) / 2 - 160), y: Math.max(40, (st.clientHeight || 600) / 2 - 120), title: '', text: seed || '' };
    things[note.id] = note;
  } else if (seed) note.text = seed;
  stageApi.select(note.id);
  return note;
}

/** one more line under what the notepad holds (a new notepad when there is none); the pad is picked and drawn again */
export function append(stageApi, line) {
  const words = String(line || '').trim();
  if (!words) return null;
  const note = ensure(stageApi);
  note.text = (note.text ? note.text.replace(/\s+$/, '') + '\n' : '') + words;
  stageApi.save(); stageApi.render();
  return note;
}

function mount(th, stageApi) {
  const el = document.createElement('div');
  el.className = 'thing notepad';
  el.dataset.id = th.id;
  el.style.left = th.x + 'px';
  el.style.top = th.y + 'px';
  if (th.color) for (const side of ['Left', 'Right', 'Bottom']) el.style['border' + side + 'Color'] = th.color; // the binding stays red
  if (stageApi.selected() === th.id) el.style.outline = '1px solid rgba(255,255,255,0.25)';

  const title = document.createElement('div');
  title.className = 'notepad-title';
  title.contentEditable = 'true';
  title.spellcheck = false;
  title.dataset.placeholder = 'Notepad';
  title.textContent = th.title || '';
  title.addEventListener('pointerdown', (e) => e.stopPropagation());
  title.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); title.blur(); } });
  title.addEventListener('input', () => { th.title = title.textContent || ''; stageApi.save(); });

  const area = document.createElement('textarea');
  area.className = 'notepad-textarea';
  area.placeholder = 'Write in your notepad';
  area.value = th.text || '';
  area.spellcheck = false;
  area.addEventListener('pointerdown', (e) => e.stopPropagation());
  area.addEventListener('input', () => { th.text = area.value || ''; stageApi.save(); });

  // a yellow legal pad on the desk with this note handwritten on it (skills/mini/notepad.js); it rewrites as you type
  const padHost = document.createElement('div'); padHost.className = 'notepad-mini'; padHost.style.cssText = 'height:190px;margin:-4px -6px 8px';
  el.appendChild(padHost);
  const padData = () => ({ title: th.title || '', text: th.text || '' });
  stageApi.miniature(padHost, 'notepad', padData(), { key: 'notepad:' + th.id, label: '3D notepad' }).then((h) => {
    let t = 0; const later = () => { clearTimeout(t); t = setTimeout(() => h.update(padData()), 250); };
    area.addEventListener('input', later); title.addEventListener('input', later);
  }).catch(() => padHost.remove());
  el.appendChild(title);
  el.appendChild(area);
  // the full notes page: many notes, rich text, search and history (owner, 2026-10-25: "why are you not linking the cards to the pages?")
  const full = document.createElement('a'); full.className = 'vc-page'; full.href = '/notes/'; full.textContent = 'Open the full Notes page →'; full.style.cssText = 'display:inline-block;margin:8px 0 2px;font-size:13px;font-weight:600';
  full.addEventListener('pointerdown', (e) => e.stopPropagation()); el.appendChild(full);
  stageApi.bindDrag(el, th);
  stageApi.stage.appendChild(el);
}

/** remove, clear, or open/write, at the place the notepad code ran: what it did ('no notepad' when there is none to remove
 *  or clear), or '' */
export function ask(lower, text, stageApi) {
  if (wantsRemove(lower)) {
    const n = picked(stageApi);
    if (!n) return 'no notepad'; // the page says so rather than handing the ask on
    delete stageApi.things()[n.id];
    if (stageApi.selected() === n.id) stageApi.select(null);
    stageApi.save(); stageApi.render();
    return 'notepad-removed';
  }
  if (wantsClear(lower)) {
    const n = picked(stageApi);
    if (!n) return 'no notepad';
    n.text = '';
    stageApi.select(n.id);
    stageApi.save(); stageApi.render();
    return 'notepad-cleared';
  }
  const more = appendOf(text);
  if (more) { append(stageApi, more); return 'notepad'; }
  if (wantsCreate(lower, text)) {
    ensure(stageApi, textOf(text));
    stageApi.save(); stageApi.render();
    return 'notepad';
  }
  return '';
}

export default {
  name: 'notepad',
  examples: ['open a notepad', 'notepad: buy bread', 'write in the notepad call the vet', 'add to the notepad: the vet called back'],
  nearMisses: ['sticky note buy milk', 'take notes'],
  match(lower, text) { return plainNotepad(lower, text); },
  async run(text, api) { const d = ask(String(text || '').toLowerCase(), text, api.stage); return d && d !== 'no notepad' ? 'notepad' : 'none'; },
  // askAt: the page asks this kind's ask at its own place, not in the early loop the counter and shape use
  stageKinds: { notepad: { mount, ensure: (stageApi) => ensure(stageApi, ''), ask, askAt: 'notepad' } },
};
