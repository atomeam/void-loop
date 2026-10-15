/**
 * video-release skill — browser video recordings pipeline to GitHub release assets.
 * Contract: { name, examples, nearMisses, match(lower, text), run(text, api) }
 * "pipeline my video recordings to github releases", "upload browser recording as release asset".
 * Returns a JSON description of the pipeline (no secrets, empty surface stays empty).
 * Uses existing tools where possible; does not invent tokens.
 */
export function videoReleaseOf(text) {
  const t = String(text || '').trim().toLowerCase().replace(/[?!.]+$/, '').replace(/\s+/g, ' ');
  return /^(?:pipeline|upload|send|export)\s+(?:my\s+|the\s+)?(?:browser\s+)?video\s+recordings?\s+(?:to|as)\s+(?:github\s+)?release\s+assets?$/.test(t)
    || /^(?:github\s+)?release\s+asset\s+pipeline\s+for\s+videos?$/.test(t);
}

async function run(text, api) {
  if (!videoReleaseOf(text)) return 'none';
  const { showPage, esc } = api;
  const pipeline = {
    steps: [
      "Record in browser (MediaRecorder API)",
      "Download the webm/mp4 locally",
      "Use existing GitHub release tools (gh release upload) once a tag exists",
      "Attach as asset; no new secrets written"
    ],
    note: "Empty surface stays empty. No Cloudflare tokens invented. Uses what exists."
  };
  const json = JSON.stringify(pipeline, null, 2);
  showPage((p) => {
    p.innerHTML = '<h2>Browser video recordings pipeline</h2><pre style="white-space:pre-wrap;font-size:12px">' + esc(json) + '</pre><div class="src">Pipeline description only · no upload performed</div>';
  });
  return 'video-release';
}

export default {
  name: 'video-release',
  examples: ['pipeline my video recordings to github releases', 'upload browser recording as release asset'],
  nearMisses: ['play a video', 'record a video', 'github'],
  match(lower, text) { return videoReleaseOf(text); },
  run,
  suite() {
    return { ok: videoReleaseOf('pipeline my video recordings to github releases') && !videoReleaseOf('hello') };
  },
};
