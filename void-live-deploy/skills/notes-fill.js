/**
 * notes-fill skill - a sentence writes into the Notes page's own store (owner, 2026-10-25: "make sure Verse knows how to fill out its own relevant
 * pages for you just by chatting with it, similar to notion"). "add a note: buy milk", "make a note about my trip to Lisbon: flights Friday, hotel
 * Alfama, packing list", "add eggs to my shopping list", "tick milk", "clean up my shopping list", "summarise my meeting note", "what did I write about
 * Lisbon", "rename / pin / tag / merge / split my X note", "start a meeting note", and the German verbs. The reading and the writing are lib/chat-notes.js
 * (pure, tested); the notes are the ones /notes/ keeps on this device (lib/notes.js KEY). The card says what changed, has Undo (a real restore) and a
 * link to the page. A weak match is shown with a Confirm button, two notes that fit are listed to choose from; nothing is written unseen.
 * Contract: { name, examples, nearMisses, match(lower, text), run(text, api) }
 */
import { KEY, load } from '../lib/notes.js';
import { parseIntent, plan, undoOf, looksLikeNotes, HINT } from '../lib/chat-notes.js';

const LOG = 'a2m.void.chatfill.undo.v1';
const read = () => { try { return load(localStorage.getItem(KEY)); } catch (_) { return { docs: [], cur: null }; } };
const write = (s) => { try { localStorage.setItem(KEY, JSON.stringify(s)); return true; } catch (_) { return false; } };
const log = () => { try { const l = JSON.parse(localStorage.getItem(LOG) || '[]'); return Array.isArray(l) ? l : []; } catch (_) { return []; } };
const saveLog = (l) => { try { localStorage.setItem(LOG, JSON.stringify(l.slice(-20))); } catch (_) {} };
const openHref = (id) => '/notes/' + (id ? '?id=' + encodeURIComponent(id) : '');

/** true when the sentence is about notes: read as an intent, and (for the verbs that need an existing note) a note that fits. */
function match(lower, text) {
  const it = parseIntent(text);
  if (!it) return looksLikeNotes(text);
  if (it.op === 'create' || it.op === 'template' || it.op === 'find' || it.op === 'undo') return true;
  return plan(read(), it, Date.now()).kind !== 'none';
}

function mk(tag, cls, text) { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; }
function btn(label, fn, primary) { const b = mk('button', 'nf-btn', label); b.type = 'button'; if (primary) b.style.fontWeight = '700'; b.style.cssText += ';font:inherit;font-size:13px;margin:4px 6px 0 0;padding:4px 12px;min-height:36px;border-radius:999px;border:1px solid currentColor;background:transparent;color:inherit;cursor:pointer'; b.addEventListener('click', (e) => { e.stopPropagation(); fn(); }); return b; }

function draw(el, text, intent) {
  const r = plan(read(), intent, Date.now());
  el.replaceChildren();
  const wd = r.kind === 'write' && r.openId ? (r.store.docs.find((d) => d.id === r.openId) || {}).title : '';
  const h = mk('h2', '', r.kind === 'write' ? wd || 'Notes' : r.kind === 'confirm' ? 'Write this?' : r.kind === 'ask' ? 'Which one?' : r.title || 'Notes'); el.append(h);
  if (r.kind === 'write') {
    const ok = write(r.store);
    if (!ok) { el.append(mk('p', '', 'This browser would not let me save notes (private window?). Nothing was written.')); return; }
    const entry = { id: Math.random().toString(36).slice(2, 9), said: r.said, at: Date.now(), changes: r.changes }; saveLog([...log(), entry]);
    el.append(mk('p', '', r.said + '.'));
    if (r.preview) { const pre = mk('p', 'src', r.preview.split('\n').slice(0, 6).join(' · ')); el.append(pre); }
    const row = mk('div', ''); el.append(row);
    row.append(btn('Undo', () => { const now = read(); write(undoOf(now, r.changes, Date.now())); saveLog(log().filter((x) => x.id !== entry.id)); el.replaceChildren(mk('h2', '', 'Undone'), mk('p', '', r.said + ': put back as it was.'), mk('p', 'src', 'Earlier versions stay in the note\'s history.')); }, true));
    if (r.openId) { const a = mk('a', 'vc-page', 'Open it in Notes'); a.href = openHref(r.openId); a.style.cssText = 'display:inline-block;margin:6px 0 2px;font-size:13px;font-weight:600'; row.append(a); }
  } else if (r.kind === 'confirm') {
    el.append(mk('p', '', r.preview + '?'), mk('p', 'src', 'It is not an exact match for the name you gave, so I am asking first.'));
    el.append(btn('Confirm', () => draw(el, text, r.intent), true), btn('Cancel', () => el.replaceChildren(mk('h2', '', 'Cancelled'), mk('p', '', 'Nothing was written.'))));
  } else if (r.kind === 'ask') {
    el.append(mk('p', '', r.question));
    for (const o of r.options) el.append(btn(o.label, () => draw(el, text, o.intent)));
  } else if (r.kind === 'show') {
    for (const l of r.lines || []) el.append(mk('p', '', l));
    for (const hit of r.hits || []) { const p = mk('p', ''); const a = mk('a', '', hit.title); a.href = openHref(hit.id); a.style.fontWeight = '700'; p.append(a, document.createTextNode(': ' + (hit.snippet || ''))); el.append(p); }
    if (r.offer) el.append(btn(r.offer.label, () => draw(el, text, r.offer.intent)));
    if (r.openId) { const a = mk('a', 'vc-page', 'Open it in Notes'); a.href = openHref(r.openId); a.style.cssText = 'display:block;margin:6px 0 2px;font-size:13px;font-weight:600'; el.append(a); }
  } else { el.append(mk('p', '', HINT)); }
}

function run(text, api) {
  const { showPage } = api; let it = parseIntent(text);
  if (it && it.op === 'undo') { const el = showPage(() => {}); const last = log().pop(); el.replaceChildren(mk('h2', '', last ? 'Undone' : 'Notes'), mk('p', '', last ? last.said + ': put back as it was.' : 'No note change of mine left to undo.')); if (last) { write(undoOf(read(), last.changes, Date.now())); saveLog(log().slice(0, -1)); } return 'notes-fill'; }
  const el = showPage(() => {});
  if (!it) { el.append(mk('h2', '', 'What I can fill'), mk('p', '', HINT)); return 'notes-fill'; }
  draw(el, text, it);
  return 'notes-fill';
}

export default {
  name: 'notes-fill',
  examples: ['add a note: buy milk', 'take a note: call the vet', 'add eggs to my shopping list', 'what did I write about Lisbon', 'start a meeting note'],
  nearMisses: ['add dentist tomorrow to my calendar', 'what is the weather', 'tick tock', 'notepad: buy bread'],
  match,
  run
};
