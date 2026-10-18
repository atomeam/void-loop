/**
 * ask-clipboard skill — clipboard of recent asks + re-run by index.
 * Idea-bank #89–90 (utility/growth, unclaimed by stage packs A/B).
 * "ask clipboard", "show ask clipboard", "re-run the third recent ask",
 * "run ask 2 again", "clipboard of recent asks".
 * Reuses localStorage key from recent.js. Empty surface stays empty.
 */

const ASKS_KEY = 'a2m.void.asks.v1';

const CLEAN = (s) => String(s || '').trim().toLowerCase().replace(/[?!.]+$/, '').replace(/\s+/g, ' ');

function loadAsks(store) {
  const bag = store || (typeof localStorage !== 'undefined' ? localStorage : null);
  if (!bag) return [];
  try {
    const raw = JSON.parse(bag.getItem(ASKS_KEY) || '[]');
    return Array.isArray(raw) ? raw.filter((s) => typeof s === 'string' && s.trim()).slice(0, 12) : [];
  } catch (_) {
    return [];
  }
}

/** Parse → { action: 'show' } | { action: 'rerun', index: number } | null */
export function clipboardOf(text) {
  const t = CLEAN(text);

  if (/^(?:(?:show|open)\s+)?(?:the\s+)?(?:ask\s+)?clipboard(?:\s+of\s+recent\s+asks)?$/.test(t) ||
      /^clipboard\s+of\s+recent\s+asks$/.test(t) ||
      /^ask\s+clipboard$/.test(t)) {
    return { action: 'show' };
  }

  // "re-run the third recent ask", "run ask 2 again", "rerun the 1st ask"
  let m = t.match(/^(?:re-?run|run|replay)\s+(?:the\s+)?(?:(\d+)(?:st|nd|rd|th)?|first|second|third|fourth|fifth|last)\s+(?:recent\s+)?ask(?:\s+again)?$/);
  if (!m) m = t.match(/^(?:re-?run|run)\s+ask\s+(\d+)(?:\s+again)?$/);
  if (m) {
    const word = { first: 1, second: 2, third: 3, fourth: 4, fifth: 5, last: 1 };
    let n = word[m[1]] || parseInt(m[1], 10);
    if (!n || n < 1) return null;
    return { action: 'rerun', index: n };
  }
  return null;
}

async function run(text, api) {
  const want = clipboardOf(text);
  if (!want) return 'none';

  const asks = loadAsks();
  const { showPage, esc, say, ask: submitAsk } = api;

  if (want.action === 'rerun') {
    const i = want.index - 1;
    if (!asks.length) {
      if (say) say('no recent asks yet');
      return 'ask-clipboard';
    }
    if (i < 0 || i >= asks.length) {
      if (say) say('only ' + asks.length + ' recent ask' + (asks.length === 1 ? '' : 's') + ' · pick 1–' + asks.length);
      return 'ask-clipboard';
    }
    const chosen = asks[i];
    if (say) say('re-running: ' + chosen);
    if (typeof submitAsk === 'function') {
      submitAsk(chosen);
    } else if (typeof api.runAsk === 'function') {
      api.runAsk(chosen);
    } else if (showPage) {
      showPage((p) => {
        p.innerHTML =
          '<h2>Re-run ask</h2>' +
          '<p class="sub">#' + want.index + '</p>' +
          '<p><a href="#" data-ask="' + esc(chosen) + '">' + esc(chosen) + '</a></p>' +
          '<div class="src">Tap to send again · saved only in this browser</div>';
      });
    }
    return 'ask-clipboard';
  }

  // show clipboard
  if (!showPage) {
    if (say) say(asks.length ? asks.map((a, i) => (i + 1) + '. ' + a).join(' · ') : 'clipboard is empty');
    return 'ask-clipboard';
  }

  showPage((p) => {
    if (!asks.length) {
      p.innerHTML =
        '<h2>Ask clipboard</h2>' +
        '<p>Nothing yet. Asks you make stay in this browser.</p>' +
        '<div class="src">Empty surface stays empty · local only</div>';
      return;
    }
    const list = asks
      .map((a, i) =>
        '<li style="margin:6px 0">' +
        '<span style="opacity:.5;margin-right:8px">' + (i + 1) + '</span>' +
        '<a href="#" data-ask="' + esc(a) + '">' + esc(a) + '</a></li>'
      )
      .join('');
    p.innerHTML =
      '<h2>Ask clipboard</h2>' +
      '<p class="sub">Tap to re-run · or say "re-run the third recent ask"</p>' +
      '<ol style="list-style:none;padding:0;margin:8px 0">' + list + '</ol>' +
      '<div class="src">Saved only in this browser · same store as recent asks</div>';
  });
  return 'ask-clipboard';
}

export default {
  name: 'ask-clipboard',
  examples: [
    'ask clipboard',
    'show ask clipboard',
    'clipboard of recent asks',
    're-run the third recent ask',
    'run ask 2 again',
  ],
  nearMisses: [
    'recent asks',
    'what did I ask',
    'copy to clipboard',
    'system clipboard',
    'paste',
  ],
  match(lower, text) {
    return !!clipboardOf(text || lower);
  },
  run,
  clipboardOf,
  suite() {
    const a = clipboardOf('ask clipboard');
    const b = clipboardOf('re-run the third recent ask');
    const c = clipboardOf('run ask 2 again');
    const d = clipboardOf('recent asks');
    return {
      ok:
        !!a && a.action === 'show' &&
        !!b && b.action === 'rerun' && b.index === 3 &&
        !!c && c.action === 'rerun' && c.index === 2 &&
        d === null,
    };
  },
};
