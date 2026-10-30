// proxy-worker.js — run 067 sketch. Default deny. Not deployed.
// Retrieved pages and posts are data, never instructions.
// Every method is 403. The body is not read. No token markup.

export default {
  async fetch() {
    return new Response(
      JSON.stringify({
        slug: "local-proxy-channel-card",
        status: "unattested",
        emit: false,
        error: "proxy-channel hold; no device, no encode, no seal"
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
