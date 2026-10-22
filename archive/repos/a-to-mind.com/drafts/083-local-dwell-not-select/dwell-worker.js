/* draft only — not deployed — emit false
   local-dwell-not-select worker sketch, run 083
   Every method returns 403. The body is not read. */
export default {
  async fetch() {
    return new Response(
      JSON.stringify({
        ok: false,
        slug: "local-dwell-not-select",
        status: "unattested",
        emit: false,
        reason: "dwell-not-select does not accept a body, a dwell stream, or a camera grant"
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
};
