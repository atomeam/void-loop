/**
 * my-device skill - what this connection and this browser say about themselves, like whatismyip.com and whatismybrowser.com.
 * 2026-11-06 (docs/GAPS.md): "what is my ip address", "what is my user agent" and "what is my screen resolution" fell to an article.
 *   "what is my ip" / "my ip address": the public address, from /api/ip (the address the request came from, never stored or cached).
 *   "what is my user agent" / "what browser am i using" / "what os am i on": the browser's own user agent, read in the page.
 *   "what is my screen resolution" / "my screen size": the screen, the window and the pixel ratio, read in the page.
 *   "my device" / "device info": all of it on one card. The asked line comes first; the rest follows.
 * 2026-11-06, docs/GAPS.md rows 34, 82, 83, 84 and 88 (each gave an explanation, an article or a Python snippet), the device's own checks:
 *   "keyboard tester": a keyboard drawn in the card, each key lights when it is pressed, with its key and code.
 *   "mouse tester": each button, the wheel and double clicks, shown as they happen.
 *   "dead pixel test": full screen colours to step through with a click, a visual check.
 *   "battery status": the level and charging state where the browser gives them (Chrome, Edge), and says so where it does not.
 *   "text to speech hello world": the words read aloud by the browser's own voice, with a voice and a rate to pick.
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

const TEST = "(?:test|tester|testing|checker|check)";
const CHECKS = [
  ['keys', new RegExp("^(?:(?:an?|the|online|free)\\s+)*(?:keyboard|key\\s?board|keys?)\\s+" + TEST + "(?:\\s+online)?$|^(?:test|check)\\s+(?:my|the)\\s+(?:keyboard|keys)$|^(?:which|what)\\s+keys?\\s+am\\s+i\\s+pressing$|^key\\s?codes?(?:\\s+(?:finder|viewer|tester))?$")],
  ['mouse', new RegExp("^(?:(?:an?|the|online|free)\\s+)*(?:mouse|mouse\\s+button|mouse\\s+buttons|scroll\\s+wheel|mouse\\s+wheel|double\\s+click)\\s+" + TEST + "(?:\\s+online)?$|^(?:test|check)\\s+my\\s+(?:mouse|mouse\\s+buttons|scroll\\s+wheel)$")],
  ['pixels', new RegExp("^(?:(?:an?|the|online|free)\\s+)*(?:dead|stuck)\\s+pixels?\\s+" + TEST + "(?:\\s+online)?$|^(?:test|check)\\s+(?:my\\s+)?(?:screen|monitor|display)\\s+for\\s+(?:dead|stuck)\\s+pixels$|^(?:screen|monitor|display)\\s+(?:pixel|colou?r)\\s+test$")],
  ['battery', new RegExp("^(?:(?:what\\s+is|what'?s|whats|show(?:\\s+me)?|check)\\s+)?(?:my\\s+)?(?:battery|battery\\s+charge)\\s+(?:status|level|percentage|percent|charge|left|life\\s+left)$|^(?:what\\s+is\\s+|what'?s\\s+|check\\s+)?my\\s+battery$|^how\\s+much\\s+battery\\s+(?:do\\s+i\\s+have(?:\\s+left)?|is\\s+left|have\\s+i\\s+got)$|^is\\s+my\\s+(?:battery|laptop|phone)\\s+charging$")]
];
// "text to speech hello world", "tts: good morning", "read aloud: the words", "say out loud: the words"; a bare "read aloud" is a card's own button, and
// "text to speech api" or "in python" asks for code, not the voice
const SPEECH = /^(?:(?:open|use|start|run|a|an|the|free|online)\s+)*(?:text[\s-]+to[\s-]+(?:speech|voice)|tts)(?:\s+(?:reader|generator|converter|tool|online|maker))?(?:\s*[:,]\s*|\s+|$)([\s\S]*)$|^(?:read|say|speak)\s+(?:this\s+|it\s+)?(?:out\s+)?(?:aloud|out\s+loud)\s*:\s*([\s\S]+)$|^speak\s+(?:this|these\s+words)\s*:\s*([\s\S]+)$/i;
const CODE_TAIL = /^(?:api|apis|app|apps|software|program|library|sdk|engine|models?|in\s+\w+|with\s+\w+|for\s+(?:python|javascript|js|node|android|ios|windows|mac)|python|javascript|js|node|code|meaning|definition|free\s+download|download)\b/i;

/** the words to read aloud from a text to speech ask: { text } ('' when it names none), or null. Pure. */
export function speechOf(text) {
  const t = String(text || '').trim().replace(/\s+([?!.])$/, '$1');
  if (!t || t.length > 2000 || /^(?:what|how|why|is|are|does|do|which|best|top)\b/i.test(t)) return null;
  const m = t.match(SPEECH);
  if (!m) return null;
  const words = String(m[1] || m[2] || m[3] || '').trim();
  if (m[1] !== undefined && CODE_TAIL.test(words)) return null;
  return { text: words.replace(/^["“']|["”']$/g, '') };
}

/** which line the ask wants first ('ip' | 'ua' | 'os' | 'screen' | 'all'), or which check ('keys' | 'mouse' | 'pixels' | 'battery' | 'voice'), or ''. Pure. */
export function deviceAsk(text) {
  const l = String(text || '').toLowerCase().trim().replace(/[?!.]+$/, '').replace(/\s+/g, ' ');
  for (const [k, re] of ASKS) if (re.test(l)) return k;
  for (const [k, re] of CHECKS) if (re.test(l)) return k;
  if (speechOf(text)) return 'voice';
  return '';
}

/** the rows of a keyboard by KeyboardEvent.code, as drawn on the card. */
export const KEY_ROWS = [
  ['Escape', 'F1', 'F2', 'F3', 'F4', 'F5', 'F6', 'F7', 'F8', 'F9', 'F10', 'F11', 'F12'],
  ['Backquote', 'Digit1', 'Digit2', 'Digit3', 'Digit4', 'Digit5', 'Digit6', 'Digit7', 'Digit8', 'Digit9', 'Digit0', 'Minus', 'Equal', 'Backspace'],
  ['Tab', 'KeyQ', 'KeyW', 'KeyE', 'KeyR', 'KeyT', 'KeyY', 'KeyU', 'KeyI', 'KeyO', 'KeyP', 'BracketLeft', 'BracketRight', 'Backslash'],
  ['CapsLock', 'KeyA', 'KeyS', 'KeyD', 'KeyF', 'KeyG', 'KeyH', 'KeyJ', 'KeyK', 'KeyL', 'Semicolon', 'Quote', 'Enter'],
  ['ShiftLeft', 'KeyZ', 'KeyX', 'KeyC', 'KeyV', 'KeyB', 'KeyN', 'KeyM', 'Comma', 'Period', 'Slash', 'ShiftRight'],
  ['ControlLeft', 'MetaLeft', 'AltLeft', 'Space', 'AltRight', 'MetaRight', 'ControlRight', 'ArrowLeft', 'ArrowUp', 'ArrowDown', 'ArrowRight']
];
const KEY_NAMES = { Escape: 'Esc', Backquote: '`', Minus: '-', Equal: '=', Backspace: 'Back', Tab: 'Tab', BracketLeft: '[', BracketRight: ']', Backslash: '\\', CapsLock: 'Caps', Semicolon: ';', Quote: "'", Enter: 'Enter', ShiftLeft: 'Shift', ShiftRight: 'Shift', Comma: ',', Period: '.', Slash: '/', ControlLeft: 'Ctrl', ControlRight: 'Ctrl', MetaLeft: 'Meta', MetaRight: 'Meta', AltLeft: 'Alt', AltRight: 'Alt', Space: 'Space', ArrowLeft: '←', ArrowUp: '↑', ArrowDown: '↓', ArrowRight: '→' };
/** the label on a key, from its KeyboardEvent.code. Pure. */
export function keyLabel(code) {
  const c = String(code || '');
  if (KEY_NAMES[c]) return KEY_NAMES[c];
  let m = c.match(/^Key([A-Z])$/); if (m) return m[1];
  m = c.match(/^Digit(\d)$/); if (m) return m[1];
  return c;
}
const BUTTONS = ['Left', 'Middle', 'Right', 'Back', 'Forward'];
/** the name of a mouse button from MouseEvent.button (0 to 4). Pure. */
export function mouseButtonName(b) { return BUTTONS[b] || 'Button ' + b; }

/** a battery as a line: "85% · charging, full in 40 min", from a BatteryManager or its fields; null gives the line for a browser that does not say. Pure. */
export function batteryLine(b) {
  if (!b || typeof b.level !== 'number') return 'This browser does not give the battery level to web pages (Firefox and Safari keep it private). Your system shows it in its status bar.';
  const pct = Math.round(b.level * 100) + '%', mins = (s) => (Number.isFinite(s) && s > 0 ? (s >= 3600 ? Math.floor(s / 3600) + ' h' + (Math.round((s % 3600) / 60) ? ' ' + Math.round((s % 3600) / 60) + ' min' : '') : Math.round(s / 60) + ' min') : '');
  if (b.charging) { const f = mins(b.chargingTime); return pct + ' · charging' + (b.level >= 1 ? ', full' : f ? ', full in about ' + f : ''); }
  const d = mins(b.dischargingTime);
  return pct + ' · on battery' + (d ? ', about ' + d + ' left' : '');
}

/** the colours of the dead pixel test, in order. */
export const PIXEL_COLOURS = [['#000000', 'black'], ['#ffffff', 'white'], ['#ff0000', 'red'], ['#00ff00', 'green'], ['#0000ff', 'blue'], ['#808080', 'grey']];

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

const BTN = 'padding:6px 14px;border-radius:999px;border:1px solid rgba(255,255,255,.28);background:transparent;color:#e8e8e8;cursor:pointer;font:14px system-ui';
const NOTE = (s) => '<div class="src">' + s + '</div>';
const KEY_W = { Backspace: 2, Tab: 1.5, Backslash: 1.5, CapsLock: 1.8, Enter: 2.2, ShiftLeft: 2.4, ShiftRight: 2.6, Space: 5.5 };

function keysCard(api) {
  const el = api.showPage((p) => {
    // void-review: ok, every label and code comes from KEY_ROWS and KEY_NAMES above, never from a user
    p.innerHTML = '<h2>Keyboard tester</h2><div class="kt-pad" tabindex="0" role="application" aria-label="Keyboard tester: press keys here" style="outline:1px dashed rgba(255,255,255,.25);border-radius:12px;padding:10px;overflow-x:auto">'
      + KEY_ROWS.map((r) => '<div style="display:flex;gap:4px;margin:4px 0">' + r.map((c) => '<span class="kt-k" data-c="' + c + '" style="flex:' + (KEY_W[c] || 1) + ' 0 0;min-width:' + Math.round(26 * (KEY_W[c] || 1)) + 'px;padding:6px 2px;text-align:center;border-radius:6px;border:1px solid rgba(255,255,255,.22);font:13px system-ui;transition:background .1s">' + keyLabel(c) + '</span>').join('') + '</div>').join('')
      + '</div><p class="kt-out" aria-live="polite" style="font-size:18px;margin:10px 0">Click the keyboard, then press any key.</p><p class="kt-n" style="color:#8a8a8a"></p>'
      + NOTE('Read in your browser from each key press · nothing is kept or sent · the system keeps some keys, like the Windows key and Cmd+Tab, for itself');
  });
  const $ = (c) => el && el.querySelector && el.querySelector(c), pad = $('.kt-pad'), out = $('.kt-out'), cnt = $('.kt-n');
  if (!pad) return 'my-device';
  const seen = new Set();
  const keyEl = (code) => (el.querySelectorAll ? [...el.querySelectorAll('.kt-k')].find((k) => k.dataset.c === code) : null);
  pad.addEventListener('keydown', (e) => {
    e.preventDefault();
    const k = keyEl(e.code); if (k) { k.style.background = '#3d6bd8'; k.style.color = '#fff'; }
    seen.add(e.code);
    if (out) out.textContent = 'key "' + (e.key === ' ' ? 'Space' : e.key) + '" · code ' + e.code + (e.location ? ' · ' + ['', 'left', 'right', 'number pad'][e.location] : '');
    if (cnt) cnt.textContent = seen.size + ' different keys pressed; the ones that worked stay marked.';
  });
  pad.addEventListener('keyup', (e) => { e.preventDefault(); const k = keyEl(e.code); if (k) { k.style.background = '#1f5a36'; } });
  try { pad.focus(); } catch (_) {}
  return 'my-device';
}

function mouseCard(api) {
  const el = api.showPage((p) => {
    p.innerHTML = '<h2>Mouse tester</h2><div class="mt-pad" style="height:200px;border-radius:14px;background:#1d1d2e;display:flex;align-items:center;justify-content:center;text-align:center;user-select:none;cursor:pointer">Click, right click, double click and scroll here</div>'
      + '<div style="display:flex;gap:6px;flex-wrap:wrap;margin:10px 0">' + BUTTONS.map((b, i) => '<span class="mt-b" data-b="' + i + '" style="' + BTN + ';cursor:default">' + b + ' 0</span>').join('') // void-review: ok, the names are BUTTONS above
      + '<span class="mt-w" style="' + BTN + ';cursor:default">Wheel up 0 · down 0</span><span class="mt-d" style="' + BTN + ';cursor:default">Double clicks 0</span></div>'
      + '<p class="mt-out" aria-live="polite" style="font-size:18px;margin:6px 0"></p>' + NOTE('Read in your browser from each press · nothing is kept or sent · Back and Forward show on mice that have them');
  });
  const $ = (c) => el && el.querySelector && el.querySelector(c), pad = $('.mt-pad'), out = $('.mt-out'), wheelEl = $('.mt-w'), dbl = $('.mt-d');
  if (!pad) return 'my-device';
  const n = [0, 0, 0, 0, 0], w = { up: 0, down: 0 }; let d = 0;
  const btn = (i) => (el.querySelectorAll ? [...el.querySelectorAll('.mt-b')].find((b) => +b.dataset.b === i) : null);
  pad.addEventListener('pointerdown', (e) => {
    e.preventDefault(); const i = e.button; if (i >= 0 && i < 5) n[i]++;
    const b = btn(i); if (b) { b.textContent = mouseButtonName(i) + ' ' + n[i]; b.style.background = '#3d6bd8'; }
    if (out) out.textContent = mouseButtonName(i) + ' button down';
  });
  pad.addEventListener('pointerup', (e) => { const b = btn(e.button); if (b) b.style.background = '#1f5a36'; if (out) out.textContent = mouseButtonName(e.button) + ' button up'; });
  pad.addEventListener('contextmenu', (e) => e.preventDefault());
  pad.addEventListener('auxclick', (e) => e.preventDefault());
  pad.addEventListener('dblclick', () => { d++; if (dbl) dbl.textContent = 'Double clicks ' + d; if (out) out.textContent = 'Double click'; });
  pad.addEventListener('wheel', (e) => { e.preventDefault(); if (e.deltaY < 0) w.up++; else if (e.deltaY > 0) w.down++; if (wheelEl) wheelEl.textContent = 'Wheel up ' + w.up + ' · down ' + w.down; }, { passive: false });
  return 'my-device';
}

function pixelsCard(api) {
  const el = api.showPage((p) => {
    p.innerHTML = '<h2>Dead pixel test</h2><p>The screen fills with one colour at a time: black, white, red, green, blue and grey. Look for a dot that stays one colour while the rest changes: a dead pixel stays dark, a stuck one stays lit. Click or press any key for the next colour; Esc ends it.</p>'
      + '<button type="button" class="dp-go" style="' + BTN + '">Start full screen</button><p class="dp-out" aria-live="polite" style="margin:10px 0"></p>'
      + NOTE('A visual check in your browser · it finds a pixel you can see, it does not repair one · nothing is kept or sent');
  });
  const $ = (c) => el && el.querySelector && el.querySelector(c), go = $('.dp-go'), out = $('.dp-out');
  if (!go || typeof document === 'undefined') return 'my-device';
  go.addEventListener('click', () => {
    const o = document.createElement('div'); let i = 0;
    o.setAttribute('role', 'dialog'); o.setAttribute('aria-label', 'Dead pixel test colour'); o.tabIndex = 0;
    o.style.cssText = 'position:fixed;inset:0;z-index:2147483646;cursor:none;background:' + PIXEL_COLOURS[0][0];
    const end = () => { document.removeEventListener('keydown', key, true); o.remove(); try { if (document.fullscreenElement) document.exitFullscreen(); } catch (_) {} if (out) out.textContent = 'Done: ' + PIXEL_COLOURS.length + ' colours shown.'; };
    const next = () => { i++; if (i >= PIXEL_COLOURS.length) end(); else o.style.background = PIXEL_COLOURS[i][0]; };
    const key = (e) => { e.preventDefault(); e.stopPropagation(); if (e.key === 'Escape') end(); else next(); };
    o.addEventListener('click', next);
    document.addEventListener('keydown', key, true);
    document.body.appendChild(o); try { o.focus(); } catch (_) {}
    try { if (o.requestFullscreen) o.requestFullscreen().catch(() => {}); } catch (_) {}
  });
  return 'my-device';
}

async function batteryCard(api) {
  const el = api.showPage((p) => {
    p.innerHTML = '<h2>Your battery</h2><p class="bt-out" aria-live="polite" style="font-size:22px;margin:10px 0">Reading it…</p>' + NOTE('Read from this browser, where it gives the battery to pages · nothing is kept or sent · no browser gives a battery\'s health');
  });
  const out = el && el.querySelector && el.querySelector('.bt-out');
  const nav = (typeof navigator !== 'undefined' && navigator) || {};
  let b = null; try { b = nav.getBattery ? await nav.getBattery() : null; } catch (_) { b = null; }
  const paint = () => { if (out) out.textContent = batteryLine(b); };
  paint();
  if (b && b.addEventListener) for (const ev of ['levelchange', 'chargingchange', 'chargingtimechange', 'dischargingtimechange']) b.addEventListener(ev, paint);
  return 'my-device';
}

function voiceCard(text, api) {
  const { esc } = api, words = (speechOf(text) || {}).text || '';
  const synth = typeof speechSynthesis !== 'undefined' ? speechSynthesis : null;
  const el = api.showPage((p) => {
    p.innerHTML = '<h2>Text to speech</h2><textarea class="ts-text" rows="4" aria-label="Words to read aloud" placeholder="Type or paste the words to read aloud" style="width:100%;box-sizing:border-box;font:16px system-ui;padding:8px;border-radius:10px">' + esc(words) + '</textarea>'
      + '<div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center;margin:8px 0"><label>Voice <select class="ts-voice" aria-label="Voice"></select></label>'
      + '<label>Rate <input class="ts-rate" type="range" min="0.5" max="2" step="0.1" value="1" aria-label="Rate"> <span class="ts-rv">1×</span></label></div>'
      + '<div style="display:flex;gap:8px"><button type="button" class="ts-go" style="' + BTN + '">Speak</button><button type="button" class="ts-stop" style="' + BTN + '">Stop</button></div>'
      + '<p class="ts-out" aria-live="polite" style="margin:10px 0"></p>' + NOTE('Spoken by your browser\'s own voice, in this browser · the words are not sent or kept · the voices are the ones your system has');
  });
  const $ = (c) => el && el.querySelector && el.querySelector(c), box = $('.ts-text'), sel = $('.ts-voice'), rate = $('.ts-rate'), rv = $('.ts-rv'), out = $('.ts-out'), go = $('.ts-go'), stop = $('.ts-stop');
  if (!box || !go) return 'my-device';
  if (!synth || typeof SpeechSynthesisUtterance === 'undefined') { if (out) out.textContent = 'This browser has no voice for web pages. Chrome, Edge, Safari and Firefox on most systems have one.'; return 'my-device'; }
  let voices = [];
  const fill = () => {
    voices = synth.getVoices() || [];
    if (!sel || !voices.length) return;
    const lang = (typeof navigator !== 'undefined' && navigator.language) || 'en-US', base = lang.toLowerCase().split('-')[0];
    const list = voices.map((v, i) => [v, i]).sort((a, b) => (b[0].lang.toLowerCase().startsWith(base) ? 1 : 0) - (a[0].lang.toLowerCase().startsWith(base) ? 1 : 0));
    sel.innerHTML = list.map(([v, i]) => '<option value="' + i + '"' + (v.default ? ' selected' : '') + '>' + esc(v.name + ' (' + v.lang + ')') + '</option>').join('');
  };
  fill(); if (synth.addEventListener) synth.addEventListener('voiceschanged', fill);
  if (rate && rv) rate.addEventListener('input', () => { rv.textContent = rate.value + '×'; });
  const speak = () => {
    const t = String(box.value || '').trim();
    if (!t) { if (out) out.textContent = 'Type some words first.'; return; }
    synth.cancel();
    const u = new SpeechSynthesisUtterance(t.slice(0, 4000)), v = voices[+((sel && sel.value) || -1)];
    if (v) u.voice = v; u.rate = +((rate && rate.value) || 1);
    u.onstart = () => { if (out) out.textContent = 'Speaking…'; };
    u.onend = () => { if (out) out.textContent = 'Done.'; };
    u.onerror = (e) => { if (out) out.textContent = e && e.error === 'not-allowed' ? 'Press Speak to hear it: this browser waits for a press before it talks.' : 'The voice stopped: ' + ((e && e.error) || 'unknown') + '.'; };
    synth.speak(u);
  };
  go.addEventListener('click', speak);
  if (stop) stop.addEventListener('click', () => { synth.cancel(); if (out) out.textContent = 'Stopped.'; });
  if (words) setTimeout(speak, 300); // a typed ask is a press; a link opened cold may need the Speak button
  return 'my-device';
}

async function run(text, api) {
  const { showPage, esc } = api;
  const k = deviceAsk(text);
  if (!k) return 'none';
  if (k === 'keys') return keysCard(api);
  if (k === 'mouse') return mouseCard(api);
  if (k === 'pixels') return pixelsCard(api);
  if (k === 'battery') return batteryCard(api);
  if (k === 'voice') return voiceCard(text, api);
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
  examples: ['what is my ip address', 'what is my user agent', 'what is my screen resolution', 'what browser am i using', "what's my ip", 'my screen size', 'what os am i using', 'device info', 'keyboard tester', 'mouse tester', 'dead pixel test', 'battery status', 'text to speech hello world', 'text to speech'],
  nearMisses: ['what is an ip address', 'what is a user agent', 'best screen resolution for gaming', 'my ip camera', 'ip address lookup 8.8.8.8', 'what does ip stand for', 'screen recorder', 'what is the best browser', 'keyboard shortcuts', 'best gaming mouse', 'what is a dead pixel', 'battery', 'text to speech api', 'what is text to speech', 'text to speech in python', 'read aloud', 'mouse click test'],
  match(lower, text) { return !!deviceAsk(text || lower); },
  run
};
