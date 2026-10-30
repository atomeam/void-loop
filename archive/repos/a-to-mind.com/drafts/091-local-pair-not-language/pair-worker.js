export default {
  async fetch() {
    return new Response(
      JSON.stringify({
        ok: false,
        status: "unattested",
        error: "default-deny",
        slug: "local-pair-not-language"
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
