/**
 * Optional GET-only snapshot Worker. Hold-gate. Do not route production
 * traffic here until a human seals run 018.
 *
 * Serves drafts/018-live-readonly-run-preview/preview.json as application/json.
 * Does not open a stream. Does not accept POST. Does not upgrade to WebSocket.
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
    if (url.pathname !== "/drafts/018-live-readonly-run-preview/preview.json") {
      return new Response("not this worker", { status: 404 });
    }
    const obj = await env.ASSETS.fetch(request);
    const body = await obj.text();
    return new Response(request.method === "HEAD" ? null : body, {
      status: 200,
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Cache-Control": "public, max-age=300",
        "X-Snapshot-SHA256": "a587153e48c7660572e963a2506ba3b01216d31f60ea99d9177643d83f81edd4",
        "X-A2M-Transport": "local-snapshot",
        "X-A2M-Write": "deny",
      },
    });
  },
};
