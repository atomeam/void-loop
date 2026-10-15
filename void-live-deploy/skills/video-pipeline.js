/**
 * video-pipeline skill — browser video recordings pipeline to GitHub release assets.
 * Contract: { name, examples, nearMisses, match(lower, text), run(text, api) }
 * "video recordings pipeline", "upload browser recordings to github releases", "recordings to release assets".
 * Shows a card with the pipeline steps (no secrets written). Empty surface stays empty.
 */
export function pipelineOf(text) {
  const t = String(text || '').trim().toLowerCase().replace(/[?!.]+$/, '').replace(/\s+/g, ' ');
  return /^(?:browser\s+)?(?:video\s+)?recordings?\s+pipeline(?:\s+to\s+github(?:\s+release(?:s)?)?(?:\s+assets)?)?$|^(?:upload|send|pipe)\s+(?:browser\s+)?(?:video\s+)?recordings?\s+(?:to\s+)?github(?:\s+releases?)?$/.test(t);
}

async function run(text, api) {
  const { showPage, esc } = api;
  if (!pipelineOf(text)) return 'none';
  const el = showPage((p) => {
    p.innerHTML = '<h2>Browser video recordings pipeline</h2>'
      + '<div class="sub">to GitHub release assets</div>'
      + '<ol><li>Record in the browser (MediaRecorder or Void\'s film tools).</li>'
      + '<li>Save the .webm or .mp4 locally.</li>'
      + '<li>Create a GitHub release on the repo (or use the existing films release).</li>'
      + '<li>Upload the file as a release asset with <code>gh release upload</code> or the API (token stays in the runner secrets).</li>'
      + '<li>Link the asset from the film card or /films/ page.</li></ol>'
      + '<p>Nothing is uploaded from this page. The pipeline runs in CI or a helper with the proper token. Empty surface stays empty.</p>'
      + '<div class="src">Asked by Void · 2026-10-15</div>';
  });
  return 'video-pipeline';
}

export default {
  name: 'video-pipeline',
  examples: ['video recordings pipeline', 'browser video recordings pipeline to GitHub release assets', 'upload browser recordings to github releases'],
  nearMisses: ['video', 'recordings', 'github'],
  match(lower, text) { return pipelineOf(text); },
  run,
  suite() {
    return { ok: pipelineOf('video recordings pipeline') === true && pipelineOf('hello') === false };
  },
};
