export default {
  async fetch() {
    return new Response(
      JSON.stringify({
        ok: false,
        status: "unattested",
        reason: "abstain-seat does not accept a body and does not fill the instrument seat"
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
