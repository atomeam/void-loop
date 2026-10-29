// /lab/needs.js (tools/lab-import.mjs): a lab experiment that needs WebGPU or WebXR says so plainly when this browser has neither,
// instead of sitting blank. It only adds a note above the page; the experiment's own code is not touched.
(function () {
  var tag = document.currentScript, need = ((tag && tag.getAttribute('data-needs')) || '').split(' ');
  function note(text) {
    var d = document.createElement('div'); d.className = 'vl-note'; d.setAttribute('role', 'status');
    var b = document.createElement('button'); b.type = 'button'; b.textContent = 'Dismiss'; b.addEventListener('click', function () { d.remove(); });
    d.appendChild(b); d.appendChild(document.createTextNode(text)); document.body.appendChild(d);
  }
  function go() {
    var gone = [];
    if (need.indexOf('webgpu') >= 0 && !navigator.gpu) gone.push('WebGPU');
    if (need.indexOf('webxr') >= 0 && !navigator.xr) gone.push('WebXR');
    if (gone.length) return note('This experiment uses ' + gone.join(' and ') + ', which this browser does not offer, so part of it may stay blank or limited. A recent desktop Chrome or Edge' + (gone.indexOf('WebXR') >= 0 ? ' with a headset' : '') + ' runs it fully.');
    if (need.indexOf('webgpu') >= 0 && navigator.gpu.requestAdapter) navigator.gpu.requestAdapter().then(function (a) { if (!a) note('This browser has WebGPU but found no graphics adapter, so this experiment may stay blank or limited.'); }, function () {});
  }
  if (document.body) go(); else addEventListener('DOMContentLoaded', go);
})();
