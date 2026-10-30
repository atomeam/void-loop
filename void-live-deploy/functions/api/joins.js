// GET /api/joins → { count, last }: how many members MultiVerse has and when the newest joined (lib/joins.js). The community milestone
// card on the stage and the growth card's community line read it. No name, id or email leaves; takes no input, writes nothing.
import { joinStats } from '../../lib/joins.js';
export async function onRequestGet({ env }) {
  const out = await joinStats(env || {});
  return new Response(JSON.stringify(out), { headers: { 'content-type': 'application/json', 'cache-control': 'public, max-age=60' } });
}
