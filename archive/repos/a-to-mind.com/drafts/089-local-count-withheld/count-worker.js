// Draft only. Not deployed. emit is false.
// Every method refuses. The body is not read. A tally is not a sink.
export default {
  async fetch() {
    return new Response("count withheld; body not read", {
      status: 403,
      headers: {
        "content-type": "text/plain; charset=utf-8",
        "cache-control": "no-store",
        "x-void-status": "unattested"
      }
    });
  }
};
