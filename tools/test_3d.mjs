// Checks for Void's shared 3D scene (skills/scene3d.js, docs/miniatures.md) and the playable 3D board games built on it.
// Called from tools/test_void.mjs with its browser helpers.
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')), '..', 'void-live-deploy');
const until = async (fn, ms = 8000) => { const end = Date.now() + ms; for (;;) { try { const v = await fn(); if (v) return v; } catch (_) {} if (Date.now() > end) return false; await new Promise((r) => setTimeout(r, 150)); } };

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

}
