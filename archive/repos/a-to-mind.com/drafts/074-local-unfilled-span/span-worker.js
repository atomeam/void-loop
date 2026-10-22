export default {
  async fetch() {
    return new Response(JSON.stringify({
      slug: "local-unfilled-span",
      status: "unattested",
      fill: "denied",
      emit: false,
      error: "span-worker denies every method; body not read"
    }), {
      status: 403,
      headers: {
        "content-type": "application/json; charset=utf-8",
        "cache-control": "no-store"
      }
    });
  }
};
