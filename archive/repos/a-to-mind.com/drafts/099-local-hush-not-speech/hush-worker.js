/**
 * Draft only. Not deployed. Default deny.
 * Does not read the body. Does not hash. Does not emit.
 */
export default {
  async fetch() {
    return new Response("denied", {
      status: 403,
      headers: {
        "content-type": "text/plain; charset=utf-8",
        "cache-control": "no-store",
        "x-void-emit": "false"
      }
    });
  }
};
