import { hitsOf } from '/lib/video.js';
import { archiveSearch, clipQuery } from '/lib/clips.js';

const input = document.querySelector('#q');
const out = document.querySelector('#out');
const err = document.querySelector('#err');

function play(frame, hit) {
  frame.src = 'https://archive.org/embed/' + hit.id;
  frame.title = hit.title || 'Clip';
}

function draw(hits) {
  out.replaceChildren();
  if (!hits.length) {
    const p = document.createElement('p');
    p.textContent = 'Nothing matched that title.';
    out.appendChild(p);
    return;
  }
  const frame = document.createElement('iframe');
  frame.setAttribute('allowfullscreen', '');
  play(frame, hits[0]);
  out.appendChild(frame);
  const ul = document.createElement('ul');
  for (const hit of hits) {
    const li = document.createElement('li');
    const button = document.createElement('button');
    button.type = 'button';
    button.textContent = hit.title || hit.id;
    button.addEventListener('click', () => play(frame, hit));
    li.appendChild(button);
    if (hit.channel) li.appendChild(document.createTextNode(' · ' + hit.channel));
    ul.appendChild(li);
  }
  out.appendChild(ul);
}

async function find(text) {
  err.textContent = '';
  out.replaceChildren();
  err.textContent = 'Looking…';
  try {
    const r = await fetch(archiveSearch(text), { signal: AbortSignal.timeout(8000) });
    if (!r.ok) throw new Error('status');
    err.textContent = '';
    draw(hitsOf('archive', await r.json()));
  } catch (_) {
    err.textContent = 'The film archive did not answer just now. Try again in a moment.';
  }
}

document.querySelector('form').addEventListener('submit', (e) => {
  const page = clipQuery(input.value);
  if (!page.ok) {
    e.preventDefault();
    err.textContent = page.reason === 'long' ? 'That title is too long.' : 'Type a short title.';
    return;
  }
  input.value = page.text;
  const u = new URL(location.href);
  u.searchParams.set('q', page.text);
  history.replaceState(null, '', u);
  if (out.querySelector('iframe')) return;
  e.preventDefault();
  find(page.text);
});

const start = clipQuery(new URLSearchParams(location.search).get('q') || '');
if (start.ok && !out.querySelector('iframe') && !out.querySelector('p')) {
  input.value = start.text;
  find(start.text);
}
