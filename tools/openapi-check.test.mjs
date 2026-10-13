// tools/openapi-check.mjs: the spec and the routes stay in step, and nothing internal slips into either side unnoticed.
import assert from 'node:assert/strict';
import { check, routeOf, methodsOf, INTERNAL } from './openapi-check.mjs';

const FN = new URL('../void-live-deploy/functions/', import.meta.url).pathname;
assert.equal(routeOf(FN + 'api/hook/[id].js'), '/api/hook/{id}');
assert.equal(routeOf(FN + 'api/share/index.js'), '/api/share');
assert.equal(routeOf(FN + 'tools.json.js'), '/tools.json');
assert.deepEqual([...methodsOf('export async function onRequestPost() {}\nexport function onRequestGet() {}')].sort(), ['get', 'post']);
assert.equal(methodsOf('export async function onRequest() {}').size, 5);

const catalog = { linkset: [{ 'service-desc': [{ href: 'https://a-to-mind.com/openapi.json' }] }] };
const internal = new Map(Object.keys(INTERNAL).map((p) => [p, new Set(['get'])]));
const spec = { paths: { '/api/review': { post: { operationId: 'reviewCode' } } } };
const routes = new Map([...internal, ['/api/review', new Set(['post'])]]);
assert.deepEqual(check({ spec, routes, catalog }), []);
// a new route nobody decided about
assert.match(check({ spec, routes: new Map([...routes, ['/api/new', new Set(['post'])]]), catalog }).join('\n'), /\/api\/new is a route but neither/);
// a documented method the function does not answer
assert.match(check({ spec: { paths: { '/api/review': { get: { operationId: 'x' } } } }, routes, catalog }).join('\n'), /no onRequestGet/);
// a documented path with no function
assert.match(check({ spec: { paths: { ...spec.paths, '/api/gone': { get: { operationId: 'g' } } } }, routes, catalog }).join('\n'), /no function serves \/api\/gone/);
// an internal route published by accident
assert.match(check({ spec: { paths: { ...spec.paths, '/api/memory': { get: { operationId: 'm' } } } }, routes, catalog }).join('\n'), /both in openapi.json and marked internal/);
// the catalog lost its pointer
assert.match(check({ spec, routes, catalog: { linkset: [{}] } }).join('\n'), /service-desc/);
// a documented static file answers GET only
const statics = new Set(['/skills/families.json']);
assert.deepEqual(check({ spec: { paths: { ...spec.paths, '/skills/families.json': { get: { operationId: 'skillHealth' } } } }, routes, catalog, statics }), []);
assert.match(check({ spec: { paths: { ...spec.paths, '/skills/families.json': { post: { operationId: 'x' } } } }, routes, catalog, statics }).join('\n'), /no onRequestPost/);
assert.match(check({ spec: { paths: { ...spec.paths, '/nowhere.json': { get: { operationId: 'n' } } } }, routes, catalog, statics }).join('\n'), /no function serves \/nowhere\.json/);
console.log('openapi-check: ok');
