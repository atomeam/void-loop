/**
 * video-gen skill: "animate a cat chasing yarn", "animate waves on a beach" (owner, 2026-10-30: "same with image and video ... we should have
 * the best of everything"). The stage card for the AI video generator: it names the clip, says whether video is on right now (GET /api/clip,
 * the page's own state line), and links to /video/ with the words filled in. No clip is made here; a clip is made only on the page's Make
 * press. "animate a picture" opens /video/ itself (lib/toolkit.js), so it is a near miss here. Made with tools/new-skill.mjs (docs/UPGRADING.md).
 * Contract: { name, examples, nearMisses, match(lower, text), run(text, api) }
 */
import { PROMPT_MAX } from '../lib/video-gen.js';

const WHEN = /^animate (?!(?:a |my |this |the )?(?:picture|image|photo)s?$)(.{3,})$/i;

/** the clip's words from the ask, or '' (pure) */
export function clipWords(text) {
  const m = String(text || '').trim().replace(/[?!.]+$/, '').match(WHEN);
  return m ? m[1].trim().slice(0, PROMPT_MAX) : '';
}

/** how long ago an ISO time was, in plain words, or '' (pure) */
export function agoWords(iso, now = Date.now()) {
  const t = Date.parse(iso || ''), m = Math.round((now - t) / 60000);
  if (!Number.isFinite(t) || m < 0) return '';
  return m < 2 ? 'just now' : m < 90 ? m + ' minutes ago' : Math.round(m / 60) + ' hours ago';
}
/** the card's state line from GET /api/clip: on or off in the route's own words, then when Verse last tested the video model.
 *  That test runs at most every 6 hours, and tools/video-live.mjs reads this route from GitHub every 6 hours so it never goes stale. (pure) */
export function stateLine(j, now = Date.now()) {
  const state = j && j.on ? 'Video is on. ' + (Number(j.clipsLeft) || 0) + ' short clips left today for everyone.' : String((j && j.say) || 'Video is off right now.');
  const ago = agoWords(j && j.checkedAt, now);
  return state + (ago ? ' Verse last tested the video model ' + ago + '.' : '');
}

function run(text, api) {
  const { showPage, esc } = api, words = clipWords(text), href = '/video/?prompt=' + encodeURIComponent(words).replace(/[!'()*]/g, (c) => '%' + c.charCodeAt(0).toString(16).toUpperCase()); // %20, not +: lib/card-frame.js pageOfCard links only a plain query
  showPage((el) => {
    el.dataset.page = href;
    el.innerHTML = '<h2>' + esc('Animate: ' + words) + '</h2>' // void-review: ok: every piece escaped
      + '<p class="vg-state">Checking whether video is on…</p>'
      + '<p><a href="' + esc(href) + '">Open the AI video generator with these words</a></p>'
      + '<div class="src">A short clip (2, 3 or 5 seconds) from a partner video model on Workers AI, made only when you press Make on the page.</div>';
    const line = el.querySelector('.vg-state');
    fetch('/api/clip', { cache: 'no-store' }).then((r) => r.json()).then((j) => {
      if (!line) return;
      line.textContent = stateLine(j);
    }).catch(() => { if (line) line.textContent = 'Could not check video just now; the page says whether it is on.'; });
  });
  return 'video-gen';
}

export default {
  name: 'video-gen',
  examples: ['animate a cat chasing yarn', 'animate waves on a beach at sunset'],
  nearMisses: ['animate a picture', 'play a video of a cat'],
  match(lower) { return !!clipWords(lower); },
  run
};
