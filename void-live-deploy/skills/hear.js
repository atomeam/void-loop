/**
 * hear skill - play a real recording of a named song (owner, 2026-11-03: songs were a composed stand-in; a visitor who names
 * a track and an artist gets that track). "play bohemian rhapsody by queen". The preview is Apple's own 30-second file from
 * iTunes Search, no key; the card names the track and artist iTunes returned. "make me a song" stays with the music skill,
 * "play a video of …" stays with video, and a bare "play despacito" stays a video search.
 * Contract: { name, examples, nearMisses, match(lower, text), run(text, api) }
 */
// Proven by suite check in tools/hear.test.mjs (least checked, 2026-11-05)
import { songAskOf, findTrack } from '../lib/hear.js';

const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

async function run(text, api) {
  const asked = songAskOf(text);
  if (!asked) return 'none';
  const { showPage } = api;
  const el = showPage((p) => {
    p.dataset.cardKind = 'Song';
    p.innerHTML = '<h2>Song</h2><p class="sub">Looking up ' + esc(asked.title) + ' by ' + esc(asked.artist) + '…</p>';
  });
  let track = null;
  try { track = await findTrack(asked.title, asked.artist); } catch (_) { track = null; }
  if (api._pageStill && !api._pageStill(el)) return 'hear';
  if (!track) {
    el.innerHTML = '<h2>Song</h2><p>No Apple preview matched “' + esc(asked.title) + '” by ' + esc(asked.artist) + '. Try the title and the artist the way the recording is credited.</p><div class="src">Looked up on <a href="https://itunes.apple.com/" target="_blank" rel="noopener">iTunes Search</a>. Nothing is played that the lookup did not name.</div>';
    return 'hear';
  }
  el.innerHTML = '<h2>Song</h2>'
    + '<p class="hear-title" style="font-size:1.15em;margin:0 0 2px;overflow-wrap:anywhere"><b>' + esc(track.title) + '</b></p>'
    + '<p class="hear-artist" style="margin:0 0 8px">' + esc(track.artist) + (track.collection ? ' · ' + esc(track.collection) : '') + '</p>'
    + '<audio class="hear-audio" controls preload="metadata" src="' + esc(track.preview) + '" style="display:block;max-width:100%"></audio>'
    + '<p><button type="button" class="hear-play">Play</button></p>'
    + '<div class="src">Source: <a href="https://itunes.apple.com/search?entity=song&term=' + encodeURIComponent(asked.title + ' ' + asked.artist) + '" target="_blank" rel="noopener">iTunes Search</a> preview (30 seconds). The file is Apple\'s; Verse does not rehost it.</div>';
  const audio = el.querySelector('.hear-audio'), btn = el.querySelector('.hear-play');
  if (btn && audio) btn.addEventListener('click', () => { audio.play().catch(() => {}); });
  return 'hear';
}

export default {
  name: 'hear',
  examples: ['play bohemian rhapsody by queen', 'play billie jean by michael jackson', 'play imagine by john lennon', 'play the song hey jude by the beatles'],
  nearMisses: ['play despacito', 'make me a song', 'play a video of the moon landing', 'play the podcast', 'podcasts about history', 'play chess'],
  match(lower, text) { return !!songAskOf(text == null ? lower : text); },
  run,
};
