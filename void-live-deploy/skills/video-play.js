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
  match(lower, text) { const q = videoAskOf(text || lower, { late: true }); return !!q && q.kind === 'play' && !q.video; },
  async run(text, api) { const q = videoAskOf(text, { late: true }); return q ? runAsk(q, api) : 'none'; },
};
