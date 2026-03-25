// ============================================================
//  KairosScan — Service Worker v3
//  Network-first para index.html → siempre carga la versión nueva
// ============================================================

const CACHE_NAME = "kairosscan-v3";

const PRECACHE = [
  "https://unpkg.com/html5-qrcode@2.3.8/html5-qrcode.min.js",
  "https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js",
  "https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js",
  "https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js",
  "https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700;800&display=swap",
];

self.addEventListener("install", event => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache =>
      Promise.allSettled(
        PRECACHE.map(url =>
          cache.add(url).catch(() => console.warn("[SW] No se pudo cachear:", url))
        )
      )
    )
  );
});

self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys.filter(k => k !== CACHE_NAME).map(k => {
          console.log("[SW] Eliminando cache viejo:", k);
          return caches.delete(k);
        })
      ))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", event => {
  const url = event.request.url;
  const method = event.request.method;

  // POST siempre a la red
  if (method === "POST") {
    event.respondWith(
      fetch(event.request).catch(() =>
        new Response(
          JSON.stringify({ status: "error", message: "Sin conexion. Intenta de nuevo." }),
          { headers: { "Content-Type": "application/json" } }
        )
      )
    );
    return;
  }

  // GAS, QuickChart y Drive: siempre red
  if (url.includes("script.google.com") ||
      url.includes("quickchart.io") ||
      url.includes("drive.google.com")) {
    event.respondWith(
      fetch(event.request).catch(() =>
        new Response(
          JSON.stringify({ status: "error", message: "Sin conexion al servidor." }),
          { headers: { "Content-Type": "application/json" } }
        )
      )
    );
    return;
  }

  // index.html → Network-first: siempre busca la versión nueva en la red
  // Solo usa cache si no hay conexión
  if (event.request.destination === "document" ||
      url.endsWith("/") ||
      url.endsWith("/index.html") ||
      url.endsWith("asistencia-qr/")) {
    event.respondWith(
      fetch(event.request)
        .then(response => {
          // Actualizar el cache con la versión nueva
          const clone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
          return response;
        })
        .catch(() => {
          // Sin red: servir desde cache
          return caches.match(event.request) || caches.match("./index.html");
        })
    );
    return;
  }

  // Librerías y assets: cache-first (cambian poco)
  event.respondWith(
    caches.match(event.request).then(cached => {
      if (cached) return cached;
      return fetch(event.request).then(response => {
        if (response.status === 200 && !url.startsWith("chrome-extension")) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
        }
        return response;
      }).catch(() => caches.match("./index.html"));
    })
  );
});

self.addEventListener("message", event => {
  if (event.data && event.data.type === "SKIP_WAITING") {
    self.skipWaiting();
  }
});
