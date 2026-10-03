/**
 * Next #16 — 3D slogan on "what are you?"
 * Drawn with the same canvas / materialize pattern as skills/make.js (no three.js yet).
 * Mounts beside the self page; removed when that page closes.
 */
export const SLOGAN = 'A-to-Mind. Peace of mind, from A to Z. An all-in-one supertool.';
const STYLE_ID = 'vmake-style';

function ensureMakeStyle() {
  if (typeof document === 'undefined' || document.getElementById(STYLE_ID)) return;
  const s = document.createElement('style');
  s.id = STYLE_ID;
  s.textContent = '.vmake{position:relative;border-radius:14px;overflow:hidden;margin-top:8px;perspective:900px}'
    + '.vmake iframe{display:block;width:100%;border:0;border-radius:14px;background:radial-gradient(ellipse at center,rgba(120,140,255,.08),rgba(0,0,0,0) 70%);transform-origin:50% 60%;animation:vmat 1.1s cubic-bezier(.16,1,.3,1) both}'
    + '.vmake::after{content:"";position:absolute;left:0;right:0;height:38%;top:-40%;pointer-events:none;background:linear-gradient(180deg,rgba(124,204,255,0),rgba(124,204,255,.22),rgba(124,204,255,0));animation:vscan 1.2s ease-out .1s both}'
    + '@keyframes vmat{0%{opacity:0;transform:rotateX(58deg) translateY(40px) scale(.72);filter:blur(14px) brightness(2.2)}55%{opacity:1;filter:blur(2px) brightness(1.4)}100%{opacity:1;transform:none;filter:none}}'
    + '@keyframes vscan{0%{top:-40%}100%{top:110%}}'
    + '@media (prefers-reduced-motion:reduce){.vmake iframe,.vmake::after{animation:none}}'
    + '.vslogan{position:fixed;z-index:49;left:calc(50% + min(300px, 28vw));top:42%;transform:translateY(-50%);width:min(340px, calc(50vw - 40px));pointer-events:none}'
    + '.vslogan .vmake{margin:0}'
    + '.vslogan iframe{height:220px}'
    + '@media (max-width:980px){.vslogan{left:50%;top:auto;bottom:108px;transform:translateX(-50%);width:min(560px, calc(100vw - 32px))}}'
    + '@media (prefers-reduced-motion:reduce){.vslogan{transition:none}}';
  document.head.appendChild(s);
}

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

/** Mount the slogan beside the self page. Returns the slogan root (removed on close). */
export function mountSlogan(pageEl, opts = {}) {
  if (typeof document === 'undefined' || !pageEl) return null;
  ensureMakeStyle();
  document.querySelectorAll('.vslogan').forEach((n) => n.remove());
  const wrap = document.createElement('div');
  wrap.className = 'vslogan';
  wrap.setAttribute('aria-hidden', 'true');
  const box = document.createElement('div');
  box.className = 'vmake';
  const f = document.createElement('iframe');
  f.setAttribute('sandbox', 'allow-scripts');
  f.setAttribute('title', 'A-to-Mind slogan');
  f.srcdoc = sloganDoc({ reduce: !!opts.reduce });
  box.appendChild(f);
  wrap.appendChild(box);
  document.body.appendChild(wrap);
  pageEl._slogan = wrap;
  return wrap;
}

export function clearSlogan(pageEl) {
  const n = (pageEl && pageEl._slogan) || document.querySelector('.vslogan');
  if (n && n.parentNode) n.parentNode.removeChild(n);
  if (pageEl) pageEl._slogan = null;
}

export default { SLOGAN, sloganDoc, mountSlogan, clearSlogan };
