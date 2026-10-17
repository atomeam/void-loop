/**
 * video-release-note skill — prepares a release note for a browser video recording aimed at GitHub release assets.
 * Contract: { name, examples, nearMisses, match(lower, text), run(text, api) }
 * "video recording release note", "prepare browser video for github release".
 * Shows a card with a suggested release note and asset name. No upload, no token. Empty surface stays empty.
 * Pipeline step for ask-20261014-2134-2.
 */
const WHEN = /^(?:video\s+recording\s+release\s+note|prepare\s+browser\s+video\s+for\s+github\s+release)$/i;

export function noteOf(text) {
  const t = String(text || '').trim();
  if (!WHEN.test(t)) return null;
  return {
    asset: 'void-browser-recording-' + new Date().toISOString().slice(0, 10) + '.webm',
    note: 'Browser video recording of a Void skill walkthrough. Captured with the page recorder. Ready for the next GitHub release assets.',
    steps: ['Record on the stage', 'Download the webm', 'Attach to the release', 'Link from the films page']
  };
}

async function run(text, api) {
  const { showPage, esc } = api;
  const n = noteOf(text);
  if (!n) return 'none';
  showPage((el) => {
    el.innerHTML = '<h2>Video release note</h2><div class="sub">for GitHub release assets</div>'
      + '<p><b>Asset:</b> ' + esc(n.asset) + '</p>'
      + '<p>' + esc(n.note) + '</p>'
      + '<ol>' + n.steps.map((s) => '<li>' + esc(s) + '</li>').join('') + '</ol>'
      + '<div class="src">Pipeline note only · no upload · empty until asked</div>';
  });
  return 'video-release-note';
}

export function suite() {
  const n = noteOf('video recording release note');
  const ok = n && n.asset.includes('.webm') && noteOf('video') === null;
  return { ok, got: ok ? '' : JSON.stringify(n) };
}

export default {
  name: 'video-release-note',
  examples: ['video recording release note', 'prepare browser video for github release'],
  nearMisses: ['video', 'films'],
  suite,
  match(lower, text) { return !!noteOf(text || lower); },
  run
};
