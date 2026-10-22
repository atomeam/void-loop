/**
 * dismiss-recent — clear the "Recently built" / "I built this" walkthrough on this device.
 * "clear recently built", "dismiss recently built", "hide what you made", "clear the 169".
 * Writes a2m.void.recentDismissed.v1 and removes the showcase panel/bell; does not clear stage or cards.
 */
const KEY = 'a2m.void.recentDismissed.v1';
const CLEAN = (s) => String(s || '').trim().toLowerCase().replace(/[’']/g, "'").replace(/[?!.]+$/, '').replace(/\s+/g, ' ');
const ASK = /^(?:(?:please\s+)?(?:clear|dismiss|hide|close|stop)\s+(?:the\s+)?(?:recently\s+built|recent\s+builds?|i\s+built\s+this|what\s+you\s+made|showcase|whats?\s*new\s+panel|the\s+169)|clear\s+the\s+169)$/;

export function dismissRecentOf(text) {
  return ASK.test(CLEAN(text));
}

function run(text, api) {
  if (!dismissRecentOf(text)) return 'none';
  const at = new Date().toISOString().replace(/\.\d+Z$/, 'Z');
  try { localStorage.setItem(KEY, at); } catch (_) {}
  try {
    document.getElementById('showcase-bar')?.remove();
    document.getElementById('showcase-scrim')?.remove();
    document.getElementById('whatsnew-bell')?.remove();
    const note = document.getElementById('away-note');
    if (note) note.textContent = '';
  } catch (_) {}
  if (api && api.say) api.say('cleared recently built on this device');
  if (api && api.showPage) {
    api.showPage((el) => {
      el.innerHTML = '<h2>Recently built cleared</h2><p class="sub">Dismissed on this device through ' + at + '. Your stage and cards were not touched.</p><div class="src">Source: this browser only · key ' + KEY + '</div>';
    });
  }
  return 'dismiss-recent';
}

export default {
  name: 'dismiss-recent',
  examples: ['clear recently built', 'dismiss recently built', 'hide what you made', 'clear the 169'],
  nearMisses: ['clear the stage', 'forget me', 'reset my void'],
  match(lower, text) { return dismissRecentOf(text || lower); },
  run,
  dismissRecentOf,
};
