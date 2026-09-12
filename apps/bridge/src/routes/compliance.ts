import { Hono } from 'hono';
import { parseIsoZ, assertAwareness, deriveDeadlines } from '../cra/clock';
import { AgRunCreateSchema, AgOutput, dryRunScore, validateAgRun } from '../../packages/ledger/src/alphagenome';
import { putEvidence, getEvidence } from '../evidence';
import { verifyHumanKey } from '../lib/auth';

export const complianceApp = new Hono<{ Bindings: any }>();

complianceApp.use('*', verifyHumanKey);

complianceApp.post('/cra/cases', async (c) => {
  const body = await c.req.json();
  const now = new Date();
  const awarenessAt = parseIsoZ(body.awareness_at);
  assertAwareness(now, awarenessAt);
  const deadlines = deriveDeadlines({
    kind: body.kind,
    awarenessAt,
    measureAt: body.measure_at ? new Date(body.measure_at) : undefined,
    notify72hFiledAt: body.notify_72h_filed_at ? new Date(body.notify_72h_filed_at) : undefined,
  });

  const caseId = `case_${Math.random().toString(36).slice(2, 24)}`;
  await c.env.BRIDGE_DB.prepare(`
    INSERT INTO cra_cases (id, org_id, product_id, kind, title, summary, awareness_at, measure_at, notify_users, status, created_by, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'OPEN', ?, ?)
  `).bind(
    caseId,
    body.org_id,
    body.product_id,
    body.kind,
    body.title,
    body.summary,
    body.awareness_at,
    body.measure_at ?? null,
    body.notify_users,
    body.created_by,
    now.toISOString(),
  ).run();

  for (const [stage, dueAt] of Object.entries(deadlines) as [string, Date | null][]) {
    if (dueAt) {
      await c.env.BRIDGE_DB.prepare(`
        INSERT INTO cra_deadlines (id, case_id, stage, due_at)
        VALUES (?, ?, ?, ?)
      `).bind(`deadline_${stage}_${caseId}`, caseId, stage, dueAt.toISOString()).run();
    }
  }

  await c.env.BRIDGE_DB.prepare(`
    INSERT INTO holds (id, kind, subject_type, subject_id, status, expires_at, created_by, decided_at)
    VALUES (?, 'run', 'cra_case', ?, 'PENDING', ?, ?, ?)
  `).bind(`hold_${caseId}`, caseId, deadlines.final_14d?.toISOString() ?? deadlines.final_1m?.toISOString() ?? '', body.created_by, now.toISOString()).run();

  return c.json({ id: caseId, deadlines });
});

complianceApp.get('/cra/cases/:id', async (c) => {
  const caseId = c.req.param('id');
  const row = await c.env.BRIDGE_DB.prepare(`SELECT id, org_id, product_id, kind, title, summary, awareness_at, measure_at, notify_users, status, created_by, created_at FROM cra_cases WHERE id = ?`).bind(caseId).first<any>();
  if (!row) return c.json({ error: 'not found' }, 404);
  return c.json(row);
});

complianceApp.post('/ag/runs', async (c) => {
  const body = await c.req.json();
  validateAgRun(body);

  const mode = (c.env.AG_TOS_OK === '1') ? 'LIVE' : 'DRY_RUN';

  if (mode === 'DRY_RUN') {
    const { score, modality, evidence_id } = dryRunScore(
      JSON.parse(body.interval_json),
      body.variant_json ? JSON.parse(body.variant_json) : null,
    );

    const runId = `ag_run_${Math.random().toString(36).slice(2, 24)}`;
    await c.env.BRIDGE_DB.prepare(`
      INSERT INTO ag_runs (id, org_id, hold_id, assembly, interval_json, variant_json, mode, status, created_at)
      VALUES (?, ?, ?, 'hg38', ?, ?, 'DRY_RUN', 'QUEUED', ?)
    `).bind(
      runId,
      body.org_id,
      body.hold_id ?? null,
      body.interval_json,
      body.variant_json ?? null,
      now => now.toISOString(),
    ).run();

    await c.env.BRIDGE_DB.prepare(`
      INSERT INTO ag_scores (id, run_id, modality, score_json, evidence_id, created_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `).bind(`score_${runId}`, runId, modality, JSON.stringify({ score }), evidence_id, now => now.toISOString()).run();

    const output: AgOutput = {
      run_id: runId,
      mode: 'DRY_RUN',
      status: 'QUEUED',
      interval: { start: 0, end: 0, step: 1 },
      variant: null,
      evidence_id,
      notes: 'dry-run: no external egress; AG_TOS_OK=0 gate enforced',
    };
    return c.json(output);
  }

  return c.json({ error: 'LIVE mode requires AG_TOS_OK=1 and API key' }, 403);
});

complianceApp.post('/ag/runs/:id/score', async (c) => {
  const runId = c.req.param('id');
  const body = await c.req.json();
  validateAgRun(body);

  const row = await c.env.BRIDGE_DB.prepare(`SELECT id, hold_id, mode, status FROM ag_runs WHERE id = ?`).bind(runId).first<any>();
  if (!row) return c.json({ error: 'run not found' }, 404);
  if (row.mode !== 'DRY_RUN') return c.json({ error: 'LIVE scoring not allowed in this config' }, 403);

  const { score, modality, evidence_id } = dryRunScore(
    JSON.parse(row.interval_json || '{}'),
    row.variant_json ? JSON.parse(row.variant_json) : null,
  );

  await c.env.BRIDGE_DB.prepare(`
    INSERT INTO ag_scores (id, run_id, modality, score_json, evidence_id, created_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `).bind(`score_${runId}`, runId, modality, JSON.stringify({ score }), evidence_id, new Date().toISOString()).run();

  await c.env.BRIDGE_DB.prepare(`UPDATE ag_runs SET status='SCORED', error=NULL WHERE id=?`).bind(runId).run();

  return c.json({ score, modality, evidence_id, run_id: runId });
});