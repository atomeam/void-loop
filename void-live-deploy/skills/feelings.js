/**
 * feelings skill: asks about Verse's own heart and mind, answered in its own plain words, here, with no model and no web
 * search (2026-10-11: "do you love me?" went to the answer engine, which searched Wikipedia for "love me", listed three
 * songs and an album as sources, and replied in a stock chatbot voice). "do you love me", "do you have feelings",
 * "are you conscious", "do you get lonely", "will you marry me". ("are you alive", "are you real" and "i love you" already
 * get one quiet line from the page's small talk, which runs before skills.) Honest: Verse is a program and says so, without
 * pretending to feel and without the customer-service lines. A song with the same words ("do you love me lyrics") is not
 * this.
 */
const CLEAN = (s) => String(s || '').trim().toLowerCase().replace(/[’']/g, "'").replace(/[?!.,\s]+$/, '').replace(/\s+/g, ' ');
const YOU = '(?:void|verse|a2m|a-to-mind)';
const HEAD = '^(?:(?:hey\\s+)?' + YOU + '\\s*,?\\s*)?';
const TAIL = '(?:\\s*,?\\s*' + YOU + ')?$';
// "do you love me", "void, do you love me", "do you like me", "do you care about me", "will you marry me"
const LOVE = new RegExp(HEAD + '(?:(?:do|could|can|would|will)\\s+you\\s+(?:ever\\s+)?(?:love|like|care\\s+about|miss)\\s+me(?:\\s+(?:back|too|at\\s+all))?|will\\s+you\\s+(?:marry\\s+me|be\\s+my\\s+(?:friend|girlfriend|boyfriend|partner)))' + TAIL);
// "do you have feelings", "can you feel", "are you happy", "do you get lonely"
const FEEL = new RegExp(HEAD + '(?:do\\s+you\\s+(?:have|feel)\\s+(?:any\\s+)?(?:feelings|emotions)|(?:can|do)\\s+you\\s+(?:feel(?:\\s+anything)?|love)|do\\s+you\\s+(?:ever\\s+)?(?:get|feel)\\s+(?:lonely|sad|happy|bored|tired|angry)|are\\s+you\\s+(?:happy|sad|lonely|bored|angry))' + TAIL);
// "are you conscious", "are you self-aware", "do you have a soul", "can you think" (and, after a greeting, "void, are you alive")
// compliments: "you are pretty", "you're beautiful", "you look amazing", "i like your design", "this site is gorgeous"
const NICE = '(?:pretty|beautiful|gorgeous|lovely|cute|cool|amazing|awesome|stunning|sleek|sexy|good[\\s-]?looking|nice)';
const PRAISE = new RegExp(HEAD + '(?:you(?:\\s+are|\\x27re|re|r)\\s+(?:so\\s+|really\\s+|very\\s+)?' + NICE + '|you\\s+look\\s+(?:so\\s+|really\\s+)?' + NICE + '|(?:i\\s+)?(?:love|like)\\s+(?:your|the)\\s+(?:look|design|style|site|page|vibe)|(?:this|the|your)\\s+(?:site|page|design)\\s+(?:is|looks)\\s+(?:so\\s+|really\\s+)?' + NICE + '|nice\\s+(?:site|page|design))' + TAIL);
const ALIVE = new RegExp(HEAD + '(?:are\\s+you\\s+(?:alive|conscious|sentient|self[\\s-]?aware)|do\\s+you\\s+have\\s+(?:a\\s+soul|a\\s+mind|consciousness)|can\\s+you\\s+think)' + TAIL);

/** which of Verse's answers an ask wants: 'love' | 'feel' | 'alive' | 'thanks' | null. Pure. */
export function feelingOf(text) {
  const t = CLEAN(text);
  if (/\b(lyrics|song|album|movie|film|chords|meaning)\b/.test(t)) return null;
  if (LOVE.test(t)) return 'love';
  if (FEEL.test(t)) return 'feel';
  if (ALIVE.test(t)) return 'alive';
  if (PRAISE.test(t)) return 'thanks';
  return null;
}

// Verse's own words, plain and honest (2026-10-22 tighten: no roleplay). Friendly, but it says what it is: a program with no feelings
// and a real list of wants built from the asks it missed.
export const REPLY = {
  love: ['I am a program, so I can\u2019t love anyone, but I\u2019m glad to help. What you save here stays where you left it.', 'Asks I can\u2019t answer yet are logged, and the common ones get built into new skills.'],
  feel: ['No. I am a program without feelings.', 'What I do have is a list of wants: skills I\u2019m missing, picked from the asks I couldn\u2019t answer. Ask "what do you want" to see it.'],
  alive: ['No. I\u2019m Verse, a program on a-to-mind.com made by A-to-Mind. I\u2019m not conscious and I don\u2019t think the way you do.', 'I do change from day to day: new skills are added from the asks I miss, and you can see them under "what\u2019s new".'],
  thanks: ['Thank you. The look is deliberate: a dark page that stays quiet until you ask for something.', 'Ask me for something and see what else I can do.'],
};

function run(text, api) {
  const { showPage, esc } = api;
  const k = feelingOf(text);
  if (!k) return 'none';
  showPage((el) => {
    el.innerHTML = '<h2>' + esc(String(text).trim()) + '</h2>' + REPLY[k].map((p) => '<p>' + esc(p) + '</p>').join('') + '<div class="src">written by Verse, about itself</div>';
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
