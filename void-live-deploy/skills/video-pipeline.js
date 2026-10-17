/**
 * video-pipeline skill — browser video recordings pipeline to GitHub release assets.
 * "video recordings pipeline", "upload browser video to github release", "recordings to release assets".
 * Empty surface stays empty. Informational card; no secrets, no direct upload without approval.
 */
export function videoPipelineOf(text) {
  const t = String(text || '').trim().toLowerCase().replace(/[?!.]+$/, '').replace(/\s+/g, ' ');
  return /^(?:browser\s+)?video\s+recordings?\s+pipeline|^(?:upload|send)\s+(?:browser\s+)?(?:video|recordings?)\s+(?:to\s+)?(?:github\s+)?release(?:\s+assets)?$/.test(t);
}

function run(text, api) {
  const { showPage, esc } = api;
  if (!videoPipelineOf(text)) return 'none';
  showPage((p) => {
    p.innerHTML = '<h2>Browser video recordings pipeline</h2>'
      + '<div class="sub">Path to GitHub release assets</div>'
      + '<ol><li>Record in browser (existing video skill or canvas capture)</li><li>Prepare asset (blob to file)</li><li>Confirm line for owner yes (no auto-upload)</li><li>GitHub release asset once token path is set</li></ol>'
      + '<p>Uses existing tools. Empty stage stays empty. Nothing sent without yes.</p>'
      + '<div class="src">Follow-on to video skill. No secrets written.</div>';
  });
  return 'video-pipeline';
}

export default {
  name: 'video-pipeline',
  examples: ['video recordings pipeline', 'upload browser video to github release', 'recordings to release assets'],
  nearMisses: ['play video', 'video skill', 'download video'],
  match(lower, text) { return videoPipelineOf(text); },
  run,
  suite() {
    return { ok: videoPipelineOf('video recordings pipeline') && !videoPipelineOf('hello world') };
  },
};
