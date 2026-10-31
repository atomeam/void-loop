// Verse's MCP Server Card (SEP-2127): GET /api/mcp/server-card, the reserved place beside the streamable HTTP endpoint
// /api/mcp. A static, public, read-only description (lib/mcp.js serverCard): who the server is and where to connect.
// It carries no tools, no keys and nothing about the caller. The api-catalog lists it.
import { serverCard } from '../../../lib/mcp.js';

export function onRequestGet() {
  return new Response(JSON.stringify(serverCard(), null, 2) + '\n', { headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'public, max-age=300' } });
}
