/**
 * video-release skill — browser video recordings pipeline to GitHub release assets (open inbox row).
 * Empty surface: the pipeline waits on owner for token and release setup. Uses existing video skill for playback.
 * "video release", "record this to release", "pipeline for recordings".
 */
export function wantsRelease(text) {
  const t = String(text || '').trim().toLowerCase();
  return /video release|recordings pipeline|release assets/.test(t);
}
export default {
  name: 'video-release',
  examples: ['video release', 'recordings pipeline', 'pipeline for browser video recordings'],
  nearMisses: ['play a video', 'record me'],
  match(lower, text) { return wantsRelease(text); },
  run(text, api) {
    const { showPage } = api;
    showPage((p) => { p.innerHTML = '<h2>Video release pipeline</h2><p>The pipeline to GitHub release assets is open: it waits for the owner to enable the path. Use the video skill to play recordings today.</p>'; });
    return 'video-release';
  },
  suite() { return { ok: wantsRelease('video release') && !wantsRelease('play video') }; },
};
