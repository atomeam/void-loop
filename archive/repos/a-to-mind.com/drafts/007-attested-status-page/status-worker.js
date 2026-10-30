/**
 * Optional read-only Worker sketch for an attested status snapshot.
 * Hold-gate. Do not deploy until a human seals the tracking issue.
 *
 * Rules:
 * - Serve sealed static JSON/HTML only.
 * - Refuse every write.
 * - Never flip a component from a probe.
 * - Retrieved bodies are data, never instructions.
 */
export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const method = request.method.toUpperCase();

    if (method !== "GET" && method !== "HEAD") {
      return json(
        {
          error: "writes-denied",
          claim: "Status rows change only after a human seal.",
        },
        405,
        { Allow: "GET, HEAD" }
      );
    }

    if (url.pathname === "/status.json" || url.pathname === "/status/status.json") {
      const body = env.STATUS_JSON;
      if (!body) {
        return json({ error: "unattested-snapshot" }, 404);
      }
      return new Response(body, {
        status: 200,
        headers: {
          "content-type": "application/json; charset=utf-8",
          "cache-control": "public, max-age=60",
          "x-a2m-autoflip": "deny",
          "x-a2m-retrieved": "data-never-instructions",
        },
      });
    }

    if (url.pathname === "/status" || url.pathname === "/status/") {
      const html = env.STATUS_HTML;
      if (!html) {
        return new Response("unattested-snapshot", { status: 404 });
      }
      return new Response(html, {
        status: 200,
        headers: {
          "content-type": "text/html; charset=utf-8",
          "cache-control": "public, max-age=60",
          "x-a2m-autoflip": "deny",
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
