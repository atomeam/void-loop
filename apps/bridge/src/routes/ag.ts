import { Hono } from "hono";
import { scoreOrDry } from "../ag/client";
import { putEvidence } from "../evidence";

const ag = new Hono<{ Bindings: { BRIDGE_DB: D1Database; EVIDENCE: R2Bucket; AG_TOS_OK: string } }>();

ag.post("/runs/:id/score", async (c) => {
  const runId = c.req.param("id");
  const run = await c.env.BRIDGE_DB.prepare("SELECT * FROM ag_runs WHERE id = ?").bind(runId).first<any>();
  if (!run) return c.json({ error: "RUN_NOT_FOUND" }, 404);
  const evalResult = await scoreOrDry(c.env, run);
  const ev = await putEvidence(c.env, {
    subjectType: "ag_run",
    subjectId: runId,
    body: JSON.stringify(evalResult),
  });
  await c.env.BRIDGE_DB.prepare(
    `INSERT INTO ag_scores (id, run_id, modality, score_json, fetch_count, evidence_id)
     VALUES (?, ?, 'variant_effect', ?, 0, ?)`
  )
    .bind(`scr_${crypto.randomUUID().slice(0, 8)}`, runId, JSON.stringify(evalResult), ev.id)
    .run();
  await c.env.BRIDGE_DB.prepare(`UPDATE ag_runs SET status = 'SCORED' WHERE id = ?`).bind(runId).run();
  return c.json({ ok: true, mode: evalResult.mode, fetch_count: 0, evidence: ev });
});

export const handleAG = ag;
