import { fillPatternHtml } from '../../lib/dev-tools.js';

export async function onRequestGet(context) {
  const url = new URL(context.request.url);
  if (!['pattern', 'flags', 'sample', 'replace'].some((k) => url.searchParams.has(k))) return context.next();
  const asset = await context.next();
  const html = fillPatternHtml(await asset.text(), url.searchParams);
  return new Response(html, { headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' } });
}
