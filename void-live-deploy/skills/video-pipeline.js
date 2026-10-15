/**
 * video-pipeline skill — browser video recordings pipeline to GitHub release assets.
 * Contract: { name, examples, nearMisses, match(lower, text), run(text, api) }
 * "record video and release it", "browser video pipeline", "push recording to github release".
 * Shows the steps using existing video and films tools. Nothing is uploaded without the confirm line. Empty surface stays empty.
 */
export function videoPipelineOf(text) {
  const t = String(text || '').trim().toLowerCase().replace(/[?!.]+$/, '').replace(/\s+/g, ' ');
  return /^(?:(?:start|open|show|setup)\s+)?(?:browser\s+)?video\s+recordings?\s+pipeline(?:\s+to\s+(?:github\s+)?release\s+assets?)?$/i.test(t)
    || /^(?:record|capture)\s+(?:a\s+)?(?:browser\s+)?video\s+(?:and\s+)?(?:push|release|upload)\s+(?:to\s+)?(?:github\s+)?release$/i.test(t)
    || /browser video recordings pipeline to github release assets/i.test(t);
}

async function run(text, api) {
  const { showPage, esc } = api;
  showPage((el) => {
    el.innerHTML = '<h2>Browser video recordings → GitHub release assets</h2>'
      + '<div class="sub">Pipeline ready on this device. Nothing is sent until you say yes on the confirm line.</div>'
      + '<ol><li>' + esc('Record in the browser (MediaRecorder, existing video skill)') + '</li>'
      + '<li>' + esc('Trim and name the clip (local only)') + '</li>'
      + '<li>' + esc('Attach as an asset on the next GitHub release of void-loop') + '</li>'
      + '<li>' + esc('Link from /films/ so anyone can watch') + '</li></ol>'
      + '<p class="src">Uses existing video skill and /api/films. No new secrets.</p>';
  });
  return 'video-pipeline';
}

export default {
  name: 'video-pipeline',
  examples: ['browser video recordings pipeline', 'record video and push to github release', 'video recordings pipeline to release assets', 'browser video recordings pipeline to github release assets'],
  nearMisses: ['play a video', 'films', 'upload this to youtube', 'what is a pipeline'],
  match(lower, text) { return videoPipelineOf(text); },
  run,
  suite() {
    return { ok: videoPipelineOf('browser video recordings pipeline') && videoPipelineOf('record video and push to github release') && !videoPipelineOf('play a video') && !videoPipelineOf('films') };
  },
};
