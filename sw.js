// ============================================================
//  KairosScan — Service Worker v2
//  Compatible con módulo de Asistencia + Notas/Calificaciones
// ============================================================

const CACHE_NAME = "kairosscan-v2";

const PRECACHE = [
  "./index.html",
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
          cache.add(url).catch(e => console.warn("[SW] No se pudo cachear:", url))
        )
      )
    )
  );
});

self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))
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

  // Cache-first para todo lo demas
  event.respondWith(
    caches.match(event.request).then(cached => {
      if (cached) return cached;
      return fetch(event.request).then(response => {
        if (event.request.method === "GET" &&
            response.status === 200 &&
            !url.startsWith("chrome-extension")) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
        }
        return response;
      }).catch(() => {
        if (event.request.destination === "document") {
          return caches.match("./index.html");
        }
      });
    })
  );
});

self.addEventListener("message", event => {
  if (event.data && event.data.type === "SKIP_WAITING") {
    self.skipWaiting();
  }
});
