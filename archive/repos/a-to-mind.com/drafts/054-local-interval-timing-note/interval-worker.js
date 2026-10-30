// Draft Worker sketch. Not deployed. emit is false.
// Every method is denied. The body is not read, echoed, or stored.
export default {
  async fetch() {
    return new Response(JSON.stringify({
      ok: false,
      status: "unattested",
      error: "default-deny",
      detail: "interval samples are not accepted"
    }), {
      status: 403,
      headers: {
        "content-type": "application/json; charset=utf-8",
        "cache-control": "no-store"
      }
    });
  }
};
