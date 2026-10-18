/**
 * kept skill — an answer you kept on the stage: "keep this" puts the open answer up as a card, "call this my tip" names it,
 * "refresh this" asks it again. The asks stay in the page (they work on whatever answer is open, and public /@name pages
 * show their cards the same way); this draws the card: pinned up with a red pushpin at a slight tilt of its own, the title
 * in the felt-tip hand, the answer scrolling under the pin. Moved out of void.html in cleanup step 6.
 * To the notepad (asked by Verse, 2026-10-16): the small "to notepad" button on every kept card, or "turn the card into a note" /
 * "note this card", copies its title and words as one line under what the notepad holds (lib/bridges.js keptNote).
 */
import { append } from './notepad.js';
import { keptNote, plainOf } from '../lib/bridges.js';

/** "turn this card into a note", "copy the card to the notepad", "note this card": the kept card goes to the notepad. Pure. */
export function toNoteAsk(text) {
  const t = String(text || '').trim().toLowerCase().replace(/[?!.]+$/, '').replace(/\s+/g, ' ');
  return /^(?:please\s+)?(?:turn|convert|make|change)\s+(?:this|the|that)\s+(?:kept\s+)?card\s+(?:into|to)\s+(?:a\s+)?(?:note|notepad(?:\s+(?:note|entry|line))?|text(?:\s+note)?)$/.test(t)
    || /^(?:please\s+)?(?:copy|send|put|add|write)\s+(?:this|the|that)\s+(?:kept\s+)?card\s+(?:to|into|in|on)\s+(?:the\s+|my\s+)?notepad$/.test(t)
    || /^(?:please\s+)?note\s+(?:this|the|that)\s+(?:kept\s+)?card$/.test(t);
}
const plain = plainOf;
/** the card's line in the notepad: a new notepad when there is none; the line */
export function noteKept(th, stageApi) {
  const line = keptNote(th, plain(th && th.html));
  if (line) append(stageApi, line);
  return line;
}

/** a kept card's own slight tilt, -2 to 2 degrees, the same every time for the same card (as skills/image.js). Pure. */
export function tiltOf(id) {
  let h = 0;
  for (const c of String(id || '')) h = (h * 31 + c.charCodeAt(0)) | 0;
  return Math.round(((Math.abs(h) % 41) - 20) / 10 * 10) / 10 || 0.8; // never square
}

/** "as of 4:05 PM" (and the day when it is not today), on the dated answers the page keeps */
function asOf(t, now = new Date()) {
  return ' · as of ' + t.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
    + (t.toDateString() === now.toDateString() ? '' : ', ' + t.toLocaleDateString([], { month: 'short', day: 'numeric' })) + ' · say “refresh this”';
}

function mount(th, stageApi) {
  const el = document.createElement('div');
  el.className = 'thing kept-card pinned';
  el.dataset.id = th.id;
  el.style.left = th.x + 'px';
  el.style.top = th.y + 'px';
  el.style.width = (th.w || 320) + 'px';
  el.style.rotate = tiltOf(th.id) + 'deg';
  if (stageApi.selected() === th.id) el.style.outline = '1px solid rgba(255,255,255,0.25)';
  const head = document.createElement('div');
  head.className = 'kept-head';
  head.textContent = th.name || th.ask || 'kept';
  const body = document.createElement('div');
  body.className = 'kept-body';
  // void-review: ok: the html is the page's own: "keep this" copies the answer it already drew, a synced stage passes the page's
  // cleanHTML on the way in, and a public /@name page's cards are escaped text (as when this lived in void.html)
  body.innerHTML = th.html || ''; // void-review: ok
  body.querySelectorAll('.asof[data-t]').forEach((a) => { a.textContent = asOf(new Date(a.dataset.t)); });
  body.querySelectorAll('h2').forEach((h) => { h.style.cssText = 'font-size:16px;margin:0 0 2px;font-weight:500'; });
  body.querySelectorAll('iframe').forEach((f) => { f.style.height = '220px'; });
  body.querySelectorAll('a[data-alt], a[data-ask]').forEach((a) => a.removeAttribute('href'));
  const toNote = document.createElement('button');
  toNote.type = 'button'; toNote.className = 'kept-to-note'; toNote.textContent = 'to notepad'; toNote.title = 'copy this card as a line in the notepad';
  toNote.style.cssText = 'position:absolute;right:8px;bottom:6px;font:inherit;font-size:11px;padding:1px 7px;border-radius:9px;border:1px solid rgba(0,0,0,.25);background:rgba(255,255,255,.7);color:#333;cursor:pointer';
  toNote.addEventListener('pointerdown', (e) => e.stopPropagation());
  toNote.addEventListener('click', (e) => { e.stopPropagation(); noteKept(th, stageApi); stageApi.say('in the notepad'); });
  el.appendChild(head); el.appendChild(body); el.appendChild(toNote);
  stageApi.bindDrag(el, th);
  body.addEventListener('pointerdown', (e) => { if (e.target.closest('a, iframe')) e.stopPropagation(); });
  stageApi.stage.appendChild(el);
}

export default {
  name: 'kept',
  examples: ['turn this card into a note', 'copy the card to the notepad', 'note this card'],
  nearMisses: ['keep this', 'note: call mom', 'turn the sticky into a note', 'copy the list to the notepad'],
  match(lower, text) { return toNoteAsk(text); }, // "keep this" and "call this" stay in the page: they work on the answer that is open
  async run(text, api) {
    if (!toNoteAsk(text)) return 'none';
    const st = api.stage, things = st.things(), sel = things[st.selected()];
    const cards = Object.values(things).filter((t) => t && t.kind === 'kept');
    const th = (sel && sel.kind === 'kept' && sel) || cards[cards.length - 1];
    if (!th) { api.say('no kept card on the stage · "keep this" on an open answer makes one'); return 'kept'; }
    noteKept(th, st);
    api.say('the card is a line in the notepad');
    return 'kept';
  },
  stageKinds: { kept: { mount } },
};
