import { classifyDeadline } from "./cra/clock";
import { putEvidence } from "./evidence";
import { scoreOrDry } from "./ag/client";
import { POLICY_ACTOR } from "./policy";

export type EnvAuto = {
  BRIDGE_DB: D1Database;
  EVIDENCE: R2Bucket;
  AG_TOS_OK: string;
  CRA_SRP_LIVE: string;
};

function id(prefix: string): string {
  return `${prefix}_${crypto.randomUUID().slice(0, 8)}`;
}

export async function tickClock(env: EnvAuto, now = new Date()) {
  const rows = await env.BRIDGE_DB.prepare(
    `SELECT d.id, d.case_id, d.stage, d.due_at, d.filed_at, c.kind, c.title, c.summary, c.awareness_at
     FROM cra_deadlines d
     JOIN cra_cases c ON c.id = d.case_id
     WHERE d.filed_at IS NULL`
  ).all<{
    id: string;
    case_id: string;
    stage: string;
    due_at: string;
    filed_at: string | null;
    kind: string;
    title: string;
    summary: string | null;
    awareness_at: string;
  }>();

  let due = 0;
  let filed = 0;
  let missed = 0;

  for (const row of rows.results ?? []) {
    const state = classifyDeadline(now, new Date(row.due_at), row.filed_at ? new Date(row.filed_at) : null);
    if (state === "PENDING") continue;
    due += 1;
    if (state === "MISSED") missed += 1;

    const packet = {
      case_id: row.case_id,
      stage: row.stage,
      kind: row.kind,
      title: row.title,
      summary: row.summary,
      awareness_at: row.awareness_at,
      classified: state,
      dest: env.CRA_SRP_LIVE === "1" ? "STUB" : "STUB",
      actor: POLICY_ACTOR,
      note: "CRA_SRP_LIVE=0 — draft only, no ENISA/SRP egress",
    };
    const ev = await putEvidence(env, {
      subjectType: "cra_case",
      subjectId: row.case_id,
      body: JSON.stringify(packet),
    });
    const nowIso = now.toISOString();
    await env.BRIDGE_DB.batch([
      env.BRIDGE_DB.prepare(
        `INSERT OR IGNORE INTO cra_submissions (id, case_id, stage, payload_sha, r2_key, dest)
         VALUES (?, ?, ?, ?, ?, 'STUB')`
      ).bind(id("sub"), row.case_id, row.stage, ev.sha256, ev.r2_key),
      env.BRIDGE_DB.prepare(`UPDATE cra_deadlines SET filed_at = ? WHERE id = ? AND filed_at IS NULL`).bind(
        nowIso,
        row.id
      ),
    ]);
    filed += 1;
  }

  const queued = await env.BRIDGE_DB.prepare(
    `SELECT id, interval_json, variant_json FROM ag_runs WHERE status IN ('QUEUED','RUNNING')`
  ).all<{ id: string; interval_json: string; variant_json: string | null }>();

  let scored = 0;
  for (const run of queued.results ?? []) {
    const evalResult = await scoreOrDry(env, run);
    const ev = await putEvidence(env, {
      subjectType: "ag_run",
      subjectId: run.id,
      body: JSON.stringify(evalResult),
    });
    await env.BRIDGE_DB.batch([
      env.BRIDGE_DB.prepare(
        `INSERT INTO ag_scores (id, run_id, modality, score_json, fetch_count, evidence_id)
         VALUES (?, ?, 'variant_effect', ?, 0, ?)`
      ).bind(id("scr"), run.id, JSON.stringify(evalResult), ev.id),
      env.BRIDGE_DB.prepare(`UPDATE ag_runs SET status = 'SCORED', error = NULL WHERE id = ?`).bind(run.id),
    ]);
    scored += 1;
  }

  await env.BRIDGE_DB.prepare(
    `INSERT INTO automation_ticks (id, due_scanned, filed, missed, scored) VALUES (?, ?, ?, ?, ?)`
  )
    .bind(id("tick"), due, filed, missed, scored)
    .run();

  return { due, filed, missed, scored };
}
