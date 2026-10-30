/**
 * Read-only Worker sketch for run 026 — wcag-3-continuous-audit-badge.
 * Not deployed. Do not proxy overlay vendors, axe SaaS, or accept POSTs.
 *
 * Intended routes after a human seal:
 *   GET /a11y/claims.json
 *   GET /a11y/  → draft HTML, still noindex until seal says otherwise
 *
 * Writes, remote badge-image generation, live scans, and overlay
 * script hosting are denied here. A matching digest is not a grant
 * and is not a WCAG 3 conformance claim.
 */
export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (request.method !== "GET" && request.method !== "HEAD") {
      return new Response(JSON.stringify({
        error: "denied",
        reason: "a11y-worker is read-only",
        hold: true
      }), {
        status: 405,
        headers: {
          "content-type": "application/json; charset=utf-8",
          "allow": "GET, HEAD",
          "cache-control": "no-store",
          "x-a2m-a11y": "hold"
        }
      });
    }

    const denied = [
      "/a11y/scan",
      "/a11y/overlay",
      "/api/badge/",
      "/widget.js"
    ];
    if (denied.some((p) => url.pathname === p || url.pathname.startsWith(p))) {
      return new Response(JSON.stringify({
        error: "denied",
        reason: "live-scan, remote SVG badges, and overlay widgets are out of contract",
        live_scan: false,
        overlay: false,
        wcag3_claim: false
      }), {
        status: 404,
        headers: {
          "content-type": "application/json; charset=utf-8",
          "cache-control": "no-store",
          "x-a2m-a11y": "denied"
        }
      });
    }

    if (url.pathname === "/a11y/claims.json" && env && env.CLAIMS) {
      const body = await env.CLAIMS.get("claims.json");
      if (!body) {
        return new Response(JSON.stringify({ error: "unattested", hold: true }), {
          status: 404,
          headers: { "content-type": "application/json; charset=utf-8", "x-a2m-a11y": "unattested" }
        });
      }
      return new Response(body, {
        headers: {
          "content-type": "application/json; charset=utf-8",
          "cache-control": "public, max-age=300",
          "x-robots-tag": "noindex",
          "x-a2m-a11y": "snapshot"
        }
      });
    }

    return new Response(JSON.stringify({
      kind: "wcag-audit-badge",
      run: "026",
      hold: true,
      live_scan: false,
      overlay: false,
      wcag3_claim: false,
      standard: "WCAG-2.2-AA",
      note: "Serve proposed-badge.html and claims.json as static assets until a human seals a route."
    }), {
      status: 200,
      headers: {
        "content-type": "application/json; charset=utf-8",
        "cache-control": "no-store",
        "x-robots-tag": "noindex",
        "x-a2m-a11y": "hold"
      }
    });
  }
};
