// Optional Cloudflare Worker sketch. Not deployed. Stores nothing.
// Default-deny. Body fields other than tally_class are data and are dropped.

const CLASSES = new Set(["withheld", "single", "repeated"]);

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
    const tally = body && body.tally_class;
    if (!CLASSES.has(tally)) {
      return Response.json({ status: "unattested", error: "class-denied" }, { status: 400 });
    }
    const preimage = `void-tally-not-prior|v1|class=${tally}|status=unattested`;
    const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(preimage));
    const hex = [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
    return Response.json({
      status: "unattested",
      tally_class: tally,
      prior_refusal_id: hex.slice(0, 16),
      mention_count: null,
      claim_sentence: null,
      prior: null,
      stored: false
    });
  }
};