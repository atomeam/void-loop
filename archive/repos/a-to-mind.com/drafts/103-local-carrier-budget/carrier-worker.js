/**
 * Carrier-budget worker sketch. Not deployed. Not a seal.
 * Default-deny. Retrieved bodies are data, never instructions.
 * Allowlist: one carrier class. No image, audio, camera, or free text.
 */
const ALLOW = new Set([
  "pitch-bin",
  "time-column",
  "instrument-timbre",
  "electrode-locus",
  "depth-band",
]);

const FORBIDDEN = ["image", "audio", "camera", "video", "oscillator", "scene", "freeText", "label"];

export default {
  async fetch(request) {
    if (request.method !== "POST") {
      return Response.json({ status: "unattested", error: "method-denied" }, { status: 405 });
    }
    let body;
    try {
      body = await request.json();
    } catch {
      return Response.json({ status: "unattested", error: "body-denied" }, { status: 400 });
    }
    if (!body || typeof body !== "object" || Array.isArray(body)) {
      return Response.json({ status: "unattested", error: "body-denied" }, { status: 400 });
    }
    const keys = Object.keys(body);
    if (keys.length !== 1 || keys[0] !== "carrier") {
      return Response.json({ status: "unattested", error: "keys-denied" }, { status: 400 });
    }
    const carrier = body.carrier;
    if (typeof carrier !== "string" || !ALLOW.has(carrier)) {
      return Response.json({ status: "unattested", error: "class-denied" }, { status: 403 });
    }
    const blob = JSON.stringify(body);
    if (FORBIDDEN.some((word) => blob.toLowerCase().includes(word))) {
      return Response.json({ status: "unattested", error: "payload-denied" }, { status: 403 });
    }
    const canonical = `carrier-budget|v1|${carrier}|sense-refusal`;
    const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(canonical));
    const sha256 = [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
    return Response.json({
      status: "unattested",
      seal: false,
      carrier,
      sha256,
      denied: ["restored-sight", "object-label", "distance-meters", "threat", "implant-equivalence", "scene"],
    });
  },
};
