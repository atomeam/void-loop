#!/usr/bin/env node
// Takes off /films/ every listed film whose own words are a kind of topic Verse no longer makes (tools/topic-gate.mjs): a small
// everyday sum (bills, tips, percents, conversions) or adult content. The film stays stored and the owner still sees it, marked
// unlisted: its words are posted again without gate 'pass' (functions/api/films.js lists only words with gate 'pass'), so this is
// reversible. It also counts every film stored, page by page, so the total is shown beyond the first page of 60.
//   node tools/film-cleanup.mjs [--dry]     needs VOID_OWNER_TOKEN; VOID_SITE overrides https://a-to-mind.com
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { filmWordsCheck } from './topic-gate.mjs';
import { post } from './film-post.mjs';

/** the listed films a cleanup takes off the list: [{ id, kinds }]. Pure. */
export function toUnlist(films) {
  return (films || []).filter((f) => f && !f.unlisted).map((f) => ({ id: f.id, title: f.title, kinds: filmWordsCheck(f).kinds })).filter((f) => f.kinds.length);
}

/** every film the owner can see, page by page, with a wait on a busy minute (429) */
export async function allFilms({ site, token, fetchImpl = fetch, wait = (ms) => new Promise((ok) => setTimeout(ok, ms)) }) {
  const films = []; let next = 0, stored = null, pages = 0;
  while (next != null) {
    let r;
    for (let tries = 0; ; tries++) {
      r = await fetchImpl(site + '/api/films?from=' + next, { headers: { authorization: 'Bearer ' + token } });
      if (r.status !== 429 || tries >= 3) break;
      await wait(1000 * Math.min(60, Number(r.headers && r.headers.get && r.headers.get('retry-after')) || 20));
    }
    const j = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error('the films list said ' + r.status + ' at ' + next);
    if (!j.owner) throw new Error('the site did not take VOID_OWNER_TOKEN as the owner');
    films.push(...(j.films || [])); stored = j.stored == null ? stored : j.stored; pages++;
    next = j.next == null ? null : j.next;
  }
  return { films, stored, pages };
}

export async function cleanup({ site = 'https://a-to-mind.com', token, fetchImpl = fetch, dry = false, wait } = {}) {
  if (!token) throw new Error('VOID_OWNER_TOKEN is not set');
  const { films, stored, pages } = await allFilms({ site, token, fetchImpl, wait });
  const off = toUnlist(films), done = [];
  if (!dry) for (const f of off) {
    const w = films.find((x) => x.id === f.id);
    await post({ id: f.id, words: { title: w.title, description: w.description, tags: w.tags }, wordsOnly: true, site, token, fetchImpl });
    done.push(f.id);
  }
  return { stored, seen: films.length, pages, listed: films.filter((f) => !f.unlisted).length - done.length, unlisted: dry ? [] : done, wouldUnlist: off };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const dry = process.argv.includes('--dry');
  cleanup({ site: process.env.VOID_SITE || undefined, token: process.env.VOID_OWNER_TOKEN, dry })
    .then((r) => {
      console.log('films stored: ' + r.stored + ', read: ' + r.seen + ' over ' + r.pages + ' pages, listed now: ' + r.listed);
      for (const f of r.wouldUnlist) console.log((dry ? 'would take off the list: ' : 'taken off the list: ') + f.id + ' (' + f.kinds.join(', ') + ')');
      if (!r.wouldUnlist.length) console.log('no listed film is a refused topic');
    })
    .catch((e) => { console.error('film cleanup: ' + (e.message || e)); process.exit(1); });
}
