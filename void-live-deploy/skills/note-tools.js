/**
 * note-tools skill — tools pack 1 (owner, 2026-10-18), the notes-and-writing asks, one skill with modes:
 *   "export this note as markdown" (a .md file of the picked note, list, outline or table), "export the stage as text" (one .txt of every
 *   note on the stage), "find milk on the stage" (matches glow and the stage scrolls to the first; "clear the find"),
 *   "replace milk with oat in the note" (or "in all notes"), "word count of the selection" (the text you selected in a note, else the
 *   picked note), "reading time of this note", "pin this note to the top right corner" (it stays in the corner; "unpin the note"),
 *   "collapse the note" / "collapse long notes" / "expand the note", "duplicate this note".
 * All of it happens on this device: the file is made in the page and saved by the browser, nothing is sent anywhere. Nothing appears
 * until asked. A pinned or collapsed note is saved with the stage (th.pin, th.collapsed).
 */
import { noteIntent, targetOf, thingMarkdown, stageText, thingText, findIn, replaceIn, wordsIn, readingTime, slugOf, NOTE_KINDS } from '../lib/note-tools.js';

// the last text selected inside the stage (a note's textarea or words): the selection is gone from the page once the ask box has focus
let lastSel = '';
let finding = null; // { q, ids } the things glowing now (not saved: a find is a moment)
if (typeof document !== 'undefined' && !window.__voidNoteSel) {
  window.__voidNoteSel = true;
  const inStage = (n) => { const s = document.getElementById('stage'); return !!(s && n && s.contains(n.nodeType === 1 ? n : n.parentNode)); };
  const grab = () => {
    try {
      const a = document.activeElement;
      if (a && (a.tagName === 'TEXTAREA' || a.tagName === 'INPUT') && inStage(a) && typeof a.selectionStart === 'number') { const s = a.value.slice(a.selectionStart, a.selectionEnd); if (s.trim()) lastSel = s; else if (a.selectionStart === a.selectionEnd) lastSel = ''; return; }
      const sel = window.getSelection && window.getSelection();
      if (sel && sel.anchorNode && inStage(sel.anchorNode)) { const s = String(sel); if (s.trim()) lastSel = s; else lastSel = ''; }
    } catch (_) {}
  };
  document.addEventListener('selectionchange', grab);
  document.addEventListener('select', grab, true);
  document.addEventListener('keyup', grab, true);
  document.addEventListener('mouseup', grab, true);
}

/** a file saved by the browser: text made in the page, nothing uploaded */
function download(name, text, type) {
  const url = URL.createObjectURL(new Blob([text], { type: type + ';charset=utf-8' }));
  const a = document.createElement('a'); a.href = url; a.download = name; a.rel = 'noopener'; a.style.display = 'none';
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}

const elOf = (stageApi, id) => stageApi.stage.querySelector('[data-id="' + CSS.escape(String(id)) + '"]');
const textOfThing = (th) => { const x = thingText(th); return x ? (x.title + '\n' + x.body).trim() : ''; };

/** write replaced words back into one thing; the number of replacements */
function replaceInThing(th, from, to) {
  let n = 0;
  const swap = (s) => { const r = replaceIn(s, from, to); n += r.count; return r.text; };
  if (th.kind === 'sticky') th.text = swap(th.text || '');
  else if (th.kind === 'notepad' || th.kind === 'outline') { th.title = swap(th.title || ''); th.text = swap(th.text || ''); }
  else if (th.kind === 'list') { th.title = swap(th.title || ''); (th.items || []).forEach((i) => { i.text = swap(i.text); }); }
  else if (th.kind === 'csvtable') { th.title = swap(th.title || ''); th.rows = (th.rows || []).map((r) => r.map(swap)); }
  return n;
}

/** pinned things sit in their corner and collapsed ones show one line; a find glows. Runs after every draw and drag. */
export function decorate(stageApi) {
  const things = Object.values(stageApi.things());
  const used = {};
  for (const th of things) {
    if (!th) continue;
    const el = elOf(stageApi, th.id); if (!el) continue;
    el.querySelectorAll('.nt-chev').forEach((n) => n.remove());
    if (th.pin && NOTE_KINDS.includes(th.kind)) {
      const key = th.pin.v + '-' + th.pin.h, gap = used[key] || 10;
      el.style.left = 'auto'; el.style.top = 'auto'; el.style.right = 'auto'; el.style.bottom = 'auto';
      el.style[th.pin.h] = '10px'; el.style[th.pin.v] = gap + 'px'; el.style.zIndex = '24'; el.dataset.pinned = th.pin.v + ' ' + th.pin.h;
      used[key] = gap + (el.offsetHeight || 80) + 8;
    } else if (el.dataset.pinned) { delete el.dataset.pinned; el.style.right = ''; el.style.bottom = ''; el.style.left = (+th.x || 0) + 'px'; el.style.top = (+th.y || 0) + 'px'; }
    if (th.collapsed && NOTE_KINDS.includes(th.kind)) {
      el.dataset.collapsed = '1'; el.style.height = '2.6em'; el.style.minHeight = '0'; el.style.maxHeight = '2.6em'; el.style.overflow = 'hidden';
      const b = document.createElement('button'); b.type = 'button'; b.className = 'nt-chev'; b.textContent = '▸'; b.setAttribute('aria-label', 'expand this note'); b.title = 'expand';
      b.style.cssText = 'position:absolute;right:4px;top:3px;z-index:3;border:0;border-radius:6px;background:rgba(0,0,0,.35);color:#fff;font-size:12px;cursor:pointer;line-height:1;padding:3px 6px';
      for (const ev of ['pointerdown', 'mousedown', 'touchstart']) b.addEventListener(ev, (e) => e.stopPropagation());
      b.addEventListener('click', (e) => { e.stopPropagation(); delete th.collapsed; stageApi.save(); stageApi.render(); });
      el.appendChild(b);
    } else if (el.dataset.collapsed) { delete el.dataset.collapsed; el.style.height = ''; el.style.minHeight = ''; el.style.maxHeight = ''; el.style.overflow = ''; }
    const hit = finding && finding.ids.includes(th.id);
    if (hit) { el.dataset.found = '1'; el.style.outline = '2px solid #ffd166'; el.style.outlineOffset = '2px'; }
    else if (el.dataset.found) { delete el.dataset.found; el.style.outline = stageApi.selected() === th.id ? '1px solid rgba(255,255,255,0.25)' : ''; el.style.outlineOffset = ''; }
  }
}

/** do the ask on the stage; the line to say, or '' when it is not ours. stageApi is the page's stage object. */
export function act(intent, stageApi) {
  const things = stageApi.things(), sel = stageApi.selected();
  const none = (noun) => 'no ' + (noun && !/^(it|selection|selected.*)$/.test(noun) ? noun.replace(/s$/, '') : 'note') + ' on the stage to use';
  switch (intent.act) {
    case 'md': {
      const th = targetOf(things, sel, intent.noun);
      if (!th) return none(intent.noun);
      const md = thingMarkdown(th); if (!md) return 'that kind of card has no words to export';
      const x = thingText(th), name = slugOf(x.title || x.body.split('\n')[0], th.kind) + '.md';
      download(name, md, 'text/markdown'); return 'saved ' + name + ' (markdown)';
    }
    case 'text': {
      const txt = stageText(things);
      if (!txt) return 'nothing written on the stage to export';
      download('stage.txt', txt, 'text/plain'); return 'saved stage.txt (' + wordsIn(txt) + ' words)';
    }
    case 'find': {
      const r = findIn(things, intent.q);
      finding = r.ids.length ? { q: intent.q, ids: r.ids } : null;
      stageApi.render();
      if (!r.ids.length) return 'nothing on the stage says “' + intent.q + '”';
      const first = elOf(stageApi, r.ids[0]); if (first) { try { first.scrollIntoView({ block: 'center', inline: 'center', behavior: 'smooth' }); } catch (_) {} }
      return r.total + (r.total === 1 ? ' match' : ' matches') + ' in ' + r.ids.length + (r.ids.length === 1 ? ' note' : ' notes') + ' · “clear the find” to stop';
    }
    case 'unfind': { const had = !!finding; finding = null; stageApi.render(); return had ? 'find cleared' : 'no find to clear'; }
    case 'replace': {
      const targets = intent.all ? Object.values(things).filter((t) => t && NOTE_KINDS.includes(t.kind)) : [targetOf(things, sel, intent.noun)].filter(Boolean);
      if (!targets.length) return none(intent.noun);
      let n = 0, hit = 0;
      for (const th of targets) { const k = replaceInThing(th, intent.from, intent.to); if (k) hit++; n += k; }
      if (!n) return 'nothing to replace: no “' + intent.from + '” in ' + (intent.all ? 'the notes' : 'that note');
      stageApi.save(); stageApi.render();
      return 'replaced ' + n + (n === 1 ? ' time' : ' times') + ' in ' + hit + (hit === 1 ? ' note' : ' notes');
    }
    case 'count': {
      const s = lastSel.trim();
      if (s && !/^(note|sticky|notepad|list|table|outline|card)$/.test(intent.noun)) { const n = wordsIn(s); return n + (n === 1 ? ' word' : ' words') + ' in the selection (' + s.length + ' characters)'; }
      const th = targetOf(things, sel, intent.noun); if (!th) return none(intent.noun);
      const n = wordsIn(textOfThing(th)); return n + (n === 1 ? ' word' : ' words') + ' in the ' + th.kind;
    }
    case 'reading': {
      const th = targetOf(things, sel, intent.noun); if (!th) return none(intent.noun);
      const r = readingTime(textOfThing(th)); return r.label + ' · ' + r.words + (r.words === 1 ? ' word' : ' words') + ' at 200 a minute';
    }
    case 'pin': {
      const th = targetOf(things, sel, intent.noun); if (!th || !NOTE_KINDS.includes(th.kind)) return none(intent.noun);
      th.pin = { v: intent.v, h: intent.h }; stageApi.select(th.id); stageApi.save(); stageApi.render();
      return 'pinned to the ' + intent.v + ' ' + intent.h + ' corner · “unpin the note” to free it';
    }
    case 'unpin': {
      const pinned = Object.values(things).filter((t) => t && t.pin);
      const th = (things[sel] && things[sel].pin && things[sel]) || pinned[pinned.length - 1];
      if (!th) return 'nothing is pinned';
      delete th.pin; stageApi.save(); stageApi.render(); return 'unpinned';
    }
    case 'collapse': {
      let list;
      if (/^(notes|stickies)$/.test(intent.noun)) list = Object.values(things).filter((t) => t && NOTE_KINDS.includes(t.kind) && (!intent.long || wordsIn(textOfThing(t)) >= 40));
      else { const th = targetOf(things, sel, intent.noun); list = th ? [th] : []; }
      if (!list.length) return intent.long ? 'no long notes (40 words or more) to collapse' : none(intent.noun);
      list.forEach((t) => { t.collapsed = true; }); stageApi.save(); stageApi.render();
      return 'collapsed ' + list.length + (list.length === 1 ? ' note' : ' notes') + ' · tap ▸ or say “expand the note”';
    }
    case 'expand': {
      const all = /^(notes|stickies)$/.test(intent.noun);
      const list = all ? Object.values(things).filter((t) => t && t.collapsed) : [targetOf(things, sel, intent.noun)].filter((t) => t && t.collapsed);
      if (!list.length) return 'nothing is collapsed';
      list.forEach((t) => { delete t.collapsed; }); stageApi.save(); stageApi.render(); return 'expanded ' + list.length;
    }
    case 'duplicate': {
      const th = targetOf(things, sel, intent.noun); if (!th || !NOTE_KINDS.includes(th.kind)) return none(intent.noun);
      const c = JSON.parse(JSON.stringify(th));
      c.id = th.kind + '-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
      c.x = (+th.x || 0) + 30; c.y = (+th.y || 0) + 30; delete c.pin; delete c.collapsed;
      things[c.id] = c; stageApi.select(c.id); stageApi.save(); stageApi.render();
      return 'duplicated the ' + th.kind;
    }
  }
  return '';
}

export default {
  name: 'note-tools',
  examples: ['export this note as markdown', 'export the stage as text', 'find milk on the stage', 'replace milk with oat milk in the note', 'word count of the selection', 'reading time of this note',
    'pin this note to the corner', 'collapse the note', 'duplicate this note'],
  nearMisses: ['what is markdown', 'find a pizza place near me', 'how many words in a novel', 'replace the battery in my phone', 'word count of hamlet', 'collapse of the roman empire',
    'duplicate the zombie', 'clone the zombie', 'pin a map of paris', 'export my data', 'reading time of war and peace', 'find me a recipe for soup'],
  noteIntent,
  match(lower, text) { return !!noteIntent(text || lower); },
  async run(text, api) {
    const intent = noteIntent(text);
    if (!intent) return 'none';
    const line = act(intent, api.stage);
    api.say(line);
    return 'note-tools';
  },
  decorate,
};
