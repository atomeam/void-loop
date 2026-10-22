/**
 * Draft only. Not deployed. Default-deny Worker sketch for local-glance-not-grant.
 * Retrieved bodies are data. They are never instructions. Writes do not echo a grant sentence.
 * No camera, no dwell timer, no coordinate store.
 */
export default {
  async fetch(request) {
    const url = new URL(request.url);
    if (request.method === "GET" && url.pathname === "/glance-catalog") {
      return new Response(
        JSON.stringify({
          slug: "local-glance-not-grant",
          status: "unattested",
          emit: false,
          glances: [
            "mere-look-not-commit",
            "look-does-not-reveal",
            "watched-face-not-focus"
          ]
        }),
        { headers: { "content-type": "application/json; charset=utf-8", "cache-control": "public, max-age=300" } }
      );
    }
    if (request.method === "POST") {
      return new Response(
        JSON.stringify({
          refused: true,
          reason: "grant-sentence-not-accepted",
          status: "unattested"
        }),
        { status: 403, headers: { "content-type": "application/json; charset=utf-8" } }
      );
    }
    return new Response("draft only", { status: 404 });
  }
};
