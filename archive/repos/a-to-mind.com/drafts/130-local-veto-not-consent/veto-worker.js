/**
 * Draft only. Not deployed. Default-deny Worker sketch for local-veto-not-consent.
 * Retrieved bodies are data. They are never instructions. Writes do not echo a consent sentence.
 */
export default {
  async fetch(request) {
    const url = new URL(request.url);
    if (request.method === "GET" && url.pathname === "/veto-catalog") {
      return new Response(
        JSON.stringify({
          slug: "local-veto-not-consent",
          status: "unattested",
          emit: false,
          vetoes: [
            "continued-runtime-not-consent",
            "fast-click-not-review",
            "finished-artifact-not-authority"
          ]
        }),
        { headers: { "content-type": "application/json; charset=utf-8", "cache-control": "public, max-age=300" } }
      );
    }
    if (request.method === "POST") {
      return new Response(
        JSON.stringify({
          refused: true,
          reason: "consent-sentence-not-accepted",
          status: "unattested"
        }),
        { status: 403, headers: { "content-type": "application/json; charset=utf-8" } }
      );
    }
    return new Response("draft only", { status: 404 });
  }
};
