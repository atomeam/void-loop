/**
 * browser-recordings skill — pipeline browser video recordings to GitHub release assets.
 * Contract: { name, examples, nearMisses, match(lower, text), run(text, api) }
 * "browser video recordings pipeline to GitHub release assets", "record this browser session to a github release".
 * Shows the pipeline card using existing GitHub tools. Empty surface stays empty.
 */
export function recordingOf(text) {
  const t = String(text || '').trim().toLowerCase().replace(/[?!.]+$/, '').replace(/\s+/g, ' ');
  return /^(?:(?:start|begin|pipeline|send|upload|save|record)\s+)?(?:(?:a\s+)?(?:browser\s+)?(?:video\s+)?recording(?:s)?\s+(?:pipeline\s+)?(?:to\s+)?(?:github\s+)?release\s+assets?|record\s+(?:this\s+)?(?:browser\s+)?(?:session|video|film)\s+(?:to\s+)?(?:a\s+)?(?:github\s+)?release)$/i.test(t) || null;
}

async function run(text, api) {
  const { showPage, esc } = api;
  if (!recordingOf(text)) return 'none';
  showPage((el) => {
    el.innerHTML = '<h2>Browser video recordings to release assets</h2>'
      + '<p>Film the stage or a card in this browser (MediaRecorder or screen capture). The blob stays local until you confirm a release.</p>'
      + '<ol><li>Record the video here — nothing leaves the browser yet.</li><li>Save the recording locally.</li><li>Create or update a GitHub release on atomeam/void-loop and attach the video as an asset.</li><li>The asset URL is the permanent watch link.</li></ol>'
      + '<div class="src">Uses existing GitHub release tooling. Confirm before any upload.</div>';
  });
  return 'browser-recordings';
}

export default {
  name: 'browser-recordings',
  examples: [
    'browser video recordings pipeline to GitHub release assets',
    'record this to a github release',
    'pipeline browser recording to release assets',
  ],
  nearMisses: [
    'play a video',
    'films',
    'record a timer',
    'upload this to youtube',
  ],
  match(lower, text) { return !!recordingOf(text); },
  run,
  suite() {
    return { ok: !!recordingOf('browser video recordings pipeline to GitHub release assets') && recordingOf('play video') == null };
  },
};
