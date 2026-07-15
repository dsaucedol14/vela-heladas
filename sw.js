/* Service worker de Vela — cachea la app para uso sin conexión.
   Solo tiene efecto cuando la app se sirve por http/https (p. ej. GitHub Pages),
   no al abrir el archivo local. */
const CACHE = "vela-v6";
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
  const url = new URL(e.request.url);

  // Datos del SMN: red primero (frescos), con cache como respaldo offline.
  if (url.pathname.endsWith("datos_smn.json")) {
    e.respondWith(
      fetch(e.request).then((r) => {
        const copia = r.clone();
        caches.open(CACHE).then((c) => c.put(e.request, copia));
        return r;
      }).catch(() => caches.match(e.request))
    );
    return;
  }

  // Resto de la app: cache primero (funciona offline).
  e.respondWith(
    caches.match(e.request).then((r) => r || fetch(e.request))
  );
});
