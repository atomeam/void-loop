/* A-to-Mind draft service worker — run 021.
   Allowlisted GET only. No push. No sync. Not scoped to / unless a human seals it. */
const CACHE_NAME = "a2m-pwa-021-v1";
const ALLOWLIST = [
  "./proposed-pwa.html",
  "./offline.html",
  "./manifest.webmanifest",
  "./claims.json",
  "./catalog.json",
  "./icons/icon.svg",
  "./icons/icon-192.png",
  "./icons/icon-512.png"
];
const CACHE_FIRST = new Set(["./offline.html", "./icons/icon.svg", "./icons/icon-192.png", "./icons/icon-512.png"]);

function resolveAllowed(requestUrl) {
  const req = new URL(requestUrl);
  if (req.origin !== self.location.origin) return null;
  for (const rel of ALLOWLIST) {
    const allowed = new URL(rel, self.location.href);
    if (req.pathname === allowed.pathname) return rel;
  }
  return null;
}

self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE_NAME);
      for (const rel of ALLOWLIST) {
        try {
          const res = await fetch(rel, { cache: "no-store" });
          if (res.ok) await cache.put(rel, res);
        } catch (_err) {
          /* optional icons may be absent until make-icons.py runs */
        }
      }
    })()
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)));
    })()
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;

  const rel = resolveAllowed(req.url);
  const dest = req.mode === "navigate";

  event.respondWith(
    (async () => {
      if (!rel) {
        try {
          return await fetch(req);
        } catch (_err) {
          if (dest) {
            const cache = await caches.open(CACHE_NAME);
            const fallback = await cache.match("./offline.html");
            if (fallback) return fallback;
          }
          return new Response("offline-unlisted", { status: 504, statusText: "offline-unlisted" });
        }
      }

      const cache = await caches.open(CACHE_NAME);
      if (CACHE_FIRST.has(rel)) {
        const hit = await cache.match(rel);
        if (hit) return hit;
      }

      try {
        const fresh = await fetch(req);
        if (fresh.ok) await cache.put(rel, fresh.clone());
        return fresh;
      } catch (_err) {
        const hit = await cache.match(rel);
        if (hit) return hit;
        if (dest) {
          const fallback = await cache.match("./offline.html");
          if (fallback) return fallback;
        }
        return new Response("offline-miss", { status: 504, statusText: "offline-miss" });
      }
    })()
  );
});

self.addEventListener("message", (event) => {
  const data = event.data || {};
  if (data.type === "ledger") {
    event.waitUntil(
      (async () => {
        const cache = await caches.open(CACHE_NAME);
        const keys = await cache.keys();
        const held = keys.map((r) => new URL(r.url).pathname);
        const port = event.ports && event.ports[0];
        if (port) port.postMessage({ cache: CACHE_NAME, allowlist: ALLOWLIST, held });
      })()
    );
  }
  if (data.type === "apply-update") {
    event.waitUntil(self.skipWaiting());
  }
});
