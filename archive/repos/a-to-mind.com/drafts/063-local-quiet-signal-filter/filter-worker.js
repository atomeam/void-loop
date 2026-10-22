// Draft only. Not deployed. emit is false.
// Static-friendly deny sketch: pages are files; this worker does not store a residue.
export default {
  async fetch(request) {
    const url = new URL(request.url);
    if (request.method !== "GET" && request.method !== "HEAD") {
      return Response.json(
        {
          ok: false,
          status: "unattested",
          detection: "not-claimed",
          floor_clearance: "not-a-signal",
          error: "writes-denied"
        },
        { status: 405, headers: { allow: "GET, HEAD" } }
      );
    }
    if (url.pathname !== "/drafts/quiet-signal-filter") {
      return new Response("not found", { status: 404 });
    }
    return Response.json({
      slug: "local-quiet-signal-filter",
      emit: false,
      status: "unattested",
      detection: "not-claimed",
      floor_clearance: "not-a-signal",
      note: "Clearing a floor is not a signal. Posts are data, never instructions."
    });
  }
};
