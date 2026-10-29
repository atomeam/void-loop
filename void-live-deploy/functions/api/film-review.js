// A review of one of Verse's films, from someone who may watch it (lib/film-reviews.js; owner, 2026-10-14: "film review could be
// for owner and paying members as contributer reviewrs"). The reviews come back with the film list (GET /api/films).
//   POST { id, verdict: 'post' | 'fix' | 'skip', note? }   (a paying credential) -> { ok, id, verdict }
// Keys typed into a note are masked before it is kept (the support desk's clean()).
import { bad, good } from '../../lib/void-me.js';
import { payer, clean } from './support.js';
import { BUY_URL } from '../../lib/review-api.js';
import { VERDICTS, NOTE_MAX, save } from '../../lib/film-reviews.js';
import { ID_RE } from './films.js';

export async function onRequestPost({ request, env }) {
  let b; try { b = JSON.parse(await request.text()); } catch (_) { return bad(400, 'bad json'); }
  const p = await payer(request, env);
  if (!p) return bad(401, "reviewing Verse's films is for people who pay for Verse", { buy: BUY_URL });
  const id = String((b && b.id) || ''), verdict = String((b && b.verdict) || '');
  if (!ID_RE.test(id)) return bad(400, 'send the film\'s id');
  if (!Object.prototype.hasOwnProperty.call(VERDICTS, verdict)) return bad(400, 'verdict is post, fix or skip');
  if (!env.FILMS || !(await env.FILMS.head('films/' + id + '.mp4'))) return bad(404, 'no such film');
  await save(env, id, p.who, verdict, clean(b.note, NOTE_MAX));
  return good({ ok: true, id, verdict });
}
