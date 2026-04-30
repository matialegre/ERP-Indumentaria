// ═══════════════════════════════════════════════════════════════════════════
// Service Worker — ERP Sistema (PWA offline-first, pro-level)
// ═══════════════════════════════════════════════════════════════════════════

const CACHE_NAME = "mo-erp-v16";
const API_CACHE_NAME = "mo-erp-api-v3";
const VALID_CACHES = new Set([CACHE_NAME, API_CACHE_NAME]);

// Tiempo máximo de vida para entradas de API cache (24 horas en ms)
const API_CACHE_MAX_AGE = 24 * 60 * 60 * 1000;

// Timeout de red para API requests (ms) — rápido para fallback offline
const API_NETWORK_TIMEOUT = 3000;

// Assets estáticos base del app shell
const SHELL_URLS = [
  "/",
  "/manifest.json",
  "/icons/icon-192.png",
  "/icons/icon-512.png",
];

// API endpoints cacheables (GET only, stale-while-revalidate)
const CACHEABLE_API_PATTERNS = [
  /\/api\/v1\/products\//,
  /\/api\/v1\/stock(\?|$)/,
  /\/api\/v1\/providers\//,
  /\/api\/v1\/locals\//,
  /\/api\/v1\/purchase-orders(\?|$\/)/,
  /\/api\/v1\/purchase-invoices(\?|$)/,
  /\/api\/v1\/ingresos(\?|$)/,
  /\/api\/v1\/system\/sidebar-counts/,
  /\/api\/v1\/sales\//,
  /\/api\/v1\/modules\//,
];

// ─── Helpers ────────────────────────────────────────────────────────────────

/**
 * Parsea el HTML del index y extrae URLs de assets (scripts y stylesheets).
 * Busca <script src="..."> y <link rel="stylesheet" href="...">.
 */
function extractAssetUrlsFromHtml(html, baseUrl) {
  const urls = new Set();
  // Extraer <script src="...">
  const scriptRegex = /<script[^>]+src=["']([^"']+)["']/gi;
  let match;
  while ((match = scriptRegex.exec(html)) !== null) {
    urls.add(new URL(match[1], baseUrl).href);
  }
  // Extraer <link rel="stylesheet" href="...">
  const linkRegex = /<link[^>]+href=["']([^"']+)["'][^>]*>/gi;
  while ((match = linkRegex.exec(html)) !== null) {
    // Solo stylesheets y modulepreload
    if (/rel=["'](stylesheet|modulepreload)["']/i.test(match[0])) {
      urls.add(new URL(match[1], baseUrl).href);
    }
  }
  return [...urls];
}

/**
 * Limpia entradas viejas del API cache (mayores a API_CACHE_MAX_AGE).
 */
async function purgeStaleApiEntries() {
  try {
    const cache = await caches.open(API_CACHE_NAME);
    const requests = await cache.keys();
    const now = Date.now();

    await Promise.all(
      requests.map(async (request) => {
        const response = await cache.match(request);
        if (!response) return;
        const dateHeader = response.headers.get("date");
        if (dateHeader) {
          const age = now - new Date(dateHeader).getTime();
          if (age > API_CACHE_MAX_AGE) {
            await cache.delete(request);
          }
        }
      })
    );
  } catch (_) {
    // Si falla la limpieza, no bloquear activación
  }
}

// ─── Install ────────────────────────────────────────────────────────────────
// Pre-cachea el shell + descubre y cachea todos los chunks de assets dinámicamente
self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE_NAME);

      // 1. Pre-cachear shell base
      await cache.addAll(SHELL_URLS);

      // 2. Descubrir assets dinámicos parseando el index.html
      try {
        const indexResponse = await fetch("/");
        if (indexResponse.ok) {
          const html = await indexResponse.text();
          const assetUrls = extractAssetUrlsFromHtml(html, self.location.origin);

          if (assetUrls.length > 0) {
            // Cachear cada asset individualmente para no fallar todo si uno falla
            await Promise.allSettled(
              assetUrls.map(async (url) => {
                try {
                  const resp = await fetch(url);
                  if (resp.ok) {
                    await cache.put(url, resp);
                  }
                } catch (_) {
                  // Asset individual falló, no bloquear install
                }
              })
            );
          }

          // Guardar el index.html parseado en cache (fresco)
          await cache.put("/", new Response(html, {
            headers: { "Content-Type": "text/html; charset=utf-8" },
          }));
        }
      } catch (_) {
        // Si falla descubrimiento de assets, al menos el shell base ya está cacheado
      }
    })()
  );
  self.skipWaiting();
});

// ─── Activate ───────────────────────────────────────────────────────────────
// Purga caches viejos + limpia entradas API expiradas
self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      // 1. Eliminar TODOS los caches que no coincidan con los nombres actuales
      const keys = await caches.keys();
      await Promise.all(
        keys
          .filter((key) => !VALID_CACHES.has(key))
          .map((key) => caches.delete(key))
      );

      // 2. Limpiar entradas de API cache mayores a 24 horas
      await purgeStaleApiEntries();

      // 3. Tomar control inmediato de todos los clientes
      await self.clients.claim();
    })()
  );
});

// ─── Fetch ──────────────────────────────────────────────────────────────────
self.addEventListener("fetch", (event) => {
  // Solo manejar http/https — ignorar chrome-extension:// y otros esquemas
  if (!event.request.url.startsWith("http")) return;

  // Solo cachear GET
  if (event.request.method !== "GET") return;

  const url = new URL(event.request.url);

  // ── 1. API GET: stale-while-revalidate para endpoints cacheables ──
  if (url.pathname.startsWith("/api/")) {
    const isCacheable = CACHEABLE_API_PATTERNS.some((p) => p.test(event.request.url));
    if (!isCacheable) return;

    event.respondWith(
      caches.open(API_CACHE_NAME).then(async (cache) => {
        try {
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), API_NETWORK_TIMEOUT);
          const networkResponse = await fetch(event.request, { signal: controller.signal });
          clearTimeout(timeoutId);

          if (networkResponse.ok) {
            cache.put(event.request, networkResponse.clone());
          }
          return networkResponse;
        } catch (_) {
          // Red falló o timeout → devolver versión cacheada
          const cached = await cache.match(event.request);
          if (cached) return cached;
          return new Response(
            JSON.stringify({ detail: "Sin conexión y sin datos en caché" }),
            { status: 503, headers: { "Content-Type": "application/json" } }
          );
        }
      })
    );
    return;
  }

  // ── 2. Navegación (SPA): network-first con fallback a cache (offline) ──
  if (event.request.mode === "navigate") {
    event.respondWith(
      (async () => {
        const cache = await caches.open(CACHE_NAME);
        try {
          // Siempre intentar red primero → versión fresca
          const networkResponse = await fetch(event.request);
          if (networkResponse.ok) {
            cache.put("/", networkResponse.clone());
          }
          return networkResponse;
        } catch (_) {
          // Sin red → fallback a cache (offline)
          const cachedIndex = await cache.match("/");
          if (cachedIndex) return cachedIndex;
          return new Response("Offline — sin caché disponible", {
            status: 503,
            headers: { "Content-Type": "text/plain; charset=utf-8" },
          });
        }
      })()
    );
    return;
  }

  // ── 3. Assets estáticos (/assets/*): network-first con fallback a cache ──
  // NOTA: los chunks tienen nombres estables (sin hash) — network-first garantiza
  // que siempre se cargue la versión más reciente cuando hay conexión.
  if (url.pathname.startsWith("/assets/")) {
    event.respondWith(
      (async () => {
        const cache = await caches.open(CACHE_NAME);
        try {
          // Red primero → siempre fresco si hay conexión
          const networkResponse = await fetch(event.request);
          if (networkResponse.ok) {
            cache.put(event.request, networkResponse.clone());
          }
          return networkResponse;
        } catch (_) {
          // Sin red → fallback a cache (offline)
          const cached = await cache.match(event.request);
          if (cached) return cached;
          return new Response("Asset no disponible offline", {
            status: 503,
            headers: { "Content-Type": "text/plain" },
          });
        }
      })()
    );
    return;
  }

  // ── 4. Otros recursos (manifest, íconos, etc.): network-first con fallback a cache ──
  event.respondWith(
    fetch(event.request)
      .then((response) => {
        if (response.ok) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
        }
        return response;
      })
      .catch(() =>
        caches.match(event.request).then(
          (cached) => cached || null
        )
      )
  );
});

// ─── Background Sync ────────────────────────────────────────────────────────
// Reenviar operaciones pendientes cuando vuelve internet
self.addEventListener("sync", (event) => {
  if (event.tag === "flush-pending-ops") {
    event.waitUntil(
      self.clients.matchAll().then((clients) => {
        clients.forEach((client) => {
          client.postMessage({ type: "FLUSH_PENDING_OPS" });
        });
      })
    );
  }
});

// ─── Messages ───────────────────────────────────────────────────────────────
self.addEventListener("message", (event) => {
  if (event.data?.type === "SKIP_WAITING") {
    self.skipWaiting();
  }
});

