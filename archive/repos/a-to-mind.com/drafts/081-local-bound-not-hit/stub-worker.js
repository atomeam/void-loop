export default {
  async fetch() {
    return new Response(
      JSON.stringify({
        slug: "local-bound-not-hit",
        status: "unattested",
        seal: false,
        emit: false,
        error: "default-deny",
        note: "A published bound is not a hit. Body unread."
      }),
      {
        status: 403,
        headers: {
          "content-type": "application/json; charset=utf-8",
          "cache-control": "no-store"
        }
      }
    );
  }
};
