const CACHE_NAME = "philos-v1";
const ASSETS = ["./", "./index.html", "./icon.svg", "./icon-192.png", "./icon-512.png", "./apple-touch-icon.png"];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((c) => c.addAll(ASSETS)));
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== location.origin) return;

  if (req.mode === "navigate") {
    event.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE_NAME).then((c) => c.put("./index.html", copy));
          return res;
        })
        .catch(() => caches.match("./index.html"))
    );
    return;
  }

  event.respondWith(
    caches.match(req).then((cached) => {
      if (cached) return cached;
      return fetch(req).then((res) => {
        if (res.ok) {
          const copy = res.clone();
          caches.open(CACHE_NAME).then((c) => c.put(req, copy));
        }
        return res;
      });
    })
  );
});

self.addEventListener("push", (event) => {
  let body = "他给你发消息了";
  let msgId = null;
  try {
    if (event.data) {
      const raw = event.data.text();
      try {
        const parsed = JSON.parse(raw);
        if (parsed && parsed.text) body = String(parsed.text);
        if (parsed && parsed.id) msgId = String(parsed.id);
      } catch (e) {
        if (raw) body = raw;
      }
    }
  } catch (e) {}

  event.waitUntil((async () => {
    const clients = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
    const visible = clients.find((c) => c.visibilityState === "visible");
    if (visible) {
      visible.postMessage({ type: "push-msg", id: msgId, text: body });
      return;
    }
    return self.registration.showNotification("☆Philos", {
      body: body,
      icon: "icon-192.png",
      badge: "icon-192.png",
    });
  })());
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if ("focus" in client) return client.focus();
      }
      if (clients.openWindow) return clients.openWindow("./");
    })
  );
});
