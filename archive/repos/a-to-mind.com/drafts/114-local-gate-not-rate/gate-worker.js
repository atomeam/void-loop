// Optional Cloudflare Worker sketch. Not deployed. Stores nothing.
// Default-deny. Body fields other than gate_class are data and are dropped.

const CLASSES = new Set(["withheld", "closed", "open-unrated"]);

export default {
  async fetch(request) {
    if (request.method !== "POST") {
      return Response.json({ status: "unattested", error: "default-deny" }, { status: 405 });
    }
    let body = {};
    try {
      body = await request.json();
    } catch {
      return Response.json({ status: "unattested", error: "not-json" }, { status: 400 });
    }
    const gate = body && body.gate_class;
    if (!CLASSES.has(gate)) {
      return Response.json({ status: "unattested", error: "class-denied" }, { status: 400 });
    }
    const preimage = `void-gate-not-rate|v1|class=${gate}|status=unattested`;
    const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(preimage));
    const hex = [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
    return Response.json({
      status: "unattested",
      gate_class: gate,
      rate_refusal_id: hex.slice(0, 16),
      rate_sentence: null,
      stored: false
    });
  }
};
