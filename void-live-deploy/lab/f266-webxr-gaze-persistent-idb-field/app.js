const canvas = document.getElementById('canvas');
const gl = canvas.getContext('webgl', {xrCompatible: true}) || canvas.getContext('webgl');
const statusEl = document.getElementById('status');
const countEl = document.getElementById('count');
let markers = [];
let xrSession = null;
let refSpace = null;
let viewProjection = null;

const DB_NAME = 'void-gaze-field';
const STORE = 'markers';

async function openDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = e => e.target.result.createObjectStore(STORE, {keyPath: 'id', autoIncrement: true});
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function loadMarkers() {
  const db = await openDB();
  return new Promise(resolve => {
    const tx = db.transaction(STORE, 'readonly');
    const store = tx.objectStore(STORE);
    const req = store.getAll();
    req.onsuccess = () => resolve(req.result || []);
  });
}

async function saveMarker(m) {
  const db = await openDB();
  return new Promise(resolve => {
    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).add(m);
    tx.oncomplete = () => resolve();
  });
}

function updateCount() {
  countEl.textContent = `Markers: ${markers.length}`;
}

async function init() {
  markers = await loadMarkers();
  updateCount();
  statusEl.textContent = `Loaded ${markers.length} persistent markers.`;
  resize();
  requestAnimationFrame(loop);
}

function resize() {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
  gl.viewport(0, 0, canvas.width, canvas.height);
}
window.addEventListener('resize', resize);

// Simple shader for points/spheres
const vs = `
attribute vec3 aPos;
uniform mat4 uMVP;
void main() {
  gl_Position = uMVP * vec4(aPos, 1.0);
  gl_PointSize = 20.0;
}`;
const fs = `
precision mediump float;
void main() {
  float d = length(gl_PointCoord - 0.5);
  if (d > 0.5) discard;
  gl_FragColor = vec4(0.0, 1.0, 0.2, 1.0);
}`;

function compile(type, src) {
  const s = gl.createShader(type);
  gl.shaderSource(s, src);
  gl.compileShader(s);
  return s;
}
const prog = gl.createProgram();
gl.attachShader(prog, compile(gl.VERTEX_SHADER, vs));
gl.attachShader(prog, compile(gl.FRAGMENT_SHADER, fs));
gl.linkProgram(prog);
gl.useProgram(prog);
const aPos = gl.getAttribLocation(prog, 'aPos');
const uMVP = gl.getUniformLocation(prog, 'uMVP');

function drawMarkers(mvp) {
  if (!markers.length) return;
  const data = new Float32Array(markers.length * 3);
  markers.forEach((m, i) => {
    data[i*3] = m.x; data[i*3+1] = m.y; data[i*3+2] = m.z;
  });
  const buf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, data, gl.DYNAMIC_DRAW);
  gl.enableVertexAttribArray(aPos);
  gl.vertexAttribPointer(aPos, 3, gl.FLOAT, false, 0, 0);
  gl.uniformMatrix4fv(uMVP, false, mvp);
  gl.drawArrays(gl.POINTS, 0, markers.length);
}

function loop(time) {
  if (xrSession) {
    // XR frame handled in onXRFrame
  } else {
    gl.clearColor(0,0,0,1);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    // Simple ortho for non-XR preview
    const mvp = new Float32Array([
      1,0,0,0,
      0,1,0,0,
      0,0,1,0,
      0,0,0,1
    ]);
    drawMarkers(mvp);
    requestAnimationFrame(loop);
  }
}

async function enterXR() {
  if (!navigator.xr) {
    statusEl.textContent = 'WebXR not available. Using 2D click-to-place mode.';
    canvas.addEventListener('click', onClickPlace);
    return;
  }
  try {
    xrSession = await navigator.xr.requestSession('immersive-vr', {requiredFeatures: ['local-floor']});
    await gl.makeXRCompatible();
    const xrLayer = new XRWebGLLayer(xrSession, gl);
    xrSession.updateRenderState({baseLayer: xrLayer});
    refSpace = await xrSession.requestReferenceSpace('local-floor');
    xrSession.requestAnimationFrame(onXRFrame);
    statusEl.textContent = 'In XR. Gaze and press trigger to place.';
  } catch (e) {
    statusEl.textContent = 'XR failed: ' + e.message + '. Fallback to click.';
    canvas.addEventListener('click', onClickPlace);
  }
}

function onXRFrame(time, frame) {
  const pose = frame.getViewerPose(refSpace);
  if (pose) {
    const view = pose.views[0];
    const viewport = xrSession.renderState.baseLayer.getViewport(view);
    gl.bindFramebuffer(gl.FRAMEBUFFER, xrSession.renderState.baseLayer.framebuffer);
    gl.viewport(viewport.x, viewport.y, viewport.width, viewport.height);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    const proj = view.projectionMatrix;
    const invView = view.transform.inverse.matrix;
    // Simple MVP = proj * invView
    const mvp = multiply(proj, invView);
    drawMarkers(mvp);
    // Gaze ray for placement on trigger
    const inputSources = frame.session.inputSources;
    for (const src of inputSources) {
      if (src.gamepad && src.gamepad.buttons[0].pressed) {
        placeAtGaze(view);
      }
    }
  }
  xrSession.requestAnimationFrame(onXRFrame);
}

function placeAtGaze(view) {
  // Place 2m in front of camera on floor approx
  const transform = view.transform;
  const pos = transform.position;
  const orient = transform.orientation;
  // Simple forward vector from quaternion
  const fwd = quatForward(orient);
  const m = {
    x: pos.x + fwd.x * 2,
    y: 0,
    z: pos.z + fwd.z * 2,
    t: Date.now()
  };
  markers.push(m);
  saveMarker(m);
  updateCount();
}

function onClickPlace(e) {
  const rect = canvas.getBoundingClientRect();
  const x = (e.clientX / rect.width - 0.5) * 4;
  const z = (e.clientY / rect.height - 0.5) * 4;
  const m = { x, y: 0, z, t: Date.now() };
  markers.push(m);
  saveMarker(m);
  updateCount();
  statusEl.textContent = 'Placed in 2D mode.';
}

function quatForward(q) {
  // Approximate forward
  return { x: 2*(q.x*q.z + q.w*q.y), y: 2*(q.y*q.z - q.w*q.x), z: 1 - 2*(q.x*q.x + q.y*q.y) };
}

function multiply(a, b) {
  const out = new Float32Array(16);
  for (let i = 0; i < 4; i++) {
    for (let j = 0; j < 4; j++) {
      out[i*4+j] = a[i*4]*b[j] + a[i*4+1]*b[4+j] + a[i*4+2]*b[8+j] + a[i*4+3]*b[12+j];
    }
  }
  return out;
}

document.getElementById('enter').onclick = enterXR;
init();
