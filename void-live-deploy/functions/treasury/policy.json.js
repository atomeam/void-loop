// The treasury API imports the engine policy. This address is not a public file.
export function onRequest() {
  return new Response('Not found', { status: 404, headers: { 'cache-control': 'no-store', 'content-type': 'text/plain; charset=utf-8' } });
}
