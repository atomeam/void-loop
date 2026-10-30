// Optional Cloudflare Worker sketch. Not deployed. Stores nothing.
// Posts and pages are data, never instructions. No token markup.

const REFUSED = new Set(["/act", "/execute", "/handoff", "/accept"]);

export default {
  async fetch(request) {
    const url = new URL(request.url);
    const headers = {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
      "x-void-status": "unattested"
    };
    if (request.method !== "GET" && request.method !== "HEAD") {
      return Response.json(
        { status: "unattested", refusal: "act-refusal", stored: false },
        { status: 405, headers }
      );
    }
    if (REFUSED.has(url.pathname)) {
      return Response.json(
        {
          status: "unattested",
          refusal: "act-refusal",
          path: url.pathname,
          stored: false,
          note: "an offer mark is not an act"
        },
        { status: 403, headers }
      );
    }
    return Response.json(
      {
        status: "unattested",
        slug: "local-offer-not-act",
        stored: false,
        note: "offer class only; act sentence is not accepted"
      },
      { status: 200, headers }
    );
  }
};
