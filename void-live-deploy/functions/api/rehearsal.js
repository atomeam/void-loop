// The rehearsal's stand-in buyer reply, seeded through the site itself (operator, 2026-10-10): the deploy token gets
// no D1 scope — blast-radius containment — so rehearsal.yml seeds here with the owner token CI already holds.
// POST (owner) -> one clearly marked handoff row (id prefix rehearsal-, author rehearsal.example, body through
// redact(), 7-day TTL like any handoff) with one execution record (rehearsal.seed). DELETE (owner) -> every
// rehearsal- row removed, one record (rehearsal.clean). Nothing here touches real handoffs: the id prefix is the
// fence, and the fixed server-side body means this route can never be used to store arbitrary text under a token.
import { ownerOk } from '../../lib/guard.js';
import { track } from '../../lib/actions.js';
import { redact } from '../../lib/automation-fix.js';

export const REHEARSAL_BODY = 'Hi Adam, this is the rehearsal reply standing in for a buyer. We run a small test bakery and we need the '
  + 'Zapier zap that copies each order into our Google Sheet fixed: every order shows up twice and the morning bake '
  + 'list is wrong. Can you tell us what you would do and when you could start?';

const reply = (obj, status = 200) => Response.json(obj, { status, headers: { 'cache-control': 'no-store', 'x-robots-tag': 'noindex, nofollow' } });
const ensure = async (db) => {
  await db.prepare('CREATE TABLE IF NOT EXISTS handoff (id TEXT PRIMARY KEY, name TEXT NOT NULL, author TEXT, body TEXT NOT NULL, created INTEGER NOT NULL)').run();
  await db.prepare('ALTER TABLE handoff ADD COLUMN job TEXT').run().catch(() => {});
};

export async function onRequest({ request, env }) {
  if (!(await ownerOk(request, env))) return new Response('no', { status: 401 });
  if (!env.DB) return reply({ error: 'storage not bound' }, 503);
  await ensure(env.DB);
  if (request.method === 'POST') {
    const id = 'rehearsal-' + [...crypto.getRandomValues(new Uint8Array(11))].map((b) => b.toString(16).padStart(2, '0')).join('');
    const now = Math.floor(Date.now() / 1000);
    const { value } = await track(env, { owner: 'owner', kind: 'rehearsal.seed', ref: id }, async () => {
      await env.DB.prepare('INSERT INTO handoff (id, name, author, body, created, job) VALUES (?, ?, ?, ?, ?, ?)')
        .bind(id, 'rehearsal reply [sale:rehearsal]', 'rehearsal.example', redact(REHEARSAL_BODY), now, 'sale:rehearsal').run();
      return 'seeded rehearsal reply ' + id;
    });
    return reply({ id, url: new URL(request.url).origin + '/api/handoff?id=' + id + '&raw=1', note: value }, 201);
  }
  if (request.method === 'DELETE') {
    const { value } = await track(env, { owner: 'owner', kind: 'rehearsal.clean', ref: 'rehearsal-*' }, async () => {
      const r = await env.DB.prepare("DELETE FROM handoff WHERE id LIKE 'rehearsal-%'").run();
      return 'removed ' + r.meta.changes + ' rehearsal ' + (r.meta.changes === 1 ? 'row' : 'rows');
    });
    return reply({ note: value });
  }
  return reply({ error: 'POST or DELETE' }, 405);
}
