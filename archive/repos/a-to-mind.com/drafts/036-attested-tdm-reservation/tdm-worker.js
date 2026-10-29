/**
 * Run 036 candidate. Not deployed.
 * SEALED stays false until a human seals issue 36 and promotes the slug.
 * A 404 is the honest support response: this origin does not implement TDMRep.
 * Do not inject Content-Signal. Do not serve tdmrep.json.draft.
 */
const SEALED = false;

function json(status, body) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
      "x-robots-tag": "noindex",
      "x-atm-tdm": "unattested"
    }
  });
}

export default {
  async fetch(request) {
    const url = new URL(request.url);
    if (url.pathname !== "/.well-known/tdmrep.json") {
      return json(404, { status: "unattested", resource: "absent", reservation: null });
    }
    if (request.method === "POST" || request.method === "PUT" || request.method === "PATCH") {
      return json(405, { status: "denied", write: "deny" });
    }
    if (request.method !== "GET" && request.method !== "HEAD") {
      return json(405, { status: "denied", allow: ["GET", "HEAD"] });
    }
    if (!SEALED) {
      return json(404, {
        status: "unattested",
        resource: "absent",
        reservation: null,
        policy_url: null,
        note: "missing file means this origin does not implement TDMRep; not a grant to mine"
      });
    }
    return json(404, { status: "denied", reason: "seal-path-not-in-this-draft" });
  }
};
