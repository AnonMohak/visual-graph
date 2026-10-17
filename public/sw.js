// Offline support: the app shell is cached on install, built assets are
// cached the first time they load, and pages fall back to the cached shell.
const CACHE = 'graph-v1'
const scope = self.registration.scope
const SHELL = ['', 'index.html', 'manifest.webmanifest', 'logo.png', 'favicon.svg'].map((path) => new URL(path, scope).href)

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(SHELL)).then(() => self.skipWaiting()))
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key))))
      .then(() => self.clients.claim())
  )
})

self.addEventListener('fetch', (event) => {
  const request = event.request
  if (request.method !== 'GET' || !request.url.startsWith(scope)) return

  if (request.mode === 'navigate') {
    // Network first so updates arrive; the cached shell works offline.
    event.respondWith(
      fetch(request)
        .then((response) => {
          const copy = response.clone()
          caches.open(CACHE).then((cache) => cache.put(new URL('index.html', scope).href, copy))
          return response
        })
        .catch(() => caches.match(new URL('index.html', scope).href))
    )
    return
  }

  // Hashed build assets never change: cache first.
  event.respondWith(
    caches.match(request).then(
      (cached) =>
        cached ||
        fetch(request).then((response) => {
          if (response.ok) {
            const copy = response.clone()
            caches.open(CACHE).then((cache) => cache.put(request, copy))
          }
          return response
        })
    )
  )
})
