const CACHE_NAME = "ruta-clientes-v1.0";

// Instalación
self.addEventListener("install", event => {
  console.log("Service Worker: Instalado");
  self.skipWaiting();
});

// Activación
self.addEventListener("activate", event => {
  console.log("Service Worker: Activado");
  event.waitUntil(self.clients.claim());
});

// Fetch (sin cache aún)
self.addEventListener("fetch", event => {
  // Handler vacío válido para PWA
});
