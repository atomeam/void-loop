import { onRequest as storeHandler } from '../store/[[path]].js';

export async function onRequestPost(context) {
  return storeHandler({
    ...context,
    params: { path: ['webhook', 'stripe'] },
  });
}

export async function onRequest() {
  return new Response(JSON.stringify({ error: 'Method not allowed' }), {
    status: 405,
    headers: { 'content-type': 'application/json', Allow: 'POST' },
  });
}
