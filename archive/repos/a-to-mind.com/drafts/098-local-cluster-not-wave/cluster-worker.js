/**
 * Draft only. Not deployed. Default deny.
 * Retrieved bodies are not read. Posts are not instructions.
 * Every method returns 403. No token markup. No allowlist.
 */
export default {
  async fetch() {
    return new Response(
      JSON.stringify({
        slug: "local-cluster-not-wave",
        status: "unattested",
        emit: false,
        seal: false,
        error: "cluster-not-wave-hold"
      }),
      {
        status: 403,
        headers: {
          "content-type": "application/json; charset=utf-8",
          "cache-control": "no-store",
          "x-void-status": "unattested"
        }
      }
    );
  }
};
