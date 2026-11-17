/**
 * adventure skill - choose-your-own-adventure books on the stage. Rules in lib/adventure.js, books in
 * void-live-deploy/data/adventures/*.json (three books ship: time-loop, dark fantasy, noir). Card shows scene,
 * choices, pack, flags, path; runs persist on the device and export as a shareable run code.
 * Contract: { name, examples, nearMisses, match(lower, text), run(text, api), adventureOf, stageKinds }
 */
import { addThing, cardEl, keepOut } from '../lib/stage-pack.js';
import { validateBook, createRun, getNode, availableChoices, choose, omenFor, runCode, runFromCode, adventureAsk, ADVENTURE_BOOKS } from '../lib/adventure.js';

const BOOKS = ADVENTURE_BOOKS;
const bookUrl = (id) => '/data/adventures/' + id + '.json';
const cache = {};
async function loadBook(id, fetchFn) {
  if (cache[id]) return cache[id];
  const r = await (fetchFn || fetch)(bookUrl(id));
  if (!r.ok) throw new Error('no book');
  const book = await r.json();
  if (validateBook(book).length) throw new Error('bad book');
  cache[id] = book;
  return book;
}
const markKey = (id) => 'a2m.adventure.' + id;

/** { book } for an ask naming the shelf or one of its books; null otherwise. Pure. */
export function adventureOf(text) {
  const b = adventureAsk(text, BOOKS);
  return b ? { book: b.id } : null;
}

function h(tag, css, text, attrs) {
  const e = document.createElement(tag);
  if (css) e.style.cssText = css;
  if (text != null) e.textContent = text;
  if (attrs) for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v);
  return e;
}
function button(stageApi, text, fn, pressed) {
  const b = h('button', 'font:inherit;padding:6px 14px;border-radius:14px;border:1px solid rgba(255,255,255,.3);background:rgba(143,180,255,.18);color:inherit;cursor:pointer;min-height:36px;text-align:left', text, { type: 'button' });
  if (pressed !== undefined) b.setAttribute('aria-pressed', pressed ? 'true' : 'false');
  b.addEventListener('click', (e) => { e.stopPropagation(); fn(); });
  keepOut(b);
  return b;
}

/** the stage kind's mount: the scene, its choices, the pack, the path. */
function mount(th, stageApi) {
  const el = cardEl(th, stageApi, 'adventure');
  el.style.width = 'min(92vw,460px)';
  const { save, render } = stageApi;
  const paint = async () => {
    el.replaceChildren(h('div', 'opacity:.7', 'Opening the book…'));
    let book;
    try { book = await loadBook(th.book, stageApi.fetch); }
    catch (_) { el.replaceChildren(h('div', '', 'This book would not open. It may be missing from this device.')); return; }
    if (!th.run || th.run.book !== book.id) {
      let resumed = null;
      try { resumed = runFromCode(book, localStorage.getItem(markKey(book.id)) || ''); } catch (_) { /* a bad mark */ }
      th.run = (resumed && resumed.node) || { ...createRun(book.id), node: book.start };
      save();
    }
    const node = getNode(book, th.run.node || book.start);
    el.replaceChildren();
    el.append(h('div', 'font-size:11px;opacity:.65;text-transform:uppercase;letter-spacing:.05em', book.title + ' · ' + (node.title || 'the end')));
    el.append(h('p', 'font-size:14px;line-height:1.5;margin:8px 0', node.prose || ''));
    el.append(h('div', 'font-size:12px;opacity:.6;font-style:italic;margin-bottom:8px', omenFor(th.run.node || book.start, th.run.seed)));
    const bits = [...th.run.pack.map((p) => '🎒 ' + p), ...Object.entries(th.run.flags).filter(([, v]) => v).map(([k]) => '⚑ ' + k)];
    if (bits.length) el.append(h('div', 'font-size:12px;opacity:.8;margin-bottom:8px', bits.join(' · '), { class: 'ad-pack' }));
    if (node.ending) {
      el.append(h('div', 'font-size:15px;font-weight:700;margin:6px 0', (node.ending.kind === 'triumph' ? '✦ ' : node.ending.kind === 'demise' ? '✖ ' : '◈ ') + (node.ending.title || 'The end'), { class: 'ad-end' }));
    }
    for (const c of availableChoices(book, th.run)) {
      const label = (c.open ? '' : '🔒 ') + c.text + (c.open || !c.need ? '' : ' (' + c.need + ')');
      const b = button(stageApi, label, () => {
        if (!c.open) return;
        const r = choose(book, th.run, c.i);
        if (!r.ok) return;
        th.run = r.run;
        try { localStorage.setItem(markKey(book.id), runCode(th.run)); } catch (_) { /* private mode */ }
        save(); render();
      });
      if (!c.open) { b.disabled = true; b.style.opacity = '.55'; b.style.cursor = 'default'; }
      el.append(b);
    }
    const row = h('div', 'display:flex;gap:6px;margin-top:8px;flex-wrap:wrap');
    const code = runCode(th.run);
    const again = button(stageApi, 'Restart', () => {
      th.run = { ...createRun(book.id), node: book.start };
      try { localStorage.removeItem(markKey(book.id)); } catch (_) { /* private mode */ }
      save(); render();
    });
    const copy = button(stageApi, 'Copy run', () => {
      const path = th.run.path.map((id) => (getNode(book, id) || {}).title || id).join(' → ');
      const text = book.title + ' · ' + (node.title || '') + (node.ending ? ' · ' + node.ending.title : '') + '\nPath: ' + path + '\nRun code: ' + code;
      try { navigator.clipboard.writeText(text).then(() => stageApi.say('copied the run'), () => stageApi.say('copy did not work here')); } catch (_) { stageApi.say('copy did not work here'); }
    });
    again.style.background = copy.style.background = 'transparent';
    row.append(again, copy);
    el.append(row);
    el.append(h('div', 'font-size:11px;opacity:.55;margin-top:6px', 'Step ' + (th.run.path.length + 1) + ' · run code ' + code.slice(0, 12) + '… · kept on this device', { class: 'ad-code' }));
    // keepOut: without the pointerdown stop the card's drag eats the press and the link never fires (calc, convert)
    el.append(keepOut(h('a', 'display:inline-block;margin-top:6px;font-size:12px', 'Read full screen →', { href: '/games/adventure/?book=' + th.book })));
  };
  stageApi.bindDrag(el, th);
  stageApi.stage.appendChild(el);
  paint();
}

/** the kind's ask: deal the book the ask names. */
export function ask(lower, text, stageApi) {
  const a = adventureOf(text);
  if (!a) return '';
  addThing(stageApi, 'adventure', { book: a.book, run: null });
  stageApi.save(); stageApi.render();
  return 'adventure';
}

export default {
  name: 'adventure',
  examples: ['choose your own adventure', 'play adventure', 'adventure game', 'interactive story', 'text adventure', 'interactive fiction', 'start an adventure', 'start the chrono signal', 'start the obsidian keep', 'chrono-signal'],
  nearMisses: ['tell me a story', 'bedtime story', 'adventure time', 'what is an adventure', 'adventure trailer', 'watch adventure'],
  adventureOf,
  match(lower, text) { return !!adventureOf(text || lower); },
  async run(text, api) {
    if (!adventureOf(text)) return 'none';
    const existing = Object.values(api.stage.things()).find((t) => t.kind === 'adventure');
    if (existing) { if (api.stage.center) api.stage.center(existing.id); else api.stage.render(); return 'adventure'; }
    ask(String(text || '').toLowerCase(), text, api.stage);
    return 'adventure';
  },
  stageKinds: { adventure: { mount, ask } },
};
