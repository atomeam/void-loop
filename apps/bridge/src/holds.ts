export class HoldBlocked extends Error {
  status = 409;
  code = "HOLD_REQUIRED";
  constructor(public holdId: string, public holdStatus: string) {
    super(`Hold ${holdId} is ${holdStatus}`);
  }
}

export function constantTimeHmacCompare(expected: string, actual: string): boolean {
  if (expected.length !== actual.length) return false;
  let result = 0;
  for (let i = 0; i < expected.length; i++) {
    result |= expected.charCodeAt(i) ^ actual.charCodeAt(i);
  }
  return result === 0;
}

export function validateHoldHumanAuth(req: Request, expectedSecret?: string): { ok: boolean; status: number; code: string } {
  const header = req.headers.get("x-hold-human-key");
  if (!header) {
    return { ok: false, status: 401, code: "MISSING_HOLD_KEY" };
  }
  if (header.startsWith("sk_")) {
    return { ok: false, status: 403, code: "HUMAN_ONLY" };
  }
  if (!expectedSecret || !constantTimeHmacCompare(expectedSecret, header)) {
    return { ok: false, status: 403, code: "HUMAN_KEY_INVALID" };
  }
  return { ok: true, status: 200, code: "OK" };
}

export async function assertAllowed(db: D1Database, holdId: string, expectKind?: string) {
  const row = await db.prepare(
    "SELECT id, kind, subject_id, status, expires_at, version FROM holds WHERE id = ?"
  ).bind(holdId).first<{ id: string; kind: string; subject_id: string; status: string; expires_at: string; version: number }>();

  if (!row) throw Object.assign(new Error("HOLD_NOT_FOUND"), { status: 404, code: "HOLD_NOT_FOUND" });
  if (expectKind && row.kind !== expectKind) {
    throw Object.assign(new Error("HOLD_KIND_MISMATCH"), { status: 409, code: "HOLD_KIND_MISMATCH" });
  }
  if (row.status === "PENDING" && Date.parse(row.expires_at) < Date.now()) {
    await db.prepare("UPDATE holds SET status = 'EXPIRED' WHERE id = ? AND status = 'PENDING'").bind(holdId).run();
    throw new HoldBlocked(holdId, "EXPIRED");
  }
  if (row.status !== "ALLOWED") {
    throw new HoldBlocked(holdId, row.status);
  }
  return row;
}