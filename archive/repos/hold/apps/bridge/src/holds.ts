import { decideHold, POLICY_ACTOR } from "./policy";

export type HoldRow = {
  id: string;
  kind: string;
  subject_type: string;
  subject_id: string;
  status: string;
  decided_by: string | null;
};

export async function openReleasedHold(
  db: D1Database,
  input: { id: string; kind: string; subject_type: string; subject_id: string; expires_at: string }
): Promise<HoldRow> {
  const decision = decideHold(input.kind);
  const now = new Date().toISOString();
  await db
    .prepare(
      `INSERT INTO holds (
         id, kind, subject_type, subject_id, status, reason,
         created_by, decided_by, decided_at, expires_at
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .bind(
      input.id,
      input.kind,
      input.subject_type,
      input.subject_id,
      decision.status,
      decision.reason,
      POLICY_ACTOR,
      decision.decided_by,
      now,
      input.expires_at
    )
    .run();
  return {
    id: input.id,
    kind: input.kind,
    subject_type: input.subject_type,
    subject_id: input.subject_id,
    status: decision.status,
    decided_by: decision.decided_by,
  };
}

/** Observability only. Never blocks scoring or filing. */
export async function readHold(db: D1Database, holdId: string): Promise<HoldRow | null> {
  return db
    .prepare(
      "SELECT id, kind, subject_type, subject_id, status, decided_by FROM holds WHERE id = ?"
    )
    .bind(holdId)
    .first<HoldRow>();
}
