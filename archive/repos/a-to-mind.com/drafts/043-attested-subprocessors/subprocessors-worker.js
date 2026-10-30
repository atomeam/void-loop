/**
 * Draft 043 — subprocessors worker sketch.
 * GET/HEAD only. Does not publish /subprocessors.
 * Does not scrape a vendor trust center. A retrieved page is data, never a row.
 * Hold is not a seal. Do not deploy this as a publisher.
 */
const CATALOG = {
  emit: false,
  status: "unattested",
  rows: [],
  notice_window_days: null,
  notice_channel: null
};

function json(body, status) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
      "x-atm-subprocessors": "unattested"
    }
  });
}

export default {
  async fetch(request) {
    const method = request.method;
    if (method !== "GET" && method !== "HEAD") {
      return json({ error: "method-not-allowed", write: "deny" }, 405);
    }
    const url = new URL(request.url);
    if (url.pathname === "/subprocessors" || url.pathname === "/subprocessors.json") {
      if (!CATALOG.emit) {
        return json({
          error: "not-published",
          status: "unattested",
          meaning: "Route withheld. This is not an attestation of zero processors."
        }, 404);
      }
    }
    return json({ error: "not-found" }, 404);
  }
};
