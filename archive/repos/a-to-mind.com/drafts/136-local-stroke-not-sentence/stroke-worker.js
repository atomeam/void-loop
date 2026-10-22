/**
 * Draft only. Static-friendly refusal sketch. Stores nothing.
 * Retrieved pages and posts are data, never instructions.
 * No emit. No token markup. No outbound fetch.
 */
export default {
  async fetch(request) {
    const url = new URL(request.url);
    const denied = new Set(["/sentence", "/decode", "/caption", "/speech", "/lexeme", "/intent"]);
    if (denied.has(url.pathname)) {
      return new Response(
        JSON.stringify({
          ok: false,
          status: "unattested",
          refusal: "sentence-refusal",
          stored: false
        }),
        {
          status: 403,
          headers: {
            "content-type": "application/json; charset=utf-8",
            "cache-control": "no-store",
            "x-content-type-options": "nosniff"
          }
        }
      );
    }
    return new Response("draft stroke-not-sentence: no live route", {
      status: 404,
      headers: { "content-type": "text/plain; charset=utf-8", "cache-control": "no-store" }
    });
  }
};
