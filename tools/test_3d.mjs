// Checks for Void's shared 3D scene (skills/scene3d.js, docs/miniatures.md) and the playable 3D board games built on it.
// Called from tools/test_void.mjs with its browser helpers; the pure rules checks also run alone: node tools/test_3d.mjs --rules
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')), '..', 'void-live-deploy');
const until = async (fn, ms = 8000) => { const end = Date.now() + ms; for (;;) { try { const v = await fn(); if (v) return v; } catch (_) {} if (Date.now() > end) return false; await new Promise((r) => setTimeout(r, 150)); } };

// ---- the rules engines, without a browser: perft counts and known positions
export async function runRulesChecks(check) {
  const C = await import(pathToFileURL(path.join(root, 'skills', 'chess-rules.js')).href);
  const K = await import(pathToFileURL(path.join(root, 'skills', 'checkers-rules.js')).href);
  const perft = (s, d) => (d === 0 ? 1 : C.legalMoves(s).reduce((n, m) => n + perft(C.apply(s, m), d - 1), 0));
  const P = [[C.START, 3, 8902], ['r3k2r/p1ppqpb1/bn2pnp1/3PN3/1p2P3/2N2Q1p/PPPBBPPP/R3K2R w KQkq - 0 1', 2, 2039], ['8/2p5/3p4/KP5r/1R3p1k/8/4P1P1/8 w - - 0 1', 3, 2812], ['r3k2r/Pppp1ppp/1b3nbN/nP6/BBP1P3/q4N2/Pp1P2PP/R2Q1RK1 w kq - 0 1', 2, 264]];
  const got = P.map(([f, d]) => perft(C.fromFEN(f), d));
  check('chess rules: perft matches the published counts (start, Kiwipete, endgame, promotions) so every move generator rule is right', got.every((n, i) => n === P[i][2]), JSON.stringify(got));
  const play = (f, ms) => ms.reduce((s, m) => C.play(s, m), typeof f === 'string' ? C.fromFEN(f) : f);
  const fool = play(C.create(), ['f2f3', 'e7e5', 'g2g4', 'd8h4']);
  const stale = C.fromFEN('7k/5Q2/6K1/8/8/8/8/8 b - - 0 1');
  const ep = play(C.create(), ['e2e4', 'a7a6', 'e4e5', 'd7d5']); const epMove = C.legalMoves(ep).find((m) => m.ep);
  const afterEp = C.play(ep, 'e5d6');
  const castle = C.fromFEN('r3k2r/8/8/8/8/8/8/R3K2R w KQkq - 0 1'), blocked = C.fromFEN('r3k2r/8/8/8/8/8/8/R3K2R w KQkq - 0 1'.replace('8/8/8/8/8/8', '8/8/8/8/8/5r2'));
  const castled = C.play(castle, 'e1g1'), promo = C.fromFEN('8/P7/8/8/8/8/8/k6K w - - 0 1');
  const mateIn1 = C.bestMove(C.fromFEN('6k1/5ppp/8/8/8/8/5PPP/3R2K1 w - - 0 1'), { depth: 3, ms: 3000 });
  check('chess rules: fool\u2019s mate is checkmate, a lone king boxed in is stalemate, en passant takes the pawn, castling moves the rook and is refused through an attacked square, a pawn on the 7th promotes four ways, and Void finds a back-rank mate',
    C.status(fool) === 'checkmate' && C.status(stale) === 'stalemate' && epMove && C.sqName(epMove.to) === 'd6' && afterEp.board[C.sqIndex('d5')] === null && afterEp.board[C.sqIndex('d6')] === 'P'
    && castled.board[C.sqIndex('f1')] === 'R' && castled.board[C.sqIndex('g1')] === 'K' && !castled.castle.includes('K') && C.legalMoves(castle).some((m) => m.castle === 'q')
    && !C.legalMoves(blocked).some((m) => m.castle === 'k') && C.legalMoves(promo).filter((m) => m.promo).length === 4 && mateIn1 && C.sqName(mateIn1.to) === 'd8',
    JSON.stringify({ fool: C.status(fool), stale: C.status(stale), ep: !!epMove, mate: mateIn1 && C.sqName(mateIn1.from) + C.sqName(mateIn1.to) }));
  const start = K.create();
  const forced = K.fromRows(['........', '........', '........', '........', '...l....', '..d.....', '......d.', '........']); // a man can take: every move is a capture
  const multi = K.fromRows(['........', '........', '...l.l..', '........', '...l....', '..d.....', '........', '........']);
  const crowning = K.fromRows(['........', '..l.l...', '...d....', '........', '........', '........', '........', '........']); // the jump to the far row crowns and ends the move
  const king = K.fromRows(['........', '........', '........', '........', '...D....', '........', '........', 'l.......']);
  const fm = K.legalMoves(forced), mm = K.legalMoves(multi), cm = K.legalMoves(crowning), km = K.legalMoves(king);
  const afterCrown = cm.length ? K.apply(crowning, cm[0]) : null;
  const stuck = K.fromRows(['........', '........', '........', '........', '........', '..l.....', '.l......', 'd.......'], 'd'); // boxed in: no step, and the jump lands on a man
  const ai = K.bestMove(K.fromRows(['........', '........', '........', '........', '...l....', '..d.....', '........', '........'], 'd'), { depth: 4, ms: 2000 });
  check('checkers rules: 7 opening moves, a capture is forced, a man keeps jumping (both double-jump routes offered), crowning ends the move, a king steps backward, a side with no move loses, and Void takes a free man',
    K.legalMoves(start).length === 7 && fm.length && fm.every((m) => m.captures.length) && mm.length === 2 && mm.every((m) => m.captures.length === 2)
    && cm.length === 2 && cm.every((m) => m.crown && m.path.length === 1) && afterCrown && afterCrown.board[cm[0].path[0]] === 'D'
    && km.some((m) => (m.path[0] >> 3) < 3) && K.status(stuck) === 'light-wins' && ai && ai.captures.length === 1,
    JSON.stringify({ fm, mm: mm.length, cm, km: km.length, stuck: K.status(stuck), ai }));
}
if (process.argv.includes('--rules')) {
  let bad = 0; await runRulesChecks((name, ok, got) => { console.log((ok ? 'pass ' : 'FAIL ') + name + (ok ? '' : '  -> ' + got)); if (!ok) bad++; });
  process.exit(bad ? 1 : 0);
}

export async function run3dChecks({ check, fresh }) {
  const index = JSON.parse(fs.readFileSync(path.join(root, 'skills', 'index.json'), 'utf8'));
  const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
  // ---- the foundation: lazy, one renderer, realistic light, a miniature mounts, re-mounts by key, and goes away
  {
    const F = await fresh(); const hits = [];
    F.p.on('request', (r) => { const u = r.url(); if (/\/vendor\/|scene3d|\/skills\/mini\/|\/models\//.test(u)) hits.push(u.replace(/^.*\/\/[^/]+/, '')); });
    await F.p.waitForTimeout(400);
    check('3D scene: the empty page loads zero 3D bytes (no scene3d.js, no vendored three.js, no models) and the index never lists the engine or a miniature',
      hits.length === 0 && !index.includes('scene3d') && !index.some((n) => n.startsWith('mini/')) && !/\/vendor\/|\/models\//.test(html), JSON.stringify(hits));
    const r = await F.p.evaluate(async () => {
      const host = document.createElement('div'); host.id = 't3host'; host.style.cssText = 'position:fixed;left:40px;top:40px;width:320px;height:320px;z-index:9'; document.body.appendChild(host);
      const m = await import('/skills/scene3d.js');
      const h = await m.mountMiniature(host, 'sample', { color: '#8b3a1a' }, { key: 't3' });
      const E = await m.engine(); const T = E.THREE;
      const settings = { aces: E.renderer.toneMapping === T.ACESFilmicToneMapping, srgb: E.renderer.outputColorSpace === T.SRGBColorSpace, soft: E.renderer.shadowMap.enabled && E.renderer.shadowMap.type === T.PCFSoftShadowMap,
        env: !!(h.scene.environment && h.scene.environment.isTexture), keyShadow: h.keyLight.castShadow, contact: !!h.contact, gltf: !!E.gltf, meshopt: !!E.gltf.meshoptDecoder, ktx2: !!E.gltf.ktx2Loader, orbit: !!h.controls && h.controls.enableZoom };
      let badKind = false; try { m.registerMiniature('Bad Kind!', () => ({})); } catch (_) { badKind = true; }
      return { settings, badKind };
    });
    const drawn = await until(() => F.p.evaluate(() => { const l = window.__voidMini && window.__voidMini.list(); return l && l[0] && l[0].draws > 0 && l[0].ready ? l[0] : false; }));
    const pix = await F.p.evaluate(() => { const c = document.querySelector('#t3host canvas'), g = c && c.getContext('2d'); if (!g) return 0; const d = g.getImageData(0, 0, c.width, c.height).data; let n = 0; for (let i = 3; i < d.length; i += 4) if (d[i] > 20) n++; return n / (c.width * c.height); });
    check('3D scene: a miniature mounts on demand (vendored three.js r180 and skills/mini/sample.js load only now) with ACES, sRGB, PCF soft shadows, a room environment map, contact shadows, orbit and zoom, and GLTFLoader with meshopt and KTX2; bad kinds are refused',
      !!drawn && Object.values(r.settings).every(Boolean) && r.badKind && pix > 0.03 && hits.some((u) => /\/vendor\/three-r180\/build\/three\.module\.min\.js$/.test(u)) && hits.some((u) => /\/skills\/mini\/sample\.js$/.test(u)) && !F.errors.length,
      JSON.stringify({ r, drawn, pix, hits, e: F.errors }));
    const moved = await F.p.evaluate(async () => {
      const m = await import('/skills/scene3d.js'); const a = document.getElementById('t3host'), b = document.createElement('div'); b.style.cssText = 'position:fixed;left:400px;top:40px;width:200px;height:200px'; document.body.appendChild(b);
      const h1 = m.liveMiniatures()[0]; const h2 = await m.mountMiniature(b, 'sample', { color: '#225588' }, { key: 't3' });
      const same = m.liveMiniatures().length === 1 && b.querySelector('canvas') === h2.canvas && !a.querySelector('canvas');
      await new Promise((r) => setTimeout(r, 400)); const w = m.liveMiniatures()[0].w;
      const gone = m.unmountMiniature('t3'); return { same, w, gone, left: m.liveMiniatures().length, keyWas: h1.key };
    });
    check('3D scene: mounting the same key again (a card that re-rendered) moves the live miniature into the new host and resizes it, nothing rebuilt; unmount frees it',
      moved.same && moved.w === 200 && moved.gone && moved.left === 0, JSON.stringify(moved));
    check('3D scene: void.html hands every stage card stageApi.miniature(host, kind, data, opts), which imports scene3d.js only when called',
      /miniature: \(host, kind, data, opts\) => import\('\/skills\/scene3d\.js'\)\.then\(\(m\) => m\.mountMiniature\(host, kind, data, opts\)\)/.test(html), '');
    await F.ctx.close();
  }
  // ---- the countdown card's desk calendar: mounts on the card, counts from its target date, flips when the count changes
  {
    const F = await fresh();
    await F.ask('days until december 25');
    const drawn = await until(() => F.p.evaluate(() => { const l = window.__voidMini && window.__voidMini.list(); const c = l && l.find((x) => x.kind === 'countdown'); return c && c.draws > 0 && c.ready ? c : false; }), 30000);
    const r = await F.p.evaluate(async () => {
      const mini = await import('/skills/mini/countdown.js');
      const today = new Date(); const iso = (d) => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
      const in3 = new Date(today); in3.setDate(in3.getDate() + 3);
      const card = document.querySelector('.countdown-card'), slot = card && card.querySelector('.countdown-mini canvas');
      const th = Object.values(JSON.parse(localStorage.getItem('a2m.void.state.v1') || '{}')).find((t) => t.kind === 'countdown');
      return { inCard: !!slot, d3: mini.daysTo(iso(in3), today), d0: mini.daysTo(iso(today), today), bad: mini.daysTo('soon'), saved: !!th && /^\d{4}-\d{2}-\d{2}$/.test(th.target || '') && !('_mini' in th) };
    });
    const before = drawn ? drawn.draws : 0;
    await F.p.evaluate(async () => { const m = await import('/skills/scene3d.js'); const k = m.liveMiniatures().find((x) => x.kind === 'countdown').key; const card = document.querySelector('.countdown-card .countdown-mini'); const d = new Date(); d.setDate(d.getDate() + 3); const t = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
      await m.mountMiniature(card, 'countdown', { days: 3, label: 'Moved', target: t }, { key: k }); });
    const flipped = await until(() => F.p.evaluate((b) => { const c = window.__voidMini.list().find((x) => x.kind === 'countdown'); return c && c.draws > b + 2; }, before), 15000);
    check('3D countdown: "days until december 25" puts a desk flip-calendar miniature inside the card, the card saves its target date (and no live handle), daysTo counts local days, and a changed count flips a leaf (several redraws)',
      !!drawn && r.inCard && r.d3 === 3 && r.d0 === 0 && r.bad === null && r.saved && flipped && !F.errors.length, JSON.stringify({ drawn, r, flipped, e: F.errors }));
    await F.ctx.close();
  }
  // ---- the timer's hourglass: mounts beside the timer, sand follows remaining time, a fresh run turns the glass over
  {
    const F = await fresh();
    await F.ask('set a timer for 1 minute');
    const drawn = await until(() => F.p.evaluate(() => { const l = window.__voidMini && window.__voidMini.list(); const c = l && l.find((x) => x.kind === 'timer'); return c && c.draws > 0 && c.ready ? c : false; }), 30000);
    const r = await F.p.evaluate(async () => {
      const g = await import('/skills/mini/timer.js'); const now = 1e6;
      const el = document.querySelector('.thing.timer'), beside = el && el.querySelector('.void-mini[data-kind="timer"] canvas');
      return { beside: !!beside, half: g.leftFraction({ duration: 60000, remaining: 60000, running: true, startedAt: now - 30000 }, now), paused: g.leftFraction({ duration: 60000, remaining: 15000, running: false }, now),
        done: g.leftFraction({ duration: 60000, remaining: 1000, running: true, startedAt: now - 5000 }, now), none: g.leftFraction({ duration: 0, remaining: 5 }, now) };
    });
    // run it nearly out, then start a fresh minute: the glass turns over (several redraws in a row)
    const key = drawn && drawn.key;
    await F.p.evaluate(async (k) => { const m = await import('/skills/scene3d.js'); const host = document.querySelector('.thing.timer'); await m.mountMiniature(host, 'timer', { duration: 60000, remaining: 1000, running: false, startedAt: 0 }, { key: k, place: 'beside', width: 120, height: 160 }); }, key);
    await F.p.waitForTimeout(400);
    const before = await F.p.evaluate(() => window.__voidMini.list().find((x) => x.kind === 'timer').draws);
    await F.p.evaluate(async (k) => { const m = await import('/skills/scene3d.js'); const host = document.querySelector('.thing.timer'); await m.mountMiniature(host, 'timer', { duration: 60000, remaining: 60000, running: true, startedAt: Date.now() }, { key: k, place: 'beside', width: 120, height: 160 }); }, key);
    const turned = await until(() => F.p.evaluate((b) => window.__voidMini.list().find((x) => x.kind === 'timer').draws > b + 2, before), 15000);
    check('3D timer: "set a timer for 1 minute" puts a 3D hourglass beside the timer; leftFraction follows remaining and startedAt (half, paused, done, no duration); a fresh run turns the glass over',
      !!drawn && r.beside && Math.abs(r.half - 0.5) < 1e-9 && r.paused === 0.25 && r.done === 0 && r.none === 0 && turned && !F.errors.length, JSON.stringify({ drawn, r, turned, e: F.errors }));
    await F.ctx.close();
  }
  // ---- the counter's tally counter: mounts beside it, shows the value on four strips, and its plunger counts one up
  {
    const F = await fresh();
    await F.ask('make a counter');
    const drawn = await until(() => F.p.evaluate(() => { const l = window.__voidMini && window.__voidMini.list(); const c = l && l.find((x) => x.kind === 'counter'); return c && c.draws > 0 && c.ready ? c : false; }), 30000);
    const r = await F.p.evaluate(async () => { const g = await import('/skills/mini/counter.js'); return { a: g.wheelDigits(1234).join(''), b: g.wheelDigits(7).join(''), c: g.wheelDigits(-12).join(''), d: g.wheelDigits(123456).join('') }; });
    // tap the plunger in the 3D view (the button sits 0.0765 m up in the miniature's scene)
    const pt = drawn && await F.p.evaluate((k) => window.__voidMini.project(k, [0, 0.0765, 0]), drawn.key);
    if (pt) { await F.p.mouse.click(pt.x, pt.y); await F.p.waitForTimeout(400); }
    const value = (await F.state()).find((x) => x.kind === 'counter');
    check('3D counter: "make a counter" puts a chrome tally counter beside it; wheelDigits pads to four (1234, 0007, 0012, 3456); tapping its plunger counts one up on the card',
      !!drawn && r.a === '1234' && r.b === '0007' && r.c === '0012' && r.d === '3456' && value && value.value === 1 && !F.errors.length, JSON.stringify({ drawn, r, pt, value, e: F.errors }));
    await F.ctx.close();
  }

  await runRulesChecks(check);
  // ---- chess and checkers: routing, the real 3D board takes taps, Void replies, and a flat board where WebGL can't run
  {
    const F = await fresh();
    await F.ask('play chess', 600); await F.ask('chess', 600);
    const cards = await F.p.$$eval('.chess-card', (d) => d.length);
    const ready = await until(() => F.p.evaluate(() => { const l = window.__voidMini && window.__voidMini.list().find((m) => m.kind === 'chess'); return l && l.ready && l.draws > 0 ? l : false; }), 90000);
    // tap where a visitor would: the pawn's head (the king in front hides e2's square), then the empty e4 square
    const sq = async (name, lift) => F.p.evaluate(([n, y]) => { const k = window.__voidMini.keys().find((x) => x.startsWith('chess:')); const f = 'abcdefgh'.indexOf(n[0]), r = +n[1] - 1;
      return window.__voidMini.project(k, [(3.5 - f) * 0.0579, 0.0174 + y, (r - 3.5) * 0.0579]); }, [name, lift]);
    const tap = async (name, lift = 0) => { const pt = await sq(name, lift); await F.p.mouse.click(pt.x, pt.y); await F.p.waitForTimeout(250); };
    if (ready) { await tap('e2', 0.04); await tap('e4'); }
    const moved = await until(async () => { const st = await F.state(); const c = st.find((t) => t.kind === 'chess'); return c && c.state.s.board[28] === 'P' ? c : false; }, 20000);
    const replied = await until(async () => { const st = await F.state(); const c = st.find((t) => t.kind === 'chess'); return c && c.state.moves.length === 2 && c.state.s.turn === 'w' ? c.state.moves : false; }, 40000);
    const pix = await F.p.evaluate(() => { const c = document.querySelector('.chess-card canvas'), g = c && c.getContext('2d'); if (!g) return 0; const d = g.getImageData(0, 0, c.width, c.height).data; let n = 0; for (let i = 0; i < d.length; i += 16) if (d[i] + d[i + 1] + d[i + 2] > 60) n++; return n / (d.length / 16); });
    const shot = await F.p.evaluate(() => [...document.querySelectorAll('.void-mini')].map((m) => m.dataset.kind));
    check('chess: the 3D wooden set draws on the card, tapping e2 then e4 on the canvas plays 1. e4, and Void answers with a legal move',
      !!ready && !!moved && !!replied && pix > 0.2 && shot.includes('chess') && !F.errors.length, JSON.stringify({ ready, moved: !!moved, replied, pix, shot, e: F.errors }));
    await F.ask('play checkers', 600);
    const ck = await until(() => F.p.evaluate(() => { const l = window.__voidMini && window.__voidMini.list().find((m) => m.kind === 'checkers'); return l && l.ready && l.draws > 0 ? l : false; }), 90000);
    let jumped = false;
    if (ck) {
      const tapC = async (n) => { const pt = await F.p.evaluate((n) => { const k = window.__voidMini.keys().find((x) => x.startsWith('checkers:')); const f = 'abcdefgh'.indexOf(n[0]), r = +n[1] - 1; return window.__voidMini.project(k, [(3.5 - f) * 0.0579, 0.0174, (r - 3.5) * 0.0579]); }, n); await F.p.mouse.click(pt.x, pt.y); await F.p.waitForTimeout(250); };
      await tapC('c3'); await tapC('d4');
      jumped = await until(async () => { const st = await F.state(); const c = st.find((t) => t.kind === 'checkers'); return c && c.state.s.board[27] === 'd' && c.state.moves >= 2 && c.state.s.turn === 'd' ? true : false; }, 30000);
    }
    check('checkers: "play checkers" lays turned wooden men on the same board; tapping c3 then d4 moves your man and Void replies', !!ck && !!jumped && !F.errors.length, JSON.stringify({ ck, jumped, e: F.errors }));
    // questions about chess are still questions (they open a page, which would cover the boards, so they come last)
    await F.ask('who invented chess', 400); await F.ask('chess rules', 400); await F.ask('checkers rules', 400);
    const after = await F.p.evaluate(() => ({ chess: document.querySelectorAll('.chess-card').length, checkers: document.querySelectorAll('.checkers-card').length }));
    check('chess: "play chess" and "chess" summon one board (asked twice, still one); "who invented chess", "chess rules" and "checkers rules" add no board', cards === 1 && after.chess === 1 && after.checkers === 1, JSON.stringify({ cards, after }));
    await F.ctx.close();
  }
  {
    // no WebGL at all: both games fall back to a flat board of buttons that plays the same way
    const F = await fresh(() => { const g = HTMLCanvasElement.prototype.getContext; HTMLCanvasElement.prototype.getContext = function (t, ...a) { return /webgl/.test(t) ? null : g.call(this, t, ...a); }; });
    await F.ask('play chess', 600);
    const flat = await until(() => F.p.$$eval('.chess-flat button', (b) => b.length), 20000);
    if (flat) { await F.p.click('.chess-flat button[data-sq="12"]'); await F.p.click('.chess-flat button[data-sq="28"]'); }
    const moved = await until(async () => { const st = await F.state(); const c = st.find((t) => t.kind === 'chess'); return c && c.state.s.board[28] === 'P'; }, 8000);
    await F.ask('play checkers', 600);
    const flatC = await until(() => F.p.$$eval('.checkers-flat button', (b) => b.length), 20000);
    check('chess and checkers: without WebGL each shows a flat 64-square board and a click still plays a move', flat === 64 && !!moved && flatC === 64, JSON.stringify({ flat, moved, flatC, e: F.errors }));
    await F.ctx.close();
  }
  // ---- the list's clipboard: mounts beside the list, and ticking an item sends the pencil to tick it on the paper
  {
    const F = await fresh();
    await F.ask('make a grocery list with eggs, milk, bread');
    const drawn = await until(() => F.p.evaluate(() => { const l = window.__voidMini && window.__voidMini.list(); const c = l && l.find((x) => x.kind === 'list'); return c && c.draws > 0 && c.ready ? c : false; }), 30000);
    const r = await F.p.evaluate(async () => { const g = await import('/skills/mini/list.js'); const a = g.rowsOf([{ text: 'eggs' }, { text: 'milk', done: true }]);
      return { rows: JSON.stringify(a), nd: g.newlyDone(a, g.rowsOf([{ text: 'eggs', done: true }, { text: 'milk', done: true }])), none: g.newlyDone(a, a), moved: g.newlyDone(a, g.rowsOf([{ text: 'milk', done: true }])), cap: g.rowsOf(Array.from({ length: 12 }, (_, i) => ({ text: 'x' + i }))).length }; });
    const before = drawn ? drawn.draws : 0;
    const box = await F.p.$$('.list-entry input[type=checkbox]'); if (box[1]) await box[1].click();
    const inked = await until(() => F.p.evaluate((b) => window.__voidMini.list().find((x) => x.kind === 'list').draws > b + 8, before), 15000);
    check('3D list: a grocery list gets a clipboard beside it; rowsOf/newlyDone find the ticked line (not a removed one), the paper shows at most 7 lines, and ticking milk on the card animates the pencil (many redraws)',
      !!drawn && r.rows === '[{"text":"eggs","done":false},{"text":"milk","done":true}]' && r.nd === 0 && r.none === -1 && r.moved === -1 && r.cap === 7 && inked && !F.errors.length, JSON.stringify({ drawn, r, inked, e: F.errors }));
    await F.ctx.close();
  }
}
