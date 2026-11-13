import { pickTrack } from '/lib/hear.js';
import { songFields } from '/lib/songs.js';

const title = document.querySelector('#title');
const artist = document.querySelector('#artist');
const out = document.querySelector('#out');
const err = document.querySelector('#err');

function draw(track) {
  out.replaceChildren();
  if (!track) {
    const p = document.createElement('p');
    p.textContent = 'That recording is not in the song search.';
    out.appendChild(p);
    return;
  }
  const h = document.createElement('h2');
  h.textContent = track.title;
  const by = document.createElement('p');
  by.textContent = track.artist;
  const audio = document.createElement('audio');
  audio.controls = true;
  audio.src = track.preview;
  out.append(h, by, audio);
}

async function play(fields) {
  err.textContent = 'Looking…';
  out.replaceChildren();
  try {
    const res = await fetch('https://itunes.apple.com/search?entity=song&limit=8&term=' + encodeURIComponent(fields.title + ' ' + fields.artist), { headers: { accept: 'application/json' }, signal: AbortSignal.timeout(8000) });
    if (!res.ok) throw new Error('status');
    const track = pickTrack((await res.json()).results, fields.title, fields.artist);
    err.textContent = '';
    draw(track);
  } catch (_) {
    err.textContent = 'The song search did not answer just now. Try again in a moment.';
  }
}

document.querySelector('form').addEventListener('submit', (e) => {
  const fields = songFields(title.value, artist.value);
  if (!fields.ok) {
    e.preventDefault();
    err.textContent = fields.reason === 'long' ? 'That line is too long.' : 'Type a song and who plays it.';
    return;
  }
  title.value = fields.title;
  artist.value = fields.artist;
  const u = new URL(location.href);
  u.searchParams.set('title', fields.title);
  u.searchParams.set('artist', fields.artist);
  history.replaceState(null, '', u);
  e.preventDefault();
  play(fields);
});

const start = songFields(new URLSearchParams(location.search).get('title') || '', new URLSearchParams(location.search).get('artist') || '');
if (start.ok && !out.querySelector('audio') && !out.querySelector('p')) {
  title.value = start.title;
  artist.value = start.artist;
  play(start);
}
