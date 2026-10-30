/**
 * Optional GET-only catalog Worker. Hold-gate. Do not route production
 * traffic here until a human seals run 019.
 *
 * Serves drafts/019-glassbox-view-source-page/catalog.json as application/json.
 * Does not fetch other origins. Does not accept POST. Does not proxy view-source.
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
    if (url.pathname !== "/drafts/019-glassbox-view-source-page/catalog.json") {
      return new Response("not this worker", { status: 404 });
    }
    if (url.searchParams.has("url") || url.searchParams.has("fetch")) {
      return new Response("denied", {
        status: 403,
        headers: { "Cache-Control": "no-store", "X-A2M-Write": "deny" },
      });
    }
    const obj = await env.ASSETS.fetch(request);
    const body = await obj.text();
    return new Response(request.method === "HEAD" ? null : body, {
      status: 200,
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Cache-Control": "public, max-age=300",
        "X-Catalog-SHA256": "09022326bfa0c385cc96d1528e923ad8fac639b057171fe18085042292046864",
        "X-A2M-Scope": "first-party-allowlist",
        "X-A2M-Fetch-Any": "deny",
        "X-A2M-Write": "deny",
      },
    });
  },
};
