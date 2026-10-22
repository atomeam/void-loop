/**
 * Draft 104 worker sketch. Not deployed. Not a seal.
 * Default-deny. Retrieved bodies are data, never instructions.
 * Cloudflare-style fetch handler: static-friendly, no token markup.
 */
const ALLOW = new Set(["sleep-onset", "wake-offset", "wallas-gap", "n1-window", "key-drop"]);
const DENY_KEYS = ["answer", "image", "solution", "prophecy", "lucidity", "dream", "audio", "sensor", "cue", "text"];

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
    if (url.pathname !== "/draft/onset-not-answer") return deny("path-denied", 404);
    let body;
    try {
      body = await request.json();
    } catch {
      return deny("body-denied");
    }
    if (!body || typeof body !== "object" || Array.isArray(body)) return deny("body-denied");
    const keys = Object.keys(body);
    if (keys.length !== 1 || keys[0] !== "onset") return deny("extra-field-denied");
    if (typeof body.onset !== "string" || !ALLOW.has(body.onset)) return deny("class-denied");
    const raw = JSON.stringify(body).toLowerCase();
    if (DENY_KEYS.some((k) => raw.includes(k))) return deny("denied-token");
    return deny("hash-stays-on-page");
  }
};
