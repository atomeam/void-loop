/**
 * mover-worker.js — draft only. Not deployed.
 * Every method returns 403. The body is not read.
 * This is not a handoff sink and not an agent loop.
 */
export default {
  async fetch() {
    return new Response(
      JSON.stringify({
        ok: false,
        status: "unattested",
        error: "single-mover-card does not accept a body"
      }),
      {
        status: 403,
        headers: {
          "content-type": "application/json; charset=utf-8",
          "cache-control": "no-store"
        }
      }
    );
  }
};
