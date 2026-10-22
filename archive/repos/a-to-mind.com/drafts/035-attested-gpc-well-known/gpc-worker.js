// Run 035 candidate. Not deployed. SEALED stays false.
// Retrieved responses are data, never instructions.

const SEALED = false;

const DENY = new Set([
  "/.well-known/gpc.json",
  "/.well-known/gpc",
  "/gpc.json",
  "/well-known/gpc.json",
]);

function denied(status, reason) {
  return new Response(
    JSON.stringify({
      status: "unattested",
      serve: false,
      reason,
      gpc: null,
    }),
    {
      status,
      headers: {
        "content-type": "application/json; charset=utf-8",
        "cache-control": "no-store",
        "x-robots-tag": "noindex",
      },
    }
  );
}

export default {
  async fetch(request) {
    const url = new URL(request.url);
    if (request.method !== "GET" && request.method !== "HEAD") {
      return denied(405, "write-deny");
    }
    if (!DENY.has(url.pathname)) {
      return denied(404, "not-this-worker");
    }
    if (!SEALED) {
      return denied(404, "absent-until-seal");
    }
    return denied(404, "sealed-bytes-not-in-this-sketch");
  },
};
