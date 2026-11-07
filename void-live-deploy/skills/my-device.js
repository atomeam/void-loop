/**
 * my-device skill - what this connection and this browser say about themselves, like whatismyip.com and whatismybrowser.com.
 * 2026-11-06 (docs/GAPS.md): "what is my ip address", "what is my user agent" and "what is my screen resolution" fell to an article.
 *   "what is my ip" / "my ip address": the public address, from /api/ip (the address the request came from, never stored or cached).
 *   "what is my user agent" / "what browser am i using" / "what os am i on": the browser's own user agent, read in the page.
 *   "what is my screen resolution" / "my screen size": the screen, the window and the pixel ratio, read in the page.
 *   "my device" / "device info": all of it on one card. The asked line comes first; the rest follows.
 * Contract: { name, examples, nearMisses, match(lower, text), run(text, api) }. Nothing is sent anywhere but the one GET for the address.
 */
const LEAD = "^(?:please\\s+)?(?:(?:what\\s+is|what'?s|whats|show(?:\\s+me)?|tell\\s+me|check|find|get|see)\\s+)?(?:my\\s+)";
const ASKS = [
  ['ip', new RegExp(LEAD + "(?:public\\s+|current\\s+|external\\s+)?ip(?:\\s*address)?(?:\\s+(?:address|v4|v6))?$|^(?:what\\s+is\\s+my\\s+ip|whats\\s+my\\s+ip|my\\s+ip|ip\\s+lookup\\s+for\\s+me|show\\s+ip)$")],
  ['ua', new RegExp(LEAD + "(?:browser'?s?\\s+)?user[\\s-]?agent(?:\\s+string)?$|^(?:what|which)\\s+browser\\s+(?:am\\s+i\\s+(?:using|on)|do\\s+i\\s+(?:have|use))$|" + LEAD + "browser(?:\\s+version)?$")],
  ['os', new RegExp("^(?:what|which)\\s+(?:os|operating\\s+system)\\s+(?:am\\s+i\\s+(?:using|on|running)|do\\s+i\\s+(?:have|use))$|" + LEAD + "(?:os|operating\\s+system)$")],
  ['screen', new RegExp(LEAD + "(?:screen|display|monitor)(?:\\s+(?:resolution|size|dimensions))?$|^(?:what\\s+is\\s+)?(?:the\\s+)?(?:resolution|size)\\s+of\\s+my\\s+(?:screen|display|monitor)$|^(?:my\\s+)?screen\\s+resolution(?:\\s+(?:checker|test))?$|^what\\s+(?:screen\\s+)?resolution\\s+(?:am\\s+i\\s+using|is\\s+my\\s+screen)$")],
  ['all', new RegExp(LEAD + "(?:device|computer|phone)(?:\\s+(?:info|information|details|specs))?$|^device\\s+info(?:rmation)?$|^(?:what\\s+does\\s+)?(?:this\\s+)?(?:site|website|verse)\\s+(?:know|see)\\s+about\\s+(?:me|my\\s+(?:device|browser))$")]
];

/** which line the ask wants first ('ip' | 'ua' | 'os' | 'screen' | 'all'), or ''. Pure. */
export function deviceAsk(text) {
  const l = String(text || '').toLowerCase().trim().replace(/[?!.]+$/, '').replace(/\s+/g, ' ');
  for (const [k, re] of ASKS) if (re.test(l)) return k;
  return '';
}

/** the browser and the system named from a user agent string, with versions where it says them. Pure. */
export function readAgent(ua) {
  ua = String(ua || '');
  const v = (re) => { const m = ua.match(re); return m ? m[1] : ''; };
  let browser = 'Unknown browser', bv = '';
  if (/Edg\//.test(ua)) { browser = 'Edge'; bv = v(/Edg\/([\d.]+)/); }
  else if (/OPR\//.test(ua)) { browser = 'Opera'; bv = v(/OPR\/([\d.]+)/); }
  else if (/SamsungBrowser\//.test(ua)) { browser = 'Samsung Internet'; bv = v(/SamsungBrowser\/([\d.]+)/); }
  else if (/Firefox\//.test(ua) || /FxiOS\//.test(ua)) { browser = 'Firefox'; bv = v(/(?:Firefox|FxiOS)\/([\d.]+)/); }
  else if (/CriOS\//.test(ua)) { browser = 'Chrome'; bv = v(/CriOS\/([\d.]+)/); }
  else if (/Chrome\//.test(ua) && !/Chromium\//.test(ua)) { browser = 'Chrome'; bv = v(/Chrome\/([\d.]+)/); }
  else if (/Chromium\//.test(ua)) { browser = 'Chromium'; bv = v(/Chromium\/([\d.]+)/); }
  else if (/Safari\//.test(ua) && /Version\//.test(ua)) { browser = 'Safari'; bv = v(/Version\/([\d.]+)/); }
  let os = 'Unknown system';
  if (/iPhone|iPad|iPod/.test(ua)) os = (/iPad/.test(ua) ? 'iPadOS ' : 'iOS ') + v(/OS (\d+(?:_\d+)*)/).replace(/_/g, '.');
  else if (/Android/.test(ua)) os = 'Android ' + v(/Android ([\d.]+)/);
  else if (/Windows NT 10\.0/.test(ua)) os = 'Windows 10 or 11';
  else if (/Windows NT ([\d.]+)/.test(ua)) os = 'Windows NT ' + v(/Windows NT ([\d.]+)/);
  else if (/CrOS/.test(ua)) os = 'ChromeOS';
  else if (/Mac OS X/.test(ua)) os = 'macOS ' + v(/Mac OS X (\d+(?:[_.]\d+)*)/).replace(/_/g, '.');
  else if (/Linux/.test(ua)) os = 'Linux';
  return { browser, version: bv, os: os.trim(), mobile: /Mobi|iPhone|Android.+Mobile/.test(ua) };
}

const TITLES = { ip: 'Your IP address', ua: 'Your browser', os: 'Your system', screen: 'Your screen', all: 'Your device' };

async function run(text, api) {
  const { showPage, esc } = api;
  const k = deviceAsk(text);
  if (!k) return 'none';
  const nav = (typeof navigator !== 'undefined' && navigator) || {}, scr = (typeof screen !== 'undefined' && screen) || {}, win = (typeof window !== 'undefined' && window) || {};
  const ua = String(nav.userAgent || ''), a = readAgent(ua), dpr = +win.devicePixelRatio || 1;
  const row = (label, value, cls) => '<li><b>' + esc(label) + '</b> <span' + (cls ? ' class="' + cls + '"' : '') + '>' + esc(value) + '</span></li>';
  const tz = (() => { try { return Intl.DateTimeFormat().resolvedOptions().timeZone || ''; } catch (_) { return ''; } })();
  const lines = {
    ip: row('IP address', 'looking it up…', 'dev-ip'),
    ua: row('Browser', a.browser + (a.version ? ' ' + a.version : '')) + row('User agent', ua || 'not given', 'dev-ua'),
    os: row('System', a.os + (a.mobile ? ' (mobile)' : '')),
    screen: row('Screen', (scr.width && scr.height ? scr.width + ' × ' + scr.height : 'not given') + (dpr !== 1 ? ' at ' + dpr + '× pixels (' + Math.round((scr.width || 0) * dpr) + ' × ' + Math.round((scr.height || 0) * dpr) + ' real pixels)' : ''))
      + row('Window', (win.innerWidth || 0) + ' × ' + (win.innerHeight || 0))
  };
  const extra = row('Language', String(nav.language || 'not given')) + (tz ? row('Time zone', tz) : '') + row('Cookies', nav.cookieEnabled === false ? 'off' : 'on');
  const order = k === 'all' ? ['ip', 'os', 'ua', 'screen'] : [k, ...['ip', 'os', 'ua', 'screen'].filter((x) => x !== k)];
  const el = showPage((p) => {
    p.innerHTML = '<h2>' + esc(TITLES[k]) + '</h2><ul>' + order.map((x) => lines[x]).join('') + extra + '</ul>'
      + '<p style="color:#8a8a8a">Read from this browser, and the address from the connection your ask came in on. Shown to you only: Verse keeps none of it. A VPN or a phone network shows its own address, not your home one.</p>';
  });
  const ipEl = el && el.querySelector && el.querySelector('.dev-ip');
  if (ipEl) {
    try {
      const r = await fetch('/api/ip', { cache: 'no-store' }), j = r.ok ? await r.json() : null;
      ipEl.textContent = j && j.ip ? j.ip + (j.v6 ? ' (IPv6)' : ' (IPv4)') : 'not available here';
    } catch (_) { ipEl.textContent = 'not available here'; }
  }
  return 'my-device';
}

export const builtWith = ['eat'];
export default {
  name: 'my-device',
  examples: ['what is my ip address', 'what is my user agent', 'what is my screen resolution', 'what browser am i using', "what's my ip", 'my screen size', 'what os am i using', 'device info'],
  nearMisses: ['what is an ip address', 'what is a user agent', 'best screen resolution for gaming', 'my ip camera', 'ip address lookup 8.8.8.8', 'what does ip stand for', 'screen recorder', 'what is the best browser'],
  match(lower) { return !!deviceAsk(lower); },
  run
};
