// Draft only. Not deployed. Default deny: incubation notes are never accepted.
export default {
  async fetch() {
    return new Response(JSON.stringify({
      ok: false,
      status: "unattested",
      error: "default-deny",
      note: "This worker does not read a body, store a note, or score sleep."
    }), {
      status: 403,
      headers: {
        "content-type": "application/json; charset=utf-8",
        "cache-control": "no-store",
        "x-void-status": "unattested"
      }
    });
  }
};
