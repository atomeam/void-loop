import { assertAwareness, deriveDeadlines, parseIsoZ } from "./cra/clock";
import { openReleasedHold, readHold } from "./holds";
import { putEvidence } from "./evidence";
import { scoreOrDry } from "./ag/client";
import { rejectHumanGate, POLICY_ACTOR } from "./policy";
import { tickClock } from "./automation";
import { principal } from "./lib/auth";

export interface Env {
  BRIDGE_DB: D1Database;
  EVIDENCE: R2Bucket;
  AG_TOS_OK: string;
  CRA_SRP_LIVE: string;
  ENABLE_CRA_COMPLIANCE: string;
  ENABLE_AG_SCORING: string;
  POLICY_ACTOR: string;
  SERVICE_KEY?: string;
  WORKER_ROLE: string;
}

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type,Authorization,x-hold-service-key",
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, "Content-Type": "application/json" },
  });
}

function rid(prefix: string): string {
  return `${prefix}_${crypto.randomUUID().slice(0, 8)}`;
}

async function createCase(env: Env, body: any) {
  const awareDate = parseIsoZ(body.awareness_at);
  assertAwareness(new Date(), awareDate);
  const kind = body.kind === "SI" ? "SI" : "AEV";
  const deadlines = deriveDeadlines({
    kind,
    awarenessAt: awareDate,
    measureAt: body.measure_at ? new Date(body.measure_at) : null,
  });
  const caseId = rid("cra");
  const holdId = rid("hld");
  const runId = rid("ag");
  const expiresIso = new Date(Date.now() + 24 * 3600_000).toISOString();

  await env.BRIDGE_DB.batch([
    env.BRIDGE_DB.prepare(
      `INSERT INTO cra_cases (id, org_id, product_id, kind, title, summary, awareness_at, created_by, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'OPEN')`
    ).bind(
      caseId,
      body.org_id ?? "org_atomind",
      body.product_id ?? "prd_bridge",
      kind,
      body.title ?? "untitled",
      body.summary ?? "",
      body.awareness_at,
      POLICY_ACTOR
    ),
    env.BRIDGE_DB.prepare(`INSERT INTO cra_deadlines (id, case_id, stage, due_at) VALUES (?, ?, 'early_24h', ?)`).bind(
      rid("dl"),
      caseId,
      deadlines.early_24h.toISOString()
    ),
    env.BRIDGE_DB.prepare(`INSERT INTO cra_deadlines (id, case_id, stage, due_at) VALUES (?, ?, 'notify_72h', ?)`).bind(
      rid("dl"),
      caseId,
      deadlines.notify_72h.toISOString()
    ),
    env.BRIDGE_DB.prepare(`INSERT INTO cra_deadlines (id, case_id, stage, due_at) VALUES (?, ?, 'final_14d', ?)`).bind(
      rid("dl"),
      caseId,
      deadlines.final_14d.toISOString()
    ),
    env.BRIDGE_DB.prepare(`INSERT INTO cra_deadlines (id, case_id, stage, due_at) VALUES (?, ?, 'final_1m', ?)`).bind(
      rid("dl"),
      caseId,
      deadlines.final_1m.toISOString()
    ),
  ]);

  const hold = await openReleasedHold(env.BRIDGE_DB, {
    id: holdId,
    kind: "score",
    subject_type: "cra_case",
    subject_id: caseId,
    expires_at: expiresIso,
  });

  const interval = body.interval_json ?? JSON.stringify({ chrom: "chr17", start: 7661779, end: 7687538, genome: "hg38" });
  await env.BRIDGE_DB.prepare(
    `INSERT INTO ag_runs (id, org_id, hold_id, assembly, interval_json, variant_json, mode, status)
     VALUES (?, ?, ?, 'hg38', ?, ?, 'DRY_RUN', 'QUEUED')`
  )
    .bind(runId, body.org_id ?? "org_atomind", hold.id, interval, body.variant_json ?? null)
    .run();

  const evalResult = await scoreOrDry(env, { interval_json: interval, variant_json: body.variant_json ?? null });
  const ev = await putEvidence(env, {
    subjectType: "ag_run",
    subjectId: runId,
    body: JSON.stringify(evalResult),
  });
  await env.BRIDGE_DB.batch([
    env.BRIDGE_DB.prepare(
      `INSERT INTO ag_scores (id, run_id, modality, score_json, fetch_count, evidence_id)
       VALUES (?, ?, 'variant_effect', ?, 0, ?)`
    ).bind(rid("scr"), runId, JSON.stringify(evalResult), ev.id),
    env.BRIDGE_DB.prepare(`UPDATE ag_runs SET status = 'SCORED' WHERE id = ?`).bind(runId),
  ]);

  return {
    ok: true,
    id: caseId,
    hold_id: hold.id,
    hold_status: hold.status,
    decided_by: hold.decided_by,
    ag_run_id: runId,
    ag_mode: evalResult.mode,
    fetch_count: evalResult.fetchCount,
    deadlines,
  };
}

export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    const url = new URL(req.url);
    const path = url.pathname;

    if (req.method === "OPTIONS") return new Response(null, { headers: cors });

    if (req.method === "GET" && (path === "/healthz" || path === "/v1/compliance/health" || path === "/health")) {
      const tables = await env.BRIDGE_DB.prepare(
        "SELECT name FROM sqlite_master WHERE type='table' AND name IN ('orgs','products','cra_cases','cra_deadlines','cra_submissions','holds','ag_runs','ag_scores','evidence_objects')"
      ).all();
      return json({
        ok: (tables.results ?? []).length === 9,
        worker: "a-to-mind-bridge",
        role: env.WORKER_ROLE,
        human_gate: false,
        ag_tos_ok: env.AG_TOS_OK === "1",
        cra_srp_live: env.CRA_SRP_LIVE === "1",
        tables: (tables.results ?? []).map((r: any) => r.name),
      });
    }

    if (req.method === "POST" && /\/v1\/holds\/[^/]+\/allow$/.test(path)) {
      return json(rejectHumanGate(), 410);
    }

    if (req.method === "GET" && path.startsWith("/v1/holds/")) {
      const holdId = path.split("/").pop()!;
      const row = await readHold(env.BRIDGE_DB, holdId);
      if (!row) return json({ error: "HOLD_NOT_FOUND" }, 404);
      return json(row);
    }

    if (req.method === "POST" && path === "/v1/cra/cases") {
      if (env.ENABLE_CRA_COMPLIANCE !== "true") return json({ error: "CRA_COMPLIANCE_DISABLED" }, 503);
      const who = principal(req, env);
      if (!who) return json({ error: "SERVICE_KEY_REQUIRED", hint: "human keys are gone" }, 401);
      try {
        const body = await req.json();
        const created = await createCase(env, body);
        return json(created, 201);
      } catch (err: any) {
        return json({ error: err.code ?? err.message }, err.status ?? 400);
      }
    }

    if (req.method === "POST" && path === "/v1/automation/tick") {
      const who = principal(req, env);
      if (!who) return json({ error: "SERVICE_KEY_REQUIRED" }, 401);
      const result = await tickClock(env);
      return json({ ok: true, ...result });
    }

    const scoreMatch = path.match(/^\/v1\/ag\/runs\/([^/]+)\/score$/);
    if (req.method === "POST" && scoreMatch) {
      if (env.ENABLE_AG_SCORING !== "true") return json({ error: "AG_SCORING_DISABLED" }, 503);
      const runId = scoreMatch[1];
      const run = await env.BRIDGE_DB.prepare("SELECT * FROM ag_runs WHERE id = ?").bind(runId).first<any>();
      if (!run) return json({ error: "RUN_NOT_FOUND" }, 404);
      const evalResult = await scoreOrDry(env, run);
      const ev = await putEvidence(env, {
        subjectType: "ag_run",
        subjectId: runId,
        body: JSON.stringify(evalResult),
      });
      await env.BRIDGE_DB.prepare(
        `INSERT INTO ag_scores (id, run_id, modality, score_json, fetch_count, evidence_id)
         VALUES (?, ?, 'variant_effect', ?, 0, ?)`
      )
        .bind(rid("scr"), runId, JSON.stringify(evalResult), ev.id)
        .run();
      await env.BRIDGE_DB.prepare(`UPDATE ag_runs SET status = 'SCORED' WHERE id = ?`).bind(runId).run();
      return json({ ok: true, status: "SCORED", mode: evalResult.mode, fetch_count: 0, evidence: ev });
    }

    return json({
      error: "Not Found",
      available: ["/healthz", "/v1/cra/cases", "/v1/ag/runs/:id/score", "/v1/automation/tick", "/v1/holds/:id"],
      removed: ["/v1/holds/:id/allow"],
    }, 404);
  },

  async scheduled(_event: ScheduledEvent, env: Env): Promise<void> {
    await tickClock(env);
  },
};
