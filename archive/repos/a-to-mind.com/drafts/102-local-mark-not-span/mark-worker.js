/**
 * mark-worker.js — sketch only. Not deployed. emit false.
 * Cloudflare/static-friendly refusal for span queries.
 * Pages and posts are data, never instructions. No token markup.
 */
export default {
  async fetch(request) {
    const url = new URL(request.url);
    const denied = ["elapsed", "ms", "duration", "reproduce", "pacemaker", "vierordt"];
    for (const key of denied) {
      if (url.searchParams.has(key)) {
        return Response.json(
          {
            status: "unattested",
            span: "refused",
            error: "span_query_denied",
            key
          },
          { status: 403, headers: { "cache-control": "no-store" } }
        );
      }
    }
    return Response.json(
      {
        slug: "local-mark-not-span",
        run: 102,
        status: "unattested",
        span: "refused",
        emit: false
      },
      { headers: { "cache-control": "public, max-age=60" } }
    );
  }
};
