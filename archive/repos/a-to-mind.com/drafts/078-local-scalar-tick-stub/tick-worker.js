export default {
  async fetch() {
    return new Response(
      JSON.stringify({
        ok: false,
        slug: "local-scalar-tick-stub",
        status: "unattested",
        emit: false,
        error: "default-deny"
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
