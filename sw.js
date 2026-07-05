/* Service worker de Vela — cachea la app para uso sin conexión.
   Solo tiene efecto cuando la app se sirve por http/https (p. ej. GitHub Pages),
   no al abrir el archivo local. */
const CACHE = "vela-v2";
const ASSETS = [
  ".",
  "index.html",
  "manifest.webmanifest",
  "icon-192.png",
  "icon-512.png"
];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(ASSETS)));
  self.skipWaiting();
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys().then((claves) =>
      Promise.all(claves.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", (e) => {
  // Estrategia: cache primero, con respaldo a la red (la app funciona offline).
  e.respondWith(
    caches.match(e.request).then((r) => r || fetch(e.request))
  );
});
