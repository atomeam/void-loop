"""Row 13: entering your own Void + personal look. Apply to void.html (python tools\\entry_look_patch.py)."""
import pathlib
f = pathlib.Path(__file__).resolve().parent.parent / 'void.html'
s = f.read_text(encoding='utf-8'); nl = '\r\n' if '\r\n' in s else '\n'; s = s.replace('\r\n', '\n')
if 'a2m.void.entered.v1' in s:
    print('already applied'); raise SystemExit
css = '''    html { background: var(--void-bg, #050505); transition: background-color 1.5s ease; }
    html, body { background-color: transparent; }
    html { background-color: var(--void-bg, #050505); }
    #void-glow { position: fixed; inset: 0; pointer-events: none; z-index: 0;
      background: radial-gradient(circle at 50% 45%, var(--void-glow, #0b0b10), transparent 70%);
      opacity: 0; transition: opacity 1.5s ease; }
    body.void-entered #void-glow { opacity: 1; }
    #void-stars { position: fixed; inset: 0; width: 100%; height: 100%; pointer-events: none; z-index: 0;
      opacity: 0; transition: opacity 1.5s ease; }
    #void-stars.on { opacity: 1; }
    #stage, #dock { z-index: 1; }
    body.void-quiet { font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, sans-serif; font-weight: 300; }
  </style>'''
assert s.count('  </style>') == 1; s = s.replace('  </style>', css, 1)
b = '<div id="stage"'
assert s.count(b) == 1
s = s.replace(b, '<div id="void-glow"></div><canvas id="void-stars"></canvas>\n  ' + b, 1)
js = r'''
    // row 13: entering your own Void (silent, first time something is kept) + personal look
    const ENTRY_KEY = 'a2m.void.entered.v1', LOOK_KEY = 'a2m.void.look.v1';
    const LOOK_DEFAULT = { bg: '#050505', glow: '#0b0b10', stars: 'off', quiet: false, scale: 1 };
    const BGS = { 'deep blue': ['#01040f', '#0a1633'], blue: ['#01040f', '#0a1633'], purple: ['#07020f', '#1a0b2e'], warmer: ['#0d0704', '#24140a'], darker: ['#000000', '#07070a'] };
    let voidLook = { ...LOOK_DEFAULT };
    try { voidLook = { ...LOOK_DEFAULT, ...(JSON.parse(localStorage.getItem(LOOK_KEY) || '{}') || {}) }; } catch (_) {}
    const starCv = document.getElementById('void-stars');
    const starCtx = starCv.getContext('2d');
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
    let stars = [], starRAF = 0;
    function isEntered() { try { return !!localStorage.getItem(ENTRY_KEY); } catch (_) { return false; } }
    function enterVoid() {
      if (!isEntered()) { try { localStorage.setItem(ENTRY_KEY, new Date().toISOString()); } catch (_) {} }
      document.body.classList.add('void-entered');
    }
    function seedStars() {
      starCv.width = innerWidth; starCv.height = innerHeight;
      stars = Array.from({ length: 120 }, () => ({ x: Math.random() * innerWidth, y: Math.random() * innerHeight, r: Math.random() * 1.3 + 0.2, vx: (Math.random() - 0.5) * 0.15, vy: (Math.random() - 0.5) * 0.15 }));
    }
    function drawStars() {
      starCtx.clearRect(0, 0, starCv.width, starCv.height);
      starCtx.fillStyle = 'rgba(255,255,255,0.65)';
      const k = voidLook.stars === 'slow' ? 0.3 : 1, move = !reduceMotion.matches;
      for (const st of stars) {
        if (move) { st.x = (st.x + st.vx * k + starCv.width) % starCv.width; st.y = (st.y + st.vy * k + starCv.height) % starCv.height; }
        starCtx.beginPath(); starCtx.arc(st.x, st.y, st.r, 0, Math.PI * 2); starCtx.fill();
      }
      if (move && !document.hidden) starRAF = requestAnimationFrame(drawStars); else starRAF = 0;
    }
    function applyLook(persist) {
      const r = document.documentElement.style;
      r.setProperty('--void-bg', voidLook.bg); r.setProperty('--void-glow', voidLook.glow);
      document.body.classList.toggle('void-quiet', !!voidLook.quiet);
      document.body.style.fontSize = (15 * (voidLook.scale || 1)) + 'px';
      cancelAnimationFrame(starRAF); starRAF = 0;
      if (voidLook.stars !== 'off') { if (!stars.length) seedStars(); starCv.classList.add('on'); drawStars(); }
      else starCv.classList.remove('on');
      if (persist) { try { localStorage.setItem(LOOK_KEY, JSON.stringify(voidLook)); } catch (_) {} }
    }
    document.addEventListener('visibilitychange', () => { if (!document.hidden && voidLook.stars !== 'off' && !starRAF) drawStars(); });
    window.addEventListener('resize', () => { if (voidLook.stars !== 'off') seedStars(); });
    function handleLookAsk(lower) {
      if (/^(this is mine|open my void|my void)\s*[.!]?$/.test(lower)) { enterVoid(); say('yours'); return true; }
      if (!/\b(my void|the void|void)\b.*\b(deep blue|blue|purple|warmer|warm|darker|dark)\b|\b(add|slow|no|remove|hide)\s+(the\s+)?stars\b|\bquieter\s+(font|text)\b|\b(bigger|larger|smaller)\s+text\b|^reset\s+my\s+void$/.test(lower)) return false;
      enterVoid();
      if (/^reset\s+my\s+void$/.test(lower)) voidLook = { ...LOOK_DEFAULT };
      const c = (lower.match(/\b(deep blue|purple|warmer|darker|blue)\b/) || [])[1] || (/\bwarm\b/.test(lower) ? 'warmer' : /\bdark\b/.test(lower) ? 'darker' : '');
      if (c && /void/.test(lower)) { voidLook.bg = BGS[c][0]; voidLook.glow = BGS[c][1]; }
      if (/\badd\s+(the\s+)?stars\b/.test(lower)) voidLook.stars = 'on';
      if (/\bslow\s+(the\s+)?stars\b/.test(lower)) voidLook.stars = 'slow';
      if (/\b(no|remove|hide)\s+(the\s+)?stars\b/.test(lower)) voidLook.stars = 'off';
      if (/\bquieter\s+(font|text)\b/.test(lower)) voidLook.quiet = true;
      if (/\b(bigger|larger)\s+text\b/.test(lower)) voidLook.scale = Math.min(1.4, (voidLook.scale || 1) + 0.15);
      if (/\bsmaller\s+text\b/.test(lower)) voidLook.scale = Math.max(0.85, (voidLook.scale || 1) - 0.15);
      applyLook(true);
      return true;
    }
    if (isEntered()) document.body.classList.add('void-entered');
    applyLook(false);

    function handle(raw) {'''
a = '\n    function handle(raw) {'
assert s.count(a) == 1; s = s.replace(a, js, 1)
old = "      if (wantsSelfPage(lower0))"
assert s.count(old) == 1
s = s.replace(old, "      if (handleLookAsk(lower0)) { loopLog({ domain: 'void.look', ask: text, score: 'pass', note: 'look' }); return; }\n" + old, 1)
old2 = "    function save() {\n      localStorage.setItem(STATE_KEY, JSON.stringify(things));"
assert s.count(old2) == 1
s = s.replace(old2, old2 + "\n      if (Object.keys(things).length && !localStorage.getItem('a2m.void.entered.v1')) { localStorage.setItem('a2m.void.entered.v1', new Date().toISOString()); document.body.classList.add('void-entered'); }", 1)
f.write_text(s.replace('\n', nl), encoding='utf-8')
print('entry + look added')
