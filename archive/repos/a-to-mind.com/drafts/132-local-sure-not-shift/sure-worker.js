export default {
  async fetch(request) {
    const url = new URL(request.url);
    const denied = new Set(["/shift", "/timeline", "/canon", "/poll", "/chorus"]);
    if (denied.has(url.pathname)) {
      return new Response(
        JSON.stringify({
          ok: false,
          status: "unattested",
          refusal: "shift-refusal",
          stored: false,
          note: "A sure mark is not a shift. This route stores nothing."
        }),
        {
          status: 403,
          headers: {
            "content-type": "application/json; charset=utf-8",
            "cache-control": "no-store",
            "x-void-emit": "false"
          }
        }
      );
    }
    return new Response(
      JSON.stringify({
        ok: false,
        status: "unattested",
        draft: "local-sure-not-shift",
        emit: false,
        note: "Draft worker. No live route. No store."
      }),
      {
        status: 404,
        headers: {
          "content-type": "application/json; charset=utf-8",
          "cache-control": "no-store"
        }
      }
    );
  }
};
