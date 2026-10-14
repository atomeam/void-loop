#!/usr/bin/env node
// Puts one of Void's films on the site, for people who pay (functions/api/films.js; owner, 2026-10-14: "just put void films
// right onto the sight , with only paid access"). .github/workflows/record.yml runs it after each daily film, and once for each
// older film that was still a public GitHub release.
//   node tools/film-post.mjs <film.mp4> <words> --id <id>
// <words> is the recorder's media/<id>.json ({ title, description, tags: [] }) or the release text (TITLE / DESCRIPTION / TAGS).
// Needs VOID_OWNER_TOKEN (the site's READ_TOKEN, a repo secret); VOID_SITE overrides https://a-to-mind.com.
import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

// the release text record.yml writes: TITLE\n…\n\nDESCRIPTION\n…\n\nTAGS\n…
export function parseWords(text) {
  const t = String(text || '');
  try { const j = JSON.parse(t); return { title: j.title || '', description: j.description || '', tags: Array.isArray(j.tags) ? j.tags.join(', ') : (j.tags || '') }; } catch (_) {}
  const part = (name) => { const m = t.match(new RegExp('(?:^|\\n)' + name + '\\n([\\s\\S]*?)(?=\\n(?:TITLE|DESCRIPTION|TAGS)\\n|$)')); return m ? m[1].trim() : ''; };
  return { title: part('TITLE'), description: part('DESCRIPTION'), tags: part('TAGS') };
}

export async function post({ mp4, words, id, site = 'https://a-to-mind.com', token, fetchImpl = fetch }) {
  if (!token) throw new Error('VOID_OWNER_TOKEN is not set: the site only takes films from the owner');
  if (!/^[a-z0-9][a-z0-9-]{2,95}$/.test(id)) throw new Error('bad film id: ' + id);
  if (!words.title) throw new Error('the film has no title');
  const url = site.replace(/\/$/, '') + '/api/films?id=' + encodeURIComponent(id), auth = { authorization: 'Bearer ' + token };
  const send = async (body, type) => {
    const r = await fetchImpl(url, { method: 'POST', headers: { ...auth, 'content-type': type }, body });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error('the site said ' + r.status + ': ' + (j.error || 'no reason given'));
    return j;
  };
  const v = await send(mp4, 'video/mp4');
  await send(JSON.stringify(words), 'application/json');
  return { id, bytes: v.bytes };
}

if (import.meta.url === pathToFileURL(process.argv[1] || '').href) {
  const a = process.argv.slice(2), at = a.indexOf('--id'), id = at >= 0 ? a[at + 1] : '';
  const [mp4Path, wordsPath] = a.filter((x, i) => x !== '--id' && i !== at + 1);
  if (!mp4Path || !wordsPath || !id) { console.error('usage: node tools/film-post.mjs <film.mp4> <words.json|.txt> --id <id>'); process.exit(2); }
  post({ mp4: readFileSync(mp4Path), words: parseWords(readFileSync(wordsPath, 'utf8')), id, site: process.env.VOID_SITE || undefined, token: process.env.VOID_OWNER_TOKEN })
    .then((r) => console.log('On the site for members: ' + (process.env.VOID_SITE || 'https://a-to-mind.com') + '/films/ (' + r.id + ', ' + r.bytes + ' bytes)'))
    .catch((e) => { console.error('film-post: ' + e.message); process.exit(1); });
}
