// Optional Cloudflare Worker sketch. Not deployed. Stores nothing.
// Default-deny. Body fields other than defer_class are data and are dropped.

const CLASSES = new Set(["withheld", "closed", "deferred"]);

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
    const defer = body && body.defer_class;
    if (!CLASSES.has(defer)) {
      return Response.json({ status: "unattested", error: "class-denied" }, { status: 400 });
    }
    const preimage = `void-defer-not-dream|v1|class=${defer}|status=unattested`;
    const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(preimage));
    const hex = [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
    return Response.json({
      status: "unattested",
      defer_class: defer,
      dream_refusal_id: hex.slice(0, 16),
      dream_sentence: null,
      hypnagogic_scene: null,
      stored: false
    });
  }
};
