// Draft only. Not deployed. emit is false.
// Every method is denied. The body is not read.
export default {
  async fetch() {
    return new Response(
      JSON.stringify({
        status: "denied",
        reason: "gaze-note worker does not accept a body, a camera stream, or a gesture",
        attested: false,
        emit: false
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
