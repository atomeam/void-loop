/**
 * othello engine ΓÇö reversible disc-flipping logic for 8x8 board
 * Renders a playable Othello (Reversi) game in a sandboxed frame
 * Contract: { name, examples, nearMisses, match(lower, text), run(text, api) }
 * Examples: "play othello", "reversi", "start othello game"
 * Near misses: "what is othello", "how to play reversi", "othello rules"
 */

const DIRS = [[-1,-1],[-1,0],[-1,1],[0,-1],[0,1],[1,-1],[1,0],[1,1]];

function ix(r, c) { return r * 8 + c; }
function rc(i) { return [Math.floor(i / 8), i % 8]; }
function inside(r, c) { return r >= 0 && r < 8 && c >= 0 && c < 8; }

/** Return indices of opponent discs that would flip if player plays at pos */
export function flips(board, pos, player) {
  const opp = player === 1 ? 2 : 1;
  const out = [];
  const r0 = Math.floor(pos / 8), c0 = pos % 8;
  for (const [dr, dc] of DIRS) {
    let r = r0 + dr, c = c0 + dc;
    const path = [];
    while (inside(r, c)) {
      const idx = ix(r, c);
      if (board[idx] === opp) path.push(idx);
      else if (board[idx] === player && path.length) { out.push(...path); break; }
      else break;
      r += dr; c += dc;
    }
  }
  return out;
}

/** Return all valid move indices for player */
export function validMoves(board, player) {
  const v = [];
  for (let i = 0; i < 64; i++) if (!board[i] && flips(board, i, player).length) v.push(i);
  return v;
}

/** Count discs: [black, white] */
export function count(board) {
  let bl = 0, wh = 0;
  for (const v of board) { if (v === 1) bl++; else if (v === 2) wh++; }
  return [bl, wh];
}

/** Initial board state */
export function initialBoard() {
  const b = new Array(64).fill(0);
  b[27] = b[36] = 2; // white
  b[28] = b[35] = 1; // black
  return b;
}

/** Simple greedy AI: pick move that maximizes immediate disc count */
export function aiMove(board) {
  const moves = validMoves(board, 2);
  if (!moves.length) return -1;
  let best = -1, bestScore = -1e9;
  for (const m of moves) {
    const bb = board.slice();
    bb[m] = 2;
    flips(bb, m, 2).forEach(j => bb[j] = 2);
    const sc = count(bb)[1];
    if (sc > bestScore) { bestScore = sc; best = m; }
  }
  return best;
}

/** Check if game is over (no valid moves for either player) */
export function isGameOver(board) {
  return !validMoves(board, 1).length && !validMoves(board, 2).length;
}

/** Result string for end of game */
export function result(board) {
  const [bl, wh] = count(board);
  if (bl > wh) return { winner: 1, text: `you win! ${bl}-${wh}` };
  if (wh > bl) return { winner: 2, text: `Void wins ${wh}-${bl}` };
  return { winner: 0, text: `draw ${bl}-${wh}` };
}

const FRAME_CSS = ':root{color-scheme:dark}html,body{margin:0;height:100%;background:#0b0b13;color:#e6e6ea;font:14px/1.4 ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;overflow:hidden;user-select:none}'
  + '.bar{display:flex;justify-content:space-between;align-items:center;padding:6px 4px;color:#9a9aa6}'
  + 'button{font:inherit;color:#e6e6ea;background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.2);border-radius:14px;padding:4px 12px;cursor:pointer}';

function othelloDoc() {
  return '<!doctype html><html><head><meta charset="utf-8"><style>' + FRAME_CSS
    + '.g{display:grid;grid-template-columns:repeat(8,56px);gap:4px;justify-content:center;margin-top:10px}'
    + '.g button{height:56px;width:56px;border-radius:50%;font-size:28px;padding:0;transition:transform .1s}.g button:hover{transform:scale(1.05)}'
    + '.b{background:#1a1a2e;border:2px solid #ffd700}.w{background:#f0f0f0;border:2px solid #444}.empty{background:#0f3460;border:2px solid #1a1a2e}</style></head><body>'
    + '<div class="bar"><span id="s">your move ┬╖ you are black</span><button id="r">new game</button><span id="score">ΓùÅ 2 Γùï 2</span></div><div class="g" id="g"></div><script>'
    + `(function(){var b,over,g=document.getElementById('g'),st=document.getElementById('s'),sc=document.getElementById('score'),DIRS=[[-1,-1],[-1,0],[-1,1],[0,-1],[0,1],[1,-1],[1,0],[1,1]];
function ix(r,c){return r*8+c}function inside(r,c){return r>=0&&r<8&&c>=0&&c<8}
function flips(bb,pos,player){var opp=player===1?2:1,out=[];var r0=Math.floor(pos/8),c0=pos%8;for(var d of DIRS){var r=r0+d[0],c=c0+d[1],path=[];while(inside(r,c)){var idx=ix(r,c);if(bb[idx]===opp)path.push(idx);else if(bb[idx]===player&&path.length){out.push(...path);break}else break;r+=d[0];c+=d[1]}}return out}
function valid(bb,player){var v=[];for(var i=0;i<64;i++)if(!bb[i]&&flips(bb,i,player).length)v.push(i);return v}
function count(bb){var bl=0,wh=0;for(var v of bb){if(v===1)bl++;else if(v===2)wh++}return [bl,wh]}
function render(){g.innerHTML='';b.forEach(function(v,i){var e=document.createElement('button');if(v===1)e.className='b',e.textContent='ΓùÅ';else if(v===2)e.className='w',e.textContent='Γùï';else e.className='empty';e.setAttribute('aria-label','square '+(i+1));e.onclick=function(){if(over||!valid(b,1).includes(i))return;var f=flips(b,i,1);b[i]=1;f.forEach(function(j){b[j]=1});render();if(!valid(b,2).length){if(!valid(b,1).length)end();return}st.textContent='Void is thinkingΓÇª';setTimeout(function(){var vm=valid(b,2);var best=-1,bestScore=-1e9;for(var m of vm){var bb=b.slice();bb[m]=2;flips(bb,m,2).forEach(function(j){bb[j]=2});var s=count(bb)[1];if(s>bestScore){bestScore=s;best=m}}if(best>=0){b[best]=2;flips(b,best,2).forEach(function(j){bb[j]=2})}render();if(!valid(b,1).length){if(!valid(b,2).length)end();else st.textContent='no moves for you'}else st.textContent='your move ┬╖ you are black'},400)};g.appendChild(e)})}
function end(){var [bl,wh]=count(b);over=true;st.textContent=bl>wh?'you win! '+bl+'-'+wh:wh>bl?'Void wins '+wh+'-'+bl:'draw '+bl+'-'+wh}
function reset(){b=new Array(64).fill(0);b[27]=b[36]=2;b[28]=b[35]=1;over=false;st.textContent='your move ┬╖ you are black';sc.textContent='ΓùÅ 2 Γùï 2';render()}
document.getElementById('r').onclick=reset;reset();})();`
    + '</script></body></html>';
}

export function othelloOf(text) {
  const t = String(text || '').trim().toLowerCase().replace(/[?!.]+$/, '').replace(/\s+/g, ' ');
  if (/^(?:play\s+)?(?:othello|reversi)$/.test(t)) return { kind: 'game', id: 'othello', label: 'Othello' };
  if (/^(?:lets?\s+play\s+|can\s+we\s+play\s+|i\s+want\s+to\s+play\s+)(?:othello|reversi)$/.test(t)) return { kind: 'game', id: 'othello', label: 'Othello' };
  if (/^start\s+othello\s+game$/.test(t)) return { kind: 'game', id: 'othello', label: 'Othello' };
  return null;
}

export default {
  name: 'othello',
  examples: ['play othello', 'reversi', 'start othello game', 'lets play othello'],
  nearMisses: ['what is othello', 'how to play reversi', 'othello rules', 'othello strategy', 'reversi tips'],
  match(lower, text) { return !!othelloOf(text); },
  async run(text, api) {
    const q = othelloOf(text);
    if (!q) return 'none';
    const { showPage, esc } = api;
    const el = showPage((p) => { p.innerHTML = '<h2>' + esc(q.label) + '</h2><div class="sub">You are black. Void flips your discs.</div><div class="vmake"></div>'; });
    const f = document.createElement('iframe');
    f.setAttribute('sandbox', 'allow-scripts');
    f.setAttribute('title', q.label);
    f.style.height = '480px';
    f.srcdoc = othelloDoc();
    const box = el.querySelector('.vmake');
    if (box) box.appendChild(f);
    return 'othello';
  }
};
