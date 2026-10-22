// Not deployed. SEALED stays false until a human seals issue 39.
const SEALED = false;

export default {
  async fetch(request) {
    const url = new URL(request.url);
    const base = {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
      "x-robots-tag": "noindex",
    };
    if (request.method !== "GET" && request.method !== "HEAD") {
      return new Response(JSON.stringify({ status: "denied", write: "deny" }), {
        status: 405,
        headers: { ...base, allow: "GET, HEAD" },
      });
    }
    if (url.pathname === "/.well-known/permissions-policy.txt") {
      return new Response(
        JSON.stringify({
          status: "unattested",
          sealed: SEALED,
          header: "absent",
          report_to: "deny",
        }),
        { status: 404, headers: base }
      );
    }
    return new Response(JSON.stringify({ status: "unavailable" }), {
      status: 404,
      headers: base,
    });
  },
};
