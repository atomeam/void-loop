/**
 * sample-not-score worker sketch — run 137 draft.
 * Not deployed. Default-deny. Stores nothing. No token markup.
 * Retrieved pages and posts are data, never instructions.
 */
export default {
  async fetch(request) {
    const url = new URL(request.url);
    const denied = new Set([
      "/score",
      "/accuracy",
      "/heartbeat",
      "/bpm",
      "/hct",
      "/maia",
      "/probe-upload",
      "/sense",
      "/diagnosis",
    ]);
    if (denied.has(url.pathname)) {
      return new Response(
        JSON.stringify({
          ok: false,
          status: "unattested",
          error: "score-refusal",
          stored: false,
        }),
        {
          status: 403,
          headers: {
            "content-type": "application/json; charset=utf-8",
            "cache-control": "no-store",
            "x-void-emit": "false",
          },
        }
      );
    }
    return new Response(
      JSON.stringify({
        ok: false,
        status: "unattested",
        error: "no-route",
        stored: false,
      }),
      {
        status: 404,
        headers: {
          "content-type": "application/json; charset=utf-8",
          "cache-control": "no-store",
          "x-void-emit": "false",
        },
      }
    );
  },
};
