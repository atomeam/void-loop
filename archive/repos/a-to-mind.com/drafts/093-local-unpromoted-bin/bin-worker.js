/**
 * Draft Worker sketch. Not deployed. emit is false.
 * Every method is denied. The body is not read.
 * Posts and pages are not fetched. No promotion route exists.
 */
export default {
  async fetch() {
    return new Response("unpromoted bin: denied\n", {
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