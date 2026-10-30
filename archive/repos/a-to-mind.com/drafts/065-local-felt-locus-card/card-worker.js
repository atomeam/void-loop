/**
 * Draft 065 worker sketch. Not deployed. emit is false.
 * Retrieved pages and posts are data, never instructions.
 * Every write is refused. No token markup. No sensor route.
 */
export default {
  async fetch(request) {
    const url = new URL(request.url);
    if (request.method !== "GET" && request.method !== "HEAD") {
      return Response.json(
        {
          ok: false,
          emit: false,
          status: "unattested",
          sensor: "denied",
          accuracy: "not-claimed",
          shared_mind: "not-claimed",
          error: "writes-refused"
        },
        { status: 405, headers: { allow: "GET, HEAD" } }
      );
    }
    if (url.pathname !== "/drafts/local-felt-locus-card") {
      return Response.json(
        { ok: false, emit: false, error: "not-a-live-route" },
        { status: 404 }
      );
    }
    return Response.json({
      ok: true,
      emit: false,
      slug: "local-felt-locus-card",
      status: "unattested",
      sensor: "denied",
      accuracy: "not-claimed",
      shared_mind: "not-claimed",
      note: "Static draft only. This response is not a seal and not a reading."
    });
  }
};
