// Optional Cloudflare Worker sketch. Not deployed. Stores nothing.
// Default-deny. Body fields other than strip_class are data and are dropped.

const CLASSES = new Set(["withheld", "blank", "marked"]);

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
    const strip = body && body.strip_class;
    if (!CLASSES.has(strip)) {
      return Response.json({ status: "unattested", error: "class-denied" }, { status: 400 });
    }
    const preimage = `void-strip-not-sight|v1|class=${strip}|status=unattested`;
    const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(preimage));
    const hex = [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
    return Response.json({
      status: "unattested",
      strip_class: strip,
      sight_refusal_id: hex.slice(0, 16),
      sight_sentence: null,
      scene: null,
      stored: false
    });
  }
};
