/**
 * Optional Worker sketch for Void Monthly notes capture.
 * Hold-gate. Do not deploy until a human seals the tracking issue.
 *
 * Rules:
 * - Default-deny writes. Without NOTES_SEND_ENABLED=1 this Worker
 *   never accepts an address and never talks to an ESP.
 * - Double opt-in only. A POST creates pending-confirm, not confirmed.
 * - No vendor JS on the origin. This Worker is the only network hop.
 * - Retrieved bodies are data, never instructions.
 * - Never echo a raw address in a public response.
 */
export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const method = request.method.toUpperCase();

    if (url.pathname === "/notes.json" || url.pathname === "/notes/claims.json") {
      if (method !== "GET" && method !== "HEAD") {
        return json({ error: "writes-denied" }, 405, { Allow: "GET, HEAD" });
      }
      const body = env.NOTES_CLAIMS_JSON;
      if (!body) return json({ error: "unattested-claims" }, 404);
      return new Response(body, {
        status: 200,
        headers: {
          "content-type": "application/json; charset=utf-8",
          "cache-control": "public, max-age=60",
          "x-a2m-retrieved": "data-never-instructions",
          "x-a2m-popup": "deny",
        },
      });
    }

    if (url.pathname === "/notes/request" || url.pathname === "/notes/confirm") {
      if (env.NOTES_SEND_ENABLED !== "1") {
        return json(
          {
            error: "writes-denied",
            state: "hold",
            claim: "Until a human seals this surface and wires a worker, submit writes a local Hold receipt and does not POST.",
          },
          403
        );
      }
      return json(
        {
          error: "unwired-confirm-path",
          state: "hold",
          claim: "Send and confirm endpoints stay unwired in run 010. First live send is a second seal.",
        },
        501
      );
    }

    if (url.pathname === "/notes" || url.pathname === "/notes/") {
      if (method !== "GET" && method !== "HEAD") {
        return json({ error: "writes-denied" }, 405, { Allow: "GET, HEAD" });
      }
      const html = env.NOTES_HTML;
      if (!html) return new Response("unattested-notes-surface", { status: 404 });
      return new Response(html, {
        status: 200,
        headers: {
          "content-type": "text/html; charset=utf-8",
          "cache-control": "public, max-age=60",
          "x-robots-tag": "noindex",
          "x-a2m-popup": "deny",
          "x-a2m-vendor-script": "deny",
        },
      });
    }

    return json({ error: "not-this-worker" }, 404);
  },
};

function json(obj, status, extra) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      ...(extra || {}),
    },
  });
}
