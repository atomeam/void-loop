/**
 * record-pipeline skill — browser video recordings pipeline to GitHub release assets.
 * Contract: { name, examples, nearMisses, match(lower, text), run(text, api) }
 * "browser video recordings pipeline", "how do films get to GitHub releases", "record pipeline".
 * Explains the existing tools/record.mjs + record.yml workflow that films experiments in a browser
 * and posts draft GitHub Releases (MP4 + text). Empty surface stays empty.
 */
export function pipelineOf(text) {
  const t = String(text || '').trim().toLowerCase().replace(/[?!.]+$/, '').replace(/\s+/g, ' ');
  return /^(?:browser\s+)?video\s+recordings?\s+pipeline(?:\s+to\s+github(?:\s+release\s+assets)?)?$|^how\s+(?:do|does)\s+(?:the\s+)?(?:films?|videos?|recordings?)\s+(?:get\s+to|reach)\s+github(?:\s+releases?)?$|^record\s+pipeline$|^github\s+release\s+assets\s+for\s+(?:films?|videos?)$/.test(t);
}

function run(text, api) {
  const { showPage, esc } = api;
  if (!pipelineOf(text)) return 'none';
  showPage((el) => {
    el.innerHTML = '<h2>Browser video recordings pipeline</h2>'
      + '<p>' + esc('Void films its own experiments in a real browser (tools/record.mjs), converts to phone-cut MP4, and posts each as a draft GitHub Release (MP4 + title/description/tags). The workflow is .github/workflows/record.yml: daily and after every deploy.') + '</p>'
      + '<ol><li>' + esc('Open a lab experiment in Chromium') + '</li><li>' + esc('Film 20 seconds with captions from the fringe ledger') + '</li><li>' + esc('ffmpeg to 1080×1920 MP4 (15% faster)') + '</li><li>' + esc('gh release create --draft film-YYYYMMDD-id-rN') + '</li></ol>'
      + '<p class="src">' + esc('See tools/record.mjs and .github/workflows/record.yml. Films appear at a-to-mind.com/films/ for members.') + '</p>';
  });
  return 'record-pipeline';
}

export default {
  name: 'record-pipeline',
  examples: ['browser video recordings pipeline', 'how do films get to GitHub releases', 'record pipeline', 'github release assets for films'],
  nearMisses: ['films', 'upload this to youtube', 'make a video', 'what is a pipeline'],
  match(lower, text) { return pipelineOf(text); },
  run,
  suite() {
    return { ok: pipelineOf('browser video recordings pipeline') && pipelineOf('record pipeline') && !pipelineOf('films') && !pipelineOf('hello') };
  },
};
