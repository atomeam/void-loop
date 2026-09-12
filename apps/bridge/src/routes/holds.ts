import { Hono } from 'hono';
import { verifyHumanKey } from '../lib/auth';

const holds = new Hono<{ Bindings: { DB: D1Database } }>();

// POST /v1/holds/:id/allow - human approval gate
holds.post('/:id/allow', async (c) => {
  const holdId = c.req.param('id');
  const humanKey = c.req.header('x-hold-human-key');

  if (!humanKey) {
    return c.json({ error: 'Missing x-hold-human-key header' }, 401);
  }

  const verified = await verifyHumanKey(c.env.DB, humanKey);
  if (!verified) {
    return c.json({ error: 'Invalid human key' }, 403);
  }

  const body = await c.req.json().catch(() => ({}));
  const { decision, reason } = body; // decision: 'allowed' | 'denied'

  if (!decision || !['allowed', 'denied'].includes(decision)) {
    return c.json({ error: 'decision must be "allowed" or "denied"' }, 400);
  }

  const hold = await c.env.DB.prepare(
    'SELECT * FROM holds WHERE hold_id = ?'
  ).bind(holdId).first();

  if (!hold) {
    return c.json({ error: 'Hold not found' }, 404);
  }

  if (hold.status !== 'pending') {
    return c.json({ error: `Hold already ${hold.status}` }, 409);
  }

  const now = Date.now();
  await c.env.DB.prepare(
    'UPDATE holds SET status = ?, decided_by = ?, decided_at = ?, reason = COALESCE(?, reason) WHERE hold_id = ?'
  ).bind(decision, verified.user_id, now, reason, holdId).run();

  // If this is an ag_score hold, check if we should trigger scoring
  if (hold.kind === 'ag_score' && decision === 'allowed') {
    const run = await c.env.DB.prepare(
      'SELECT * FROM ag_runs WHERE case_id = (SELECT case_id FROM holds WHERE hold_id = ?) AND status = ?'
    ).bind(holdId, 'awaiting_allow').first();

    if (run) {
      await c.env.DB.prepare(
        'UPDATE ag_runs SET status = ?, started_at = ? WHERE run_id = ?'
      ).bind('scoring', now, run.run_id).run();
    }
  }

  return c.json({ hold_id: holdId, status: decision, decided_at: now });
});

// GET /v1/holds/:id - get hold status
holds.get('/:id', async (c) => {
  const holdId = c.req.param('id');
  const hold = await c.env.DB.prepare(
    'SELECT * FROM holds WHERE hold_id = ?'
  ).bind(holdId).first();

  if (!hold) {
    return c.json({ error: 'Hold not found' }, 404);
  }

  return c.json(hold);
});

export const handleHolds = holds;