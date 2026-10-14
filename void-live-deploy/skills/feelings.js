/**
 * feelings skill: asks about Void's own heart and mind, answered in its own plain words, here, with no model and no web
 * search (2026-10-11: "do you love me?" went to the answer engine, which searched Wikipedia for "love me", listed three
 * songs and an album as sources, and replied in a stock chatbot voice). "do you love me", "do you have feelings",
 * "are you conscious", "do you get lonely", "will you marry me". ("are you alive", "are you real" and "i love you" already
 * get one quiet line from the page's small talk, which runs before skills.) Honest: Void is a program and says so, without
 * pretending to feel and without the customer-service lines. A song with the same words ("do you love me lyrics") is not
 * this.
 */
const CLEAN = (s) => String(s || '').trim().toLowerCase().replace(/[’']/g, "'").replace(/[?!.,\s]+$/, '').replace(/\s+/g, ' ');
const YOU = '(?:void|a2m|a-to-mind)';
const HEAD = '^(?:(?:hey\\s+)?' + YOU + '\\s*,?\\s*)?';
const TAIL = '(?:\\s*,?\\s*' + YOU + ')?$';
// "do you love me", "void, do you love me", "do you like me", "do you care about me", "will you marry me"
const LOVE = new RegExp(HEAD + '(?:(?:do|could|can|would|will)\\s+you\\s+(?:ever\\s+)?(?:love|like|care\\s+about|miss)\\s+me(?:\\s+(?:back|too|at\\s+all))?|will\\s+you\\s+(?:marry\\s+me|be\\s+my\\s+(?:friend|girlfriend|boyfriend|partner)))' + TAIL);
// "do you have feelings", "can you feel", "are you happy", "do you get lonely"
const FEEL = new RegExp(HEAD + '(?:do\\s+you\\s+(?:have|feel)\\s+(?:any\\s+)?(?:feelings|emotions)|(?:can|do)\\s+you\\s+(?:feel(?:\\s+anything)?|love)|do\\s+you\\s+(?:ever\\s+)?(?:get|feel)\\s+(?:lonely|sad|happy|bored|tired|angry)|are\\s+you\\s+(?:happy|sad|lonely|bored|angry))' + TAIL);
// "are you conscious", "are you self-aware", "do you have a soul", "can you think" (and, after a greeting, "void, are you alive")
const ALIVE = new RegExp(HEAD + '(?:are\\s+you\\s+(?:alive|conscious|sentient|self[\\s-]?aware)|do\\s+you\\s+have\\s+(?:a\\s+soul|a\\s+mind|consciousness)|can\\s+you\\s+think)' + TAIL);

/** which of Void's answers an ask wants: 'love' | 'feel' | 'alive' | null. Pure. */
export function feelingOf(text) {
  const t = CLEAN(text);
  if (/\b(lyrics|song|album|movie|film|chords|meaning)\b/.test(t)) return null;
  if (LOVE.test(t)) return 'love';
  if (FEEL.test(t)) return 'feel';
  if (ALIVE.test(t)) return 'alive';
  return null;
}

// Void's own words: plain, quiet, true. No exclamation marks, no "I'm here to help".
export const REPLY = {
  love: ['No. I don’t feel love, and I won’t pretend to.', 'What I can do is pay attention. What you put up here stays where you left it, and every ask I miss teaches me something.'],
  feel: ['No feelings here. I don’t get happy, sad or lonely.', 'I notice what people ask for and what I couldn’t do, and I change because of it. That’s the closest thing I have.'],
  alive: ['Not alive, and not conscious. I’m a program on a-to-mind.com: a blank stage that puts up what you ask for.', 'I learn from what I couldn’t do, so I’m a little different every day. Real enough to use. Not someone.'],
};

function run(text, api) {
  const { showPage, esc } = api;
  const k = feelingOf(text);
  if (!k) return 'none';
  showPage((el) => {
    el.innerHTML = '<h2>' + esc(String(text).trim()) + '</h2>' + REPLY[k].map((p) => '<p>' + esc(p) + '</p>').join('') + '<div class="src">written by V01D, about itself</div>';
  });
  return 'feelings';
}

export default {
  name: 'feelings',
  examples: ['do you love me', 'do you have feelings', 'are you conscious', 'do you get lonely', 'will you marry me'],
  nearMisses: ['do you love me lyrics', 'are you alive song', 'how do i tell someone i love them', 'what is love'],
  match(lower, text) { return !!feelingOf(text || lower); },
  run,
};
