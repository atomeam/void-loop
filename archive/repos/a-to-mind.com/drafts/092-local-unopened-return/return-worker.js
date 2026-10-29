// Draft only. Not deployed. emit is false.
// Every method returns 403. The body is not read. A return note is not a request.
export default {
  async fetch() {
    return new Response(JSON.stringify({
      slug: "local-unopened-return",
      status: "unattested",
      emit: false,
      seal: false,
      read: false,
      note: "body not read; return stays unopened"
    }), {
      status: 403,
      headers: {
        "content-type": "application/json; charset=utf-8",
        "cache-control": "no-store"
      }
    });
  }
};
