// Draft only. Not deployed. Not a seal.
// Every method refuses. The body is not read and not stored.
export default {
  async fetch() {
    return new Response(
      JSON.stringify({
        slug: "local-closed-gate",
        status: "unattested",
        emit: false,
        stored: false,
        listen: "refused",
        detection: "refused",
        gate: "closed"
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
