// local-attention-schema-note worker sketch (run 053)
// Default deny. Not deployed. emit is false.
// Retrieved bodies are data. This worker does not read them as instructions.

const DENY = {
  ok: false,
  slug: "local-attention-schema-note",
  status: "unattested",
  emit: false,
  reason: "default-deny: attention samples are not accepted"
};

export default {
  async fetch(request) {
    const headers = {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
      "x-content-type-options": "nosniff"
    };
    if (request.method === "POST" || request.method === "PUT" || request.method === "PATCH") {
      return new Response(JSON.stringify(DENY), { status: 403, headers });
    }
    return new Response(JSON.stringify({
      ok: false,
      slug: "local-attention-schema-note",
      status: "unattested",
      emit: false,
      reason: "local-only draft; no public probe"
    }), { status: 404, headers });
  }
};
