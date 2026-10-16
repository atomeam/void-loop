/**
 * video-pipeline skill: browser video recordings pipeline to GitHub release assets.
 * Contract: { name, examples, nearMisses, match(lower, text), run(text, api) }
 * "browser video recordings pipeline", "pipeline to GitHub release assets", "record video for release".
 * Shows the steps to record in the browser with MediaRecorder and attach the file as a GitHub release asset.
 * No secrets written, nothing uploaded from Void. Empty surface stays empty.
 */
export function wantsPipeline(text) {
  const t = String(text || '').trim().toLowerCase().replace(/[?!.]+$/, '').replace(/\s+/g, ' ');
  return /^(?:browser\s+)?video\s+recordings?\s+pipeline(?:\s+to\s+github\s+release\s+assets)?$|pipeline\s+to\s+(?:github\s+)?release\s+assets|record\s+(?:browser\s+)?video\s+for\s+release$/i.test(t);
}

function run(text, api) {
  const { showPage, esc } = api;
  if (!wantsPipeline(text)) return 'none';
  showPage((p) => {
    p.innerHTML = '<h2>Browser video → GitHub release assets</h2>'
      + '<ol><li>Capture in the browser: MediaRecorder on a canvas or video element, start/stop to get a Blob (webm).</li>'
      + '<li>Create or choose a GitHub release for the repo.</li>'
      + '<li>Upload the Blob as a release asset (via the UI or the releases API with your own token).</li>'
      + '<li>Use the asset download URL in film metadata or the /films/ page.</li></ol>'
      + '<p>Void stores no tokens and uploads nothing. The pipeline is the steps above.</p>'
      + '<div class="src">For automating Void’s films</div>';
  });
  return 'video-pipeline';
}

export default {
  name: 'video-pipeline',
  examples: ['browser video recordings pipeline', 'pipeline to GitHub release assets', 'record video for release'],
  nearMisses: ['play a video', 'video skill', 'youtube video', 'films'],
  match(lower, text) { return wantsPipeline(text); },
  run,
  suite() {
    return { ok: wantsPipeline('browser video recordings pipeline') && !wantsPipeline('play lofi beats') };
  },
};
