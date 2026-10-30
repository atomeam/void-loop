/**
 * book: The Book of Verse as a real book (owner, 2026-10-16: "the Verse book should be an actual 3D book with a cover and turnable pages").
 * A hardcover lying on the desk: tap the cover and it swings open on its spine; the pages are leaves that really turn, bending as
 * they go, with the stack thinning on one side and thickening on the other. Every face is a sheet of skills/guide.json laid out
 * by lib/book-face.js (the same pages the flat book shows). data: { book (skills/guide.json), cur (the page the spread holds),
 * open (false: the cover is shut), onTurn(dir), onJump(page), onAsk(text), onOpen(), onClose() }. Taps: the cover opens the book;
 * the outer edge of a page turns it; an ask on a page runs it; a contents or index line jumps to its page.
 * Only the spread you can see (and the leaf in the air) is painted: a 220-page book is a handful of textures, not 220.
 * It reads the way a Skyrim book does (owner, 2026-10-16: "research how the books on Skyrim work and make it like that"): the
 * cover opens in half a second (Skyrim's fBookOpenTime is 500 ms) and the book comes up to fill the view with the world dimmed
 * behind it; shut, it lies back on the desk. skills/guide.js adds the rest of that screen: the Turn page / Close prompt bar, the
 * wheel turning pages, Esc closing the book before it closes anything else, and a page's rustle when the sound is on.
 */
import { layoutFace, paint, hitAt, edgeAt, PAGE_W, PAGE_H } from '../../lib/book-face.js';
import { spreadOf, pagesOfSpread, hueOf } from '../../lib/guide.js';

const W = 0.12, H = W * PAGE_H / PAGE_W, B = 0.0032, T = 0.032, OV = 0.004, SEG = 20; // metres: a page, a board, the full page block, the board's overhang
const pace = () => Number(typeof window !== 'undefined' && window.__bookPace) || 1; // tests slow the turn down to look at the leaf in the air
const smooth = (x) => { x = Math.min(1, Math.max(0, x)); return x * x * (3 - 2 * x); };

export default async function build(ctx, data) {
  const { THREE, root, still } = ctx;
  const phone = !!ctx.phone, K = phone ? 1.5 : 2; // texture pixels per sheet unit
  const measureCanvas = document.createElement('canvas').getContext('2d');
  const measure = (s, font) => { measureCanvas.font = font; return measureCanvas.measureText(s).width; };
  let book = data.book, total = (book && book.pages.length) || 1;
  const L = () => Math.ceil(total / 2), leafT = () => T / L();

  // ---- textures: the faces of the spread and of the leaf in the air, painted on demand and remembered a little while
  const faces = new Map(); // key 'n:side' -> { tex, layout }
  const blank = { ops: [], hits: [], n: 0 };
  function face(n, side) {
    const key = n + ':' + side; const hit = faces.get(key); if (hit) { faces.delete(key); faces.set(key, hit); return hit; }
    const layout = n >= 1 && book ? layoutFace(book.pages[n - 1], book, side, measure) : { ...blank, gutter: side === 'left' ? 'right' : 'left' };
    const c = document.createElement('canvas'); c.width = Math.round(PAGE_W * K); c.height = Math.round(PAGE_H * K);
    paint(c.getContext('2d'), layout, K);
    const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = phone ? 4 : 8;
    const f = { tex, layout }; faces.set(key, f);
    if (faces.size > 10) { const old = faces.keys().next().value; faces.get(old).tex.dispose(); faces.delete(old); }
    return f;
  }

  // ---- the cover: dark leather with gold, drawn once
  function coverTexture() {
    const c = document.createElement('canvas'); c.width = 512; c.height = Math.round(512 * H / W); const g = c.getContext('2d'), w = c.width, h = c.height;
    const grad = g.createLinearGradient(0, 0, w, h); grad.addColorStop(0, '#1d2740'); grad.addColorStop(1, '#0e1424'); g.fillStyle = grad; g.fillRect(0, 0, w, h);
    g.globalAlpha = 0.07; for (let i = 0; i < 1400; i++) { g.fillStyle = i % 2 ? '#fff' : '#000'; g.fillRect(Math.random() * w, Math.random() * h, 2, 2); } g.globalAlpha = 1;
    const gold = '#d8b45a'; g.strokeStyle = gold; g.lineWidth = 3; g.strokeRect(26, 26, w - 52, h - 52); g.lineWidth = 1.2; g.strokeRect(36, 36, w - 72, h - 72);
    g.save(); g.translate(w / 2, h * 0.38); g.strokeStyle = gold; g.lineWidth = 2.2;
    for (let i = 1; i <= 5; i++) { g.beginPath(); g.arc(0, 0, 22 + i * 17, i * 0.9, i * 0.9 + 4.6); g.stroke(); }
    g.fillStyle = gold; g.beginPath(); g.arc(0, 0, 7, 0, Math.PI * 2); g.fill(); g.restore();
    g.fillStyle = gold; g.textAlign = 'center'; g.font = '700 74px Georgia, serif'; g.fillText('Verse', w / 2, h * 0.67);
    g.font = '600 22px Georgia, serif'; g.fillText('THE BOOK', w / 2, h * 0.73);
    g.font = '13px system-ui, sans-serif'; g.fillText('a-to-mind.com', w / 2, h * 0.91);
    const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 8; return tex;
  }
  function edgeTexture() {
    const c = document.createElement('canvas'); c.width = 4; c.height = 64; const g = c.getContext('2d');
    for (let y = 0; y < 64; y++) { g.fillStyle = y % 2 ? '#efe4cb' : '#d9cba9'; g.fillRect(0, y, 4, 1); }
    const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace; tex.wrapS = tex.wrapT = THREE.RepeatWrapping; tex.repeat.set(1, 4); return tex;
  }
  const coverTex = coverTexture(), edgeTex = edgeTexture();
  const leather = new THREE.MeshStandardMaterial({ color: '#17203a', roughness: 0.62, metalness: 0.05 });
  const coverTop = new THREE.MeshStandardMaterial({ map: coverTex, roughness: 0.55, metalness: 0.08 });
  const endpaper = new THREE.MeshStandardMaterial({ color: '#e9dec2', roughness: 0.9 });
  const edgeMat = new THREE.MeshStandardMaterial({ map: edgeTex, roughness: 0.95 });
  const spineMat = new THREE.MeshStandardMaterial({ color: '#141b30', roughness: 0.5, metalness: 0.1 });

  const bookRoot = new THREE.Group(); root.add(bookRoot);
  const box = (w, h, d, mat) => { const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat); m.castShadow = m.receiveShadow = true; return m; };

  // the back board lies under the right pages; the spine joins the two boards
  const backBoard = box(W + OV, B, H + OV * 2, leather); backBoard.position.set((W + OV) / 2, B / 2, 0); bookRoot.add(backBoard);
  const spine = box(0.012, B, H + OV * 2, spineMat); spine.position.set(0, B / 2, 0); bookRoot.add(spine);
  const rightBlock = box(W, 0.001, H, edgeMat), leftBlock = box(W, 0.001, H, edgeMat); bookRoot.add(rightBlock, leftBlock);
  // the front board is a group that swings about the spine: its outside is the title art, its inside an endpaper
  const cover = new THREE.Group(); bookRoot.add(cover);
  const covBoard = new THREE.Mesh(new THREE.BoxGeometry(W + OV, B, H + OV * 2), [leather, leather, coverTop, endpaper, leather, leather]);
  covBoard.position.set((W + OV) / 2, -B / 2, 0); covBoard.castShadow = covBoard.receiveShadow = true; cover.add(covBoard);
  // box face order: +x, -x, +y, -y, +z, -z; the +y face (outside while shut) carries the art, mapped with the art's top at -z

  // the two pages that lie on the stacks, and the leaf that turns
  const pageMat = () => new THREE.MeshStandardMaterial({ roughness: 0.88, color: '#ffffff' });
  const leftPlane = new THREE.Mesh(new THREE.PlaneGeometry(W, H), pageMat()), rightPlane = new THREE.Mesh(new THREE.PlaneGeometry(W, H), pageMat());
  for (const p of [leftPlane, rightPlane]) { p.rotation.x = -Math.PI / 2; p.receiveShadow = true; bookRoot.add(p); }
  leftPlane.position.x = -W / 2; rightPlane.position.x = W / 2;
  // wound so the front faces up while the leaf lies on the right and the back faces up once it lies on the left
  function leafGeo(flip) {
    const g = new THREE.BufferGeometry(), nv = (SEG + 1) * 2, pos = new Float32Array(nv * 3), uv = new Float32Array(nv * 2), idx = [];
    for (let i = 0; i <= SEG; i++) for (let r = 0; r < 2; r++) { const v = i * 2 + r; const u = i / SEG; uv[v * 2] = flip ? 1 - u : u; uv[v * 2 + 1] = r === 0 ? 1 : 0; }
    for (let i = 0; i < SEG; i++) { const a = i * 2, b = a + 1, c = a + 2, d = a + 3; if (flip) idx.push(a, c, b, b, c, d); else idx.push(a, b, c, b, d, c); }
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.BufferAttribute(uv, 2)); g.setIndex(idx); return g;
  }
  const leafFront = new THREE.Mesh(leafGeo(false), pageMat()), leafBack = new THREE.Mesh(leafGeo(true), pageMat());
  for (const m of [leafFront, leafBack]) { m.castShadow = true; m.receiveShadow = true; m.visible = false; m.frustumCulled = false; bookRoot.add(m); }

  // lay a leaf out at turning angle th (0 on the right pages, PI on the left): it leans, its free edge trailing, and curls
  function layLeaf(th, pivotY) {
    const lag = 0.55 * Math.sin(th), eps = 0.00012;
    for (const [m, sgn] of [[leafFront, 1], [leafBack, -1]]) {
      const pos = m.geometry.attributes.position; let x = 0, y = 0;
      for (let i = 0; i <= SEG; i++) {
        const u = i / SEG, phi = Math.max(0, th - lag * u * (0.4 + 0.6 * u)), nx = -Math.sin(phi), ny = Math.cos(phi);
        if (i) { x += Math.cos(phi) * (W / SEG); y += Math.sin(phi) * (W / SEG); }
        for (let r = 0; r < 2; r++) pos.setXYZ(i * 2 + r, x + nx * eps * sgn, pivotY + y + ny * eps * sgn, (r === 0 ? -1 : 1) * H / 2);
      }
      pos.needsUpdate = true; m.geometry.computeVertexNormals(); m.geometry.computeBoundingSphere();
    }
  }

  // ---- state: what has landed, and what is moving
  let landed = { open: false, k: 0 }, anim = null; // anim: { kind: 'cover'|'leaf', t, dur, ... }
  const tgt = (d) => ({ open: !!d.open, k: Math.min(spreadOf(Math.min(Math.max(d.cur || 1, 1), total)), Math.floor((total + 1) / 2)) });
  const tl = (k) => k * leafT(), tr = (k) => (L() - k) * leafT();

  function setStatic(k, leftK, rightK) { // which spread each page plane shows, and how thick each stack is
    const [lp] = pagesOfSpread(leftK, total), [, rp] = pagesOfSpread(rightK, total);
    const lf = face(lp, 'left'), rf = face(rp, 'right');
    leftPlane.material.map = lf.tex; rightPlane.material.map = rf.tex; leftPlane.material.needsUpdate = rightPlane.material.needsUpdate = true;
    cur.left = lf; cur.right = rf; cur.leftN = lp; cur.rightN = rp;
    const lh = tl(leftK), rh = tr(rightK);
    leftPlane.position.y = B + lh + 0.0002; rightPlane.position.y = B + rh + 0.0002;
    leftBlock.scale.y = Math.max(lh, 0.0002) / 0.001; leftBlock.position.set(-W / 2, B + lh / 2, 0);
    rightBlock.scale.y = Math.max(rh, 0.0002) / 0.001; rightBlock.position.set(W / 2, B + rh / 2, 0);
  }
  const cur = { left: null, right: null, leftN: 0, rightN: 0 };

  function place(theta) { // the cover at angle theta (0 shut on the right stack, PI open on the left) and the whole book's centring
    const s = smooth(theta / Math.PI);
    cover.position.set(0, (B + T + B) * (1 - s) + 0, 0); cover.rotation.z = theta;
    bookRoot.position.x = -(W / 2) * (1 - s);
    leftBlock.visible = leftPlane.visible = s > 0.5; rightPlane.visible = s > 0.02 || theta > 0;
  }

  function settle() {
    if (!landed.open) { // shut: only the right stack, under the cover
      setStatic(0, 0, 0); leftPlane.visible = false; place(0); leftBlock.scale.y = 0.0002 / 0.001; leftBlock.visible = false;
    } else { setStatic(landed.k, landed.k, landed.k); place(Math.PI); leftBlock.visible = leftPlane.visible = true; }
    rightPlane.visible = true; leafFront.visible = leafBack.visible = false;
    ctx.requestRender();
  }

  function startCover(open) {
    anim = { kind: 'cover', t: 0, dur: still ? 0.001 : 0.5 * pace(), from: open ? 0 : Math.PI, to: open ? Math.PI : 0, open }; // Skyrim's half-second open
    if (open) { setStatic(landed.k, landed.k, landed.k); rightPlane.visible = true; leftPlane.visible = false; leftBlock.visible = false; }
  }
  function startLeaf(k0, k1) {
    const fwd = k1 > k0, [lp0] = pagesOfSpread(k0, total), [, rp0] = pagesOfSpread(k0, total), [lp1] = pagesOfSpread(k1, total), [, rp1] = pagesOfSpread(k1, total);
    // forward: the leaf carries the old right page over and shows the new left page on its back; the new right page is revealed under it
    // backward: the leaf carries the old left page over and shows the new right page; the new left page is revealed under it
    leafFront.material.map = (fwd ? face(rp0, 'right') : face(rp1, 'right')).tex; leafBack.material.map = (fwd ? face(lp1, 'left') : face(lp0, 'left')).tex;
    leafFront.material.needsUpdate = leafBack.material.needsUpdate = true;
    setStatic(0, fwd ? k0 : k1, fwd ? k1 : k0); // the planes: forward shows old left + new right, backward new left + old right
    const lf = face(fwd ? lp0 : lp1, 'left'), rf = face(fwd ? rp1 : rp0, 'right');
    leftPlane.material.map = lf.tex; rightPlane.material.map = rf.tex;
    leftPlane.position.y = B + tl(fwd ? k0 : k1) + 0.0002; rightPlane.position.y = B + tr(fwd ? k1 : k0) + 0.0002;
    anim = { kind: 'leaf', t: 0, dur: still ? 0.001 : (0.75 + Math.min(0.5, Math.abs(k1 - k0) * 0.01)) * pace(), k0, k1, fwd };
    leafFront.visible = leafBack.visible = true;
  }

  // open, the book is examined the way a game's inventory shows one (scene3d inspect): it comes up to fill the view with the stage
  // dimmed behind, held still (a book is read, not spun), with the Skyrim-style prompt bar; Esc shuts the cover and puts it back
  const READ = { view: [0, 1.05, 1.0], pad: 0.58, turn: false, prompt: '◂ ▸ Turn page · Esc closes the book' };
  const examine = () => { const d = ctx.handle.data || data; if (!ctx.inspect) return; if (landed.open) ctx.inspect(true, { ...READ, onEsc: () => { d.onClose && d.onClose(); } }); else ctx.inspect(false); };
  if (ctx.examine) ctx.examine('Read', () => { const d = ctx.handle.data || data; d.onOpen && d.onOpen(); });

  function finish() {
    if (!anim) return;
    if (anim.kind === 'cover') landed.open = anim.open; else landed.k = anim.k1;
    anim = null; settle();
    if (anim === null && landed.open !== undefined) examine();
  }

  const tick = (dt) => {
    if (!anim) return false;
    anim.t += dt; const p = Math.min(1, anim.t / anim.dur);
    if (anim.kind === 'cover') {
      const e = smooth(p), th = anim.from + (anim.to - anim.from) * e; place(th);
      if (anim.open && th > Math.PI * 0.55) { leftPlane.visible = leftBlock.visible = true; }
    } else {
      const e = smooth(p), th = anim.fwd ? Math.PI * e : Math.PI * (1 - e);
      const yR = B + tr(anim.fwd ? anim.k0 : anim.k1) + 0.0004, yL = B + tl(anim.fwd ? anim.k1 : anim.k0) + 0.0004; // where the leaf starts and lands
      layLeaf(th, anim.fwd ? yR + (yL - yR) * e * e : yL + (yR - yL) * (1 - e) * (1 - e));
    }
    if (p >= 1) finish();
    return true;
  };

  // ---- taps
  const listeners = [];
  ctx.onTap((hits) => {
    const d = ctx.handle.data || data; if (anim) return;
    for (const h of hits) {
      if (h.object === covBoard || h.object === backBoard) { if (!landed.open) { d.onOpen && d.onOpen(); return; } if (h.object === covBoard) { d.onClose && d.onClose(); return; } }
      const side = h.object === leftPlane ? 'left' : h.object === rightPlane ? 'right' : '';
      if (!side || !h.uv) continue;
      const f = side === 'left' ? cur.left : cur.right, x = (side === 'left' ? h.uv.x : h.uv.x) * PAGE_W, y = (1 - h.uv.y) * PAGE_H;
      const hit = f && hitAt(f.layout, x, y);
      if (hit && hit.ask) { d.onAsk && d.onAsk(hit.ask); return; }
      if (hit && hit.page) { d.onJump && d.onJump(hit.page); return; }
      const e = edgeAt(side, x); if (e) { d.onTurn && d.onTurn(e === 'next' ? 1 : -1); return; }
    }
  }, true);

  // ---- first look
  landed = tgt(data); landed.open = !!data.open; settle();
  if (!landed.open) { landed.k = 0; settle(); }
  // frame the book open and centred: the camera does not move when the cover swings
  const frameBox = new THREE.Mesh(new THREE.BoxGeometry(W * 2 + OV * 2, T + B * 3, H + OV * 2)); frameBox.position.set(0, (T + B * 3) / 2, 0);
  ctx.frame(frameBox, { view: [0, 1.7, 0.55], pad: 0.72, light: [0.35, 1.2, 0.55], minZoom: 0.55, maxZoom: 1.6 });
  if (landed.open) examine();

  return {
    state() { return { open: landed.open, k: landed.k, left: cur.leftN, right: cur.rightN, turning: !!anim, coverX: bookRoot.position.x, pages: total }; },
    update(d) {
      if (d.book && d.book !== book) { book = d.book; total = book.pages.length; faces.forEach((f) => f.tex.dispose()); faces.clear(); landed = { open: false, k: 0 }; anim = null; }
      const t = tgt(d); finish();
      if (t.open !== landed.open) { if (t.open) { landed.k = t.k; startCover(true); } else { startCover(false); } }
      else if (t.open && t.k !== landed.k) startLeaf(landed.k, t.k);
      ctx.requestRender();
    },
    tick,
    dispose() {
      faces.forEach((f) => f.tex.dispose()); coverTex.dispose(); edgeTex.dispose();
      root.traverse((o) => { if (o.geometry) o.geometry.dispose(); if (o.material) (Array.isArray(o.material) ? o.material : [o.material]).forEach((m) => m.dispose()); });
    },
  };
}
