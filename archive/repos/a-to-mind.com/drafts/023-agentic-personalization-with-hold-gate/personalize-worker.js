/**
 * Optional GET-only facets worker. Hold-gate.
 * Serves facets.json with a digest header. Does not accept a profile POST.
 * Does not infer. Does not start a run.
 */
export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (request.method !== "GET") {
      return new Response("method deny", { status: 405 });
    }
    if (url.pathname !== "/drafts/023-agentic-personalization-with-hold-gate/facets.json") {
      return new Response("path deny", { status: 404 });
    }
    const body = await env.ASSETS.fetch(request);
    const text = await body.text();
    const digest = await sha256Hex(text);
    return new Response(text, {
      status: 200,
      headers: {
        "content-type": "application/json; charset=utf-8",
        "cache-control": "public, max-age=60",
        "x-facets-sha256": digest,
        "x-profile-post": "deny",
        "x-infer": "deny",
        "x-run": "deny",
      },
    });
  },
};

async function sha256Hex(text) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}
