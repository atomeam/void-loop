// Checks for Void's shared 3D scene (skills/scene3d.js, docs/miniatures.md) and the playable 3D board games built on it.
// Called from tools/test_void.mjs with its browser helpers; the pure rules checks also run alone: node tools/test_3d.mjs --rules
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')), '..', 'void-live-deploy');
const until = async (fn, ms = 8000) => { const end = Date.now() + ms; for (;;) { try { const v = await fn(); if (v) return v; } catch (_) {} if (Date.now() > end) return false; await new Promise((r) => setTimeout(r, 150)); } };

// ---- the miniature behaviour contract (docs/miniatures.md, "The reference miniature"): any kind can be run through it.
// It mounts the kind on its own host with data a, then b under the same key, and reads what the engine and the kind's
// own state() say: it draws real pixels, its state follows the data, a remount moves the live one (nothing rebuilt),
// a change shows on the canvas, it settles (no redraws while idle), with reduced motion a change lands at once,
// and unmounting frees it. Returns the facts; the caller decides what the kind's state should be.
export async function miniContract(fresh, { kind, a, b, settledWhen = 'flipping' }) {
  const run = async (F, reduce) => F.p.evaluate(async ({ kind, a, b, reduce, settledWhen }) => {
    const m = await import('/skills/scene3d.js');
    const wait = async (fn, ms) => { const end = performance.now() + ms; for (;;) { const v = fn(); if (v) return v; if (performance.now() > end) return false; await new Promise((r) => setTimeout(r, 100)); } };
    const key = 'contract:' + kind + (reduce ? ':still' : '');
    const host = document.createElement('div'); host.style.cssText = 'position:fixed;left:16px;top:16px;width:260px;height:210px;z-index:9';
    document.body.appendChild(host);
    const me = () => m.liveMiniatures().find((x) => x.key === key);
    const state = () => window.__voidMini.state(key);
    const pixels = () => { const c = host.querySelector('canvas'); if (!c || !c.width) return { colours: 0, sig: '' }; const g = c.getContext('2d'), d = g.getImageData(0, 0, c.width, c.height).data, seen = new Set(); let sig = 0;
      for (let i = 0; i < d.length; i += 4 * 7) { seen.add((d[i] >> 3) + ',' + (d[i + 1] >> 3) + ',' + (d[i + 2] >> 3)); sig = (sig * 31 + d[i] + d[i + 1] * 3 + d[i + 2] * 7) % 1000000007; } return { colours: seen.size, sig: String(sig) }; };
    const settle = () => wait(() => { const s = state(); return !(s && s[settledWhen]); }, 8000);
    const h1 = await m.mountMiniature(host, kind, a, { key });
    const drawn = await wait(() => { const x = me(); return x && x.ready && x.draws > 0; }, 60000);
    await settle(); await new Promise((r) => setTimeout(r, 300));
    const pa = pixels(), sa = state();
    const h2 = await m.mountMiniature(host, kind, b, { key });
    const right = state(); // straight after the update: still mid-animation unless reduced motion
    const changedAt = await wait(() => pixels().sig !== pa.sig, 15000);
    const settled = !!(await settle());
    await new Promise((r) => setTimeout(r, 400));
    const d0 = me().draws; await new Promise((r) => setTimeout(r, 1500)); const d1 = me().draws;
    const sb = state(), pb = pixels();
    const freed = m.unmountMiniature(key) && !me();
    host.remove();
    return { drawn: !!drawn, colours: pa.colours, same: h1 === h2, stateA: sa, stateRight: right, stateB: sb, redrew: !!changedAt && pb.sig !== pa.sig, settled, idleDraws: d1 - d0, freed };
  }, { kind, a, b, reduce, settledWhen });
  const F = await fresh(); const moving = await run(F, false); const errors = F.errors.slice(); await F.ctx.close();
  const S = await fresh(); await S.p.emulateMedia({ reducedMotion: 'reduce' }); await S.p.reload(); await S.p.waitForTimeout(700);
  const still = await run(S, true); errors.push(...S.errors); await S.ctx.close();
  return { moving, still, errors };
}

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
    const pixOf = () => F.p.evaluate(() => { const c = document.querySelector('#t3host canvas'), g = c && c.getContext('2d'); if (!g) return 0; const d = g.getImageData(0, 0, c.width, c.height).data; let n = 0; for (let i = 3; i < d.length; i += 4) if (d[i] > 20) n++; return n / (c.width * c.height); });
    const pix = (await until(async () => { const v = await pixOf(); return v > 0.03 ? v : 0; }, 20000)) || (await pixOf()); // a slow software renderer can hand over its first frame late
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
  // ---- the reference miniature: the countdown's calendar passes the behaviour contract every miniature should
  {
    const c = await miniContract(fresh, { kind: 'countdown', a: { days: 12, label: 'Launch' }, b: { days: 11, label: 'Launch' } });
    const ok = (r, still) => r.drawn && r.colours > 40 && r.same && r.stateA && r.stateA.days === 12 && r.stateB.days === 11 && r.stateB.label === 'Launch'
      && r.redrew && r.settled && r.idleDraws === 0 && r.freed && (still ? r.stateRight.flipping === false : true);
    check('reference miniature (countdown): draws real pixels, its state follows the data (12 -> 11), a remount by key moves the live one (nothing rebuilt), the change shows on the canvas, it settles with no redraws while idle, under reduced motion the change lands with no flip, and unmounting frees it',
      ok(c.moving, false) && ok(c.still, true) && c.moving.stateRight.flipping === true && !c.errors.length, JSON.stringify(c));
  }
  // ---- the gear explainer (explainer.gear-pair) through the same contract: a 16-32 pair, then the driver changed to 24 teeth
  {
    const G = await import(pathToFileURL(path.join(root, 'skills', 'gear-pair-rules.js')).href);
    const c = await miniContract(fresh, { kind: 'gears', a: { state: G.create({ driverTeeth: 16, drivenTeeth: 32 }) }, b: { state: G.turnDriver(G.create({ driverTeeth: 24, drivenTeeth: 32 }), 30) }, settledWhen: 'dragging' });
    const ok = (r) => r.drawn && r.colours > 40 && r.same && r.stateA && r.stateA.built === '16:32' && r.stateB.built === '24:32' && r.redrew && r.settled && r.idleDraws === 0 && r.freed;
    check('gear explainer miniature: draws real pixels, its pair follows the data (16:32 -> 24:32), a remount by key moves the live one, the change shows on the canvas, it settles with no redraws while paused, under reduced motion too, and unmounting frees it',
      ok(c.moving) && ok(c.still) && !c.errors.length, JSON.stringify(c));
  }
  // ---- the moon explainer (explainer.moon-phases) through the same contract: the Moon at 30°, then moved to 200°
  {
    const M = await import(pathToFileURL(path.join(root, 'skills', 'moon-phases-rules.js')).href);
    const c = await miniContract(fresh, { kind: 'moon', a: { state: M.create({ orbitAngleDegrees: 30 }) }, b: { state: M.create({ orbitAngleDegrees: 200 }) }, settledWhen: 'dragging' });
    const near = (x, y) => Math.abs(x - y) < 0.01;
    const ok = (r) => r.drawn && r.colours > 40 && r.same && r.stateA && near(r.stateA.angle, 30) && near(r.stateB.angle, 200) && r.stateB.moon[2] > 0 && r.redrew && r.settled && r.idleDraws === 0 && r.freed;
    check('moon explainer miniature: draws real pixels, the Moon follows the data (30° -> 200°, now on the far side), a remount by key moves the live one, the change shows on the canvas, it settles with no redraws while paused, under reduced motion too, and unmounting frees it',
      ok(c.moving) && ok(c.still) && !c.errors.length, JSON.stringify(c));
  }
  // ---- the lock explainer (explainer.pin-lock) through the same contract: the matching key half in, then fully in and turned 60°
  {
    const Lk = await import(pathToFileURL(path.join(root, 'skills', 'lock-rules.js')).href);
    const a = Lk.setInsertion(Lk.create({ keyPreset: 'matching' }), 0.5), b = Lk.turnTo(Lk.setInsertion(Lk.create({ keyPreset: 'matching' }), 1), 60);
    const c = await miniContract(fresh, { kind: 'lock', a: { state: a }, b: { state: b }, settledWhen: 'dragging' });
    const ok = (r) => r.drawn && r.colours > 40 && r.same && r.stateA && r.stateA.state === 'inserting' && r.stateA.insertion === 0.5
      && r.stateB.state === 'turned' && r.stateB.angle === 60 && r.stateB.aligned === 5 && r.stateB.driverY.every((y) => y === Lk.SHEAR + Lk.DRIVER / 2)
      && r.redrew && r.settled && r.idleDraws === 0 && r.freed;
    check('lock explainer miniature: draws real pixels (brass housing and plug, steel pins, springs, the key), poses from the one state (half in, then fully in and turned 60° with every driver pin waiting at the shear line), a remount by key moves the live one, it settles with no redraws, under reduced motion too, and unmounting frees it',
      ok(c.moving) && ok(c.still) && !c.errors.length, JSON.stringify(c));
  }
  // ---- Ringer (build-order step 5) through the same contract: a new game, then the same game after a hard shot has settled
  {
    const Rr = await import(pathToFileURL(path.join(root, 'skills', 'ringer-rules.js')).href);
    const a = Rr.create(77), b = Rr.settle(Rr.flick(Rr.setPower(a, 1)));
    const c = await miniContract(fresh, { kind: 'ringer', a: { state: a }, b: { state: b }, settledWhen: 'rolling' });
    const ok = (r) => r.drawn && r.colours > 40 && r.same && r.stateA && r.stateA.marbles === 14 && r.stateA.left === 13 && r.stateA.aiming
      && r.stateB.out === b.out && r.stateB.left === 13 - b.out && r.stateB.shots === 1 && r.redrew && r.settled && r.idleDraws === 0 && r.freed;
    check('Ringer miniature: draws real pixels (dirt, chalk ring, 14 glass marbles), poses from the one state (13 in the ring, then ' + b.out + ' knocked out after a shot), a remount by key moves the live one, it settles with no redraws, under reduced motion too, and unmounting frees it',
      b.out >= 1 && ok(c.moving) && ok(c.still) && !c.errors.length, JSON.stringify(c));
  }
  // ---- Ringer end to end: "play marbles" stands the ring in the void, Flick rolls it from the card's own state until it stops
  {
    const F = await fresh();
    await F.ask('play marbles', 600);
    const up = await until(() => F.p.evaluate(() => { const l = window.__voidMini && window.__voidMini.list(); const c = l && l.find((x) => x.kind === 'ringer'); return c && c.ready && c.draws > 0 ? c.key : false; }), 30000);
    const before = up && await F.p.evaluate((k) => window.__voidMini.state(k), up);
    if (up) { await F.p.evaluate(() => { const p = document.querySelector('.ringer-power'); p.value = '100'; p.dispatchEvent(new Event('input', { bubbles: true })); }); await F.p.click('.ringer-flick'); }
    const after = up && await until(() => F.p.evaluate((k) => { const s = window.__voidMini.state(k); return s && s.shots === 1 && !s.rolling ? s : false; }, up), 20000);
    const status = await F.p.evaluate(() => (document.querySelector('.ringer-status') || {}).textContent || '');
    check('Ringer: "play marbles" stands the ring in the void (14 marbles, 13 to knock out); Flick rolls it from the card\'s state until everything stops, and the card says how the shot went',
      !!up && before && before.marbles === 14 && before.left === 13 && !!after && after.out >= 1 && /knocked out · 1 shot/.test(status) && F.errors.length === 0,
      JSON.stringify({ up, before, after, status, errors: F.errors.slice(0, 3) }));
    await F.ctx.close();
  }
  // ---- the growth tree (frontier #3) through the same contract: a 5-entry ledger, then a 6th entry grows in as a new tip
  {
    const day = (d, i, kind) => ({ at: '2026-10-0' + d + 'T1' + i + ':00:00Z', by: 'claude', kind, what: 'entry ' + i });
    const five = [day(1, 0, 'grow'), day(2, 1, 'build'), day(3, 2, 'fix'), day(4, 3, 'idea'), day(5, 4, 'grow')];
    const c = await miniContract(fresh, { kind: 'growthtree', a: { entries: five }, b: { entries: five.concat([day(6, 5, 'finding')]) }, settledWhen: 'growing' });
    const ok = (r, still) => r.drawn && r.colours > 40 && r.same && r.stateA && r.stateA.branches === 5 && r.stateA.newest === 4 && r.stateB.branches === 6 && r.stateB.newest === 5
      && r.redrew && r.settled && r.idleDraws === 0 && r.freed && (still ? r.stateRight.growing === false : true);
    check('growth tree miniature: draws real pixels, one branch per ledger entry (5 -> 6, the new one the newest tip), a remount by key moves the live one, the new branch grows in and shows on the canvas, it settles with no redraws while idle, under reduced motion the branch is simply there, and unmounting frees it',
      ok(c.moving, false) && ok(c.still, true) && c.moving.stateRight.growing === true && !c.errors.length, JSON.stringify(c));
  }
  // ---- "growth": the card brings its tree (two-part summons), and touching the trunk reads the oldest entry under it
  {
    const F = await fresh();
    await F.ask('growth');
    const drawn = await until(() => F.p.evaluate(() => { const l = window.__voidMini && window.__voidMini.list(); const c = l && l.find((x) => x.kind === 'growthtree'); return c && c.draws > 0 && c.ready ? c : false; }), 60000);
    const at = drawn && await F.p.evaluate(async () => {
      const T = await import('/skills/growth-tree.js'); const list = await (await fetch('/void.growth.json')).json(); const t = T.layout(list);
      return { pt: window.__voidMini.project('growth-tree', T.midpoint(t.branches[0])), oldest: list[t.branches[0].index].what.slice(0, 40), trunk: t.branches[0].index, n: t.branches.length, inCard: !!document.querySelector('.vpage .growth-tree canvas'), state: window.__voidMini.state('growth-tree') };
    });
    if (at && at.pt) await F.p.mouse.click(at.pt.x, at.pt.y);
    const read = at && await until(() => F.p.evaluate((w) => { const s = document.querySelector('.vpage .growth-picked'); return s && s.textContent.includes(w) ? s.textContent.slice(0, 80) : false; }, at.oldest), 8000);
    const sel = await until(() => F.p.evaluate(() => { const s = window.__voidMini && window.__voidMini.state('growth-tree'); return s && s.selected != null ? s : false; }), 8000);
    check('"growth": the ledger card brings its 3D tree inside the card with a branch for every entry, and touching the trunk reads the oldest entry under the tree and lights that branch',
      !!drawn && at.inCard && at.state.branches === at.n && !!read && sel && sel.selected === at.trunk && !F.errors.length, JSON.stringify({ drawn: !!drawn, at, read, sel, e: F.errors }));
    // the time slider: at the first date the tree is one branch, at today all of them (plus the faint shoots not grown yet)
    const slide = async (v) => { await F.p.evaluate((v) => { const r = document.querySelector('.vpage .growth-when input'); r.value = String(v); r.dispatchEvent(new Event('input', { bubbles: true })); }, v);
      return until(() => F.p.evaluate((v) => { const s = window.__voidMini.state('growth-tree'); return s && !s.growing && (v === 0 ? s.branches === 1 : s.until === null) ? { s, day: document.querySelector('.vpage .growth-day').textContent } : false; }, v), 15000); };
    const first = await slide(0), last = await slide(9999);
    // the will has an open want (the suite's /api/will says one), so today there is at least one bud, and the commits are new leaves
    const buds = await until(() => F.p.evaluate(() => { const s = window.__voidMini.state('growth-tree'); return s && s.buds >= 1 && s.commitLeaves > 0 ? s : false; }), 15000);
    check('"growth": the time slider under the tree goes back to the first change (one branch, the readout names that day and 1 change) and forward to today (every branch, the shoots not grown yet among them, one of them the claim being built, at least one bud for the will\'s open want, the last commits as new leaves)',
      !!first && first.s.branches === 1 && first.s.ghosts === 0 && /2026-09-25 · 1 change\b/.test(first.day) && !!last && last.s.branches === at.n && last.s.ghosts > 0 && last.s.building && new RegExp('today, .* · ' + at.n + ' changes').test(last.day) && !F.errors.length && !!buds,
      JSON.stringify({ first, last, buds, e: F.errors }));
    await F.ctx.close();
  }
  // ---- "what can you do now that you couldn't last week?": the tree stands as it was a week ago, then this week's tips grow in
  {
    const F = await fresh();
    // the week-ago tree stands for about a second; polling from here can miss it, because each evaluate waits behind a
    // software-WebGL frame that takes about as long, so the page records the first week-ago pose itself, frame by frame
    await F.p.evaluate(() => { window.__weekAgo = null; const look = () => { const s = window.__voidMini && window.__voidMini.state('growth-tree'); if (s && s.until && !window.__weekAgo) window.__weekAgo = s; if (!window.__weekAgo) requestAnimationFrame(look); }; requestAnimationFrame(look); });
    await F.ask("what can you do now that you couldn't last week?");
    const seen = { weekAgo: null, today: null };
    await until(async () => { const s = await F.p.evaluate(() => window.__voidMini && window.__voidMini.state('growth-tree')); if (s && s.until === null && !s.growing) seen.today = s; return seen.today; }, 60000);
    seen.weekAgo = await F.p.evaluate(() => window.__weekAgo);
    const day = await F.p.evaluate(() => { const d = document.querySelector('.vpage .growth-day'); return d && d.textContent; });
    const n = await F.p.evaluate(async () => (await import('/skills/growth-tree.js')).layout(await (await fetch('/void.growth.json')).json()).branches.length);
    check('"what can you do now that you couldn\'t last week?": the card\'s tree first stands as it was a week ago (fewer branches), then grows to today with this week\'s tips, the readout ending on today',
      !!seen.weekAgo && !!seen.today && seen.weekAgo.branches < seen.today.branches && seen.today.branches === n && /^today, /.test(day || '') && !F.errors.length, JSON.stringify({ seen, day, n, e: F.errors }));
    await F.ctx.close();
  }
  // ---- Ringer drag to flick: press the shooter on the 3D ring, pull it straight back and let go: one shot, aimed opposite the pull
  {
    const Rr = await import(pathToFileURL(path.join(root, 'skills', 'ringer-rules.js')).href);
    const F = await fresh();
    await F.ask('play marbles', 600);
    const key = await until(() => F.p.evaluate(() => { const l = window.__voidMini && window.__voidMini.list(); const c = l && l.find((x) => x.kind === 'ringer'); return c && c.ready && c.draws > 0 ? c.key : false; }), 30000);
    const z0 = Rr.RING + Rr.SHOOTER; // a new game's shooter sits at the edge, ring centre (0, 0); the ground's y is the state's -y
    const at = key && await F.p.evaluate(([k, a, b]) => ({ from: window.__voidMini.project(k, a), to: window.__voidMini.project(k, b) }), [key, [0, Rr.SHOOTER, z0], [0, 0, z0 + Rr.PULL_MAX * 0.8]]);
    let mid = null;
    if (at && at.from && at.to) {
      await F.p.mouse.move(at.from.x, at.from.y); await F.p.mouse.down();
      for (let i = 1; i <= 6; i++) await F.p.mouse.move(at.from.x + (at.to.x - at.from.x) * i / 6, at.from.y + (at.to.y - at.from.y) * i / 6);
      mid = await F.p.evaluate((k) => window.__voidMini.state(k), key);
      await F.p.mouse.up();
    }
    const after = key && await until(() => F.p.evaluate((k) => { const s = window.__voidMini.state(k); return s && s.shots === 1 && !s.rolling ? s : false; }, key), 20000);
    check('Ringer: on the 3D ring, pressing the shooter and pulling it straight back aims at the middle with the pull as power (orbit held while pulling); letting go flicks it, one shot',
      !!key && !!mid && mid.pulling && Math.abs(mid.angle - Math.PI / 2) < 0.2 && mid.power > 0.5 && mid.shots === 0 && !!after && after.shots === 1 && !after.pulling && F.errors.length === 0,
      JSON.stringify({ key, at, mid, after, errors: F.errors.slice(0, 3) }));
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

  // ---- card miniatures: the clock keeps the asked zone's time, the weather diorama shows the forecast
  {
    const F = await fresh();
    const r = await F.p.evaluate(async () => {
      const m = await import('/skills/scene3d.js'); const host = (id) => { const d = document.createElement('div'); d.id = id; d.style.cssText = 'position:fixed;left:20px;top:20px;width:360px;height:220px;z-index:9'; document.body.appendChild(d); return d; };
      const c = await m.mountMiniature(host('mc'), 'clock', { clocks: [{ tz: 'Asia/Tokyo', label: 'Tokyo' }, { tz: 'America/New_York', label: 'New York' }] }, { key: 'tclock' });
      const fixed = Date.UTC(2026, 0, 15, 6, 30, 0); // 15:30 in Tokyo, 01:30 in New York
      const c2 = await m.mountMiniature(host('mc2'), 'clock', { clocks: [{ tz: 'Asia/Tokyo', label: 'Tokyo' }], at: fixed }, { key: 'tclock2' });
      const now = new Date(), tok = new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Tokyo', hour: 'numeric', minute: 'numeric', hourCycle: 'h23' }).formatToParts(now);
      const hh = +tok.find((x) => x.type === 'hour').value, mm = +tok.find((x) => x.type === 'minute').value;
      const st = c.inst.state(), st2 = c2.inst.state(); const T = Math.PI * 2, near = (a, b, tol) => { const d = Math.abs(((a - b) % T + T + T / 2) % T - T / 2); return d < tol; };
      const w = await m.mountMiniature(host('mw'), 'weather', { code: 63, temp: 12, isDay: true, wind: 20 }, { key: 'twx' });
      const rain = w.inst.state(); w.update({ code: 73, temp: -4, isDay: false }); const snow = w.inst.state(); w.update({ code: 0, temp: 30, isDay: true }); const sun = w.inst.state(); w.update({ code: 45, temp: 8, isDay: true }); const fog = w.inst.state();
      return { live: near(st[0].minute, (mm / 60) * T, 0.12) && near(st[0].hour, ((hh % 12 + mm / 60) / 12) * T, 0.05), twoZones: Math.abs(st[0].hour - st[1].hour) > 0.1,
        fixed: near(st2[0].hour, (3.5 / 12) * T, 0.01) && near(st2[0].minute, Math.PI, 0.01) && near(st2[0].second, 0, 0.01), rain, snow, sun, fog };
    });
    const drawn = await until(() => F.p.evaluate(() => window.__voidMini.list().filter((x) => x.draws > 0).length >= 3), 60000);
    check('miniatures: the brass clock\u2019s hands show the real time in each asked zone (two zones differ), and a fixed moment ("3:30pm Tokyo") stops them exactly there',
      r.live && r.twoZones && r.fixed && !!drawn && !F.errors.length, JSON.stringify({ live: r.live, two: r.twoZones, fixed: r.fixed, drawn, e: F.errors }));
    check('miniatures: the weather diorama rains under grey clouds, snows at night with lit windows, shows the sun on a clear day with a taller thermometer column, and fogs over in fog',
      r.rain.rain && !r.rain.sun && r.rain.clouds >= 2 && r.snow.snow && r.snow.windows > 1 && !r.snow.rain && r.sun.sun && !r.sun.rain && r.sun.clouds === 0 && r.sun.column > r.snow.column && r.fog.fog,
      JSON.stringify({ rain: r.rain, snow: r.snow, sun: r.sun, fog: r.fog }));
    await F.ask('weather in Lisbon', 600);
    const wx = await until(() => F.p.evaluate(() => { const l = window.__voidMini.list().find((x) => x.kind === 'weather' && x.key.startsWith('weather:')); return l && l.draws > 0 && !!document.querySelector('.vpage.on .vmini canvas'); }), 60000);
    check('miniatures: "weather in Lisbon" puts the live diorama at the top of the weather card', !!wx && !F.errors.length, JSON.stringify({ wx, e: F.errors }));
    await F.ctx.close();
  }

  // ---- card miniatures, batch 2: the stopwatch runs with its card, the calculator types the sum
  {
    const F = await fresh();
    const r = await F.p.evaluate(async () => {
      const m = await import('/skills/scene3d.js'); const host = (id) => { const d = document.createElement('div'); d.id = id; d.style.cssText = 'position:fixed;left:20px;top:20px;width:300px;height:240px;z-index:9'; document.body.appendChild(d); return d; };
      const now = Date.now(), T = Math.PI * 2;
      let presses = 0; const sw = await m.mountMiniature(host('ms'), 'stopwatch', { read: () => ({ ms: 90500, running: false }), press: () => presses++ }, { key: 'tsw' });
      const s = sw.inst.state();
      const calc = await import('/skills/mini/calculator.js');
      const cm = await m.mountMiniature(host('mc'), 'calculator', { expression: '12*7', result: '84', typed: true }, { key: 'tcalc' });
      const typing = cm.inst.state();
      return { sw: { second: Math.abs(s.second - (30.5 / 60) * T) < 0.02, minute: Math.abs(s.minute - (1.5083 / 30) * T) < 0.02 }, typing,
        keys: calc.keysFor('15% of 240').join(''), keys2: calc.keysFor('(3 + 4) * 2 / 7 - 1').join('') };
    });
    const typed = await until(() => F.p.evaluate(() => { const s = window.__voidMini.state('tcalc'); return s && !s.pending && s.display === '84' ? s : false; }), 30000);
    check('miniatures: the stopwatch\u2019s sweep hand and 30-minute register read 1:30.5; the calculator presses 1, 2, \u00d7, 7, = and then shows 84 ("15% of 240" types 15%\u00d7240)',
      r.sw.second && r.sw.minute && r.typing.pending > 0 && !!typed && r.keys === '15%\u00d7240' && r.keys2 === '3+4\u00d72\u00f77\u22121' && !F.errors.length, JSON.stringify({ sw: r.sw, typing: r.typing, typed, keys: r.keys, keys2: r.keys2, e: F.errors }));
    await F.ask('make a calculator', 600);
    const card = await until(() => F.p.evaluate(() => { const l = window.__voidMini.list().find((x) => x.kind === 'calculator' && x.key.startsWith('calculator:calc')); return l && l.draws > 0 && !!document.querySelector('.calc-card .void-mini canvas') ? window.__voidMini.state(l.key) : false; }), 60000);
    await F.ask('calculate 12*7', 600);
    const page = await until(() => F.p.evaluate(() => { const l = window.__voidMini.list().find((x) => x.kind === 'calculator' && x.key.startsWith('calculator:page')); const s = l && window.__voidMini.state(l.key); return l && l.draws > 0 && !!document.querySelector('.vpage.on .vmini canvas') && s && s.display === '84' && !s.pending ? s : false; }), 60000);
    const cc = card && page ? { card, page } : false;
    await F.ask('start a stopwatch', 600);
    const sw = await until(() => F.p.evaluate(() => { const l = window.__voidMini.list().find((x) => x.kind === 'stopwatch' && /^stopwatch:\d/.test(x.key)); const s = l && window.__voidMini.state(l.key); return l && l.draws > 0 && !!document.querySelector('.vpage.on .vmini canvas') && s && s.ms > 300 ? s : false; }), 60000);
    check('miniatures: "make a calculator" puts a pocket calculator on its card, "calculate 12*7" types it on a calculator\u2019s keys to 84 on the answer card, "start a stopwatch" runs a 3D stopwatch on its card',
      !!cc && !!sw && !F.errors.length, JSON.stringify({ cc, sw, e: F.errors }));
    await F.p.reload(); await F.p.waitForTimeout(700); // render() runs on load before stageApi exists: the cards must still mount
    const back = await until(() => F.p.evaluate(() => !!document.querySelector('.calc-card .void-mini canvas') && document.querySelectorAll('.thing').length >= 1), 60000);
    check('miniatures: after a reload the calculator comes back with its 3D miniature (render() runs on load before stageApi exists)', !!back && !F.errors.length, JSON.stringify({ back, e: F.errors }));
    await F.ctx.close();
  }

  // ---- card miniatures: the notepad shows the note in handwriting and rewrites as you type
  {
    const F = await fresh();
    const r = await F.p.evaluate(async () => {
      const m = await import('/skills/scene3d.js'); const d = document.createElement('div'); d.style.cssText = 'position:fixed;left:20px;top:20px;width:300px;height:220px;z-index:9'; document.body.appendChild(d);
      const np = await m.mountMiniature(d, 'notepad', { title: 'Call', text: 'call mom about sunday dinner and pick up milk, eggs and basil on the way home' }, { key: 'tnp' });
      const a = np.inst.state(); np.update({ title: 'Call', text: 'short' }); const b = np.inst.state(); return { a, b };
    });
    await F.ask('make a notepad', 600);
    const pad = await until(() => F.p.evaluate(() => { const l = window.__voidMini.list().find((x) => x.kind === 'notepad' && x.key.startsWith('notepad:note')); return l && l.draws > 0 && !!document.querySelector('.notepad .void-mini canvas') ? l.key : false; }), 60000);
    let typed = false;
    if (pad) { await F.p.fill('.notepad-textarea', 'buy flowers for the party and call the florist tomorrow morning'); typed = await until(() => F.p.evaluate((k) => { const s = window.__voidMini.state(k); return s && s.lines >= 1 && /flowers/.test(s.text) ? s : false; }, pad), 20000); }
    check('miniatures: the legal pad writes the note across its ruled lines and rewrites when it changes; "make a notepad" puts it on the notepad card and typing in the card rewrites the pad',
      r.a.lines >= 2 && r.b.lines === 1 && !!pad && !!typed && !F.errors.length, JSON.stringify({ ...r, pad, typed, e: F.errors }));
    await F.ctx.close();
  }

  // ---- card miniatures: the glass piggy bank fills toward a savings goal
  {
    const F = await fresh();
    const r = await F.p.evaluate(async () => {
      const m = await import('/skills/scene3d.js'); const d = document.createElement('div'); d.style.cssText = 'position:fixed;left:20px;top:20px;width:320px;height:220px;z-index:9'; document.body.appendChild(d);
      const h = await m.mountMiniature(d, 'piggybank', { fill: 0.5, gold: 0.25 }, { key: 'tpig' });
      const half = h.inst.state(); h.update({ fill: 1, gold: 0 }); await new Promise((res) => setTimeout(res, 50)); return { half };
    });
    const full = await until(() => F.p.evaluate(() => { const s = window.__voidMini.state('tpig'); return s && s.level === 1 && s.coins === s.total && s.gold === 0 ? s : false; }), 20000);
    await F.ask('how long to save 50000 if i save 500 a month', 700);
    const goal = await until(() => F.p.evaluate(() => { const l = window.__voidMini.list().find((x) => x.kind === 'piggybank' && x.key.startsWith('piggybank:')); const s = l && window.__voidMini.state(l.key); return l && l.draws > 0 && !!document.querySelector('.vpage.on .vmini canvas') && s && s.level === 1 ? s : false; }), 60000);
    check('miniatures: the glass piggy bank holds half its coins at half (a quarter of them gold growth), fills to the top at the goal, and "how long to save 50000 if i save 500 a month" fills one on the answer',
      Math.abs(r.half.coins / r.half.total - 0.5) < 0.01 && Math.abs(r.half.gold / r.half.coins - 0.25) < 0.02 && !!full && !!goal && !F.errors.length, JSON.stringify({ half: r.half, full, goal, e: F.errors }));
    await F.ctx.close();
  }

  // ---- card miniatures: the heart beats at the card's rate beside an ECG monitor
  {
    const F = await fresh();
    const lastHeart = () => F.p.evaluate(() => { const ls = window.__voidMini.list().filter((x) => x.kind === 'heart' && x.draws > 0); const l = ls[ls.length - 1]; return l && !!document.querySelector('.vpage.on .vmini canvas') ? { key: l.key, ...window.__voidMini.state(l.key) } : false; });
    await F.ask('is a resting heart rate of 55 good', 700);
    const rest = await until(async () => { const s = await lastHeart(); return s && s.bpm === 55 ? s : false; }, 60000);
    const beating = rest && await F.p.evaluate((k) => { const a = window.__voidMini.state(k).phase; return new Promise((res) => setTimeout(() => res(window.__voidMini.state(k).phase !== a), 500)); }, rest.key);
    await F.ask('heart rate zones for a 40 year old', 700);
    // the page's big number is the target band "a-b bpm": the heart beats at its middle
    const zones = await until(async () => { const s = await lastHeart(); if (!s || s.key === rest.key) return false; const m = (await F.page()).match(/(\d+)\s*[\u2013-]\s*(\d+)\s*bpm/); return m && s.bpm === Math.round((+m[1] + +m[2]) / 2) ? { ...s, band: m[0] } : false; }, 60000);
    // the one heart: the monitor's QRS spike comes just before the ventricles' squeeze peaks, on the same clock, and a beat lasts 60 / bpm
    const sync = await F.p.evaluate(async () => { const h = await import('/skills/mini/heart.js'); let qrs = 0, best = -9, peak = 0, top = -1;
      for (let i = 0; i < 1000; i++) { const t = i / 1000, e = h.ecgAt(t, 60), b = h.beatPhase(t, 60); if (e > best) { best = e; qrs = t; } if (b > top) { top = b; peak = t; } }
      return { qrs, peak, ok: qrs < peak && peak - qrs < 0.25 && Math.abs(h.beatPhase(0.3, 72) - h.beatPhase(0.3 + 60 / 72, 72)) < 1e-9 && h.atriaPhase(0.03, 60) > 0 }; });
    check('miniatures: "is a resting heart rate of 55 good" beats the 3D heart at 55 bpm and it keeps beating; "heart rate zones for a 40 year old" beats a new one at the middle of the target band on the card; the ECG spike leads the squeeze on one clock',
      !!rest && !!beating && !!zones && sync.ok && !F.errors.length, JSON.stringify({ rest, beating, zones, sync, e: F.errors }));
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
    // two boards on a 1280-wide stage don't both fit with their cards: the one pushed aside shrinks instead of half-covering the
    // new one, and a tap on it brings it back (the other then shrinks in its place)
    const boards = () => F.p.evaluate(() => {
      const box = (n) => { const r = n.getBoundingClientRect(); return { x: r.x, y: r.y, r: r.right, b: r.bottom }; };
      const of = (kind) => { const el = [...document.querySelectorAll('#stage > .thing[data-id]')].find((e) => e.dataset.id.startsWith(kind + '_')); if (!el) return null;
        const side = document.querySelector('#stage > .side-card[data-of="' + el.dataset.id + '"]'); return { small: el.classList.contains('shrunk'), w: Math.round(el.getBoundingClientRect().width), parts: [box(el)].concat(side ? [box(side)] : []) }; };
      const c = of('chess'), k = of('checkers'), hit = (a, b) => a.x < b.r && b.x < a.r && a.y < b.b && b.y < a.b;
      return { stageW: document.getElementById('stage').clientWidth, chess: c, checkers: k, overlap: !!(c && k) && c.parts.some((a) => k.parts.some((b) => hit(a, b))) }; });
    const shrunk = await until(async () => { const s = await boards(); return s.chess && s.chess.small && s.checkers && !s.checkers.small ? s : false; }, 8000) || await boards();
    const smallAt = await F.p.evaluate(() => { const e = [...document.querySelectorAll('#stage > .thing.shrunk')].find((x) => x.dataset.id.startsWith('chess_')); if (!e) return null; const r = e.getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 }; });
    if (smallAt) await F.p.mouse.click(smallAt.x, smallAt.y);
    const back = await until(async () => { const s = await boards(); return s.chess && !s.chess.small && s.checkers && s.checkers.small ? s : false; }, 8000) || await boards();
    check('two boards on a 1280 stage: chess then checkers, the chess board moves aside shrunk (its card with it) and neither overlaps; a tap on the small chess board brings it back to full size and checkers shrinks instead',
      shrunk.stageW === 1280 && !!shrunk.chess && shrunk.chess.small && !shrunk.checkers.small && !shrunk.overlap && !!smallAt && back.chess && !back.chess.small && back.chess.w >= 500 && back.checkers.small && !back.overlap && !F.errors.length,
      JSON.stringify({ shrunk, back, e: F.errors }));
    // questions about chess are still questions (they open a page, which would cover the boards, so they come last)
    await F.ask('who invented chess', 400); await F.ask('chess rules', 400); await F.ask('checkers rules', 400);
    const after = await F.p.evaluate(() => ({ chess: document.querySelectorAll('.chess-card').length, checkers: document.querySelectorAll('.checkers-card').length }));
    check('chess: "play chess" and "chess" summon one board (asked twice, still one); "who invented chess", "chess rules" and "checkers rules" add no board', cards === 1 && after.chess === 1 && after.checkers === 1, JSON.stringify({ cards, after }));
    await F.ctx.close();
  }
  // ---- Go: the 3D goban stands in the void with its card separate; a tap places a stone and changes no count
  {
    const F = await fresh();
    await F.ask('play go', 600);
    const ready = await until(() => F.p.evaluate(() => { const l = window.__voidMini && window.__voidMini.list().find((m) => m.kind === 'go'); return l && l.ready && l.draws > 0 ? l : false; }), 90000);
    const tapGo = async (col, row) => { const pt = await F.p.evaluate(([c, r]) => { const k = window.__voidMini.keys().find((x) => x.startsWith('go:')); return window.__voidMini.project(k, [(4 - c) * 0.0237, 0.034, (4 - r) * 0.0237]); }, [col, row]); await F.p.mouse.click(pt.x, pt.y); await F.p.waitForTimeout(300); };
    if (ready) { await tapGo(4, 4); await tapGo(2, 6); }
    const g = await until(async () => { const st = await F.state(); const t = st.find((x) => x.kind === 'go'); return t && t.state.moveCount === 2 ? t.state : false; }, 15000);
    const layout = await F.p.evaluate(() => { const b = document.querySelector('.go-board-wrap'), c = document.querySelector('.side-card'); return { sep: !!b && !!c && !b.contains(c) && !c.contains(b), status: c ? c.innerText : '' }; });
    await F.p.click('.go-count'); const counted = await F.p.$eval('.go-countout', (e) => e.innerText).catch(() => '');
    check('go: "play go" stands a 3D goban in the void with its card separate; tapping E5 then C3 places Black then White, no capture count moves, no winner; Count position gives an estimate only when asked',
      !!ready && !!g && g.board[40] === 1 && g.board[56] === 2 && g.captured[1] === 0 && g.captured[2] === 0 && layout.sep && /Black to play/.test(layout.status)
        && /not a result/.test(counted) && !/wins/.test(counted) && !F.errors.length, JSON.stringify({ ready, g: g && { b: g.board.filter(Boolean).length, c: g.captured }, layout, counted, e: F.errors }));
    await F.ctx.close();
  }
  // ---- every flat game stands in 3D in the void (skills/lift3d.js): its 2D board hides, the card is separate, a 3D tap plays
  {
    const F = await fresh();
    const lifted = {};
    for (const [ask, kind] of [['play tic tac toe', 'tictactoe'], ['play othello', 'othello'], ['play mancala', 'mancala'], ['play aggravation', 'aggravation'], ['play connect 4', 'connect4']]) {
      await F.ask('close', 200); await F.ask(ask, 600);
      const ready = await until(() => F.p.evaluate((k) => { const l = window.__voidMini && window.__voidMini.list().find((m) => m.kind === k); return l && l.ready && l.draws > 0; }, kind), 90000);
      lifted[kind] = ready && await F.p.evaluate((k) => { const c = document.querySelector('.' + k + '-side'), b = document.querySelector('.free-board .' + k + '-view'); return !!c && !!b && c.closest('.side-card') === c; }, kind);
      if (kind === 'tictactoe' && ready) { // tap the centre square on the carved board: X lands there and Void answers
        const pt = await F.p.evaluate(() => { const k = window.__voidMini.keys().find((x) => x.startsWith('tictactoe:')); return window.__voidMini.project(k, [0, 0.026, 0]); });
        await F.p.mouse.click(pt.x, pt.y);
        lifted.played = await until(async () => { const t = (await F.state()).find((x) => x.kind === 'tictactoe'); return t && t.state.board[4] === 'X' && t.state.board.filter(Boolean).length === 2; }, 15000);
      }
    }
    check('lift3d: tic-tac-toe, Othello, mancala, Aggravation and Connect Four each stand a 3D board in the void with their card separate; tapping the carved tic-tac-toe board\'s centre plays X there and Void answers',
      lifted.tictactoe && lifted.othello && lifted.mancala && lifted.aggravation && lifted.connect4 && !!lifted.played && !F.errors.length, JSON.stringify({ lifted, e: F.errors }));
    await F.ctx.close();
  }
  // ---- the Magic 8 Ball is a ball in the void: asking again shakes the same ball for a new answer
  {
    const F = await fresh();
    await F.ask('magic 8 ball', 600);
    const ready = await until(() => F.p.evaluate(() => { const l = window.__voidMini && window.__voidMini.list().find((m) => m.kind === 'eightball'); return l && l.ready && l.draws > 0; }), 90000);
    const first = (await F.state()).filter((t) => t.kind === 'eightball');
    await F.ask('ask the magic 8 ball will it rain', 600);
    const again = (await F.state()).filter((t) => t.kind === 'eightball');
    const { ANSWERS } = await import(new URL('../void-live-deploy/skills/eightball.js', import.meta.url).href);
    check('eightball: "magic 8 ball" spawns one 3D Magic 8 Ball in the void with one of the 20 classic answers; asking again shakes the same ball (one ball, a new shake), and each answer is kept in the ball\'s history with its question',
      !!ready && first.length === 1 && ANSWERS.includes(first[0].answer) && again.length === 1 && again[0].n === 1 && ANSWERS.includes(again[0].answer)
        && again[0].history.length === 2 && again[0].history[1].q === 'will it rain' && again[0].history[1].how === 'asked' && again[0].history[0].q === null && !F.errors.length,
      JSON.stringify({ ready, first, again, e: F.errors }));
    await F.ctx.close();
  }
  // ---- Monopoly: the property board stands in the void, the card beside it; a roll walks your pawn, buying waits for you
  {
    const F = await fresh();
    await F.ask('play monopoly', 600);
    const ready = await until(() => F.p.evaluate(() => { const l = window.__voidMini && window.__voidMini.list().find((m) => m.kind === 'monopoly'); return l && l.ready && l.draws > 0; }), 90000);
    const sep = await F.p.evaluate(() => !!document.querySelector('.free-board .monopoly-view') && !!document.querySelector('.side-card.monopoly-side'));
    if (ready) await F.p.click('.mono-roll');
    const moved = await until(async () => { const t = (await F.state()).find((x) => x.kind === 'monopoly'); return t && t.state.moves >= 1 ? t.state : false; }, 10000);
    const owned = moved && Object.keys(moved.owner).filter((i) => moved.owner[i] === 0).length;
    check('monopoly: "play monopoly" stands the property board in 3D in the void with its card separate; Roll moves your pawn and buys nothing for you',
      !!ready && sep && !!moved && moved.players[0].pos > 0 && owned === 0 && !F.errors.length, JSON.stringify({ ready, sep, pos: moved && moved.players[0].pos, phase: moved && moved.phase, owned, e: F.errors }));
    await F.ctx.close();
  }
  // ---- Battleship: the folding case in the void; a tap on the upright board fires; Void's fleet never reaches the page
  {
    const F = await fresh();
    await F.ask('play battleship', 600);
    const ready = await until(() => F.p.evaluate(() => { const l = window.__voidMini && window.__voidMini.list().find((m) => m.kind === 'battleship'); return l && l.ready && l.draws > 0; }), 90000);
    const hidden = await F.p.evaluate(() => { const st = Object.values(JSON.parse(localStorage.getItem('a2m.void.state.v1') || '{}')).find((t) => t.kind === 'battleship'); const voidCells = st.state.fleet.void.flatMap((s) => s.cells);
      const lit = [...document.querySelectorAll('.bs-target button')].filter((b) => b.querySelector('i') || b.style.background !== 'rgb(29, 106, 147)').length; return { voidCells: voidCells.length, lit }; });
    if (ready) { const pt = await F.p.evaluate(() => { const k = window.__voidMini.keys().find((x) => x.startsWith('battleship:')); return window.__voidMini.project(k, [0.0964, 0.2372, 0.1268]); }); await F.p.mouse.click(pt.x, pt.y); }
    const fired = await until(async () => { const t = (await F.state()).find((x) => x.kind === 'battleship'); return t && t.state.shots.you[0] ? t.state : false; }, 10000);
    check('battleship: "play battleship" stands the folding case in the void with its card separate; before any shot nothing of Void\'s fleet shows; tapping A1 on the upright board fires there',
      !!ready && hidden.voidCells === 17 && hidden.lit === 0 && !!fired && !F.errors.length, JSON.stringify({ ready, hidden, fired: !!fired, e: F.errors }));
    await F.ctx.close();
  }
  // ---- Poker: the felt table in the void; your cards show, Void's stay face down until a showdown
  {
    const F = await fresh();
    await F.ask('play poker', 600);
    const ready = await until(() => F.p.evaluate(() => { const l = window.__voidMini && window.__voidMini.list().find((m) => m.kind === 'poker'); return l && l.ready && l.draws > 0; }), 90000);
    const shown = await F.p.evaluate(() => ({ cards: window.__voidMini.state(window.__voidMini.keys().find((k) => k.startsWith('poker:'))).cards, faces: [...document.querySelectorAll('.pk-table .pk-card')].map((c) => c.textContent) }));
    check('poker: "play poker" stands the card table in the void with its card separate; your two cards show, Void\'s two stay face down',
      !!ready && shown.cards === 4 && shown.faces.filter(Boolean).length === 2 && shown.faces.length === 4 && !F.errors.length, JSON.stringify({ ready, shown, e: F.errors }));
    await F.ctx.close();
  }
  // ---- Fireworks (co-op): Void's cards face you, yours face Void; tapping one of Void's cards offers a hint
  {
    const F = await fresh();
    await F.ask('play fireworks', 600);
    const ready = await until(() => F.p.evaluate(() => { const l = window.__voidMini && window.__voidMini.list().find((m) => m.kind === 'fireworks'); return l && l.ready && l.draws > 0; }), 90000);
    const faces = await F.p.evaluate(() => ({ void: [...document.querySelectorAll('.fw-void .fw-card')].map((b) => b.textContent), you: [...document.querySelectorAll('.fw-you .fw-card')].map((b) => b.textContent) }));
    await F.p.evaluate(() => document.querySelector('.fw-void .fw-card').click());
    const offer = await until(() => F.p.evaluate(() => !!document.querySelector('.fw-hint-color') && !!document.querySelector('.fw-hint-rank')), 3000);
    check('fireworks: "play fireworks" stands the co-op table in the void with its card separate; you can read Void\'s cards but not yours; picking one of Void\'s offers a hint',
      !!ready && faces.void.every((t) => /^[1-5]$/.test(t)) && faces.you.every((t) => t === '?') && !!offer && !F.errors.length, JSON.stringify({ ready, faces, offer, e: F.errors }));
    await F.ctx.close();
  }
  // ---- the game rack: "games" stands a 3D shelf of the seven board games in the void; picking one puts the rack away and opens it
  {
    const F = await fresh();
    await F.ask('what games do you have', 600); // the hint line itself is checked in test_void.mjs ("the games hint names every game"), where no 3D frame holds the page
    const ready = await until(() => F.p.evaluate(() => { const l = window.__voidMini && window.__voidMini.list().find((m) => m.kind === 'rack'); return l && l.ready && l.draws > 0 ? l : false; }), 90000);
    const boxes = ready ? await F.p.evaluate(() => window.__voidMini.state(window.__voidMini.keys().find((k) => k.startsWith('rack:'))).boxes) : [];
    await F.p.click('.rack-pick[data-game="go"]');
    const opened = await until(async () => { const st = await F.state(); return st.some((t) => t.kind === 'go') && !st.some((t) => t.kind === 'rack'); }, 10000);
    check('rack: "what games do you have" stands a 3D shelf of boxed games in the void (chess, checkers, go, othello, connect four, tic-tac-toe, mancala, aggravation, ringer, sorry, battleship, poker, fireworks, monopoly) ; picking Go puts the rack away and opens the Go board',
      !!ready && boxes.join() === 'chess,checkers,go,othello,connect4,tictactoe,mancala,aggravation,ringer,sorry,battleship,poker,fireworks,monopoly' && !!opened && !F.errors.length, JSON.stringify({ ready, boxes, opened, e: F.errors }));
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
  // ---- the savings page's coin stacks: silver paid in, gold growth on top, rising one stack after another
  {
    const F = await fresh();
    await F.ask('how much will i have if i save 300 a month for 30 years at 7%', 900);
    const drawn = await until(() => F.p.evaluate(() => { const l = window.__voidMini && window.__voidMini.list(); const c = l && l.find((x) => x.kind === 'savings'); return c && c.draws > 0 && c.ready ? c : false; }), 30000);
    const r = await F.p.evaluate(async () => {
      const g = await import('/skills/mini/savings.js'), sk = await import('/skills/savings.js');
      const cols = sk.coinCols(0, 300, 7, 360), st = g.coinsFor(cols);
      const flat = g.coinsFor([{ label: 'a', paid: 100, total: 100 }, { label: 'b', paid: 200, total: 200 }]);
      return { n: cols.length, labels: cols.map((c) => c.label).join(','), last: Math.round(cols[5].total), tallest: st[5].silver + st[5].gold, goldGrows: st.every((s, i) => i === 0 || s.gold >= st[i - 1].gold), noGold: flat.every((s) => s.gold === 0), inPage: !!document.querySelector('.vpage .savings-mini canvas') };
    });
    const rose = drawn && await until(() => F.p.evaluate(() => window.__voidMini.list().find((x) => x.kind === 'savings').draws > 6), 15000);
    check('3D savings: "save 300 a month for 30 years at 7%" shows coin stacks on the page (6 stacks, 5 to 30 yrs, $365,991 at the end), the tallest is 34 coins, gold grows stack by stack, no growth means no gold, and the stacks rise in turn',
      !!drawn && r.inPage && r.n === 6 && r.labels === '5 yrs,10 yrs,15 yrs,20 yrs,25 yrs,30 yrs' && r.last === 365991 && r.tallest === 34 && r.goldGrows && r.noGold && rose && !F.errors.length, JSON.stringify({ drawn, r, rose, e: F.errors }));
    await F.ctx.close();
  }
  // ---- the tip page's receipt and coins: the receipt lists bill, tip, total and each share; one coin stack per person
  {
    const F = await fresh();
    await F.ask('20% tip on 86.40 split between 3 people', 900);
    const drawn = await until(() => F.p.evaluate(() => { const l = window.__voidMini && window.__voidMini.list(); const c = l && l.find((x) => x.kind === 'tip'); return c && c.draws > 0 && c.ready ? c : false; }), 30000);
    const r = await F.p.evaluate(async () => {
      const g = await import('/skills/mini/tip.js'), d = { bill: 86.4, tip: 17.28, total: 103.68, people: 3, pct: 20 };
      const one = g.stackFor({ bill: 40, tip: 0, total: 40, people: 1 });
      return { lines: g.receiptLines(d).map((l) => l.join(' ')).join(' | '), s: g.stackFor(d), one, many: g.stackFor({ bill: 900, tip: 90, total: 990, people: 30 }).people, inPage: !!document.querySelector('.vpage .tip-mini canvas') };
    });
    check('3D tip: "20% tip on 86.40 split between 3 people" puts a receipt and coins on the page; the receipt reads Bill $86.40 | Tip 20% $17.28 | Total $103.68 | Each (3) $34.56; three stacks with gold tip coins on top; no tip means no gold; at most 8 stacks',
      !!drawn && r.inPage && r.lines === 'Bill $86.40 | Tip 20% $17.28 | Total $103.68 | Each (3) $34.56' && r.s.people === 3 && r.s.gold >= 1 && r.s.silver > r.s.gold && r.one.gold === 0 && r.many === 8 && !F.errors.length, JSON.stringify({ drawn, r, e: F.errors }));
    await F.ctx.close();
  }
  // ---- Pentamote-1: the motor body from the same boxes as its 3MF; the magnet slab shuttles over coils lit in three-phase order
  {
    const F = await fresh();
    await F.ask('pentamote-1', 900);
    const drawn = await until(() => F.p.evaluate(() => { const l = window.__voidMini && window.__voidMini.list(); const c = l && l.find((x) => x.kind === 'pentamote'); return c && c.draws > 0 && c.ready ? c : false; }), 30000);
    const r = await F.p.evaluate(async () => {
      const g = await import('/skills/mini/pentamote.js'), q = g.driveAt(0.5), z = g.driveAt(0), third = g.driveAt(2 / 3);
      return { quarter: +q.d.toFixed(6), rest: +z.d.toFixed(6), first: z.glow.map((x) => +x.toFixed(3)), next: third.glow.indexOf(Math.max(...third.glow)), inPage: !!document.querySelector('.vpage .pentamote-mini canvas') };
    });
    const moves = drawn && await until(() => F.p.evaluate(() => window.__voidMini.list().find((x) => x.kind === 'pentamote').draws > 6), 15000);
    check('3D Pentamote-1: "pentamote-1" draws the motor body on its page; the slab is at +0.5 mm a quarter period in and centred at rest, coil 1 glows first and coil 2 next, and it keeps moving',
      !!drawn && r.inPage && r.quarter === 0.5 && r.rest === 0 && r.first[0] === 0.55 && r.first[1] === 0 && r.next === 1 && moves && !F.errors.length, JSON.stringify({ drawn, r, moves, e: F.errors }));
    await F.ctx.close();
  }
  // ---- Void's own body on its self page: one fixed seed (the same entity everywhere), asymmetric, tap breaks it apart
  {
    const F = await fresh();
    await F.ask('void', 900);
    const drawn = await until(() => F.p.evaluate(() => { const l = window.__voidMini && window.__voidMini.list(); const c = l && l.find((x) => x.kind === 'void'); return c && c.draws > 0 && c.ready ? c : false; }), 30000);
    const r = await F.p.evaluate(async () => {
      const v = await import('/skills/mini/void.js'), a = v.plan(), b = v.plan(), c = v.plan(12345);
      const mean = a.reduce((m, s) => [m[0] + s.d[0], m[1] + s.d[1], m[2] + s.d[2]], [0, 0, 0]).map((x) => x / a.length);
      return { n: a.length, same: JSON.stringify(a) === JSON.stringify(b), other: JSON.stringify(a) !== JSON.stringify(c), lean: Math.hypot(...mean), inPage: !!document.querySelector('.vpage .void-self canvas') };
    });
    const before = drawn ? drawn.draws : 0;
    const pt = drawn && await F.p.evaluate((k) => window.__voidMini.project(k, [0, 0.075, 0]), drawn.key);
    if (pt) await F.p.mouse.click(pt.x, pt.y);
    const broke = await until(() => F.p.evaluate((b) => window.__voidMini.list().find((x) => x.kind === 'void').draws > b + 4, before), 15000);
    check('3D Void: its self page shows its own body, built from one fixed seed (the same 24 shards every time; another seed differs), lopsided by design (the shard directions lean to one side), and a tap breaks it apart and back',
      !!drawn && r.inPage && r.n === 24 && r.same && r.other && r.lean > 0.12 && broke && !F.errors.length, JSON.stringify({ drawn, r, broke, e: F.errors }));
    await F.ctx.close();
  }

  // ---- the stage sandbox: every summon is its own individual (seed and kind reach the 3D figure), a cloud rains once it
  // has gathered enough water, and a zombie finds a brain and eats it
  {
    const F = await fresh();
    const figs = () => F.p.evaluate(() => (window.__void3d ? window.__void3d.state().figures : []));
    await F.ask('summon a zombie', 600); await F.ask('summon a zombie', 600); await F.ask('add a cloud', 600);
    const three = await until(async () => { const f = await figs(); return f.length === 3 && f.every((x) => x.seed != null && x.kindOf) ? f : false; }, 30000);
    const zs = (three || []).filter((x) => x.kindOf === 'zombie');
    const rained = await until(async () => { const c = (await figs()).find((x) => x.kindOf === 'cloud'); return c && c.nature && c.nature.falling === 'rain' ? c.nature : false; }, 90000);
    await F.ask('add a brain', 600);
    const brainIn = await until(async () => (await figs()).some((x) => x.kindOf === 'brain'), 20000);
    const eaten = brainIn && await until(async () => !(await figs()).some((x) => x.kindOf === 'brain'), 90000);
    check('sandbox: two zombies arrive as two individuals (different seeds), a cloud gathers water and rains, and a zombie finds the brain and eats it',
      !!three && zs.length === 2 && zs[0].seed !== zs[1].seed && !!rained && !!eaten && !F.errors.length, JSON.stringify({ three: !!three, seeds: zs.map((z) => z.seed), rained, brainIn, eaten, e: F.errors }));
    await F.ctx.close();
  }

  // ---- collector detail (Next #22): a figure arrives light, re-meshes finer one tier at a time as you zoom in on it, and
  // drops back to the light tier (same triangle count as before) when you zoom out
  {
    const F = await fresh();
    const cat = () => F.p.evaluate(() => (window.__void3d ? window.__void3d.state().figures.find((x) => x.kindOf === 'cat') : null) || null);
    await F.ask('add a cat', 600);
    const light = await until(async () => { const c = await cat(); return c && c.tris > 0 ? c : false; }, 30000);
    await F.ask('zoom in on the figure', 400);
    const one = light && await until(async () => { const c = await cat(); return c && c.detail === 1 ? c : false; }, 20000);
    await F.ask('zoom in on the figure', 400);
    const two = one && await until(async () => { const c = await cat(); return c && c.detail === 2 ? c : false; }, 20000);
    await F.ask('zoom out on the figure', 300); await F.ask('zoom out on the figure', 300);
    const back = two && await until(async () => { const c = await cat(); return c && c.detail === 0 ? c : false; }, 20000);
    check('collector detail: a cat arrives at the light tier, zooming in on it re-meshes it finer twice (more triangles each step), and zooming out returns the light mesh (same triangle count) with the same seed',
      !!light && light.detail === 0 && !!one && one.tris > light.tris * 1.6 && !!two && two.tris > one.tris * 1.4 && !!back && back.tris === light.tris && back.seed === light.seed && !F.errors.length,
      JSON.stringify({ light: light && [light.detail, light.tris], one: one && one.tris, two: two && two.tris, back: back && back.tris, e: F.errors }));
    await F.ctx.close();
  }
}
