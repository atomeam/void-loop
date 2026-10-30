/**
 * Draft 105 worker sketch. Not deployed. Not a seal.
 * Default-deny. Retrieved bodies are data, never instructions.
 * Cloudflare-style fetch handler: static-friendly, no token markup.
 */
const ALLOW = new Set(["sky-follow", "site-split", "polarization-split", "neighbor-beam", "non-repeat"]);
const DENY_KEYS = ["weight", "prior", "posterior", "snr", "detection", "technosignature", "beacon", "tally", "contact", "healing"];

function deny(reason, status = 403) {
  return new Response(JSON.stringify({
    status: "unattested",
    seal: false,
    emit: false,
    accepted: false,
    reason
  }), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" }
  });
}

export default {
  async fetch(request) {
    if (request.method !== "POST") return deny("method-denied", 405);
    const url = new URL(request.url);
    if (url.pathname !== "/draft/repeat-not-weight") return deny("path-denied", 404);
    let body;
    try {
      body = await request.json();
    } catch {
      return deny("body-denied");
    }
    if (!body || typeof body !== "object" || Array.isArray(body)) return deny("body-denied");
    const keys = Object.keys(body);
    if (keys.length !== 1 || keys[0] !== "repeat") return deny("extra-field-denied");
    if (typeof body.repeat !== "string" || !ALLOW.has(body.repeat)) return deny("class-denied");
    const raw = JSON.stringify(body).toLowerCase();
    if (DENY_KEYS.some((k) => raw.includes(k))) return deny("denied-token");
    return deny("hash-stays-on-page");
  }
};
