(function () {
  const live = document.getElementById("live");
  let deferredPrompt = null;

  function setLive(state, text) {
    live.textContent = text;
    live.dataset.state = state;
  }

  async function sha256hex(text) {
    const bytes = new TextEncoder().encode(text);
    const buf = await crypto.subtle.digest("SHA-256", bytes);
    return Array.from(new Uint8Array(buf)).map(function (b) {
      return b.toString(16).padStart(2, "0");
    }).join("");
  }

  function isIos() {
    return /iPad|iPhone|iPod/.test(navigator.userAgent) ||
      (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  }

  function isStandalone() {
    return window.matchMedia("(display-mode: standalone)").matches ||
      window.matchMedia("(display-mode: minimal-ui)").matches ||
      navigator.standalone === true;
  }

  async function verifyClaims() {
    const articles = Array.from(document.querySelectorAll("article[data-canonical]"));
    const rows = Array.from(document.querySelectorAll("tr[data-canonical]"));
    if (!window.isSecureContext || !window.crypto || !crypto.subtle) {
      setLive("failed", "failed · crypto.subtle needs HTTPS or localhost");
      return;
    }
    const claimLines = articles.map(function (el) { return el.getAttribute("data-canonical") || ""; });
    for (const el of articles) {
      const status = el.querySelector(".verify");
      const got = await sha256hex(el.getAttribute("data-canonical") || "");
      const want = (el.getAttribute("data-hash") || "").toLowerCase();
      const ok = got === want;
      status.dataset.state = ok ? "match" : "mismatch";
      status.textContent = ok ? "match · " + got.slice(0, 12) + "…" : "mismatch";
    }
    for (const el of rows) {
      const status = el.querySelector(".verify");
      const got = await sha256hex(el.getAttribute("data-canonical") || "");
      const want = (el.getAttribute("data-hash") || "").toLowerCase();
      status.dataset.state = got === want ? "match" : "mismatch";
      status.textContent = got === want ? "match" : "mismatch";
    }
    const body = claimLines.join("\n") + "\n";
    const gotBody = await sha256hex(body);
    const published = (document.getElementById("published-body").textContent || "").trim();
    const bodyEl = document.getElementById("body-verify");
    const ok = gotBody === published;
    bodyEl.dataset.state = ok ? "match" : "mismatch";
    bodyEl.textContent = ok ? "body match · " + gotBody.slice(0, 12) + "…" : "body mismatch · " + gotBody.slice(0, 12) + "…";
    setLive(ok ? "match" : "mismatch", ok ? "match · claims hash" : "mismatch · claims");
  }

  function paintNetwork() {
    const online = navigator.onLine;
    document.getElementById("net-state").textContent = online ? "network: online (browser hint)" : "network: offline (browser hint)";
    document.getElementById("display-state").textContent = isStandalone()
      ? "display: standalone or minimal-ui"
      : "display: browser";
  }

  async function paintWorker() {
    const el = document.getElementById("sw-state");
    if (!("serviceWorker" in navigator)) {
      el.textContent = "worker: unsupported";
      return;
    }
    const reg = await navigator.serviceWorker.getRegistration("./");
    el.textContent = reg ? "worker: registered (draft scope)" : "worker: none";
    if (reg && reg.active) {
      const channel = new MessageChannel();
      channel.port1.onmessage = function (ev) {
        const held = (ev.data && ev.data.held) || [];
        document.querySelectorAll("tr[data-path]").forEach(function (row) {
          const path = row.getAttribute("data-path");
          const cell = row.querySelector("[data-held]");
          const hit = held.some(function (p) { return p.endsWith("/" + path) || p.endsWith(path); });
          cell.textContent = hit ? "held" : "absent";
        });
      };
      reg.active.postMessage({ type: "ledger" }, [channel.port2]);
    }
  }

  function wireInstall() {
    const btn = document.getElementById("btn-install");
    if (isStandalone()) {
      btn.disabled = true;
      btn.textContent = "Already installed";
      setLive("installed", "installed · display-mode is not browser");
      return;
    }
    if (isIos()) {
      document.getElementById("ios-steps").dataset.show = "true";
      btn.disabled = true;
      btn.textContent = "No Chromium prompt on iOS";
    }
    window.addEventListener("beforeinstallprompt", function (e) {
      e.preventDefault();
      deferredPrompt = e;
      btn.disabled = false;
      setLive("unattested", "unattested · beforeinstallprompt stored, not shown");
    });
    window.addEventListener("appinstalled", function () {
      deferredPrompt = null;
      btn.disabled = true;
      setLive("installed", "installed · appinstalled fired");
    });
  }

  document.getElementById("btn-install").addEventListener("click", async function () {
    if (!deferredPrompt) {
      setLive("denied", "denied · no beforeinstallprompt");
      return;
    }
    deferredPrompt.prompt();
    const choice = await deferredPrompt.userChoice;
    deferredPrompt = null;
    document.getElementById("btn-install").disabled = true;
    setLive(choice.outcome === "accepted" ? "installed" : "denied", "install " + choice.outcome);
  });

  document.getElementById("btn-register").addEventListener("click", async function () {
    if (!("serviceWorker" in navigator)) {
      setLive("failed", "failed · serviceWorker missing");
      return;
    }
    setLive("hold", "hold · registering draft-scoped worker");
    try {
      await navigator.serviceWorker.register("./sw.js", { scope: "./" });
      setLive("registered", "registered · scope is this draft directory");
      await paintWorker();
    } catch (err) {
      setLive("failed", "failed · " + (err && err.message ? err.message : "register"));
    }
  });

  document.getElementById("btn-apply").addEventListener("click", async function () {
    const reg = await navigator.serviceWorker.getRegistration("./");
    if (!reg || !reg.waiting) {
      if (reg && reg.active) reg.active.postMessage({ type: "apply-update" });
      setLive("hold", "hold · no waiting worker; skipWaiting messaged if active");
      return;
    }
    reg.waiting.postMessage({ type: "apply-update" });
    setLive("registered", "registered · apply-update sent");
  });

  document.getElementById("btn-unregister").addEventListener("click", async function () {
    const reg = await navigator.serviceWorker.getRegistration("./");
    if (reg) await reg.unregister();
    const keys = await caches.keys();
    await Promise.all(keys.filter(function (k) { return k.indexOf("a2m-pwa-021") === 0; }).map(function (k) { return caches.delete(k); }));
    setLive("unregistered", "unregistered · draft caches dropped");
    await paintWorker();
    document.querySelectorAll("[data-held]").forEach(function (el) { el.textContent = "absent"; });
  });

  document.getElementById("btn-push").addEventListener("click", function () {
    setLive("denied", "denied · push is not in this contract");
  });
  document.getElementById("btn-sync").addEventListener("click", function () {
    setLive("denied", "denied · background sync is not in this contract");
  });
  document.getElementById("btn-any").addEventListener("click", function () {
    setLive("denied", "denied · runtime cache-any is not in this contract");
  });

  window.addEventListener("online", paintNetwork);
  window.addEventListener("offline", paintNetwork);
  paintNetwork();
  wireInstall();
  verifyClaims();
  paintWorker();
})();
