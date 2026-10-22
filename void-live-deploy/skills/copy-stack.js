/**
 * copy-stack skill — the last 5 things copied on this page (tools pack 5, owner 2026-10-18; number 110).
 * Anything copied here (a selection, a "copy" button on a card, "Copy for an email") is remembered for this tab only (sessionStorage:
 * it goes when the tab closes and never reaches the stage's saved state); "show my clipboard stack" lists them with a copy-again
 * button, "copy item 2 from the clipboard stack" does the same by words, "clear the clipboard stack" empties it. Anything that looks like
 * a key, token or password is never kept (lib/stage-port.js looksSecret). Only copies made on this page are seen; the system clipboard
 * outside it is not read. Nothing leaves the browser.
 */
import { pushCopy, copyIntent, COPIES_MAX } from '../lib/stage-port.js';
import { listPage } from '../lib/pack5-ui.js';

const KEY = 'a2m.void.copies.v1';
const read = () => { try { const v = JSON.parse(sessionStorage.getItem(KEY) || '[]'); return Array.isArray(v) ? v.filter((s) => typeof s === 'string').slice(0, COPIES_MAX) : []; } catch (_) { return []; } };
const write = (v) => { try { sessionStorage.setItem(KEY, JSON.stringify(v)); } catch (_) { /* private window: the stack stays empty */ } };
export const remember = (text) => write(pushCopy(read(), text));

/** listen for copies once: the page's copy event (a selection) and the clipboard writes its own buttons make. */
function listen() {
  if (globalThis.__copyStackOn) return;
  globalThis.__copyStackOn = true;
  document.addEventListener('copy', () => {
    try {
      const a = document.activeElement;
      const sel = a && typeof a.selectionStart === 'number' && a.selectionEnd > a.selectionStart ? String(a.value).slice(a.selectionStart, a.selectionEnd) : String(document.getSelection());
      remember(sel);
    } catch (_) { /* never break a copy */ }
  }, true);
  try {
    const cb = navigator.clipboard;
    if (cb && typeof cb.writeText === 'function' && !cb.writeText.__stacked) {
      const orig = cb.writeText.bind(cb);
      const wrapped = (t) => { remember(t); return orig(t); };
      wrapped.__stacked = true;
      cb.writeText = wrapped;
    }
  } catch (_) { /* a locked-down clipboard is left alone */ }
}

async function run(text, api) {
  const it = copyIntent(text);
  if (!it) return 'none';
  const stack = read();
  if (it.op === 'clear') { write([]); api.say('clipboard stack cleared'); return 'copy-stack'; }
  if (it.op === 'copy') {
    const t = stack[it.n - 1];
    if (!t) { api.say(stack.length ? 'only ' + stack.length + ' in the stack' : 'the stack is empty'); return 'copy-stack'; }
    let ok = false; try { await navigator.clipboard.writeText(t); ok = true; } catch (_) { /* needs a tap */ }
    api.say(ok ? 'copied again' : 'tap copy on the stack card');
    return 'copy-stack';
  }
  listPage(api, 'Clipboard stack', stack.map((t, i) => ({ text: t, sub: i === 0 ? 'newest' : '#' + (i + 1), full: t })), {
    action: 'copy', empty: 'Nothing copied on this page yet. The last ' + COPIES_MAX + ' copies show up here.', foot: 'The last ' + COPIES_MAX + ' copies made on this page, kept for this tab only. Keys and passwords are never kept.',
    onPick: async (r, b) => { let ok = false; try { await navigator.clipboard.writeText(r.full); ok = true; } catch (_) { /* no clipboard */ } b.textContent = ok ? 'copied' : 'not allowed'; },
  });
  return 'copy-stack';
}

export default {
  name: 'copy-stack',
  examples: ['show my clipboard stack', 'last 5 copies', 'copy item 2 from the clipboard stack', 'clear the clipboard stack'],
  nearMisses: ['ask clipboard', 'recent asks', 'copy this to the clipboard', 'what is a clipboard', 'copy the list to the notepad'],
  copyIntent,
  match(lower, text) { return !!copyIntent(text || lower); },
  run,
  decorate() { listen(); },
};
