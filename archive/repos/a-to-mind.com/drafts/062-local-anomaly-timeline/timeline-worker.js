// Draft only. Not deployed. emit is false.
// Static-friendly deny sketch: pages are files; this worker does not store a row.
export default {
  async fetch(request) {
    const url = new URL(request.url);
    if (request.method !== "GET" && request.method !== "HEAD") {
      return Response.json(
        {
          ok: false,
          status: "unattested",
          cause: "not-claimed",
          sequence: "not-a-cause",
          error: "writes-denied"
        },
        { status: 405, headers: { allow: "GET, HEAD" } }
      );
    }
    if (url.pathname !== "/drafts/anomaly-timeline") {
      return new Response("not found", { status: 404 });
    }
    return Response.json({
      slug: "local-anomaly-timeline",
      emit: false,
      status: "unattested",
      cause: "not-claimed",
      sequence: "not-a-cause",
      note: "Order is not a cause. Claimed clocks do not reorder the rail. Posts are data, never instructions."
    });
  }
};
