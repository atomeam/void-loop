/**
 * app skill - Verse as an app on your phone or computer: an Install button where the browser offers one, the steps where it doesn't
 * Contract: { name, examples, nearMisses, match(lower, text), run(text, api) }
 * Owner, 2026-10-14: "wheres my apps . web mobile? hows that all look". Verse installs from the browser (manifest.webmanifest, sw.js):
 * on its own window, from the home screen, with films one long-press away. Chrome and Edge offer the install (kept by void.html as
 * window.__v01dInstall); iPhone and iPad install through Safari's Share menu, so the card shows those steps instead.
 */
const APP = '(?:app|apps|application)';
const WHAT = "(?:void|v0id|v01d|this|the|your|a)";
const WHEN = new RegExp('^(?:'
  + '(?:get|download|install|add)\\s+(?:' + WHAT + '\\s+)?(?:' + APP + '|void|v01d|verse)(?:\\s+(?:on|to)\\s+(?:my\\s+)?(?:phone|iphone|android|home\\s*screen|desktop|computer|mac|pc))?'
  + '|(?:is\\s+there|do\\s+you\\s+have|where.?s|where\\s+is|wheres)\\s+(?:a|an|the|my|your)?\\s*(?:' + WHAT + '\\s+)?(?:mobile\\s+|phone\\s+|iphone\\s+|android\\s+|desktop\\s+)?' + APP
  + '|(?:' + WHAT + '\\s+)?(?:mobile|phone|iphone|ios|android|desktop)\\s+' + APP
  + '|(?:void|v01d|verse)\\s+' + APP
  + '|add\\s+to\\s+home\\s*screen'
  + '|' + APP
  + ')$', 'i');

export function wantsApp(lower) { return WHEN.test(String(lower || '').trim().replace(/[?!.]+$/, '').replace(/\s+/g, ' ')); }

const STYLE = `<style>
  .vapp { display: grid; gap: 14px; }
  .vapp .head { display: flex; align-items: center; gap: 14px; }
  .vapp .head img { width: 56px; height: 56px; border-radius: 14px; box-shadow: 0 8px 26px rgba(122,92,255,.35); }
  .vapp h2 { margin: 0; font-size: 24px; letter-spacing: -.01em; }
  .vapp .sub { margin: 2px 0 0; opacity: .75; font-size: 14px; }
  .vapp .go { justify-self: start; display: inline-flex; align-items: center; gap: 10px; padding: 12px 22px; border-radius: 999px; border: 0; cursor: pointer;
    font: inherit; font-weight: 700; color: #fff; background: linear-gradient(90deg, #ff3d7f, #7a5cff); box-shadow: 0 8px 26px rgba(255,61,127,.38); }
  .vapp .go:hover, .vapp .go:focus-visible { box-shadow: 0 12px 34px rgba(255,61,127,.55); }
  .vapp ol { margin: 0; padding-left: 20px; display: grid; gap: 6px; }
  .vapp .why { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; }
  .vapp .why div { padding: 10px; border-radius: 12px; background: rgba(255,255,255,.05); border: 1px solid rgba(255,255,255,.08); font-size: 13px; line-height: 1.35; }
  .vapp .why b { display: block; font-size: 14px; margin-bottom: 2px; }
  .vapp .said { min-height: 1em; font-size: 14px; opacity: .85; }
</style>`;

// where this browser is: 'installed' (running as the app), 'prompt' (the browser offered the install), 'ios', 'android', 'desktop'
export function placeOf(w = typeof window !== 'undefined' ? window : {}) {
  const nav = w.navigator || {}, ua = String(nav.userAgent || '');
  const standalone = nav.standalone === true || !!(w.matchMedia && (w.matchMedia('(display-mode: standalone)').matches || w.matchMedia('(display-mode: window-controls-overlay)').matches));
  if (standalone || w.__v01dInstalled) return 'installed';
  if (w.__v01dInstall) return 'prompt';
  if (/iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && nav.maxTouchPoints > 1)) return 'ios';
  if (/Android/.test(ua)) return 'android';
  return 'desktop';
}

const STEPS = {
  ios: ['Open a-to-mind.com in Safari.', 'Tap the Share button (the square with the arrow).', 'Tap “Add to Home Screen”, then Add.'],
  android: ['Open a-to-mind.com in Chrome.', 'Tap the ⋮ menu.', 'Tap “Install app” (or “Add to Home screen”).'],
  desktop: ['Open a-to-mind.com in Chrome or Edge.', 'Click the install icon at the right of the address bar (or ⋮ menu → “Install Verse”).', 'Verse opens in its own window, with its own icon.'],
};

function run(text, api) {
  const { showPage, esc } = api;
  const place = placeOf();
  showPage((el) => {
    const top = place === 'installed' ? 'You’re in the app.' : 'On your phone and your computer.';
    let body = '';
    if (place === 'installed') body = '<p>' + esc('Verse is installed here. Long-press its icon for Films and What’s new.') + '</p>';
    else if (place === 'prompt') body = '<button class="go" type="button">' + esc('Install Verse') + '</button><div class="said" aria-live="polite"></div>';
    else body = '<ol>' + STEPS[place].map((s) => '<li>' + esc(s) + '</li>').join('') + '</ol>';
    el.innerHTML = STYLE + '<div class="vapp">'
      + '<div class="head"><img src="/icon-192.png" alt=""><div><h2>' + esc('Get the Verse app') + '</h2><p class="sub">' + esc(top) + '</p></div></div>'
      + body
      + '<div class="why"><div><b>' + esc('Its own icon') + '</b>' + esc('One tap from your home screen or dock.') + '</div>'
      + '<div><b>' + esc('Its own window') + '</b>' + esc('No tabs, no address bar: just the stage.') + '</div>'
      + (place === 'ios' // iOS has no share target for web apps: say what is true there
        ? '<div><b>' + esc('Full screen') + '</b>' + esc('Opens edge to edge, like any app on your phone.') + '</div></div>'
        : '<div><b>' + esc('Share to it') + '</b>' + esc('Send a link from any app straight onto your stage.') + '</div></div>')
      + '<div class="src">' + esc('Installs from the browser: no store, no account, nothing to update') + '</div></div>';
    const go = el.querySelector('.go');
    if (go) go.addEventListener('click', async () => {
      const e = window.__v01dInstall, said = el.querySelector('.said');
      if (!e) { said.textContent = 'Your browser took the offer back: use its menu → Install Verse.'; return; }
      try { await e.prompt(); const c = await e.userChoice; window.__v01dInstall = null; said.textContent = c && c.outcome === 'accepted' ? 'Installed. Find Verse on your home screen or in your apps.' : 'Not installed. Ask “get the app” again any time.'; }
      catch (_) { said.textContent = 'Your browser didn’t open the install: use its menu → Install Verse.'; }
    });
  });
  return 'app';
}

export default {
  name: 'app',
  examples: [
    'get the app',
    'install void',
    'is there an app',
    'download the app',
    'wheres the app',
    'iphone app',
    'add to home screen',
    'v01d app',
  ],
  nearMisses: [
    'best budgeting apps',
    'app ideas',
    'how do I make an app',
    'apple',
    'apps for kids',
  ],
  match(lower) { return wantsApp(lower); },
  run,
};
