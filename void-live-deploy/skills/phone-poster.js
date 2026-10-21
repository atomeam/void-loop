/**
 * phone-poster skill — auto-generates promotional phone-cut (phone-story) posters for Verse films.
 * Asks: "phone cut film poster", "auto generate promotional poster", "phone story for newest film".
 * Uses the existing poster skill (which already supports film posters and the 9:16 phone story size) and films metadata.
 * Empty stage stays empty until asked.
 */
import poster from './poster.js';

export function phonePosterOf(text) {
  const t = String(text || '').trim().toLowerCase().replace(/[?!.]+$/, '').replace(/\s+/g, ' ');
  return /^(?:auto[- ]?generate|make|create|show|give me)\s+(?:a\s+)?(?:promotional\s+)?(?:phone[- ]?cut\s+|phone[- ]?story\s+)?(?:poster|promo)(?:\s+for\s+(?:the\s+)?(?:newest\s+|latest\s+)?film)?$|^phone[- ]?cut\s+films?\s+(?:skill\s+)?poster|promotional\s+poster\s+for\s+(?:the\s+)?film$/.test(t);
}

function run(text, api) {
  // Delegate to the poster skill's film poster path, which already draws the phone-story size first.
  return poster.run('make a poster for the newest film', api);
}

/** one suite check: the ask matches, near-misses do not */
export function suite() {
  const yes = phonePosterOf('phone cut film poster') && phonePosterOf('auto generate promotional poster');
  const no = !phonePosterOf('what is a poster') && !phonePosterOf('make this a poster');
  return yes && no;
}

export default {
  name: 'phone-poster',
  examples: [
    'phone cut film poster',
    'auto generate promotional poster',
    'phone story for newest film',
    'promotional poster for the film',
    'phone-cut films skill poster',
  ],
  nearMisses: [
    'what is a poster',
    'make this a poster',
    'film metadata',
    'show the films',
  ],
  match(lower, text) { return phonePosterOf(text); },
  run,
  suite,
};
