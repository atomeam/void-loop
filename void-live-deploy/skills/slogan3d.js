/**
 * Next #16 — the slogan on "what are you?"
 * Shown as type at the top of the self page (a canvas drawing of it was blurry, boxed in white and cut off on the right,
 * and missing on phones). sloganDoc (the old canvas version) stays exported for anything that frames it.
 * Removed when that page closes.
 */
export const SLOGAN = 'A-to-Mind. Peace of mind, from A to Z. An all-in-one supertool.';
/** Canvas 3D slogan: floating shards assemble into extruded text (make.js style, no libs). */
export function sloganDoc(opts = {}) {
  const reduce = !!opts.reduce;
  const text = SLOGAN;
  return '<!doctype html><html><head><meta charset="utf-8"><style>'
    + 'html,body{margin:0;height:100%;background:transparent;overflow:hidden}'
    + 'canvas{display:block;width:100%;height:100%}'
    + '</style></head><body><canvas id="c"></canvas><script>'
    + `(function(){var TEXT=${JSON.stringify(text)},REDUCE=${reduce ? 'true' : 'false'},c=document.getElementById('c'),x=c.getContext('2d'),W,H,dpr=Math.min(devicePixelRatio||1,2),t0=performance.now();`
    + 'function size(){W=c.clientWidth;H=c.clientHeight;c.width=W*dpr;c.height=H*dpr;x.setTransform(dpr,0,0,dpr,0,0)}size();addEventListener("resize",size);'
    + 'var lines=TEXT.split(/(?<=\\.)\\s+/);'
    + 'var shards=[];for(var i=0;i<36;i++)shards.push({x:(Math.random()-.5)*2,y:(Math.random()-.5)*2,z:Math.random()*2+0.5,s:4+Math.random()*8,a:Math.random()*6.28,vx:(Math.random()-.5)*.02,vy:(Math.random()-.5)*.02});'
    + 'function draw(now){if(c.clientWidth!==W||c.clientHeight!==H)size();if(!W||!H){requestAnimationFrame(draw);return}'
    + 'var T=REDUCE?1.2:Math.min(1.2,(now-t0)/1000);var u=Math.min(1,T/1.05);'
    + 'x.clearRect(0,0,W,H);'
    + 'var cx=W/2,cy=H/2,sc=Math.min(W,H)*.42;'
    + 'if(!REDUCE){for(var i=0;i<shards.length;i++){var s=shards[i];var pz=s.z*(1-u*0.7)+0.35;var px=cx+(s.x*(1-u)+Math.sin(s.a+T)*0.08*(1-u))*sc/pz;var py=cy+(s.y*(1-u)+Math.cos(s.a+T*1.1)*0.06*(1-u))*sc/pz;x.globalAlpha=(1-u)*0.55;x.fillStyle="rgba(160,190,255,.9)";x.fillRect(px,py,s.s/pz,s.s/pz);s.a+=0.02}}'
    + 'x.globalAlpha=Math.min(1,u*1.2);x.textAlign="center";x.textBaseline="middle";'
    + 'var lh=Math.max(18,Math.min(26,H/(lines.length+1)));x.font="500 "+lh+"px system-ui,Segoe UI,sans-serif";'
    + 'var depth=REDUCE?0:Math.max(0,8*(1-u*0.3));'
    + 'for(var d=depth|0;d>=0;d--){x.fillStyle=d===0?"rgba(220,230,255,.96)":"rgba(80,100,160,"+(0.08+d/depth*0.12)+")";'
    + 'for(var L=0;L<lines.length;L++){var yy=cy+(L-(lines.length-1)/2)*lh*1.25+(REDUCE?0:Math.sin(T*1.4+L)*.6*(1-u*0.5));x.fillText(lines[L],cx+d*0.35,yy+d*0.55)}}'
    + 'x.globalAlpha=1;if(!REDUCE)requestAnimationFrame(draw)}'
    + 'if(REDUCE)draw(t0+2000);else requestAnimationFrame(draw);'
    + 'window.__slogan={text:TEXT,reduce:REDUCE};})();'
    + '</script></body></html>';
}

const SLOGAN_STYLE_ID = 'vslogan-style';
function ensureSloganStyle() {
  if (typeof document === 'undefined' || document.getElementById(SLOGAN_STYLE_ID)) return;
  const s = document.createElement('style');
  s.id = SLOGAN_STYLE_ID;
  // set in type, not painted on a canvas: crisp at any size, never cut off, the same on a phone
  s.textContent = '.vslogan{position:relative;margin:4px 0 18px;padding:18px 20px 16px;border-radius:16px;overflow:hidden;'
    + 'background:radial-gradient(120% 140% at 0% 0%,rgba(130,150,255,.16),rgba(0,0,0,0) 60%),radial-gradient(120% 140% at 100% 100%,rgba(190,130,255,.14),rgba(0,0,0,0) 60%),rgba(255,255,255,.03);'
    + 'box-shadow:inset 0 0 0 1px rgba(255,255,255,.08),inset 0 1px 0 rgba(255,255,255,.08)}'
    + '.vslogan .vs-brand{display:block;font-size:30px;line-height:1.1;font-weight:700;letter-spacing:-.02em;'
    + 'background:linear-gradient(100deg,#f3f5ff 0%,#c9d3ff 35%,#d9c3ff 55%,#f3f5ff 75%);background-size:220% 100%;-webkit-background-clip:text;background-clip:text;color:transparent;'
    + 'filter:drop-shadow(0 2px 10px rgba(140,160,255,.25));animation:vsShine 7s ease-in-out infinite}'
    + '.vslogan .vs-line{display:block;margin-top:6px;font-size:17px;line-height:1.35;font-weight:500;color:#dfe3f2;letter-spacing:-.005em}'
    + '.vslogan .vs-line + .vs-line{margin-top:2px;color:#a9afc4;font-weight:400}'
    + '@keyframes vsShine{0%,100%{background-position:100% 0}50%{background-position:0% 0}}'
    + '@media (max-width:480px){.vslogan{padding:16px 16px 14px}.vslogan .vs-brand{font-size:26px}.vslogan .vs-line{font-size:16px}}'
    + '@media (prefers-reduced-motion:reduce){.vslogan .vs-brand{animation:none;background-position:0 0}}';
  document.head.appendChild(s);
}

/** Mount the slogan at the top of the self page (HTML text, so it stays sharp and fits any screen). Removed with the page. */
export function mountSlogan(pageEl, opts = {}) {
  if (typeof document === 'undefined' || !pageEl) return null;
  ensureSloganStyle();
  document.querySelectorAll('.vslogan').forEach((n) => n.remove());
  const wrap = document.createElement('div');
  wrap.className = 'vslogan';
  wrap.dataset.text = SLOGAN;
  if (opts.reduce) wrap.dataset.reduce = '1';
  const [brand, ...rest] = SLOGAN.split(/(?<=\.)\s+/);
  const b = document.createElement('span'); b.className = 'vs-brand'; b.textContent = brand; wrap.appendChild(b);
  for (const line of rest) { const l = document.createElement('span'); l.className = 'vs-line'; l.textContent = line; wrap.appendChild(l); }
  const after = pageEl.querySelector('.sub');
  if (after && after.parentNode === pageEl) after.after(wrap); else pageEl.prepend(wrap);
  pageEl._slogan = wrap;
  return wrap;
}

export function clearSlogan(pageEl) {
  const n = (pageEl && pageEl._slogan) || document.querySelector('.vslogan');
  if (n && n.parentNode) n.parentNode.removeChild(n);
  if (pageEl) pageEl._slogan = null;
}

export default { SLOGAN, sloganDoc, mountSlogan, clearSlogan };
