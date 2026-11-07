// "what is my ip address", "what is my user agent", "what is my screen resolution" (skills/my-device.js, functions/api/ip.js; docs/GAPS.md, 2026-11-06)
//   node --test tools/my-device.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import skill, { deviceAsk, readAgent } from '../void-live-deploy/skills/my-device.js';
import { onRequestGet } from '../void-live-deploy/functions/api/ip.js';

test('the asks people type for their address, browser, system and screen', () => {
  for (const [ask, k] of [['what is my ip address', 'ip'], ["what's my ip", 'ip'], ['my ip', 'ip'], ['what is my public ip address?', 'ip'], ['show my ip address', 'ip'],
    ['what is my user agent', 'ua'], ['what browser am i using', 'ua'], ['my browser version', 'ua'], ['what os am i using', 'os'], ['which operating system do i have', 'os'],
    ['what is my screen resolution', 'screen'], ['my screen size', 'screen'], ['screen resolution', 'screen'], ['what is the resolution of my monitor', 'screen'],
    ['device info', 'all'], ['what does this site know about me', 'all']]) assert.equal(deviceAsk(ask), k, ask);
});

test('look-alikes stay with other skills', () => {
  for (const n of skill.nearMisses) assert.equal(deviceAsk(n), '', n);
  for (const n of ['what is an ip address', 'ip address of google.com', 'my screen is broken', 'my browser is slow', 'change my user agent']) assert.equal(deviceAsk(n), '', n);
});

test('the user agent is read into a browser and a system', () => {
  const mac = readAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Safari/605.1.15');
  assert.deepEqual([mac.browser, mac.version, mac.os, mac.mobile], ['Safari', '17.4', 'macOS 10.15.7', false]);
  const edge = readAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36 Edg/124.0.2478.80');
  assert.deepEqual([edge.browser, edge.os], ['Edge', 'Windows 10 or 11']);
  const droid = readAgent('Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Mobile Safari/537.36');
  assert.deepEqual([droid.browser, droid.os, droid.mobile], ['Chrome', 'Android 14', true]);
  assert.equal(readAgent('').browser, 'Unknown browser');
});

test('the card shows the asked line first, escaped, and fills the address from /api/ip', async () => {
  const parts = {}; const el = { innerHTML: '', querySelector: (s) => (parts[s] = parts[s] || { textContent: '' }) };
  globalThis.fetch = async (u) => { assert.equal(u, '/api/ip'); return { ok: true, json: async () => ({ ok: true, ip: '203.0.113.7', v6: false }) }; };
  Object.defineProperty(globalThis, 'navigator', { value: { userAgent: 'Mozilla/5.0 <script>', language: 'en-US', cookieEnabled: true }, configurable: true });
  globalThis.screen = { width: 1440, height: 900 }; globalThis.window = { devicePixelRatio: 2, innerWidth: 1200, innerHeight: 800 };
  const said = await skill.run('what is my screen resolution', { showPage: (f) => { f(el); return el; }, esc: (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;') });
  assert.equal(said, 'my-device');
  assert.ok(el.innerHTML.indexOf('Screen') < el.innerHTML.indexOf('IP address'), 'the asked line comes first');
  assert.ok(el.innerHTML.includes('1440 × 900 at 2× pixels (2880 × 1800 real pixels)'), el.innerHTML);
  assert.ok(el.innerHTML.includes('&lt;script&gt;') && !el.innerHTML.includes('<script>'));
  assert.equal(parts['.dev-ip'].textContent, '203.0.113.7 (IPv4)');
});

test('/api/ip gives back the caller\'s own address, never cached, and nothing else', async () => {
  const res = onRequestGet({ request: { headers: { get: (h) => (h === 'cf-connecting-ip' ? '2001:db8::1' : null) } } });
  assert.deepEqual(await res.json(), { ok: true, ip: '2001:db8::1', v6: true });
  assert.equal(res.headers.get('cache-control'), 'private, no-store');
  const bad = onRequestGet({ request: { headers: { get: () => '<x>' } } });
  assert.deepEqual(await bad.json(), { ok: false, ip: null, v6: false });
});
