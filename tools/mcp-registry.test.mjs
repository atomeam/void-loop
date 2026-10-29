// server.json (Verse in the official MCP registry, .github/workflows/mcp-registry.yml) stays in step with the live endpoint it
// names: the registry's limits, the remote is the MCP endpoint the public API describes, and the version is one a publish takes.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const root = new URL('../', import.meta.url);
const server = JSON.parse(readFileSync(new URL('server.json', root), 'utf8'));
const api = JSON.parse(readFileSync(new URL('void-live-deploy/openapi.json', root), 'utf8'));
assert.match(server.$schema, /^https:\/\/static\.modelcontextprotocol\.io\/schemas\/\d{4}-\d{2}-\d{2}\/server\.schema\.json$/);
assert.match(server.name, /^io\.github\.atomeam\/[a-zA-Z0-9._-]+$/, 'the GitHub OIDC login owns io.github.atomeam/* only');
assert.ok(server.description.length >= 1 && server.description.length <= 100, 'the registry takes a description of 1 to 100 characters');
assert.ok(!server.title || server.title.length <= 100);
assert.match(server.version, /^\d+\.\d+\.\d+$/, 'a plain semantic version (no range)');
assert.equal(server.remotes.length, 1);
const [remote] = server.remotes;
assert.equal(remote.type, 'streamable-http');
const base = api.servers[0].url;
assert.ok(remote.url.startsWith(base + '/') && api.paths[remote.url.slice(base.length)], 'the remote is an endpoint openapi.json documents');
assert.ok(api.paths[remote.url.slice(base.length)].post, 'the MCP endpoint takes POST');
assert.equal(server.websiteUrl, base);
console.log('mcp-registry: ok');
