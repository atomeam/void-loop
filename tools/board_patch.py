"""Adds the owner's board to Void: 'unlock <READ_TOKEN>' once, then 'show the board' / 'what are people asking'."""
import pathlib
f = pathlib.Path(__file__).resolve().parent.parent / 'void.html'
s = f.read_text(encoding='utf-8'); nl = '\r\n' if '\r\n' in s else '\n'; s = s.replace('\r\n', '\n')
js = r'''
    // owner board: what visitors asked that Void couldn't answer yet (reads /api/misses)
    const OWNER_KEY = 'a2m.void.owner.v1';
    function wantsBoard(lower) {
      return /^(show\s+(me\s+)?)?(the\s+)?(big\s+)?board$|^what\s+(are|were)\s+people\s+asking|^(show\s+(me\s+)?)?(the\s+)?misses$/.test(lower);
    }
    async function showBoard() {
      let tok = '';
      try { tok = localStorage.getItem(OWNER_KEY) || ''; } catch (_) {}
      const el = showPage((p) => { p.innerHTML = '<h2>The board</h2><div class="sub">…</div>'; });
      if (!tok) { el.innerHTML = '<h2>The board</h2><p>This one is for the owner. Type “unlock” followed by your key.</p>'; return; }
      try {
        const r = await fetch('/api/misses', { headers: { authorization: 'Bearer ' + tok } });
        if (r.status === 401) { el.innerHTML = '<h2>The board</h2><p>That key didn\'t open it.</p>'; return; }
        const rows = await r.json();
        if (vpageEl !== el) return;
        el.innerHTML = '<h2>The board</h2><div class="sub">What people asked that Void can\'t answer yet · most asked first</div>'
          + (rows.length ? '<ul>' + rows.slice(0, 40).map((x) => '<li><b>' + x.count + '×</b> ' + esc(x.ask) + ' <span style="color:#6a6a6a">· ' + esc((x.last || '').slice(0, 10)) + (x.fallback ? ' · ' + esc(x.fallback) : '') + '</span></li>').join('') + '</ul>' : '<p>Nothing missed yet.</p>');
      } catch (_) { if (vpageEl === el) el.innerHTML = '<h2>The board</h2><p>The board didn\'t answer just now.</p>'; }
    }

    function handle(raw) {'''
a = '\n    function handle(raw) {'
assert s.count(a) == 1; s = s.replace(a, js, 1)
old = "      if (wantsSelfPage(lower0))"
new = ("      { const u = text.match(/^unlock\\s+(\\S{16,})$/i); if (u) { try { localStorage.setItem(OWNER_KEY, u[1]); } catch (_) {} say('unlocked'); showBoard(); return; } }\n"
       "      if (wantsBoard(lower0)) { showBoard(); return; }\n" + old)
assert s.count(old) == 1; s = s.replace(old, new, 1)
f.write_text(s.replace('\n', nl), encoding='utf-8')
print('board added')
