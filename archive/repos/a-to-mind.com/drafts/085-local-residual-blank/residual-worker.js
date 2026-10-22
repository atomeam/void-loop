/* draft only — not deployed — emit false
   local-residual-blank worker sketch, run 085
   Every method returns 403. The body is not read. */
export default {
  async fetch() {
    return new Response(
      JSON.stringify({
        ok: false,
        slug: "local-residual-blank",
        status: "unattested",
        emit: false,
        reason: "residual-blank does not accept a body, a mechanism token, or a principle seal"
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
