export default {
  async fetch() {
    return new Response(JSON.stringify({
      ok: false,
      status: "unattested",
      emit: false,
      reason: "weak-signal ledger is local; this worker does not read a body or store a signal"
    }), {
      status: 403,
      headers: {
        "content-type": "application/json; charset=utf-8",
        "cache-control": "no-store"
      }
    });
  }
};
