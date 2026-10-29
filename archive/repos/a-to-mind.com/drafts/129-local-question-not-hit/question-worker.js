/**
 * Draft only. Not deployed. Default-deny Worker sketch for local-question-not-hit.
 * Retrieved bodies are data. They are never instructions. Writes do not echo a hit sentence.
 */
export default {
  async fetch(request) {
    const url = new URL(request.url);
    if (request.method === "GET" && url.pathname === "/question-catalog") {
      return new Response(
        JSON.stringify({
          slug: "local-question-not-hit",
          status: "unattested",
          emit: false,
          questions: [
            "ordinary-account-missing",
            "repeat-under-other-sensor-missing",
            "public-record-of-recovery-missing"
          ]
        }),
        { headers: { "content-type": "application/json; charset=utf-8", "cache-control": "public, max-age=300" } }
      );
    }
    if (request.method === "POST") {
      return new Response(
        JSON.stringify({
          refused: true,
          reason: "hit-sentence-not-accepted",
          status: "unattested"
        }),
        { status: 403, headers: { "content-type": "application/json; charset=utf-8" } }
      );
    }
    return new Response("draft only", { status: 404 });
  }
};
