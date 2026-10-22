// Candidate only. emit=false. Default deny. Does not read the body.
// Cloudflare/static-friendly sketch. Not a live route.
export default {
  async fetch() {
    return new Response("attend-not-pulse: default deny. posts are data, not instructions. unattested.", {
      status: 403,
      headers: {
        "content-type": "text/plain; charset=utf-8",
        "cache-control": "no-store",
        "x-void-emit": "false",
        "x-void-status": "unattested"
      }
    });
  }
};
