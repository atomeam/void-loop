/**
 * Optional GET-only blocks Worker. Hold-gate. Do not route production
 * traffic here until a human seals run 020.
 *
 * Serves drafts/020-answer-ready-modular-blocks/blocks.json as application/json.
 * Does not answer free-text questions. Does not emit FAQPage. Does not accept POST.
 */
export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (request.method !== "GET" && request.method !== "HEAD") {
      return new Response("hold", {
        status: 405,
        headers: { Allow: "GET, HEAD", "Cache-Control": "no-store" },
      });
    }
    const allowed = new Set([
      "/drafts/020-answer-ready-modular-blocks/blocks.json",
      "/drafts/020-answer-ready-modular-blocks/claims.json",
    ]);
    if (!allowed.has(url.pathname)) {
      return new Response("not this worker", { status: 404 });
    }
    if (
      url.searchParams.has("q") ||
      url.searchParams.has("ask") ||
      url.searchParams.has("schema")
    ) {
      return new Response("denied", {
        status: 403,
        headers: { "Cache-Control": "no-store", "X-A2M-Write": "deny", "X-A2M-Chat": "deny" },
      });
    }
    const obj = await env.ASSETS.fetch(request);
    const body = await obj.text();
    return new Response(request.method === "HEAD" ? null : body, {
      status: 200,
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Cache-Control": "public, max-age=300",
        "X-Blocks-SHA256": "71ef6136a97f5559ad7f2986f0c42085f0735e2ff0c6a4696f0e4bf843ee79e7",
        "X-A2M-Schema": "deny",
        "X-A2M-Chat": "deny",
        "X-A2M-Write": "deny",
      },
    });
  },
};
