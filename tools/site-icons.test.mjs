// tools/site-icons.mjs: which icon a page's links name, and which fetched files are kept
import test from 'node:test';
import assert from 'node:assert/strict';
import { pickIcon, iconLinks, safeSvg, sniff, judge, hostsOf, MAX } from './site-icons.mjs';
import { FLOORS } from '../void-live-deploy/lib/tower.js';

test('pickIcon takes the apple-touch-icon or a large sized icon over a small favicon, resolved against the page', () => {
  const html = `<head><link rel="icon" href="/favicon-16.png" sizes="16x16"><link rel="shortcut icon" href="/f.ico">
    <link rel="mask-icon" href="/mask.svg"><link href="icons/apple.png" rel="apple-touch-icon"><link rel="icon" sizes="32x32" href="/f32.png"></head>`;
  assert.equal(pickIcon(html, 'https://www.example.com/a/b'), 'https://www.example.com/a/icons/apple.png');
  const big = '<link rel=icon href="//cdn.example.com/i-192.png?v=1&amp;x=2" sizes="192x192"><link rel="apple-touch-icon" href="/t.png">';
  assert.equal(pickIcon(big, 'https://example.com/'), 'https://cdn.example.com/i-192.png?v=1&x=2', 'sizes 192 over an apple icon without sizes (180)');
  assert.equal(pickIcon('<link rel="icon" href="/logo.svg" type="image/svg+xml"><link rel="icon" href="/f.ico">', 'https://example.com/'), 'https://example.com/logo.svg');
  assert.equal(pickIcon('<title>none</title>', 'https://example.com/x/y'), 'https://example.com/favicon.ico', 'no links: the origin favicon');
  assert.equal(pickIcon('<link rel="mask-icon" href="/m.svg">', 'https://example.com/'), 'https://example.com/favicon.ico', 'a mask icon is not the logo');
  assert.equal(pickIcon('<base href="https://static.example.com/s/"><link rel="icon" href="i.png">', 'https://example.com/'), 'https://static.example.com/s/i.png');
  assert.deepEqual(iconLinks('<link rel="icon" href="javascript:alert(1)"><link rel="icon" href="data:image/png;base64,AA">', 'https://example.com/'), []);
});

test('safeSvg refuses an svg with a script, an event handler or a javascript: link, and anything that is not an svg', () => {
  assert.equal(safeSvg('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><path d="M0 0h10v10z"/></svg>'), true);
  assert.equal(safeSvg('<svg><script>alert(1)</script></svg>'), false);
  assert.equal(safeSvg('<svg onload="alert(1)"></svg>'), false);
  assert.equal(safeSvg('<svg><a href="javascript:x()"><rect/></a></svg>'), false);
  assert.equal(safeSvg('<svg><foreignObject><div/></foreignObject></svg>'), false);
  assert.equal(safeSvg('<html><body>hi</body></html>'), false);
});

test('a fetched file is kept only when it is a web image between 60 B and 200 KB, typed by its own bytes', () => {
  const png = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.alloc(100)]);
  const ico = Buffer.concat([Buffer.from([0, 0, 1, 0]), Buffer.alloc(100)]);
  assert.equal(sniff(png), 'png'); assert.equal(sniff(ico), 'ico');
  assert.equal(sniff(Buffer.from('<?xml version="1.0"?>\n<svg xmlns="http://www.w3.org/2000/svg"></svg>')), 'svg');
  assert.equal(sniff(Buffer.from('<!doctype html><html>' + ' '.repeat(80))), '');
  assert.deepEqual(judge(png), { ext: 'png' });
  assert.match(judge(Buffer.from([0x89, 0x50, 0x4e, 0x47])).why, /too small/);
  assert.match(judge(Buffer.concat([png, Buffer.alloc(MAX)])).why, /too big/);
  assert.match(judge(Buffer.from('<!doctype html><html><body>blocked</body></html>' + ' '.repeat(40))).why, /not an image/);
  assert.match(judge(Buffer.from('<svg onload="x()">' + ' '.repeat(60) + '</svg>')).why, /script or handlers/);
});

test('every floor host appears once, with a page address to read its icon from', () => {
  const m = hostsOf(FLOORS);
  assert.ok(m.size >= 40, 'hosts: ' + m.size);
  for (const [h, u] of m) { assert.match(h, /^[a-z0-9.-]+\.[a-z]{2,}$/); assert.match(u, /^https?:\/\//); }
  assert.ok(m.has('deepl.com') && m.has('minimalistbaker.com'), 'lanes included');
});
