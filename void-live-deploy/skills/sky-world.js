/**
 * sky-world — the real sky overhead, drawn on a full-screen canvas behind the stage while the sky card is open.
 * The colour follows the sun's altitude; after dark the 300 brightest stars stand where they really are for this place and time (with the
 * constellation figures), the moon is at its real phase and place, and the planets that are up are marked. Drag to look around (or the
 * look buttons and arrow keys on the card), pinch or scroll to zoom, tap a star for its name. It is a simulation and says so.
 *
 * Projection: stereographic, centred on where you look (a straight line stays a curve, nothing tears at the zenith). project() and
 * unproject() are pure and tested. Reduced motion holds the scene still: it is drawn when something asks (a drag, a button, a new
 * place), never on a timer. A low-power device gets the gradient and the brightest 120 stars, drawn once, without figures or glow.
 */
import * as A from '../lib/astro.js';
import { STARS, FIGURES, CONSTELLATIONS } from '../lib/stars.js';
import { compass, PLANET_LABEL } from '../lib/skyfacts.js';

const RAD = Math.PI / 180;
const clamp = (x, a, b) => Math.max(a, Math.min(b, x));

// ---- projection (pure) ----
// a view looks at (alt0, az0) with a horizontal field of fov degrees across a canvas of w by h pixels
export function viewBasis(view) {
  const a = view.alt0 * RAD, z = view.az0 * RAD;
  return {
    C: [Math.cos(a) * Math.sin(z), Math.cos(a) * Math.cos(z), Math.sin(a)],
    R: [Math.cos(z), -Math.sin(z), 0],
    U: [-Math.sin(a) * Math.sin(z), -Math.sin(a) * Math.cos(z), Math.cos(a)],
    k: (view.w / 2) / (2 * Math.tan(view.fov * RAD / 4)),
  };
}
const vec = (alt, az) => [Math.cos(alt * RAD) * Math.sin(az * RAD), Math.cos(alt * RAD) * Math.cos(az * RAD), Math.sin(alt * RAD)];
const dot = (p, q) => p[0] * q[0] + p[1] * q[1] + p[2] * q[2];
// (alt, az) -> { x, y, ok } in canvas pixels; ok is false for the far side of the sky
export function project(alt, az, view, basis = viewBasis(view)) {
  const P = vec(alt, az), d = dot(P, basis.C);
  if (d < -0.97) return { x: 0, y: 0, ok: false };
  const f = 2 * basis.k / (1 + d);
  return { x: view.w / 2 + dot(P, basis.R) * f, y: view.h / 2 - dot(P, basis.U) * f, ok: true };
}
// canvas pixels -> { alt, az }
export function unproject(x, y, view, basis = viewBasis(view)) {
  const sx = x - view.w / 2, sy = view.h / 2 - y, rho = Math.hypot(sx, sy) / (2 * basis.k), c = 2 * Math.atan(rho);
  let P;
  if (rho < 1e-9) P = basis.C;
  else { const ux = sx / Math.hypot(sx, sy), uy = sy / Math.hypot(sx, sy); P = [0, 1, 2].map((i) => basis.C[i] * Math.cos(c) + (ux * basis.R[i] + uy * basis.U[i]) * Math.sin(c)); }
  return { alt: Math.asin(clamp(P[2], -1, 1)) / RAD, az: A.norm360(Math.atan2(P[0], P[1]) / RAD) };
}

// where to look first: by day (and in twilight) with the sun to the left of the middle, where the card does not cover it, high enough to show
// some sky; at night toward the middle of the sky on the side the stars wheel
export function initialView(sunAlt, sunAz, lat) {
  // 26 degrees of sky to the left of the middle is 26 / cos(altitude) of azimuth: the higher the sun, the more the compass lines crowd together
  if (sunAlt > -6) return { az0: A.norm360(sunAz + Math.min(75, 26 / Math.max(0.2, Math.cos(clamp(sunAlt, -6, 85) * RAD)))), alt0: clamp(sunAlt, 10, 40), fov: 100 };
  return { az0: lat >= 0 ? 180 : 0, alt0: 30, fov: 100 };
}

const rgb = (c, a = 1) => `rgba(${c[0]},${c[1]},${c[2]},${a})`;
const mix = (a, b, u) => a.map((v, i) => Math.round(v + (b[i] - v) * u));
const PLANET_LOOK = { mercury: ['#c9c2b8', 2.2], venus: ['#fff6df', 3.6], mars: ['#ff9a6e', 2.8], jupiter: ['#ffe9c2', 3.4], saturn: ['#f2dd9b', 2.8] };

export function createSky(host, opts) {
  const canvas = host.canvas, ctx = canvas.getContext('2d');
  const reduced = !!host.reduced, low = !!host.lowPower;
  let place = { lat: opts.lat, lon: opts.lon }, date = opts.date || new Date();
  const dpr = low ? 1 : Math.min(2, (typeof devicePixelRatio === 'number' && devicePixelRatio) || 1);
  let W = 0, H = 0, view = { w: 0, h: 0, ...opts.view };
  let pick = null, raf = 0, timer = 0, dead = false, bg = null, bgKey = '';
  const stars = low ? STARS.slice(0, 120) : STARS;
  let cache = null;                                   // positions for the current time: recomputed when the time or place changes, not on every drag

  function positions() {
    const key = date.getTime() + '|' + place.lat + '|' + place.lon; if (cache && cache.key === key) return cache;
    const sun = A.sunHor(date, place.lat, place.lon), moon = A.moonHor(date, place.lat, place.lon), phase = A.moonPhase(date);
    const c = { key, sun, moon, phase, sunAlt: sun.alt, colors: A.skyColors(sun.alt) };
    c.stars = stars.map((s) => ({ s, ...A.starHor(s[0], s[1], date, place.lat, place.lon) }));
    c.planets = A.PLANETS.map((name) => ({ name, ...A.planetHor(name, date, place.lat, place.lon) }));
    c.figures = low ? [] : Object.entries(FIGURES).map(([abbr, polys]) => ({ abbr, polys: polys.map((poly) => poly.map(([ra, dec]) => A.starHor(ra, dec, date, place.lat, place.lon))) }));
    cache = c; return c;
  }

  function resize() {
    W = Math.max(1, Math.round(canvas.clientWidth || (typeof innerWidth === 'number' ? innerWidth : 800))); H = Math.max(1, Math.round(canvas.clientHeight || (typeof innerHeight === 'number' ? innerHeight : 600)));
    canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);
    view.w = W; view.h = H; bg = null;
  }

  // the dome: a small image, one pixel per few screen pixels, coloured by the altitude of the sky behind it, then smoothed up
  function paintDome(c) {
    const cw = low ? 40 : 128, ch = Math.max(8, Math.round(cw * H / W)), key = [cw, ch, view.az0.toFixed(2), view.alt0.toFixed(2), view.fov.toFixed(1), c.key].join('|');
    if (!bg) { bg = document.createElement('canvas'); bg.width = cw; bg.height = ch; }
    if (bgKey !== key) {
      bgKey = key; const b = bg.getContext('2d'), img = b.createImageData(cw, ch), basis = viewBasis(view), { zenith, horizon } = c.colors;
      const ground = mix(horizon, [4, 6, 12], 0.82);
      const sunV = vec(c.sun.alt, c.sun.az), glow = clamp((c.sunAlt + 9) / 12, 0, 1) * clamp((24 - c.sunAlt) / 20, 0, 1);
      const warm = c.sunAlt > -9 && c.sunAlt < 14 ? clamp(1 - Math.abs(c.sunAlt - 1) / 12, 0, 1) : 0;
      for (let j = 0; j < ch; j++) for (let i = 0; i < cw; i++) {
        const p = unproject((i + 0.5) / cw * W, (j + 0.5) / ch * H, view, basis), alt = p.alt;
        let col;
        if (alt < -0.4) col = mix(ground, mix(ground, [2, 3, 8], 0.5), clamp(-alt / 40, 0, 1));
        else { const u = Math.pow(clamp(alt / 80, 0, 1), 0.55); col = mix(horizon, zenith, u); if (alt < 0.4) col = mix(col, ground, clamp((0.4 - alt) / 0.8, 0, 1)); }
        const d = Math.acos(clamp(dot(vec(p.alt, p.az), sunV), -1, 1)) / RAD;       // near the sun the sky is brighter and warmer
        const g = glow * Math.exp(-d * d / (2 * 22 * 22)) * (alt < 0 ? 0.25 : 1);
        if (g > 0.003) col = mix(col, warm > 0.2 ? [255, 176, 110] : [255, 244, 220], clamp(g * (0.55 + 0.35 * warm), 0, 0.7));
        const o = (j * cw + i) * 4; img.data[o] = col[0]; img.data[o + 1] = col[1]; img.data[o + 2] = col[2]; img.data[o + 3] = 255;
      }
      b.putImageData(img, 0, 0);
    }
    ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(bg, 0, 0, bg.width, bg.height, 0, 0, W, H);
  }

  const items = [];                                    // what is drawn this frame and can be tapped: { x, y, r, info }
  function draw() {
    raf = 0; if (dead || !W) return;
    const c = positions(), basis = viewBasis(view), v = c.colors.starVisibility;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.clearRect(0, 0, W, H); items.length = 0;
    paintDome(c);
    const P = (alt, az) => project(alt, az, view, basis), onScreen = (p, m = 40) => p.ok && p.x > -m && p.x < W + m && p.y > -m && p.y < H + m;

    // horizon line and the points of the compass
    ctx.lineWidth = 1; ctx.strokeStyle = 'rgba(255,255,255,0.16)'; ctx.beginPath();
    let pen = false; for (let az = 0; az <= 360; az += 2) { const p = P(0, az); if (p.ok && Math.abs(p.x) < 4 * W && Math.abs(p.y) < 4 * H) { if (pen) ctx.lineTo(p.x, p.y); else ctx.moveTo(p.x, p.y); pen = true; } else pen = false; }
    ctx.stroke();
    ctx.font = '600 12px ui-sans-serif, system-ui, sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    for (let az = 0; az < 360; az += 45) { const p = P(0, az); if (onScreen(p, -6)) { ctx.fillStyle = az % 90 === 0 ? 'rgba(255,255,255,0.78)' : 'rgba(255,255,255,0.45)'; ctx.fillText(compass(az), p.x, p.y + 14); } }

    // constellation figures
    if (v > 0.25 && c.figures.length) {
      ctx.lineWidth = 1; ctx.strokeStyle = `rgba(150,180,255,${0.22 * v})`; ctx.beginPath();
      for (const f of c.figures) for (const poly of f.polys) {
        let on = false;
        for (const q of poly) { const p = q.alt > -3 ? P(q.alt, q.az) : { ok: false }; if (p.ok && Math.abs(p.x) < 3 * W && Math.abs(p.y) < 3 * H) { if (on) ctx.lineTo(p.x, p.y); else ctx.moveTo(p.x, p.y); on = true; } else on = false; }
      }
      ctx.stroke();
    }

    // stars
    if (v > 0.02) {
      const ext = (alt) => clamp(0.35 + alt / 14, 0.35, 1);
      for (const st of c.stars) {
        if (st.alt < -0.5) continue; const p = P(st.alt, st.az); if (!onScreen(p, 10)) continue;
        const mag = st.s[2], faint = clamp(1.15 - Math.max(0, mag - 1.2) * 0.12, 0.3, 1), a = v * faint * ext(st.alt);
        const r = Math.max(0.6, 0.75 + (3.9 - mag) * 0.62 + (view.fov < 70 ? 0.4 : 0));
        ctx.fillStyle = `rgba(255,255,255,${clamp(a, 0, 1)})`; ctx.beginPath(); ctx.arc(p.x, p.y, r, 0, 6.2832); ctx.fill();
        if (mag < 1.2 && !low) { const gr = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, r * 4); gr.addColorStop(0, `rgba(255,255,255,${0.25 * a})`); gr.addColorStop(1, 'rgba(255,255,255,0)'); ctx.fillStyle = gr; ctx.beginPath(); ctx.arc(p.x, p.y, r * 4, 0, 6.2832); ctx.fill(); }
        if (a > 0.35 && (mag < 1.7 || (view.fov < 60 && mag < 3.0))) { ctx.fillStyle = `rgba(215,225,255,${clamp(a * 0.8, 0, 0.8)})`; ctx.font = '11px ui-sans-serif, system-ui, sans-serif'; ctx.textAlign = 'left'; ctx.fillText(st.s[3], p.x + r + 5, p.y - 1); }
        items.push({ x: p.x, y: p.y, r: Math.max(14, r + 8), info: { kind: 'star', name: st.s[3], constellation: CONSTELLATIONS[st.s[4]] || '', mag, alt: st.alt, az: st.az } });
      }
    }

    // planets (the sky is dark enough, and they are up)
    if (c.sunAlt < -2) for (const pl of c.planets) {
      if (pl.alt < -0.5) continue; const p = P(pl.alt, pl.az); if (!onScreen(p, 10)) continue; const [col, r] = PLANET_LOOK[pl.name], a = clamp(0.3 + pl.alt / 10, 0.3, 1);
      ctx.globalAlpha = a; ctx.fillStyle = col; ctx.beginPath(); ctx.arc(p.x, p.y, r, 0, 6.2832); ctx.fill(); ctx.globalAlpha = 1;
      ctx.fillStyle = 'rgba(255,225,170,0.85)'; ctx.font = '600 11px ui-sans-serif, system-ui, sans-serif'; ctx.textAlign = 'left'; ctx.fillText(PLANET_LABEL[pl.name], p.x + r + 5, p.y - 1);
      items.push({ x: p.x, y: p.y, r: 16, info: { kind: 'planet', name: PLANET_LABEL[pl.name], alt: pl.alt, az: pl.az } });
    }

    // the moon, lit on the side that faces the sun (enlarged: at true size it would be a speck)
    if (c.moon.alt > -1.5) {
      const p = P(c.moon.alt, c.moon.az);
      if (onScreen(p, 60)) {
        const r = Math.max(10, view.fov < 40 ? 22 : 12), sunP = P(c.sun.alt, c.sun.az), ang = sunP.ok ? Math.atan2(sunP.y - p.y, sunP.x - p.x) : -Math.PI / 2, k = c.phase.illumination;
        if (!low) { const gr = ctx.createRadialGradient(p.x, p.y, r * 0.8, p.x, p.y, r * 5); gr.addColorStop(0, `rgba(210,225,255,${0.22 * k * (1 - clamp(c.sunAlt / 20, 0, 1))})`); gr.addColorStop(1, 'rgba(210,225,255,0)'); ctx.fillStyle = gr; ctx.beginPath(); ctx.arc(p.x, p.y, r * 5, 0, 6.2832); ctx.fill(); }
        ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(ang);
        ctx.fillStyle = 'rgba(40,46,64,0.92)'; ctx.beginPath(); ctx.arc(0, 0, r, 0, 6.2832); ctx.fill();          // the dark face
        ctx.fillStyle = '#f2efe3'; ctx.beginPath(); ctx.arc(0, 0, r, -Math.PI / 2, Math.PI / 2);                    // the lit half faces the sun (rotated to it)
        const w = r * (1 - 2 * k);                                                                                  // the terminator: an ellipse from the lit half to the dark one
        ctx.ellipse(0, 0, Math.abs(w), r, 0, Math.PI / 2, -Math.PI / 2, w > 0); ctx.fill();
        ctx.restore();
        items.push({ x: p.x, y: p.y, r: r + 8, info: { kind: 'moon', name: 'The Moon', detail: `${c.phase.name}, ${Math.round(k * 100)}% lit`, alt: c.moon.alt, az: c.moon.az } });
      }
    }

    // the sun
    if (c.sunAlt > -3) {
      const p = P(c.sun.alt, c.sun.az);
      if (onScreen(p, 80)) {
        const r = view.fov < 50 ? 20 : 12, up = clamp((c.sunAlt + 3) / 6, 0, 1);
        if (!low) { const gr = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, r * 7); gr.addColorStop(0, `rgba(255,236,190,${0.8 * up})`); gr.addColorStop(0.18, `rgba(255,214,150,${0.35 * up})`); gr.addColorStop(1, 'rgba(255,200,120,0)'); ctx.fillStyle = gr; ctx.beginPath(); ctx.arc(p.x, p.y, r * 7, 0, 6.2832); ctx.fill(); }
        ctx.fillStyle = `rgba(255,248,226,${up})`; ctx.beginPath(); ctx.arc(p.x, p.y, r, 0, 6.2832); ctx.fill();
        items.push({ x: p.x, y: p.y, r: r + 10, info: { kind: 'sun', name: 'The Sun', detail: c.sunAlt > 0 ? 'above the horizon' : 'just below the horizon', alt: c.sun.alt, az: c.sun.az } });
      }
    }

    // the star or planet you tapped
    if (pick) { const it = items.find((i) => i.info.name === pick.name); if (it) { ctx.strokeStyle = 'rgba(255,226,161,0.9)'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(it.x, it.y, Math.max(11, it.r - 4), 0, 6.2832); ctx.stroke(); } }

    // the label that says what this is
    ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic'; ctx.font = '11px ui-sans-serif, system-ui, sans-serif'; ctx.fillStyle = 'rgba(255,255,255,0.55)';
    ctx.fillText(`Simulation · ${Math.abs(place.lat).toFixed(1)}°${place.lat >= 0 ? 'N' : 'S'} ${Math.abs(place.lon).toFixed(1)}°${place.lon >= 0 ? 'E' : 'W'} · ${date.toLocaleString([], { weekday: 'short', hour: 'numeric', minute: '2-digit', ...(place.tz ? { timeZone: place.tz } : {}) })}${W > 520 ? ' · sun and moon enlarged' : ''}`, 14, 24);
  }

  const redraw = () => { if (dead) return; if (reduced || low) draw(); else if (!raf) raf = requestAnimationFrame(draw); };    // a held scene is drawn at once, in whole

  const ctl = {
    view: () => ({ az0: view.az0, alt0: view.alt0, fov: view.fov }),
    mode: { reduced, low },
    items: () => items.map((i) => ({ x: i.x, y: i.y, name: i.info.name, kind: i.info.kind })),   // what is on screen and tappable (the tests tap a real star)
    drawn: () => ({ stars: stars.length, figures: cache ? cache.figures.length : -1 }),
    // look around by degrees on screen: dAz right-positive, dAlt up-positive
    lookBy(dAz, dAlt) { view.az0 = A.norm360(view.az0 + dAz); view.alt0 = clamp(view.alt0 + dAlt, -12, 90); redraw(); },
    lookAt(az, alt) { view.az0 = A.norm360(az); view.alt0 = clamp(alt, -12, 90); redraw(); },
    zoomBy(f) { view.fov = clamp(view.fov * f, 24, 150); redraw(); },
    // dragging the sky: pixels moved on screen -> degrees of look
    dragBy(dx, dy) { const s = view.fov / W; ctl.lookBy(-dx * s, dy * s); },
    // what is at this pixel, if anything the sky shows (a star, a planet, the moon, the sun): the nearest within its reach
    hit(x, y) { let best = null, bd = 1e9; for (const it of items) { const d = Math.hypot(it.x - x, it.y - y); if (d <= it.r && d < bd) { bd = d; best = it; } } return best ? best.info : null; },
    select(info) { pick = info; redraw(); },
    // the gestures the stage forwards (the `world` hook): a drag, a zoom factor, and a tap that returns true when it landed on something
    drag(dx, dy) { ctl.dragBy(dx, dy); },
    zoom(f) { ctl.zoomBy(f); },
    tap(x, y) { const h = ctl.hit(x, y); if (!h) { pick = null; redraw(); return false; } pick = h; redraw(); if (opts.onPick) opts.onPick(h); return true; },
    setPlace(lat, lon, tz) { place = { lat, lon, tz }; cache = null; bgKey = ''; redraw(); },
    setTime(d) { date = d; cache = null; bgKey = ''; redraw(); },
    state: () => ({ place, date, ...(cache || {}) }),
    now: () => positions(),
    resize() { resize(); redraw(); },
    start() {
      resize(); redraw();
      if (!reduced && !low) timer = setInterval(() => { if (!document.hidden) { date = new Date(); cache = null; bgKey = ''; redraw(); } }, 60000);   // the sky turns: a fresh frame each minute
    },
    destroy() { dead = true; if (raf) cancelAnimationFrame(raf); clearInterval(timer); },
  };
  return ctl;
}
