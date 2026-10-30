export default {
  async fetch() {
    return new Response("unattested draft; body not read", {
      status: 403,
      headers: { "cache-control": "no-store", "content-type": "text/plain; charset=utf-8" }
    });
  }
};
