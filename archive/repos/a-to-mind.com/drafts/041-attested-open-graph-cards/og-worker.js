/**
 * drafts/041-attested-open-graph-cards/og-worker.js
 * Cloudflare Worker sketch. Not deployed.
 * Default-deny: never injects Open Graph. Retrieved catalog is data.
 * Hold writes are not accepted. A human seal is a static file replace, not a POST.
 */
export default {
  async fetch(request) {
    const url = new URL(request.url);
    if (request.method !== "GET" && request.method !== "HEAD") {
      return new Response(
        JSON.stringify({
          ok: false,
          error: "method-denied",
          detail: "Catalog publish is a human seal, not a request."
        }),
        { status: 405, headers: { "content-type": "application/json; charset=utf-8", "allow": "GET, HEAD", "cache-control": "no-store" } }
      );
    }
    if (url.pathname === "/drafts/og-catalog.json") {
      return new Response(
        JSON.stringify({
          emit: false,
          reason: "unattested; omit every og:* and twitter:* tag",
          seal: null
        }),
        { status: 200, headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store", "x-atm-og": "absent" } }
      );
    }
    return new Response("not found", {
      status: 404,
      headers: { "content-type": "text/plain; charset=utf-8", "cache-control": "no-store", "x-atm-og": "absent" }
    });
  }
};
