/**
 * video-play skill - the last-chance "play <anything>" (skills/video.js): ranked after every other skill, so "play chess",
 * "play a song" and the games keep their own; "play despacito" or "watch the apollo 11 landing" that nothing else took becomes a
 * video search that plays the first hit inline.
 */
import { videoAskOf } from '../lib/video.js';
import { runAsk } from './video.js';
export default {
  name: 'video-play',
  examples: ['play despacito', 'watch the apollo 11 landing', 'put on lofi hip hop'],
  nearMisses: ['play chess', 'play a game', 'play music', 'play with me'],
  // "play my cards" / "play my deck" is the card table's (skills/rally.js), not a video. Specific game asks go to their own skills.
  match(lower, text) {
    const t = String(lower || text || '').toLowerCase().trim();
    if (/\bplay\s+(?:my|our|your)\s+(?:cards?|deck|hand)\b/.test(t)) return false;
    if (/^(?:play|let'?s play)\s+(?:gap glide|cross the bus|debris field|null waves|packet maze|jump stack|stackwell|push packets|nine grid|glyph verse|three alike|token stand)\b/.test(t)) return false;
    const q = videoAskOf(text || lower, { late: true });
    return !!q && q.kind === 'play' && !q.video;
  },
  async run(text, api) { const q = videoAskOf(text, { late: true }); return q ? runAsk(q, api) : 'none'; },
};
