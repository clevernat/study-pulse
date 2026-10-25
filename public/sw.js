// StudyPulse service worker: makes the app open without internet and shows
// reminder notifications sent by the server (web push).
// Pages: network first, cached copy when offline. Build files (/_next/static,
// hashed names): cache first. Data offline is handled by Firestore (IndexedDB).
const CACHE = "studypulse-v2";
const PAGES = [
  "/", "/login/", "/dashboard/", "/today/", "/calendar/", "/tasks/", "/exams/", "/timetable/", "/habits/",
  "/flashcards/", "/flashcards/deck/", "/flashcards/review/", "/flashcards/stats/", "/flashcards/import/",
  "/timer/", "/subjects/", "/subjects/view/", "/sessions/", "/goals/", "/reports/", "/review/", "/settings/",
];
const FILES = ["/manifest.webmanifest", "/favicon.svg", "/icons/icon-192.png", "/sql-wasm.wasm"];

// Cache every page and the build files each page needs, so all pages work offline.
async function precache() {
  const cache = await caches.open(CACHE);
  await cache.addAll(FILES);
  const assets = new Set();
  await Promise.all(PAGES.map(async (url) => {
    try {
      const res = await fetch(url, { cache: "no-cache" });
      if (!res.ok) return;
      const html = await res.clone().text();
      await cache.put(url, res);
      for (const m of html.matchAll(/(?:src|href)="(\/_next\/static\/[^"]+)"/g)) assets.add(m[1]);
    } catch { /* offline during install: pages are cached when visited */ }
  }));
  await Promise.all([...assets].map((a) => cache.add(a).catch(() => undefined)));
}

self.addEventListener("install", (event) => {
  event.waitUntil(precache().then(() => self.skipWaiting()));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

function pageKey(url) {
  // /flashcards/review/?deck=x and /flashcards/review → "/flashcards/review/"
  const path = url.pathname.endsWith("/") ? url.pathname : url.pathname + "/";
  return PAGES.includes(path) ? path : "/today/";
}

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return; // Firebase, fonts: not ours

  if (req.mode === "navigate") {
    event.respondWith(
      fetch(req)
        .then((res) => {
          if (res.ok) caches.open(CACHE).then((c) => c.put(pageKey(url), res.clone()));
          return res;
        })
        .catch(async () => (await caches.match(pageKey(url))) || (await caches.match("/today/")) || Response.error())
    );
    return;
  }

  if (url.pathname.startsWith("/_next/static/") || FILES.includes(url.pathname) || url.pathname.startsWith("/icons/")) {
    event.respondWith(
      caches.match(req).then((hit) => hit || fetch(req).then((res) => {
        if (res.ok) { const copy = res.clone(); caches.open(CACHE).then((c) => c.put(req, copy)); }
        return res;
      }))
    );
  }
});

// ── Reminders (web push) ──────────────────────────────────────────────────────
// The server sends data-only messages: { title, body, url, tag }.
self.addEventListener("push", (event) => {
  let data = {};
  try { data = event.data ? event.data.json() : {}; } catch { data = { body: event.data && event.data.text() }; }
  const msg = data.data || data; // FCM wraps the data in "data"
  const title = msg.title || "StudyPulse";
  event.waitUntil(self.registration.showNotification(title, {
    body: msg.body || "",
    icon: "/icons/icon-192.png",
    badge: "/icons/icon-192.png",
    tag: msg.tag || undefined,
    data: { url: msg.url || "/today/" },
  }));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || "/today/";
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((wins) => {
      for (const w of wins) {
        if ("focus" in w) { w.navigate(url); return w.focus(); }
      }
      return self.clients.openWindow(url);
    })
  );
});
