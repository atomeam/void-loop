/**
 * notebook skill - "daily note", "linked notes", "notebook", "what links to Garden Plan", "what am I missing in my notes": linked notes with
 * backlinks and a daily note, then what the notes are missing. Part of the frontier's "absorb and connect every repo" (owner, 2026-10-15: "all the
 * projects are Verse"), written in Verse's own code (lib/notebook.js). A note is a title and text; [[Another note]] in the text is a link; a note
 * shows the notes that link to it; the daily note is today's date and is made once; "what am I missing" lists links to notes that do not exist,
 * notes named in plain words but not linked (one tap links the mention), and notes nothing links to. Everything is kept on this device with the
 * stage (nothing is sent anywhere); nothing is deleted without a second tap. Note text is written with text nodes, never as markup.
 * A note's [[links]] reach the stage: "Links to" shows each one, a tap opens that note (or makes it), and "send to the notepad" writes the
 * note, title first and its links as plain titles, under what the notepad holds (skills/notepad.js append, a new notepad when there is none).
 * Contract: { name, examples, nearMisses, match(lower, text), run(text, api), stageKinds }
 */
import { addThing, firstOf, cardEl, keepOut } from '../lib/stage-pack.js';
import { ensureDaily, missingOf, linkMention, tidyNotes, parseAsk, keyOf, cleanTitle, backlinksOf, outlinksOf, padText, MAX_NOTES, MAX_TEXT, MAX_TITLE } from '../lib/notebook.js';
import { append } from './notepad.js';

const newId = () => 'n' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5);
const byTitle = (notes, title) => notes.find((n) => keyOf(n.title) === keyOf(title)) || null;

/** what an ask does to the notebook: { notes, sel, hint } from the notes kept now, the ask read by parseAsk, and the date. Pure. */
export function openAs(notes, ask, date = new Date(), make = (title) => ({ id: newId(), title, text: '', at: date.getTime() })) {
  let list = tidyNotes(notes), sel = '', hint = '';
  if (ask && ask.daily) { const r = ensureDaily(list, date, make); list = r.notes; sel = (byTitle(list, r.title) || {}).id || ''; }
  else if (ask && ask.make) {
    const t = cleanTitle(ask.make), have = byTitle(list, t);
    if (have) sel = have.id; else if (t && list.length < MAX_NOTES) { const n = make(t); list = [...list, n]; sel = n.id; }
  } else if (ask && ask.backlinks) {
    const have = byTitle(list, ask.backlinks);
    if (have) sel = have.id; else hint = 'No note called "' + cleanTitle(ask.backlinks) + '" yet. Type its title in the box and press Enter to make it.';
  }
  return { notes: list, sel, hint };
}

function mount(th, stageApi) {
  const el = cardEl(th, stageApi, 'notebook');
  el.style.width = 'min(560px, 86vw)'; el.dataset.view = th.view || '';
  const { save } = stageApi;
  th.notes = tidyNotes(th.notes);
  if (!th.notes.some((n) => n.id === th.sel)) th.sel = th.notes.length ? th.notes[th.notes.length - 1].id : '';
  const cur = () => th.notes.find((n) => n.id === th.sel) || null;
  const mk = (tag, cls, text, style) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; if (style) e.style.cssText = style; return e; };
  const btnStyle = 'font:inherit;font-size:12px;padding:2px 10px;border-radius:12px;border:1px solid rgba(255,255,255,.3);background:transparent;color:inherit;cursor:pointer;min-height:28px';
  const btn = (label, fn, cls, extra) => { const b = mk('button', cls || '', label, btnStyle + (extra || '')); b.type = 'button'; b.addEventListener('click', (e) => { e.stopPropagation(); fn(); }); keepOut(b); return b; };
  const field = (style) => { const i = document.createElement(style.tag || 'input'); i.style.cssText = 'font:inherit;background:rgba(255,255,255,.07);color:inherit;border:1px solid rgba(255,255,255,.18);border-radius:6px;padding:4px 6px;box-sizing:border-box;width:100%;' + (style.css || ''); keepOut(i); return i; };

  const head = mk('div', 'nb-head', null, 'display:flex;justify-content:space-between;align-items:baseline;gap:8px;margin-bottom:6px');
  head.append(mk('b', '', 'Notebook'), mk('span', '', 'linked notes · kept on this device only', 'font-size:11px;opacity:.65'));
  const bar = mk('div', 'nb-bar', null, 'display:flex;gap:6px;align-items:center;margin-bottom:8px');
  const nw = field({ css: 'flex:1;min-width:0' }); nw.className = 'nb-new'; nw.placeholder = 'new note title, then Enter'; nw.maxLength = MAX_TITLE; nw.setAttribute('aria-label', 'new note title');
  const list = mk('div', 'nb-list', null, 'display:flex;flex-wrap:wrap;gap:4px;margin-bottom:8px');
  const title = field({ css: 'font-weight:600;margin-bottom:4px' }); title.className = 'nb-title'; title.maxLength = MAX_TITLE; title.setAttribute('aria-label', 'note title');
  const body = field({ tag: 'textarea', css: 'min-height:120px;resize:vertical' }); body.className = 'nb-text'; body.maxLength = MAX_TEXT; body.setAttribute('aria-label', 'note text'); body.placeholder = 'Write here. Link another note with [[its title]].';
  const side = mk('div', 'nb-side', null, 'margin-top:8px;font-size:12.5px');
  const hint = mk('div', 'nb-hint', th.hint || '', 'font-size:12px;opacity:.85;margin-bottom:6px'); th.hint = '';

  const choose = (id) => { th.sel = id; save(); loadEditor(); paintList(); paintSide(); };
  const addNote = (t) => { const c = cleanTitle(t); if (!c) return null; const have = byTitle(th.notes, c); if (have) return have; if (th.notes.length >= MAX_NOTES) return null; const n = { id: newId(), title: c, text: '', at: Date.now() }; th.notes.push(n); return n; };
  const loadEditor = () => { const n = cur(); title.value = n ? n.title : ''; body.value = n ? n.text : ''; title.disabled = body.disabled = !n; if (!n) hint.textContent = hint.textContent || 'No notes yet. Make today\'s note, or type a title above and press Enter.'; };
  function paintList() {
    list.textContent = '';
    for (const n of th.notes) { const b = btn(n.title, () => choose(n.id), 'nb-note', n.id === th.sel ? ';background:rgba(150,130,255,.28);border-color:rgba(150,130,255,.7)' : ''); b.dataset.title = n.title; b.setAttribute('aria-pressed', String(n.id === th.sel)); list.appendChild(b); }
  }
  function section(label, cls) { const s = mk('div', cls, null, 'margin-top:6px'); s.appendChild(mk('div', '', label, 'font-weight:600;font-size:12px;margin-bottom:2px')); return s; }
  function paintSide() {
    side.textContent = '';
    const n = cur();
    if (n) {
      const out = outlinksOf(th.notes, n), o = section('Links to (' + out.length + ')', 'nb-out');
      if (!out.length) o.appendChild(mk('div', '', 'No links yet. Write [[a title]] in the text.', 'opacity:.7'));
      const orow = mk('div', '', null, 'display:flex;flex-wrap:wrap;gap:4px');
      for (const l of out) { const x = btn(l.id ? l.title : l.title + ' (make it)', () => { const c = addNote(l.title); if (c) choose(c.id); }, 'nb-out-note', l.id ? '' : ';border-style:dashed'); x.dataset.title = l.title; x.dataset.made = l.id ? '1' : ''; orow.appendChild(x); }
      o.appendChild(orow); side.appendChild(o);
      const back = backlinksOf(th.notes, n.title), s = section('Linked from (' + back.length + ')', 'nb-back');
      if (!back.length) s.appendChild(mk('div', '', 'Nothing links here yet. Write [[' + n.title + ']] in another note.', 'opacity:.7'));
      const row = mk('div', '', null, 'display:flex;flex-wrap:wrap;gap:4px'); for (const b of back) { const x = btn(b.title, () => choose(b.id), 'nb-back-note'); x.dataset.title = b.title; row.appendChild(x); } s.appendChild(row);
      side.appendChild(s);
    }
    const miss = missingOf(th.notes), s = section('What I am missing', 'nb-missing'); if (th.view === 'missing') s.style.outline = '1px solid rgba(255,195,107,.5)';
    if (!miss.dangling.length && !miss.unlinked.length && !miss.orphans.length) s.appendChild(mk('div', '', th.notes.length ? 'Nothing: every link has its note, every named note is linked, and every note is connected.' : 'Nothing yet: there are no notes.', 'opacity:.7'));
    for (const d of miss.dangling) { const r = mk('div', 'nb-dangling', null, 'display:flex;gap:6px;align-items:center;margin:2px 0'); r.dataset.title = d.title; r.append(mk('span', '', '[[' + d.title + ']] is linked from ' + d.from.join(', ') + ' but has no note'), btn('make it', () => { const c = addNote(d.title); if (c) choose(c.id); })); s.appendChild(r); }
    for (const u of miss.unlinked) { const r = mk('div', 'nb-unlinked', null, 'display:flex;gap:6px;align-items:center;margin:2px 0'); r.dataset.title = u.title; r.dataset.in = u.in;
      r.append(mk('span', '', u.in + ' names "' + u.title + '" without linking it'), btn('link it', () => { const host = byTitle(th.notes, u.in); if (host) { host.text = linkMention(host.text, u.title); if (host.id === th.sel) body.value = host.text; save(); paintSide(); } })); s.appendChild(r); }
    if (miss.orphans.length) s.appendChild(mk('div', 'nb-orphans', 'No links in or out: ' + miss.orphans.join(', '), 'margin:2px 0;opacity:.85'));
    side.appendChild(s);
  }

  bar.append(btn('today\'s note', () => { const r = openAs(th.notes, { daily: true }); th.notes = r.notes; choose(r.sel); }, 'nb-daily'), nw);
  nw.addEventListener('keydown', (e) => { e.stopPropagation(); if (e.key === 'Enter') { const n = addNote(nw.value); nw.value = ''; if (n) choose(n.id); } });
  body.addEventListener('input', () => { const n = cur(); if (!n) return; n.text = body.value.slice(0, MAX_TEXT); n.at = Date.now(); save(); paintSide(); });
  title.addEventListener('change', () => { const n = cur(); if (!n) return; const t = cleanTitle(title.value); if (!t || (byTitle(th.notes, t) && keyOf(t) !== keyOf(n.title))) { title.value = n.title; return; } n.title = t; save(); paintList(); paintSide(); });
  const del = btn('delete this note', () => { if (del.dataset.sure !== '1') { del.dataset.sure = '1'; del.textContent = 'really delete? tap again'; return; } th.notes = th.notes.filter((n) => n.id !== th.sel); th.sel = th.notes.length ? th.notes[th.notes.length - 1].id : ''; save(); del.dataset.sure = ''; del.textContent = 'delete this note'; loadEditor(); paintList(); paintSide(); }, 'nb-delete', ';margin-top:6px;opacity:.8');
  del.addEventListener('blur', () => { del.dataset.sure = ''; del.textContent = 'delete this note'; });
  const toPad = btn('send to the notepad', () => { const n = cur(), t = padText(n); if (!t) return; th.hint = 'Sent "' + n.title + '" to the notepad.'; append(stageApi, t); }, 'nb-to-pad', ';margin:6px 6px 0 0');
  const acts = mk('div', 'nb-acts', null, 'display:flex;flex-wrap:wrap;align-items:center'); acts.append(toPad, del);

  el.append(head, bar, hint, list, title, body, acts, side);
  loadEditor(); paintList(); paintSide();
  stageApi.bindDrag(el, th);
  stageApi.stage.appendChild(el);
}

/** the ask: open (or make) the notebook, then do what was asked in it; one notebook on the stage. */
export function ask(lower, text, stageApi) {
  const p = parseAsk(text);
  if (!p) return '';
  const th = firstOf(stageApi, 'notebook') || addThing(stageApi, 'notebook', { notes: [], sel: '', y: 20 }) // a tall card starts near the top, so its last section is not under the ask bar;
  const r = openAs(th.notes, p);
  th.notes = r.notes; if (r.sel) th.sel = r.sel; th.hint = r.hint; th.view = p.missing ? 'missing' : '';
  stageApi.select(th.id); stageApi.save(); stageApi.render();
  return 'notebook';
}

// checked by tools/skills-check.mjs on every run: what each ask does to a made-up notebook
export function suite() {
  const d = new Date(2026, 9, 18, 9, 0), mkn = (title) => ({ id: 'i-' + title, title, text: '', at: 0 });
  const base = [{ id: 'a', title: 'Alpha', text: 'see [[Beta]]', at: 0 }];
  const day = openAs(base, parseAsk('daily note'), d, mkn), again = openAs(day.notes, parseAsk("today's note"), d, mkn);
  const made = openAs(base, parseAsk('new note called Reading List'), d, mkn), seen = openAs(base, parseAsk('new note called alpha'), d, mkn);
  const none = openAs(base, parseAsk('what links to Nowhere'), d, mkn), have = openAs(base, parseAsk('what links to ALPHA'), d, mkn);
  const ok = day.notes.length === 2 && day.notes[1].title === '2026-10-18' && day.sel === 'i-2026-10-18' && again.notes.length === 2 && again.sel === 'i-2026-10-18'
    && made.notes.map((n) => n.title).join() === 'Alpha,Reading List' && made.sel === 'i-Reading List' && seen.notes.length === 1 && seen.sel === 'a'
    && none.sel === '' && /No note called "Nowhere"/.test(none.hint) && have.sel === 'a' && have.hint === ''
    && JSON.stringify(outlinksOf([...base, { id: 'b', title: 'Beta', text: '', at: 0 }], base[0])) === '[{"title":"Beta","id":"b"}]' && outlinksOf(base, base[0])[0].id === ''
    && padText(base[0]) === 'Alpha\nsee Beta'
    && openAs(null, null, d).notes.length === 0 && JSON.stringify(parseAsk('what am i missing in my notes')) === '{"missing":true}' && parseAsk('sticky note buy milk') === null;
  return { ok, got: ok ? '' : JSON.stringify({ day, again, made, none }) };
}

export default {
  name: 'notebook',
  examples: ['daily note', "today's note", 'open my notebook', 'linked notes with backlinks', 'what links to Garden Plan', 'what am I missing in my notes', 'new note called Reading List'],
  nearMisses: ['daily notes app review', 'sticky note buy milk', 'buy a notebook computer', 'what am i missing', 'notepad: call the vet', 'note to self', 'what links to'],
  parseAsk,
  openAs,
  suite,
  match(lower, text) { return !!parseAsk(text || lower); },
  async run(text, api) { return ask(String(text || '').toLowerCase(), text, api.stage) ? 'notebook' : 'none'; },
  stageKinds: { notebook: { mount, ask } },
};
