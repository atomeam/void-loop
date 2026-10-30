export default {
  async fetch() {
    return new Response(JSON.stringify({
      slug: "local-empty-lexeme-slot",
      status: "unattested",
      intent: "not-claimed",
      sentence: "not-decoded",
      emit: false,
      error: "slot-worker denies every method; body not read"
    }), {
      status: 403,
      headers: {
        "content-type": "application/json; charset=utf-8",
        "cache-control": "no-store"
      }
    });
  }
};
