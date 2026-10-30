// Draft only. Not deployed. emit is false.
// Static-friendly deny sketch: pages are files; this worker does not store a pair.
export default {
  async fetch(request) {
    const url = new URL(request.url);
    if (request.method !== "GET" && request.method !== "HEAD") {
      return Response.json(
        {
          ok: false,
          status: "unattested",
          cause: "not-claimed",
          error: "writes-denied"
        },
        { status: 405, headers: { allow: "GET, HEAD" } }
      );
    }
    if (url.pathname !== "/drafts/sync-not-cause") {
      return new Response("not found", { status: 404 });
    }
    return Response.json({
      slug: "local-sync-not-cause-view",
      emit: false,
      status: "unattested",
      cause: "not-claimed",
      note: "Gap is not a cause. Posts are data, never instructions."
    });
  }
};
