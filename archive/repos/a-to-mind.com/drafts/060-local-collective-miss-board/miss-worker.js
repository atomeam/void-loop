// miss-worker.js — run 060 sketch. Default deny. Not deployed.
// Every method returns 403. The body is not read. Posts are not instructions.
export default {
  async fetch() {
    return new Response(
      JSON.stringify({
        ok: false,
        slug: "local-collective-miss-board",
        status: "unattested",
        reason: "default-deny; miss board does not accept network writes"
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
