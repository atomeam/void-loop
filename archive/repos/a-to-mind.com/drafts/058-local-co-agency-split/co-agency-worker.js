// local-co-agency-split worker sketch. Not deployed.
// Default deny. Does not read the body. Does not hand off.
export default {
  async fetch() {
    return new Response(
      JSON.stringify({
        slug: "local-co-agency-split",
        status: "unattested",
        emit: false,
        default: "deny",
        error: "co-agency handoff is held"
      }),
      {
        status: 403,
        headers: {
          "content-type": "application/json; charset=utf-8",
          "cache-control": "no-store",
          "x-void-status": "unattested"
        }
      }
    );
  }
};
