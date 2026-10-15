/**
 * video-recordings skill — browser video recordings pipeline to GitHub release assets.
 * Contract: { name, examples, nearMisses, match(lower, text), run(text, api) }
 * "browser video recordings", "upload recording to release", "pipeline recordings to github".
 * Prepares the recording card and notes the upload path (needs write token). Empty surface stays empty.
 */
export function videoRecordingsOf(text) {
  const t = String(text || '').trim().toLowerCase().replace(/[?!.]+$/, '').replace(/\s+/g, ' ');
  return /^(?:(?:show|open|start)\s+)?(?:the\s+)?(?:browser\s+)?video\s+recordings?(?:\s+pipeline)?(?:\s+to\s+(?:github\s+)?release\s+assets?)?$/i.test(t)
    || /pipeline\s+(?:browser\s+)?video\s+recordings?\s+to\s+github\s+release/i.test(t);
}

async function run(text, api) {
  const { showPage, esc } = api;
  if (!videoRecordingsOf(text)) return 'none';
  const el = showPage((p) => {
    p.innerHTML = '<h2>Browser video recordings</h2><div class="sub">pipeline to GitHub release assets</div><p>Record a clip in the browser (MediaRecorder), then the upload path attaches it as a release asset. Needs a write token on the path (scoped with the films track). Nothing is uploaded from here yet.</p><div class="src">Empty surface stays empty. Ask again after the token is set.</div>';
  });
  return 'video-recordings';
}

export default {
  name: 'video-recordings',
  examples: ['browser video recordings', 'video recordings pipeline', 'pipeline recordings to github release', 'browser video recordings pipeline to GitHub release assets'],
  nearMisses: ['play video', 'record a note', 'video play', 'films'],
  match(lower, text) { return videoRecordingsOf(text); },
  run,
  suite() {
    return { ok: videoRecordingsOf('browser video recordings') && videoRecordingsOf('pipeline recordings to github release') && !videoRecordingsOf('play video') && !videoRecordingsOf('films') };
  },
};
