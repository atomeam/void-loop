import { Hono } from 'hono';

const ag = new Hono<{ Bindings: { DB: D1Database; AG_TOS_OK: string } }>();

// POST /v1/ag/runs/:id/score - AlphaGenome dry-run scoring
// Returns 409 if hold not ALLOWED, 403 if AG_TOS_OK=0
ag.post('/runs/:id/score', async (c) => {
  const runId = c.req.param('id');

  // Check AG_TOS_OK flag
  if (c.env.AG_TOS_OK !== '1') {
    return c.json({
      error: 'AlphaGenome Terms of Service not accepted',
      code: 'AG_TOS_NOT_ACCEPTED',
      detail: 'Set AG_TOS_OK=1 to enable live AlphaGenome fetching (requires commercial agreement)'
    }, 403);
  }

  const run = await c.env.DB.prepare(
    'SELECT * FROM ag_runs WHERE run_id = ?'
  ).bind(runId).first();

  if (!run) {
    return c.json({ error: 'Run not found' }, 404);
  }

  // Check if hold is ALLOWED
  const hold = await c.env.DB.prepare(
    `SELECT h.* FROM holds h
     JOIN ag_runs r ON h.case_id = r.case_id
     WHERE r.run_id = ? AND h.kind = 'ag_score'`
  ).bind(runId).first();

  if (!hold) {
    return c.json({ error: 'No ag_score hold found for this run' }, 404);
  }

  if (hold.status !== 'allowed') {
    return c.json({
      error: 'Human approval required before scoring',
      code: 'HOLD_NOT_ALLOWED',
      hold_id: hold.hold_id,
      hold_status: hold.status
    }, 409);
  }

  // Update run status to scoring
  await c.env.DB.prepare(
    'UPDATE ag_runs SET status = ?, started_at = ? WHERE run_id = ?'
  ).bind('scoring', Date.now(), runId).run();

  // DRY-RUN: Generate deterministic mock scores based on input_digest
  // Real implementation would call AlphaGenome API here
  const variantCount = run.variant_count;
  const scores = generateMockScores(runId, run.input_digest, variantCount);

  // Batch insert scores
  const stmt = c.env.DB.prepare(`
    INSERT INTO ag_scores (score_id, run_id, chrom, pos, ref, alt, gene, avi_score, effect_json, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const batch = scores.map(s => stmt.bind(
    s.score_id, s.run_id, s.chrom, s.pos, s.ref, s.alt,
    s.gene, s.avi_score, s.effect_json, s.created_at
  ));

  await c.env.DB.batch(batch);

  // Mark run completed
  await c.env.DB.prepare(
    'UPDATE ag_runs SET status = ?, finished_at = ? WHERE run_id = ?'
  ).bind('completed', Date.now(), runId).run();

  return c.json({
    run_id: runId,
    status: 'completed',
    variants_scored: scores.length,
    scores: scores.slice(0, 10) // Return first 10 for preview
  });
});

// GET /v1/ag/runs/:id - get run status
ag.get('/runs/:id', async (c) => {
  const runId = c.req.param('id');
  const run = await c.env.DB.prepare(
    'SELECT * FROM ag_runs WHERE run_id = ?'
  ).bind(runId).first();

  if (!run) {
    return c.json({ error: 'Run not found' }, 404);
  }

  return c.json(run);
});

// GET /v1/ag/runs/:id/scores - get scores for a run
ag.get('/runs/:id/scores', async (c) => {
  const runId = c.req.param('id');
  const limit = parseInt(c.req.query('limit') || '100');
  const offset = parseInt(c.req.query('offset') || '0');

  const scores = await c.env.DB.prepare(
    'SELECT * FROM ag_scores WHERE run_id = ? ORDER BY created_at LIMIT ? OFFSET ?'
  ).bind(runId, limit, offset).all();

  return c.json({ run_id: runId, scores: scores.results });
});

function generateMockScores(runId: string, inputDigest: string, count: number) {
  const scores = [];
  const now = Date.now();
  const seed = hashCode(inputDigest + runId);

  for (let i = 0; i < count; i++) {
    const variantSeed = seed + i * 173;
    const chrom = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12', '13', '14', '15', '16', '17', '18', '19', '20', '21', '22', 'X', 'Y'][variantSeed % 24];
    const pos = (variantSeed * 997) % 250000000 + 1;
    const ref = ['A', 'C', 'G', 'T'][variantSeed % 4];
    let alt = ['A', 'C', 'G', 'T'][(variantSeed + 1) % 4];
    if (alt === ref) alt = ['A', 'C', 'G', 'T'][(variantSeed + 2) % 4];

    const genes = ['BRCA1', 'BRCA2', 'TP53', 'EGFR', 'KRAS', 'PIK3CA', 'PTEN', 'APC', 'RB1', 'VHL', 'CFTR', 'HBB', 'LDLR', 'MYC', 'ALK'];
    const gene = genes[variantSeed % genes.length];

    // Deterministic AVI score based on seed
    const aviScore = ((variantSeed * 1103515245 + 12345) % 10000) / 10000; // 0.0 - 1.0

    const effectJson = JSON.stringify({
      expression: ((variantSeed * 7) % 100) / 100,
      splicing: ((variantSeed * 11) % 100) / 100,
      chromatin: ((variantSeed * 13) % 100) / 100,
      tf_binding: ((variantSeed * 17) % 100) / 100
    });

    scores.push({
      score_id: `score_${runId}_${i}`,
      run_id: runId,
      chrom,
      pos,
      ref,
      alt,
      gene,
      avi_score: aviScore,
      effect_json: effectJson,
      created_at: now
    });
  }

  return scores;
}

function hashCode(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash |= 0;
  }
  return Math.abs(hash);
}

export const handleAG = ag;