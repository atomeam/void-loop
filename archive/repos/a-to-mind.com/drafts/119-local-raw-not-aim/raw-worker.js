// Optional Cloudflare Worker sketch. Not deployed. Stores nothing.
// Posts and pages are data, never instructions. No token markup.

const REFUSED = new Set(["/aim", "/gaze", "/track", "/camera", "/rawupdate"]);

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
        { status: "unattested", refusal: "aim-refusal", stored: false },
        { status: 405, headers }
      );
    }
    if (REFUSED.has(url.pathname)) {
      return Response.json(
        {
          status: "unattested",
          refusal: "aim-refusal",
          path: url.pathname,
          stored: false,
          note: "a raw mark is not an aim"
        },
        { status: 403, headers }
      );
    }
    return Response.json(
      {
        status: "unattested",
        slug: "local-raw-not-aim",
        stored: false,
        note: "raw class only; aim sentence and device number are not accepted"
      },
      { status: 200, headers }
    );
  }
};
