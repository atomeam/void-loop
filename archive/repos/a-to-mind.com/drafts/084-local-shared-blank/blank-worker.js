/* draft only — not deployed — emit false
   local-shared-blank worker sketch, run 084
   Every method returns 403. The body is not read. */
export default {
  async fetch() {
    return new Response(
      JSON.stringify({
        ok: false,
        slug: "local-shared-blank",
        status: "unattested",
        emit: false,
        reason: "shared-blank does not accept a body, a recalled token, or a consensus count"
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
