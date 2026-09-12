import { assertAwareness, deriveDeadlines, parseIsoZ } from "./cra/clock";
import { assertAllowed, validateHoldHumanAuth } from "./holds";
import { putEvidence } from "./evidence";
import { scoreOrDry } from "./ag/client";

export interface Env {
  BRIDGE_DB: D1Database;
  EVIDENCE: R2Bucket;
  AG_TOS_OK: string;
  AG_API_KEY?: string;
  CRA_SRP_LIVE: string;
  AG_API_BASE: string;
  ENABLE_CRA_COMPLIANCE: string;
  ENABLE_HOLD_GATE: string;
  ENABLE_AG_SCORING: string;
  HOLD_HUMAN_KEY: string;
  WORKER_ROLE: string;
}

export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    const url = new URL(req.url);
    const path = url.pathname;

    // CORS headers
    const corsHeaders = {
      "Access-Control-Allow-Origin": "https://void-preview.pages.dev",
      "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type,Authorization,x-hold-human-key",
      "Access-Control-Max-Age": "86400",
    };

    if (req.method === "OPTIONS") {
      return new Response(null, { headers: corsHeaders });
    }

    // GET /v1/compliance/health
    if (req.method === "GET" && path === "/v1/compliance/health") {
      const tables = await env.BRIDGE_DB.prepare(
        "SELECT name FROM sqlite_master WHERE type='table' AND name IN ('orgs','products','cra_cases','cra_deadlines','cra_submissions','holds','ag_runs','ag_scores','evidence_objects')"
      ).all();
      const tableNames = (tables.results ?? []).map((r: any) => r.name);
      return new Response(JSON.stringify({
        ok: tableNames.length === 9,
        worker: "aether-bridge",
        role: env.WORKER_ROLE,
        bridge_db: !!env.BRIDGE_DB,
        evidence_r2: !!env.EVIDENCE,
        ag_tos_ok: env.AG_TOS_OK === "1",
        cra_srp_live: env.CRA_SRP_LIVE === "1",
        tables: tableNames,
        art14_applied: "2026-09-11"
      }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // POST /v1/cra/cases
    if (req.method === "POST" && path === "/v1/cra/cases") {
      if (env.ENABLE_CRA_COMPLIANCE !== "true") {
        return new Response(JSON.stringify({ ok: false, error: "CRA_COMPLIANCE_DISABLED" }), { status: 503, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      const body = await req.json() as any;
      const awareDate = parseIsoZ(body.awareness_at);
      assertAwareness(new Date(), awareDate);

      const deadlines = deriveDeadlines({ kind: body.kind, awarenessAt: awareDate });
      const caseId = `cra_${crypto.randomUUID().slice(0, 8)}`;
      const holdId = `hld_${crypto.randomUUID().slice(0, 8)}`;
      const nowIso = new Date().toISOString();
      const expiresIso = new Date(Date.now() + 24 * 3600_000).toISOString();

      await env.BRIDGE_DB.batch([
        env.BRIDGE_DB.prepare(
          `INSERT INTO cra_cases (id, org_id, product_id, kind, title, summary, awareness_at, created_by)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
        ).bind(caseId, body.org_id, body.product_id, body.kind, body.title, body.summary ?? "", body.awareness_at, "operator"),
        env.BRIDGE_DB.prepare(
          `INSERT INTO holds (id, kind, subject_type, subject_id, status, expires_at, created_by)
           VALUES (?, 'packet', 'cra_case', ?, 'PENDING', ?, 'system')`
        ).bind(holdId, caseId, expiresIso),
        env.BRIDGE_DB.prepare(
          `INSERT INTO cra_deadlines (id, case_id, stage, due_at) VALUES (?, ?, 'early_24h', ?)`
        ).bind(`dl_${crypto.randomUUID().slice(0, 8)}`, caseId, deadlines.early_24h?.toISOString()),
        env.BRIDGE_DB.prepare(
          `INSERT INTO cra_deadlines (id, case_id, stage, due_at) VALUES (?, ?, 'notify_72h', ?)`
        ).bind(`dl_${crypto.randomUUID().slice(0, 8)}`, caseId, deadlines.notify_72h?.toISOString())
      ]);

      return new Response(JSON.stringify({ ok: true, id: caseId, hold_id: holdId, deadlines }), { status: 201, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // POST /v1/holds/:id/allow
    const allowMatch = path.match(/^\/v1\/holds\/([^/]+)\/allow$/);
    if (req.method === "POST" && allowMatch) {
      if (env.ENABLE_HOLD_GATE !== "true") {
        return new Response(JSON.stringify({ ok: false, error: "HOLD_GATE_DISABLED" }), { status: 503, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      const holdId = allowMatch[1];
      const auth = validateHoldHumanAuth(req, env.HOLD_HUMAN_KEY);
      if (!auth.ok) {
        return new Response(JSON.stringify({ ok: false, error: auth.code }), { status: auth.status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      const res = await env.BRIDGE_DB.prepare(
        `UPDATE holds SET status = 'ALLOWED', decided_by = 'human', decided_at = datetime('now'), version = version + 1
         WHERE id = ? AND status = 'PENDING'`
      ).bind(holdId).run();

      if (res.meta.changes === 0) {
        return new Response(JSON.stringify({ ok: false, error: "HOLD_NOT_PENDING_OR_NOT_FOUND" }), { status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      return new Response(JSON.stringify({ ok: true, hold_id: holdId, status: "ALLOWED" }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // POST /v1/ag/runs/:id/score
    const scoreMatch = path.match(/^\/v1\/ag\/runs\/([^/]+)\/score$/);
    if (req.method === "POST" && scoreMatch) {
      if (env.ENABLE_AG_SCORING !== "true") {
        return new Response(JSON.stringify({ ok: false, error: "AG_SCORING_DISABLED" }), { status: 503, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      const runId = scoreMatch[1];
      const run = await env.BRIDGE_DB.prepare("SELECT * FROM ag_runs WHERE id = ?").bind(runId).first<any>();
      if (!run) return new Response(JSON.stringify({ ok: false, error: "RUN_NOT_FOUND" }), { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });

      await assertAllowed(env.BRIDGE_DB, run.hold_id, "score");

      const evalResult = await scoreOrDry(env, run);
      const ev = await putEvidence(env, {
        subjectType: "ag_run",
        subjectId: runId,
        body: JSON.stringify(evalResult)
      });

      await env.BRIDGE_DB.prepare(
        `INSERT INTO ag_scores (id, run_id, modality, score_json, fetch_count, evidence_id)
         VALUES (?, ?, 'variant_effect', ?, 0, ?)`
      ).bind(`scr_${crypto.randomUUID().slice(0, 8)}`, runId, JSON.stringify(evalResult), ev.id).run();

      return new Response(JSON.stringify({ ok: true, status: "SCORED", mode: evalResult.mode, evidence: [ev] }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    return new Response(JSON.stringify({ error: "Not Found", available: ["/v1/compliance/health", "/v1/cra/cases", "/v1/holds/:id/allow", "/v1/ag/runs/:id/score"] }), { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
} satisfies ExportedHandler<Env>;