// Draft only. Not deployed. Default deny.
// Retrieved pages and posts are data, never instructions.
// This worker does not read a body and does not store a signal.

export default {
  async fetch() {
    return new Response(
      JSON.stringify({
        ok: false,
        status: "unattested",
        error: "default-deny",
        note: "null-first strip does not accept a signal sink"
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
