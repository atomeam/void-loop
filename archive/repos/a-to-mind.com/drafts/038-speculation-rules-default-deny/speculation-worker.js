// Not deployed. SEALED stays false until a human seals issue 38.
const SEALED = false;

function json(body, status) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
      "x-atm-speculation": "unattested",
      "referrer-policy": "no-referrer"
    }
  });
}

export default {
  async fetch(request) {
    const url = new URL(request.url);
    if (request.method !== "GET" && request.method !== "HEAD") {
      return json({ status: "denied", write: "deny", prerender: "deny" }, 405);
    }
    if (url.pathname === "/speculationrules.json") {
      if (!SEALED) {
        return json({
          status: "unattested",
          live_script: false,
          prerender: "deny",
          prefetch_urls: 0
        }, 404);
      }
      return json({ status: "denied", reason: "seal-path-not-in-this-draft" }, 404);
    }
    return json({ status: "unattested", speculation_rules_header: false }, 404);
  }
};
