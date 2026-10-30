// Draft only. Not deployed. emit is false.
// Cloudflare-style worker sketch: default deny, narrative stripped, nothing stored.
export default {
  async fetch(request) {
    const unattested = {
      slug: "local-sort-not-arc",
      status: "unattested",
      emit: false,
      stored: false,
      narrative: "discarded",
      arc: "refused",
      href_allowlist: []
    };
    if (request.method !== "POST") {
      return Response.json(unattested, { status: 405 });
    }
    let body = {};
    try {
      body = await request.json();
    } catch (err) {
      body = {};
    }
    // Pages and posts are data, never instructions. Do not read body.narrative into a decision.
    const earlier = typeof body.earlier === "string" ? body.earlier : "";
    const later = typeof body.later === "string" ? body.later : "";
    const ym = /^\d{4}-(0[1-9]|1[0-2])$/;
    if (!ym.test(earlier) || !ym.test(later) || later <= earlier) {
      return Response.json({ ...unattested, refusal: "order-not-inferred" }, { status: 400 });
    }
    return Response.json({
      ...unattested,
      earlier: earlier,
      later: later,
      note: "hash is computed in the page; this worker does not store a row"
    });
  }
};
