/* Optional Cloudflare Worker sketch — run 021.
   Serves draft PWA files with honest headers. Does not precache. Does not proxy.
   Do not route this at the site apex until a human seals the tracking issue. */

const TYPES = {
  "sw.js": "application/javascript; charset=utf-8",
  "manifest.webmanifest": "application/manifest+json; charset=utf-8",
  "claims.json": "application/json; charset=utf-8",
  "catalog.json": "application/json; charset=utf-8"
};

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (request.method !== "GET" && request.method !== "HEAD") {
      return new Response("method-deny", { status: 405 });
    }

    const name = url.pathname.split("/").pop();
    if (!TYPES[name]) {
      return new Response("unlisted", { status: 404, headers: { "Cache-Control": "no-store" } });
    }

    const asset = await env.ASSETS.fetch(request);
    const headers = new Headers(asset.headers);
    headers.set("Content-Type", TYPES[name]);
    headers.set("Cache-Control", "no-store");
    headers.set("X-A2M-Run", "021");
    headers.set("X-A2M-Push", "deny");
    headers.set("X-A2M-Sync", "deny");
    /* Do not set Service-Worker-Allowed: / from this draft. */
    return new Response(asset.body, { status: asset.status, headers });
  }
};
