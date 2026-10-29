export default {
  async fetch() {
    return new Response(
      JSON.stringify({
        slug: "local-held-cue-stub",
        status: "unattested",
        seal: false,
        emit: false,
        error: "default-deny",
        note: "A held cue is not a dream. Body unread."
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
