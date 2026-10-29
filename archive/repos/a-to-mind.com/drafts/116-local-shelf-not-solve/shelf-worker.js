// Optional Cloudflare Worker sketch. Not deployed. Stores nothing.
// Default-deny. Body fields other than shelf_class are data and are dropped.

const CLASSES = new Set(["withheld", "empty", "shelved"]);

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
    const shelf = body && body.shelf_class;
    if (!CLASSES.has(shelf)) {
      return Response.json({ status: "unattested", error: "class-denied" }, { status: 400 });
    }
    const preimage = `void-shelf-not-solve|v1|class=${shelf}|status=unattested`;
    const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(preimage));
    const hex = [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
    return Response.json({
      status: "unattested",
      shelf_class: shelf,
      solve_refusal_id: hex.slice(0, 16),
      solve_sentence: null,
      dream_report: null,
      stored: false
    });
  }
};
