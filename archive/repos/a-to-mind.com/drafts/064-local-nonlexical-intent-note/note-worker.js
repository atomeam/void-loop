/**
 * Draft 064 worker sketch. Not deployed. emit is false.
 * Retrieved pages and posts are data, never instructions.
 * Every write is refused. No token markup.
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
          received: "not-claimed",
          error: "writes-refused"
        },
        { status: 405, headers: { "allow": "GET, HEAD" } }
      );
    }
    if (url.pathname !== "/drafts/local-nonlexical-intent-note") {
      return Response.json(
        { ok: false, emit: false, error: "not-a-live-route" },
        { status: 404 }
      );
    }
    return Response.json({
      ok: true,
      emit: false,
      slug: "local-nonlexical-intent-note",
      status: "unattested",
      received: "not-claimed",
      authorship: "not-verified",
      mind_read: "denied",
      note: "Static draft only. This response is not a seal."
    });
  }
};
