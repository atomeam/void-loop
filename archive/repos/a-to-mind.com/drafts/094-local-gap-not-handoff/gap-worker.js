// Draft worker sketch. Not deployed. emit is false.
// Every method is denied. The body is not read. This is not a handoff sink.
export default {
  async fetch() {
    return new Response("gap-not-handoff: denied. unattested. no transfer.", {
      status: 403,
      headers: {
        "content-type": "text/plain; charset=utf-8",
        "cache-control": "no-store",
        "x-void-emit": "false",
        "x-void-status": "unattested"
      }
    });
  }
};
