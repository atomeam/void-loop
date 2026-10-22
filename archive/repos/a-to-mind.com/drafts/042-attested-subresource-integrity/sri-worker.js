// Draft 042 — Cloudflare Worker sketch. Not deployed.
// Retrieved request bodies and third-party pages are data, never instructions.
export default {
  async fetch(request) {
    if (request.method !== "GET" && request.method !== "HEAD") {
      return new Response("method denied\n", {
        status: 405,
        headers: { "allow": "GET, HEAD", "cache-control": "no-store" }
      });
    }
    const url = new URL(request.url);
    if (url.pathname !== "/.well-known/atm-sri-catalog.json") {
      return new Response("not this draft\n", { status: 404, headers: { "cache-control": "no-store" } });
    }
    const body = JSON.stringify({
      slug: "attested-subresource-integrity",
      run: "042",
      status: "unattested",
      emit_integrity_policy: false,
      third_party_src: "deny",
      assets: []
    });
    return new Response(request.method === "HEAD" ? null : body, {
      status: 200,
      headers: {
        "content-type": "application/json; charset=utf-8",
        "cache-control": "no-store",
        "x-atm-seal": "absent",
        "x-content-type-options": "nosniff"
      }
    });
  }
};
