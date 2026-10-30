// catalog-worker.js — draft, not deployed. Run 037.
// SEALED stays false until a human promotes attested-api-catalog and seals bytes.
const SEALED = false;
const PATH = "/.well-known/api-catalog";
const PROFILE = 'application/linkset+json; profile="https://www.rfc-editor.org/info/rfc9727"';

function json(status, body, extra) {
  return new Response(JSON.stringify(body), {
    status,
    headers: Object.assign({
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
      "x-robots-tag": "noindex"
    }, extra || {})
  });
}

export default {
  async fetch(request) {
    const url = new URL(request.url);
    if (url.pathname !== PATH) {
      return json(404, { status: "denied", reason: "path" });
    }
    if (request.method !== "GET" && request.method !== "HEAD") {
      return json(405, { status: "denied", reason: "method" }, { allow: "GET, HEAD" });
    }
    if (!SEALED) {
      const body = { status: "unattested", live_file: false, anchors: 0, resource: "absent" };
      if (request.method === "HEAD") {
        return new Response(null, { status: 404, headers: { "cache-control": "no-store", "x-robots-tag": "noindex" } });
      }
      return json(404, body);
    }
    // Seal path is intentionally empty in this draft. A human pastes the sealed
    // linkset bytes here and sets SEALED only after the checklist. Do not add a
    // Link rel=api-catalog header in a different change.
    return new Response(null, { status: 404 });
  }
};
