/**
 * Read-only Worker sketch for run 025 — carbon-weight-badge.
 * Not deployed. Do not proxy third-party scanners or accept POSTs.
 *
 * Intended routes after a human seal:
 *   GET /carbon/claims.json
 *   GET /carbon/  → draft HTML, still noindex until seal says otherwise
 *
 * Writes, badge-image generation from a remote scan, and Green Web
 * Foundation live lookups are denied here. A matching digest is not a grant.
 */
export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (request.method !== "GET" && request.method !== "HEAD") {
      return new Response(JSON.stringify({
        error: "denied",
        reason: "carbon-worker is read-only",
        hold: true
      }), {
        status: 405,
        headers: {
          "content-type": "application/json; charset=utf-8",
          "allow": "GET, HEAD",
          "cache-control": "no-store",
          "x-a2m-carbon": "hold"
        }
      });
    }

    if (url.pathname === "/carbon/scan" || url.pathname.startsWith("/api/badge/")) {
      return new Response(JSON.stringify({
        error: "denied",
        reason: "live-scan and remote SVG badges are out of contract",
        live_scan: false
      }), {
        status: 404,
        headers: {
          "content-type": "application/json; charset=utf-8",
          "cache-control": "no-store",
          "x-a2m-carbon": "denied"
        }
      });
    }

    // After seal, bind CLAIMS as a KV/R2/asset read. Until then, refuse to invent grams.
    if (url.pathname === "/carbon/claims.json" && env && env.CLAIMS) {
      const body = await env.CLAIMS.get("claims.json");
      if (!body) {
        return new Response(JSON.stringify({ error: "unattested", hold: true }), {
          status: 404,
          headers: { "content-type": "application/json; charset=utf-8", "x-a2m-carbon": "unattested" }
        });
      }
      return new Response(body, {
        headers: {
          "content-type": "application/json; charset=utf-8",
          "cache-control": "public, max-age=300",
          "x-robots-tag": "noindex",
          "x-a2m-carbon": "snapshot"
        }
      });
    }

    return new Response(JSON.stringify({
      kind: "page-weight-badge",
      run: "025",
      hold: true,
      live_scan: false,
      offset: false,
      note: "Serve proposed-badge.html and claims.json as static assets until a human seals a route."
    }), {
      status: 200,
      headers: {
        "content-type": "application/json; charset=utf-8",
        "cache-control": "no-store",
        "x-robots-tag": "noindex",
        "x-a2m-carbon": "hold"
      }
    });
  }
};
