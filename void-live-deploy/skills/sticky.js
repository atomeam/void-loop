/**
 * sticky skill — sticky notes on the stage: "sticky note buy milk", "a sticky", "note: call mom", "make a pink sticky",
 * "another note", "remove the sticky"; "make it blue" on a picked note uses its own paper colours. Several can be up
 * ("another note"); an edit goes to the picked one. Moved out of void.html in cleanup step 6. The page asks its hooks at
 * the places its built-in order always had them: `ask` (create, colour, remove) where the sticky code ran, `askEdit`
 * ("note: ..." on an existing note) later on, `colorOf` wherever a sticky is recoloured.
 */

const PAPER = { yellow: '#f4e27a', pink: '#ff9ec8', blue: '#9ec8ff', green: '#b6f5a8', orange: '#ffc080', white: '#f5f5f5', purple: '#d4b0ff' };

/** a sticky's paper colour named in an ask (null when none). Pure. */
export function colorOf(text) {
  const t = String(text || '').toLowerCase();
  for (const [k, v] of Object.entries(PAPER)) if (new RegExp('\\b' + k + '\\b').test(t)) return v;
  return null;
}

/** "add another note", "a new sticky": a second one rather than the picked one (the page's wantsFresh, sticky words). Pure. */
export const wantsFresh = (lower) => /\b(add|make|create|put|start|set|give\s+me|new|another)\b[^.]*?\b(a|an|another|new|one\s+more|second)\s+(?:\w+\s+){0,3}?(sticky|stickies|note)\b/.test(lower)
  || /\b(another|one\s+more|second|new)\s+(sticky|note)\b/.test(lower);

/** the ask makes or writes a sticky. Pure. */
export function wantsCreate(lower, raw = lower) {
  if (/\b(remove|delete|get rid|hide)\b/.test(lower) && /\b(note|sticky)\b/.test(lower)) return false;
  if (/^(a\s+)?(sticky(\s+note)?|note)(\s+please)?\s*[.!]?\s*$/.test(lower)) return true;
  if (/\b(make|add|create|show|spawn|put|place|drop|i\s+want|give\s+me)\b.*\b(sticky(\s+note)?|note)\b/.test(lower)) return true;
  if (/^(take|jot(\s+down)?|write)\s+(a\s+|some\s+)?notes?(\s+down)?\s*[.!]?$/.test(lower.trim())) return true;
  if (/^(another|one\s+more|a\s+new|new|a\s+second)\s+(sticky(\s+note)?|note)\b/.test(lower)) return true;
  if (/^(?:take|make|jot(?:\s+down)?|write(?:\s+down)?|add)\s+(?:a\s+)?note\s*:\s*\S/i.test(raw)) return true;
  if (/^note\s*:\s*/i.test(raw)) return true;
  if (/^sticky\s*:\s*/i.test(raw)) return true;
  if (/^(a\s+)?sticky(\s+note)?\s+(that\s+says?|saying)\s+\S/.test(lower)) return true;
  if (/^(a\s+)?sticky\s+note\s+\S/.test(lower)) return true;
  return false;
}

/** the words to write on the note ('' when none). Pure. */
export function textOf(raw, lower = String(raw).toLowerCase()) {
  let m = raw.match(/^(?:(?:take|make|jot(?:\s+down)?|write(?:\s+down)?|add)\s+(?:a\s+)?)?note\s*:\s*([\s\S]+)/i) || raw.match(/^sticky\s*:\s*([\s\S]+)/i);
  if (m) return m[1].trim();
  m = raw.match(/\b(?:that\s+says?|saying|with\s+text|reading)\s+["']?([\s\S]+?)["']?\s*$/i);
  if (m) return m[1].trim();
  m = raw.match(/\b(?:sticky(?:\s+note)?|note)\s+(?:that\s+says?\s+)?["']([^"']+)["']/i);
  if (m) return m[1].trim();
  m = raw.match(/^\s*(?:a\s+)?sticky\s+note\s+([\s\S]+?)\s*[.!]?\s*$/i);
  if (m) return m[1].trim();
  return '';
}

export const wantsRemove = (lower) => /\b(remove|delete|get\s+rid\s+of|hide|clear)\b.*\b(sticky|note|it|this)\b/.test(lower) && /\b(sticky|note)\b/.test(lower);

/** the plain asks the skill takes before the page's own parser (anything with a colour, a picked note or a removal goes
 *  on to the page, which asks the hooks below at the old places). Pure. */
export const plainSticky = (lower, raw = lower) => !colorOf(lower) && !/\b(remove|delete|get\s+rid|hide|clear|another|new|second)\b/.test(lower)
  && (/^(a\s+)?sticky(\s+note)?(\s+please)?\s*[.!]?$/.test(lower) || /^(?:sticky|note)\s*:\s*\S/i.test(raw) || /^(a\s+)?sticky\s+note\s+\S/.test(lower)
    || /^(?:please\s+)?(?:make|add|create|give\s+me)\s+(?:me\s+)?a\s+sticky(?:\s+note)?\s*[.!]?$/.test(lower));

const stickies = (stageApi) => Object.values(stageApi.things()).filter((t) => t && t.kind === 'sticky');

/** the picked note, or the first one, or a new one (fresh: always a new one); seed, when given, is written on it */
export function ensure(stageApi, seed = '', fresh = false) {
  const things = stageApi.things(), sel = things[stageApi.selected()];
  let note = fresh ? null : ((sel && sel.kind === 'sticky' && sel) || stickies(stageApi)[0] || null);
  if (!note) {
    const st = stageApi.stage, n = stickies(stageApi).length, w = st.clientWidth || 800, h = st.clientHeight || 600;
    const bx = Math.max(40, w / 2 - 90), by = Math.max(40, h / 2 + 40);
    note = { id: 'sticky-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6), kind: 'sticky',
      x: Math.min(Math.max(20, w - 220), bx + n * 28), y: Math.min(Math.max(20, h - 120), by + n * 28), text: seed || '', color: PAPER.yellow };
    things[note.id] = note;
    stageApi.select(note.id);
  } else if (seed) note.text = seed;
  return note;
}

/** a note's own slight tilt, -2.5 to 2.5 degrees, the same every time for the same note. Pure. */
export function tiltOf(id) {
  let h = 0;
  for (const c of String(id || '')) h = (h * 31 + c.charCodeAt(0)) | 0;
  return Math.round(((Math.abs(h) % 51) - 25) / 10 * 10) / 10;
}

/** what an arrow brings (frontier #24, skills/label.js deliver): its words go on a new line of the note, and it glows once.
 *  true when the note took it. Changes th. */
export function receiveInput(th, value) {
  const text = String((value && value.text) || '').trim().slice(0, 200);
  if (!text) return false;
  th.text = th.text ? th.text + '\n' + text : text;
  th.heard = Date.now();
  return true;
}

function mount(th, stageApi) {
  const el = document.createElement('div');
  el.className = 'thing sticky';
  el.dataset.id = th.id;
  el.style.left = th.x + 'px';
  el.style.top = th.y + 'px';
  if (th.color) el.style.backgroundColor = th.color; // the colour only: the paper's glue strip and curl are background images
  el.style.rotate = tiltOf(th.id) + 'deg'; // a real note never sits square; each keeps its own tilt
  if (th.role === 'note' || th.role === 'draft') el.dataset.role = th.role; // a plan's note or unsent draft: a tab says so (void.html)
  el.textContent = th.text || '';
  el.contentEditable = 'true';
  el.spellcheck = false;
  if (stageApi.selected() === th.id) el.style.outline = '1px solid rgba(0,0,0,0.25)';
  // it just heard something down an arrow: one soft glow, so the change is seen
  if (th.heard && Date.now() - th.heard < 1500 && typeof el.animate === 'function') { delete th.heard; el.animate([{ boxShadow: '0 0 0 0 rgba(255,255,255,0)' }, { boxShadow: '0 0 0 6px rgba(255,255,255,.55)' }, { boxShadow: '0 0 0 0 rgba(255,255,255,0)' }], { duration: 1100, easing: 'ease-out' }); } // once
  el.addEventListener('input', () => { th.text = el.textContent || ''; stageApi.save(); if (stageApi.edited) stageApi.edited(th); }); // a shared Verse sees the words (frontier #11)
  el.addEventListener('pointerdown', () => { stageApi.select(th.id); });
  stageApi.bindDrag(el, th);
  stageApi.stage.appendChild(el);
}

/** create / write / colour, or remove, at the place the sticky code ran: what it did ('no sticky' when there is none to
 *  remove), or '' */
export function ask(lower, text, stageApi) {
  if (wantsCreate(lower, text)) {
    const n = ensure(stageApi, textOf(text, lower), wantsFresh(lower) && stickies(stageApi).length > 0);
    const c = colorOf(lower);
    if (c) n.color = c;
    stageApi.select(n.id);
    stageApi.save(); stageApi.render();
    return 'sticky';
  }
  if (wantsRemove(lower)) {
    const things = stageApi.things(), sel = things[stageApi.selected()];
    const n = (sel && sel.kind === 'sticky' && sel) || stickies(stageApi)[0];
    if (!n) return 'no sticky'; // the page says so rather than handing the ask on
    delete things[n.id];
    if (stageApi.selected() === n.id) stageApi.select(null);
    stageApi.save(); stageApi.render();
    return 'sticky-removed';
  }
  return '';
}

/** "note: ..." / "sticky ...: ..." writing on an existing note, at the later place the page always asked it */
export function askEdit(lower, text, stageApi) {
  if (!(/\b(sticky|note)\b/.test(lower) && /:/.test(text))) return '';
  const seed = textOf(text, lower);
  if (!seed) return '';
  const n = ensure(stageApi, seed);
  stageApi.select(n.id);
  stageApi.save(); stageApi.render();
  return 'sticky-text';
}

export default {
  name: 'sticky',
  examples: ['sticky note buy milk', 'a sticky', 'note: call mom'],
  nearMisses: ['take a note of this url', 'notepad'],
  match(lower, text) { return plainSticky(lower, text); },
  async run(text, api) { const d = ask(String(text || '').toLowerCase(), text, api.stage); return d && d !== 'no sticky' ? 'sticky' : 'none'; },
  // askAt: the page asks this kind's ask/askEdit at its own places, not in the early loop the counter and shape use
  stageKinds: { sticky: { mount, ensure: (stageApi) => ensure(stageApi, ''), ask, askEdit, colorOf, receiveInput, askAt: 'sticky' } },
};
