export default {
  async fetch() {
    return new Response(JSON.stringify({
      slug: "local-notice-lag-bin",
      status: "unattested",
      present: "not-raw",
      sender: "not-claimed",
      clock: "denied",
      emit: false,
      error: "lag-worker denies every method; body not read"
    }), {
      status: 403,
      headers: {
        "content-type": "application/json; charset=utf-8",
        "cache-control": "no-store"
      }
    });
  }
};
