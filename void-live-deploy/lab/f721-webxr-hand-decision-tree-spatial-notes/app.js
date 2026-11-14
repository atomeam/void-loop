const notes = [];
let xrSession = null, xrRefSpace = null, handFeatures = {pinch:1, ext:1, tilt:0};
const channel = new BroadcastChannel('verse-f721');

function makeTree() {
  return { splits: [0.3, 0.5, 0], actions: [0,1,2,3], fitness:0 }; // thresholds, action ids: 0approach 1flee 2stick 3free
}
function evalTree(tree, f) {
  let idx = 0;
  if (f.pinch < tree.splits[0]) idx += 1;
  if (f.ext > tree.splits[1]) idx += 2;
  return tree.actions[idx % 4];
}
function addNote(text='New note', x=200, y=200) {
  const el = document.createElement('div');
  el.className = 'note';
  el.contentEditable = true;
  el.textContent = text;
  el.style.left = x+'px';
  el.style.top = y+'px';
  const tree = makeTree();
  const note = {el, x, y, vx:0, vy:0, tree, id:Date.now()+Math.random()};
  notes.push(note);
  document.getElementById('notes').appendChild(el);
  makeDraggable(note);
}
function makeDraggable(note) {
  let drag=false, ox=0, oy=0;
  note.el.onpointerdown = e => { drag=true; ox=e.clientX-note.x; oy=e.clientY-note.y; note.el.setPointerCapture(e.pointerId); };
  note.el.onpointermove = e => { if(drag){ note.x=e.clientX-ox; note.y=e.clientY-oy; note.el.style.left=note.x+'px'; note.el.style.top=note.y+'px'; note.tree.fitness+=0.1; } };
  note.el.onpointerup = () => drag=false;
}
function update() {
  const f = handFeatures;
  notes.forEach(n => {
    if (n.el.matches(':active')) return;
    const act = evalTree(n.tree, f);
    let ax=0, ay=0;
    const cx = window.innerWidth/2, cy = window.innerHeight/2;
    if (act===0) { ax=(cx-n.x)*0.002; ay=(cy-n.y)*0.002; } // approach center/hand proxy
    if (act===1) { ax=(n.x-cx)*0.002; ay=(n.y-cy)*0.002; }
    if (act===2) { n.vx*=0.8; n.vy*=0.8; }
    n.vx += ax; n.vy += ay;
    n.vx *= 0.95; n.vy *= 0.95;
    n.x += n.vx; n.y += n.vy;
    n.x = Math.max(0, Math.min(window.innerWidth-180, n.x));
    n.y = Math.max(0, Math.min(window.innerHeight-80, n.y));
    n.el.style.left = n.x+'px';
    n.el.style.top = n.y+'px';
  });
  requestAnimationFrame(update);
}
// Pointer residual as feature proxy
document.onpointermove = e => {
  if (!xrSession) {
    handFeatures.pinch = Math.min(1, Math.hypot(e.movementX, e.movementY)/20);
    handFeatures.ext = (e.clientX / window.innerWidth);
    handFeatures.tilt = (e.clientY / window.innerHeight - 0.5)*2;
  }
};
// XR
document.getElementById('xr').onclick = async () => {
  if (!navigator.xr) { document.getElementById('status').textContent='WebXR not available'; return; }
  try {
    xrSession = await navigator.xr.requestSession('immersive-ar', {requiredFeatures:['hand-tracking']});
    xrRefSpace = await xrSession.requestReferenceSpace('local');
    xrSession.requestAnimationFrame(onXRFrame);
    document.getElementById('status').textContent='XR hands active';
  } catch(e) { document.getElementById('status').textContent='XR failed: '+e.message; }
};
function onXRFrame(t, frame) {
  if (!xrSession) return;
  const pose = frame.getViewerPose(xrRefSpace);
  if (pose) {
    for (const src of frame.session.inputSources) {
      if (src.hand) {
        const thumb = src.hand.get('thumb-tip');
        const index = src.hand.get('index-finger-tip');
        if (thumb && index) {
          const tp = frame.getPose(thumb, xrRefSpace).transform.position;
          const ip = frame.getPose(index, xrRefSpace).transform.position;
          handFeatures.pinch = Math.min(1, Math.hypot(tp.x-ip.x, tp.y-ip.y, tp.z-ip.z)*5);
          handFeatures.ext = Math.min(1, Math.abs(ip.y - tp.y)*3);
        }
      }
    }
  }
  xrSession.requestAnimationFrame(onXRFrame);
}
// Persistence & export
async function seal() {
  const best = notes.slice().sort((a,b)=>b.tree.fitness-a.tree.fitness)[0];
  if (!best) return;
  const data = {trees: notes.map(n=>({splits:n.tree.splits, actions:n.tree.actions})), notes: notes.map(n=>({text:n.el.textContent, x:n.x, y:n.y}))};
  localStorage.setItem('verse-f721', JSON.stringify(data));
  channel.postMessage(data);
  document.getElementById('status').textContent='Sealed to localStorage + broadcast';
}
document.getElementById('seal').onclick = seal;
document.getElementById('download').onclick = () => {
  const data = {notes: notes.map(n=>({text:n.el.textContent, x:n.x, y:n.y, tree:n.tree}))};
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([JSON.stringify(data,null,2)], {type:'application/json'}));
  a.download = 'verse-f721-notes.json';
  a.click();
};
document.getElementById('share').onclick = () => {
  const data = btoa(JSON.stringify(notes.map(n=>({t:n.el.textContent, x:n.x, y:n.y}))));
  const url = location.origin + location.pathname + '#n=' + data;
  navigator.clipboard.writeText(url).then(()=> document.getElementById('status').textContent='Share link copied');
};
document.getElementById('add').onclick = () => addNote();
document.getElementById('reset').onclick = () => { notes.forEach(n=>n.el.remove()); notes.length=0; localStorage.removeItem('verse-f721'); };
// Load
try {
  const saved = JSON.parse(localStorage.getItem('verse-f721')||'null');
  if (saved && saved.notes) saved.notes.forEach((n,i)=> { addNote(n.text, n.x, n.y); if(saved.trees[i]) notes[notes.length-1].tree=saved.trees[i]; });
} catch (e) { console.debug("lab f721-webxr-hand-decision-tree-spatial-notes:", e); }
if (location.hash.startsWith('#n=')) {
  try {
    const arr = JSON.parse(atob(location.hash.slice(3)));
    arr.forEach(n=>addNote(n.t, n.x, n.y));
  } catch (e) { console.debug("lab f721-webxr-hand-decision-tree-spatial-notes:", e); }
}
if (notes.length===0) addNote('Drag me or use hand poses');
update();
