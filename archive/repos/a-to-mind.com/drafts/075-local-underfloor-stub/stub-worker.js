export default {
  async fetch() {
    return new Response(JSON.stringify({
      slug: "local-underfloor-stub",
      status: "unattested",
      voice: "not-decoded",
      emit: false,
      error: "stub-worker denies every method; body not read"
    }), {
      status: 403,
      headers: {
        "content-type": "application/json; charset=utf-8",
        "cache-control": "no-store"
      }
    });
  }
};
