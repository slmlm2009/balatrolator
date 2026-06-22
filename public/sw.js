/*
 * Balatrolator service worker.
 *
 * Strategy:
 *   - Navigations (the app HTML): network-first, so the latest deployed
 *     `index.html` is always used when online; falls back to cache offline.
 *   - Everything else (assets/ sprites + reference JSON): stale-while-revalidate,
 *     so they load instantly and keep working offline once seen, while still
 *     refreshing in the background.
 *
 * Bump CACHE_VERSION to force every client to drop old cached assets on the
 * next visit (e.g. after replacing sprite art). Navigations stay fresh without
 * a bump because they are network-first.
 */
const CACHE_VERSION = 'v1'
const CACHE = `balatrolator-${CACHE_VERSION}`

const APP_SHELL = [
	'./',
	'./index.html',
	'./manifest.webmanifest',
	'./icon-512.png',
	'./icon-maskable-512.png',
	'./favicon.ico',
	'./icon.svg',
]

self.addEventListener('install', (event) => {
	self.skipWaiting()
	event.waitUntil(
		caches.open(CACHE).then((cache) => cache.addAll(APP_SHELL).catch(() => {})),
	)
})

self.addEventListener('activate', (event) => {
	event.waitUntil(
		caches.keys()
			.then((keys) => Promise.all(
				keys
					.filter((key) => key.startsWith('balatrolator-') && key !== CACHE)
					.map((key) => caches.delete(key)),
			))
			.then(() => self.clients.claim()),
	)
})

self.addEventListener('fetch', (event) => {
	const request = event.request
	if (request.method !== 'GET') return

	const url = new URL(request.url)
	if (url.origin !== self.location.origin) return

	// Network-first for page navigations: always prefer the freshly deployed app.
	if (request.mode === 'navigate') {
		event.respondWith(
			fetch(request)
				.then((response) => {
					const copy = response.clone()
					caches.open(CACHE).then((cache) => cache.put('./index.html', copy)).catch(() => {})
					return response
				})
				.catch(() => caches.match('./index.html').then((cached) => cached || caches.match('./'))),
		)
		return
	}

	// Stale-while-revalidate for assets (sprites, reference JSON, icons).
	event.respondWith(
		caches.open(CACHE).then((cache) =>
			cache.match(request).then((cached) => {
				const networked = fetch(request)
					.then((response) => {
						if (response && response.status === 200 && response.type === 'basic') {
							cache.put(request, response.clone())
						}
						return response
					})
					.catch(() => cached)
				return cached || networked
			}),
		),
	)
})
