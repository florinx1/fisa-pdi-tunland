/* Service worker — cache-ul aplicației pentru funcționare offline în atelier.
   La fiecare modificare a fișierelor, crește CACHE_VERSION ca telefoanele
   să preia versiunea nouă. */

const CACHE_VERSION = "icg-fisa-pdi-v1";
const CORE_FILES = [
  "./",
  "./index.html",
  "./style.css",
  "./data.js",
  "./fonts.js",
  "./app.js",
  "./app-form.js",
  "./app-signature.js",
  "./app-archive.js",
  "./app-pdf.js",
  "./app-sync.js",
  "./manifest.json",
  "./icons/icon-192.png",
  "./icons/icon-512.png",
  "https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_VERSION).then((cache) => cache.addAll(CORE_FILES))
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_VERSION).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// strategie: "network first, fallback la cache" pentru fișierele proprii,
// astfel încât actualizările să ajungă rapid când există semnal, dar
// aplicația să funcționeze integral și fără semnal (atelier).
self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;

  event.respondWith(
    fetch(event.request)
      .then((response) => {
        const copy = response.clone();
        caches.open(CACHE_VERSION).then((cache) => cache.put(event.request, copy));
        return response;
      })
      .catch(() => caches.match(event.request).then((cached) => cached || caches.match("./index.html")))
  );
});
