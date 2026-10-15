/**
 * video-pipeline skill — browser video recordings pipeline to GitHub release assets.
 * Contract: { name, examples, nearMisses, match(lower, text), run(text, api) }
 * "browser video recordings pipeline", "how films get to github releases", "video recordings to release assets".
 * Surfaces the live record.yml and clips.yml pipelines. Empty surface stays empty.
 * No secrets written; nothing is uploaded from this skill.
 */
export function pipelineOf(text) {
  const t = String(text || '').trim().toLowerCase().replace(/[?!.]+$/, '').replace(/\s+/g, ' ');
  if (/^(?:browser\s+)?video\s+recordings?\s+pipeline(?:\s+to\s+(?:github\s+)?release\s+assets?)?$/.test(t)) return true;
  if (/^(?:how\s+(?:do|are)\s+)?(?:films?|videos?|recordings?)\s+(?:get|go|uploaded?)\s+to\s+(?:github\s+)?releases?$/.test(t)) return true;
  if (/^video\s+pipeline$/.test(t)) return true;
  if (/^(?:show|open)\s+(?:the\s+)?(?:browser\s+)?recordings?\s+pipeline$/.test(t)) return true;
  return false;
}

async function run(text, api) {
  const { showPage, esc } = api;
  if (!pipelineOf(text)) return 'none';
  showPage((el) => {
    el.innerHTML = '<h2>Browser video recordings → GitHub releases</h2>'
      + '<p>V01D already films itself and keeps every film as a draft GitHub Release (MP4 + words).</p>'
      + '<ol>'
      + '<li>' + esc('record.yml (daily + after each deploy): tools/record.mjs opens a lab experiment in a real browser, films it, converts to 9:16 MP4, and creates a draft release tagged film-YYYYMMDD-…') + '</li>'
      + '<li>' + esc('clips.yml (daily ads): tools/clips.mjs films the live site, renders Shorts, and keeps the batch as a draft release.') + '</li>'
      + '<li>' + esc('The owner reviews the draft, then uploads to YouTube by hand (or automatic when YT_UPLOAD=1). Nothing is public until then.') + '</li>'
      + '</ol>'
      + '<p class="src">Live: .github/workflows/record.yml and clips.yml · tools/record.mjs · tools/clips.mjs</p>'
      + '<div class="src">Empty stage stays empty. This card appears only when asked.</div>';
  });
  return 'video-pipeline';
}

export default {
  name: 'video-pipeline',
  examples: ['browser video recordings pipeline', 'how films get to github releases', 'video recordings to release assets', 'video pipeline'],
  nearMisses: ['play a video', 'films', 'upload this to youtube', 'what is github'],
  match(lower, text) { return pipelineOf(text); },
  run,
  suite() {
    return { ok: pipelineOf('browser video recordings pipeline') && pipelineOf('how films get to github releases') && !pipelineOf('hello') };
  },
};
