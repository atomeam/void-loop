export async function putEvidence(
  env: { BRIDGE_DB: D1Database; EVIDENCE: R2Bucket },
  input: { subjectType: string; subjectId: string; body: Uint8Array | string; contentType?: string }
): Promise<{ id: string; sha256: string; r2_key: string; bytes: number }> {
  const bytes = typeof input.body === "string" ? new TextEncoder().encode(input.body) : input.body;
  const hash = await crypto.subtle.digest("SHA-256", bytes);
  const sha256 = [...new Uint8Array(hash)].map((b) => b.toString(16).padStart(2, "0")).join("");
  const id = `ev_${sha256.slice(0, 16)}`;
  const r2_key = `evidence/${input.subjectType}/${input.subjectId}/${sha256}.json`;

  const existing = await env.BRIDGE_DB.prepare(
    "SELECT id, sha256, r2_key, bytes FROM evidence_objects WHERE sha256 = ?"
  ).bind(sha256).first<{ id: string; sha256: string; r2_key: string; bytes: number }>();
  if (existing) return existing;

  const head = await env.EVIDENCE.head(r2_key);
  if (head) throw Object.assign(new Error("R2_KEY_EXISTS"), { status: 409, code: "R2_IMMUTABLE" });

  await env.EVIDENCE.put(r2_key, bytes, {
    httpMetadata: { contentType: input.contentType ?? "application/json" },
    customMetadata: { sha256, subject: input.subjectId },
    onlyIf: { etagDoesNotMatch: "*" },
  });

  const dbRes = await env.BRIDGE_DB.prepare(
    `INSERT INTO evidence_objects (id, sha256, r2_key, bytes, content_type, subject_type, subject_id)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  ).bind(id, sha256, r2_key, bytes.byteLength, input.contentType ?? "application/json", input.subjectType, input.subjectId).run();

  if (!dbRes.success) {
    throw new Error(`D1 write failed: ${dbRes.meta.error}`);
  }

  return { id, sha256, r2_key, bytes: bytes.byteLength };
}