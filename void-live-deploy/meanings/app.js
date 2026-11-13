import { cleanWord, sensesFrom } from '/lib/meanings.js';

const input = document.querySelector('#word');
const out = document.querySelector('#out');
const err = document.querySelector('#err');
const src = document.querySelector('#src');

function draw(word, senses) {
  out.replaceChildren();
  src.replaceChildren();
  if (!senses.length) {
    const p = document.createElement('p');
    p.textContent = '“' + word + '” is not in the dictionary.';
    out.appendChild(p);
    return;
  }
  const h = document.createElement('h2');
  h.textContent = word;
  out.appendChild(h);
  for (const s of senses) {
    if (s.pos) {
      const pos = document.createElement('p');
      pos.textContent = s.pos;
      out.appendChild(pos);
    }
    const ol = document.createElement('ol');
    for (const d of s.defs) {
      const li = document.createElement('li');
      li.textContent = d;
      ol.appendChild(li);
    }
    out.appendChild(ol);
    if (s.ex) {
      const ex = document.createElement('p');
      ex.textContent = '“' + s.ex + '”';
      out.appendChild(ex);
    }
  }
  const a = document.createElement('a');
  a.href = 'https://en.wiktionary.org/wiki/' + encodeURIComponent(word.replace(/ /g, '_'));
  a.rel = 'noopener';
  a.target = '_blank';
  a.textContent = 'Dictionary entry';
  src.appendChild(document.createTextNode('Source: '));
  src.appendChild(a);
}

async function look(word) {
  err.textContent = '';
  out.replaceChildren();
  src.replaceChildren();
  if (!word) return;
  err.textContent = 'Looking…';
  try {
    const r = await fetch('https://en.wiktionary.org/api/rest_v1/page/definition/' + encodeURIComponent(word.replace(/ /g, '_')) + '?redirect=true', { signal: AbortSignal.timeout(8000) });
    if (r.status === 404) { err.textContent = ''; draw(word, []); return; }
    if (!r.ok) throw new Error('status');
    err.textContent = '';
    draw(word, sensesFrom(await r.json()));
  } catch (_) {
    err.textContent = 'The dictionary did not answer just now. Try again in a moment.';
  }
}

document.querySelector('form').addEventListener('submit', (e) => {
  const word = cleanWord(input.value);
  if (!word) { e.preventDefault(); err.textContent = 'Type a word.'; return; }
  input.value = word;
  const u = new URL(location.href);
  u.searchParams.set('word', word);
  history.replaceState(null, '', u);
  if (document.querySelector('#out h2')) return;
  e.preventDefault();
  look(word);
});

const q = new URLSearchParams(location.search);
const start = cleanWord(q.get('word') || '');
if (start && !document.querySelector('#out h2') && !document.querySelector('#out p')) {
  input.value = start;
  look(start);
}
