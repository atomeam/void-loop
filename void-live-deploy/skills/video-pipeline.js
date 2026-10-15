/**
 * video-pipeline skill — browser video recordings pipeline to GitHub release assets.
 * Contract: { name, examples, nearMisses, match(lower, text), run(text, api) }
 * "recording pipeline", "browser videos to github releases", "how do recordings become releases".
 * Surfaces the existing record.yml / tools/record.mjs flow. Empty surface stays empty.
 */
export function pipelineOf(text) {
  const t = String(text || '').trim().toLowerCase().replace(/[?!.]+$/, '').replace(/\s+/g, ' ');
  return /^(?:browser\s+)?(?:video\s+)?recordings?\s+pipeline(?:\s+to\s+github(?:\s+release)?\s+assets?)?$/.test(t)
    || /^film(?:ing)?\s+pipeline$/.test(t)
    || /^how\s+do\s+(?:browser\s+)?recordings?\s+become\s+(?:github\s+)?releases?$/.test(t)
    || /^browser\s+video\s+recordings\s+pipeline\s+to\s+github\s+release\s+assets$/.test(t);
}

function run(text, api) {
  const { showPage, esc } = api;
  showPage((p) => {
    p.innerHTML = '<h2>Browser recordings → GitHub release assets</h2>'
      + '<ol><li>tools/record.mjs opens a lab experiment in Chromium and films it (WebM)</li><li>ffmpeg converts to MP4 (9:16, 15% faster, 1080×1920)</li><li>gh release create as a draft release tagged film-YYYYMMDD-id-rN</li><li>tools/film-post.mjs posts it to the site (R2) for members at /films/</li></ol>'
      + '<p>Daily schedule and on every deploy of main. Clips.yml does the same for ad Shorts. Ask <b>films</b> or <b>new films</b> to see them.</p>'
      + '<div class="src">.github/workflows/record.yml · tools/record.mjs · tools/film-post.mjs</div>';
  });
  return 'video-pipeline';
}

export default {
  name: 'video-pipeline',
  examples: ['browser video recordings pipeline to GitHub release assets', 'recording pipeline', 'how do recordings become releases', 'filming pipeline'],
  nearMisses: ['films', 'record a video', 'play a video', 'voids fillms'],
  match(lower, text) { return pipelineOf(text); },
  run,
  suite() {
    return { ok: pipelineOf('recording pipeline') === true && pipelineOf('hello') === false };
  },
};
