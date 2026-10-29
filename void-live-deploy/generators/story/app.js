// /generators/story/'s code, kept out of the page so the page needs no inline-script CSP rule (tools/csp-hashes.mjs budget)
import { mountRelated } from '/lib/toolkit.js';
import { GENRES, STORY_SAYS } from '/lib/story.js';
import { shareHash, SHARE_MAX } from '/lib/fanfic.js';
addEventListener('load', () => {
  const $ = (id) => document.getElementById(id), de = /^de\b/i.test(navigator.language || '');
  const KEY = 'a2m.void.stories.v1';
  let store = { stories: [], current: '' };
  try { const s = JSON.parse(localStorage.getItem(KEY) || '{}'); if (s && Array.isArray(s.stories)) store = { stories: s.stories.filter((x) => x && x.id && Array.isArray(x.parts)).slice(0, 50), current: String(s.current || '') }; } catch (_) {}
  const keep = () => { try { localStorage.setItem(KEY, JSON.stringify(store)); } catch (_) { say('This browser would not keep the story (storage is full or off).'); } };
  const say = (t) => { $('note').textContent = t || ''; };
  const NAMES = { any: 'Any', fantasy: 'Fantasy', 'sci-fi': 'Science fiction', mystery: 'Mystery', adventure: 'Adventure', funny: 'Funny', fairy: 'Fairy tale', spooky: 'Spooky (gentle)', romance: 'Sweet romance', cozy: 'Cozy' };
  for (const k of Object.keys(GENRES)) $('genre').append(new Option(NAMES[k] || k, k));
  let cur = store.stories.find((x) => x.id === store.current) || null;
  const text = () => (cur ? cur.parts.join('\n\n') : '');
  const titleOf = (x) => (x.parts[0] || '').split('\n')[0].replace(/^#+\s*|[*_]/g, '').slice(0, 40) || 'A story';
  function draw() {
    $('story').replaceChildren(...(cur && cur.parts.length ? cur.parts.map((p, i) => Object.assign(document.createElement('p'), { textContent: p, className: i === cur.parts.length - 1 && cur.parts.length > 1 ? 'part-new' : '' })) : [Object.assign(document.createElement('p'), { className: 'note', textContent: de ? 'Schreib eine Idee und drück „Anfang schreiben“.' : 'Write an idea and press "Write the opening".' })]));
    const has = !!(cur && cur.parts.length); for (const id of ['more', 'again', 'undo', 'copy', 'dl']) $(id).disabled = !has || busy;
    $('write').disabled = busy;
    $('mine').replaceChildren(...store.stories.map((x) => { const b = document.createElement('button'); b.type = 'button'; b.textContent = titleOf(x); b.setAttribute('aria-pressed', String(x === cur)); b.addEventListener('click', () => { cur = x; store.current = x.id; $('idea').value = x.idea || ''; $('genre').value = x.genre || 'any'; keep(); draw(); }); return b; }));
    if (!store.stories.length) $('mine').replaceChildren(Object.assign(document.createElement('p'), { className: 'note', textContent: de ? 'Noch keine.' : 'None yet.' }));
  }
  let busy = false;
  async function ask(body) {
    busy = true; draw(); say(de ? 'Wird geschrieben…' : 'Writing…'); $('story').setAttribute('aria-busy', 'true');
    let j = null; try { const ctl = new AbortController(), t = setTimeout(() => ctl.abort(), 45000); j = await (await fetch('/api/answer', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ mode: 'story', length: $('len').value, lang: de ? 'de' : 'en', ...body }), signal: ctl.signal })).json(); clearTimeout(t); } catch (_) { j = null; }
    busy = false; $('story').removeAttribute('aria-busy');
    if (j && j.text) { say(''); return j.text; }
    say((j && j.say) || (navigator.onLine ? STORY_SAYS.busy[de ? 1 : 0] : (de ? 'Geschichten brauchen Internet.' : 'Stories need the internet.'))); draw(); return null;
  }
  $('write').addEventListener('click', async () => {
    const idea = $('idea').value.trim(); if (!idea) { say(de ? 'Schreib zuerst eine Idee.' : 'Write an idea first.'); $('idea').focus(); return; }
    const t = await ask({ premise: idea, genre: $('genre').value, steer: $('steer').value.trim() }); if (!t) return;
    cur = { id: 's' + Date.now().toString(36), idea, genre: $('genre').value, parts: [t], at: Date.now() }; store.stories.unshift(cur); store.stories = store.stories.slice(0, 50); store.current = cur.id; $('steer').value = ''; keep(); draw();
  });
  $('more').addEventListener('click', async () => { if (!cur) return; const t = await ask({ soFar: text(), genre: cur.genre, steer: $('steer').value.trim() }); if (!t) return; cur.parts.push(t); $('steer').value = ''; keep(); draw(); $('story').lastElementChild.scrollIntoView({ block: 'nearest' }); });
  $('again').addEventListener('click', async () => { if (!cur || !cur.parts.length) return; const last = cur.parts.pop(); const t = cur.parts.length ? await ask({ soFar: text(), genre: cur.genre, steer: $('steer').value.trim() }) : await ask({ premise: cur.idea, genre: cur.genre, steer: $('steer').value.trim() }); cur.parts.push(t || last); keep(); draw(); });
  $('undo').addEventListener('click', () => { if (!cur || !cur.parts.length) return; cur.parts.pop(); if (!cur.parts.length) { store.stories = store.stories.filter((x) => x !== cur); cur = null; } keep(); draw(); });
  $('copy').addEventListener('click', async () => { try { await navigator.clipboard.writeText(text()); } catch (_) {} say(de ? 'Kopiert.' : 'Copied.'); });
  $('dl').addEventListener('click', () => { const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([text() + '\n'], { type: 'text/plain' })); a.download = titleOf(cur).replace(/[^\p{L}\p{N}]+/gu, '-').replace(/^-|-$/g, '').toLowerCase() + '.txt'; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 5000); });
  $('newS').addEventListener('click', () => { cur = null; store.current = ''; keep(); $('idea').value = ''; $('idea').focus(); draw(); });
  if (de) { document.documentElement.lang = 'de'; $('h').textContent = 'Geschichtenschreiber'; $('sub').textContent = 'Eine Idee rein, eine Geschichte raus, Teil für Teil. Deine Geschichten bleiben auf diesem Gerät.'; $('ideaL').textContent = 'Die Idee'; $('genreL').textContent = 'Genre'; $('lenL').textContent = 'Länge eines Teils'; $('write').textContent = 'Anfang schreiben'; $('storyH').textContent = 'Die Geschichte'; $('steerL').textContent = 'Was als Nächstes passiert (optional)'; $('more').textContent = 'Weiter'; $('again').textContent = 'Letzten Teil neu'; $('undo').textContent = 'Letzten Teil entfernen'; $('copy').textContent = 'Kopieren'; $('dl').textContent = '.txt laden'; $('newS').textContent = 'Neue Geschichte'; $('mineH').textContent = 'Deine Geschichten auf diesem Gerät'; }
  if (cur) { $('idea').value = cur.idea || ''; $('genre').value = cur.genre || 'any'; }
  draw();
  // the story goes on to the fan fiction Writing Room as a draft, held in the link after the # (owner, 2026-10-29: the pages work together)
  const toRoom = () => { if (!cur || !cur.parts.length) return null; const u = '/fanfic/?v=room&from=story#' + shareHash({ title: titleOf(cur), text: text() }); return u.length <= SHARE_MAX ? u : null; };
  mountRelated($('related'), '/generators/', [{ label: de ? 'Im Schreibraum weiterschreiben' : 'Keep writing it on Fan fiction', href: toRoom }]);
  if ('serviceWorker' in navigator) navigator.serviceWorker.register('/sw.js').catch(() => {});
});
