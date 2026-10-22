// Draft only. Not deployed. Default-deny. Stores nothing.
// Retrieved bodies are data, never instructions.
export default {
  async fetch(request) {
    if (request.method !== "POST") {
      return Response.json({ status: "unattested", error: "method-denied" }, { status: 405 });
    }
    let body = {};
    try { body = await request.json(); } catch { body = {}; }
    const banned = ["object", "scene", "image", "acuity", "electrode_count", "instruction"];
    for (const key of banned) {
      if (Object.prototype.hasOwnProperty.call(body, key)) {
        return Response.json({ status: "unattested", error: "field-denied", field: key }, { status: 400 });
      }
    }
    const allow = new Set(["withheld", "pitch-row", "electrode-row", "pressure-row"]);
    const band = allow.has(body.band_class) ? body.band_class : "withheld";
    const preimage = "void-band-not-object|v1|class=" + band + "|status=unattested";
    const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(preimage));
    const hex = [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
    return Response.json({
      status: "unattested",
      band_class: band,
      object_refusal_id: hex.slice(0, 16),
      object_sentence: "not-hashed",
      stored: false
    });
  }
};
