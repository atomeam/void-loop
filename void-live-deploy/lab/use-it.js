// /lab/use-it.js (tools/lab-use-it.mjs writes the link it reads): an experiment page opens the tool its idea became.
// The bar's "Use it" link opens the tool over the demo; on the first visit of a session it opens by itself, so the address does a real job.
// "Watch the experiment" closes it and the demo stays as it was. Nothing is sent anywhere.
(() => {
  const a = document.querySelector('.vl-bar a.vl-use'); if (!a || !window.HTMLDialogElement) return;
  const href = a.getAttribute('href'), name = a.dataset.tool || 'the tool', key = 'a2m.lab.use.' + href;
  let d = null;
  const build = () => {
    d = document.createElement('dialog'); d.className = 'vl-use-box'; d.setAttribute('aria-label', name);
    const css = document.createElement('style');
    css.textContent = '.vl-use-box{width:min(960px,96vw);height:min(760px,92vh);padding:0;border:1px solid rgba(255,255,255,.2);border-radius:14px;background:#0b0a12;color:#ecebf5;font:14px/1.4 system-ui,-apple-system,sans-serif;overflow:hidden}'
      + '.vl-use-box::backdrop{background:rgba(0,0,0,.6)}.vl-use-box header{display:flex;flex-wrap:wrap;gap:8px 14px;align-items:center;padding:8px 12px;border-bottom:1px solid rgba(255,255,255,.14)}'
      + '.vl-use-box h2{font-size:15px;margin:0 auto 0 0}.vl-use-box a,.vl-use-box button{color:inherit;font:inherit;min-height:32px}.vl-use-box button{background:#2a2540;border:1px solid rgba(255,255,255,.25);border-radius:8px;padding:4px 12px;cursor:pointer}'
      + '.vl-use-box iframe{display:block;width:100%;height:calc(100% - 50px);border:0;background:#fff}';
    const head = document.createElement('header'), h = document.createElement('h2'), open = document.createElement('a'), shut = document.createElement('button');
    h.textContent = name; open.href = href; open.textContent = 'Open it on its own page'; shut.type = 'button'; shut.textContent = 'Watch the experiment';
    shut.addEventListener('click', () => d.close());
    const f = document.createElement('iframe'); f.title = name; f.src = href; f.allow = 'microphone; accelerometer; gyroscope; magnetometer; clipboard-write';
    head.append(h, open, shut); d.append(css, head, f); document.body.append(d);
    d.addEventListener('close', () => { try { sessionStorage.setItem(key, 'seen'); } catch (_) {} a.focus(); });
  };
  const show = () => { if (!d) build(); if (!d.open) d.showModal(); };
  a.addEventListener('click', (ev) => { if (ev.metaKey || ev.ctrlKey || ev.shiftKey || ev.button) return; ev.preventDefault(); show(); });
  let seen = false; try { seen = sessionStorage.getItem(key) === 'seen'; } catch (_) {}
  if (!seen && !navigator.webdriver) show();
})();
