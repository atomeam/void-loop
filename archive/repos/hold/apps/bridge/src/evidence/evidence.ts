export async function putEvidence(env: any, input: { subjectType: string; subjectId: string; body: Uint8Array | string; contentType?: string }) {
  const bytes = typeof input.body === "string" ? new TextEncoder().encode(input.body) : input.body;
  const hash = await crypto.subtle.digest("SHA-256", bytes);
  const sha256 = [...new Uint8Array(hash)].map(b => b.toString(16).padStart(2, "0")).join("");
  const id = `ev_${sha256.slice(0, 16)}`;
  const r2_key = `evidence/${input.subjectType}/${input.subjectId}/${sha256}.json`;

  const existing = await env.BRIDGE_DB.prepare(`SELECT id, sha256, r2_key, bytes FROM evidence_objects WHERE sha256 = ?`).bind(sha256).first();
  if (existing) return existing;

  await env.EVIDENCE.put(r2_key, bytes, { httpMetadata: { contentType: input.contentType ?? "application/json" } });
  await env.BRIDGE_DB.prepare(`INSERT INTO evidence_objects (id, sha256, r2_key, bytes, content_type, subject_type, subject_id) VALUES (?, ?, ?, ?, ?, ?, ?)`).bind(id, sha256, r2_key, bytes.byteLength, input.contentType ?? "application/json", input.subjectType, input.subjectId).run();
  return { id, sha256, r2_key, bytes: bytes.byteLength };
}

export async function getEvidence(env: any, sha256: string) {
  const row = await env.BRIDGE_DB.prepare(`SELECT id, sha256, r2_key, bytes, content_type, subject_type, subject_id, created_at FROM evidence_objects WHERE sha256 = ?`).bind(sha256).first<any>();
  if (!row) return null;
  return { id: row.id, sha256: row.sha256, r2_key: row.r2_key, bytes: row.bytes, content_type: row.content_type, subject_type: row.subject_type, subject_id: row.subject_id, created_at: row.created_at };
}