// The app's service worker (spec Q12), built and registered by SvelteKit: the app shell, the last
// copy of each page so the home opens offline (its chore outbox, spec Q20 point 1), and the Web Push
// notifications (spec Q11). Copied from notakid; caching after https://svelte.dev/docs/kit/service-workers.
import { self } from '$app/service-worker';
import { version } from '$app/env';
import { immutable, assets } from '$app/manifest';
import type { PushNotificationPayload } from '#lib/domain.js';

/** App shell: the built JS/CSS and static/ (not .assetsignore, never served), one cache per deploy. */
const SHELL_CACHE_NAME = `shell-${version}`;
const SHELL_FILES = new Set(
	[...immutable, ...assets.filter((f) => !f.path.startsWith('.'))].map(
		(f) => new URL(f.path, self.registration.scope).pathname
	)
);
/** The last copy of each page and its data seen; kept across deploys. */
const PAGES_CACHE_NAME = 'pages';

self.addEventListener('install', (event) => {
	event.waitUntil(caches.open(SHELL_CACHE_NAME).then((cache) => cache.addAll([...SHELL_FILES])));
});

self.addEventListener('activate', (event) => {
	event.waitUntil(
		caches
			.keys()
			.then((keys) =>
				Promise.all(
					keys
						.filter((k) => k !== SHELL_CACHE_NAME && k !== PAGES_CACHE_NAME)
						.map((k) => caches.delete(k))
				)
			)
	);
});

self.addEventListener('fetch', (event) => {
	const { request } = event;
	const url = new URL(request.url);
	// /cdn-cgi/: Access's login lands there and sets its cookie; always the network.
	if (request.method !== 'GET' || url.origin !== self.location.origin) return;
	if (url.pathname.startsWith('/cdn-cgi/')) return;
	if (SHELL_FILES.has(url.pathname)) {
		event.respondWith(
			caches
				.open(SHELL_CACHE_NAME)
				.then(async (cache) => (await cache.match(url.pathname)) ?? fetch(request))
		);
		return;
	}
	if (request.mode !== 'navigate' && !url.pathname.endsWith('/__data.json')) return;
	// Network first, else the last copy (offline). Only 200s are cached, so an Access login
	// redirect never replaces a page.
	event.respondWith(
		(async () => {
			const cache = await caches.open(PAGES_CACHE_NAME);
			try {
				const response = await fetch(request);
				if (response.status === 200) await cache.put(request, response.clone());
				return response;
			} catch (error) {
				const cached = await cache.match(request);
				if (cached) return cached;
				throw error;
			}
		})()
	);
});

self.addEventListener('push', (event) => {
	const notification = event.data?.json() as PushNotificationPayload | undefined;
	if (!notification) return;
	event.waitUntil(
		self.registration.showNotification(notification.title, {
			body: notification.body,
			tag: notification.tag,
			// A repush with the same tag (same performer) buzzes again instead of updating silently.
			renotify: true,
			data: notification,
			icon: '/icon-192.png',
			// Android's status bar: the monochrome broom (design/logo/tjm-notification-badge.svg).
			badge: '/icon-badge-96.png'
		} as NotificationOptions)
	);
});

// Opens Historique on the performer's profile, in the app's window if one is open.
self.addEventListener('notificationclick', (event) => {
	event.notification.close();
	const { url } = event.notification.data as PushNotificationPayload;
	event.waitUntil(
		(async () => {
			const [client] = await self.clients.matchAll({ type: 'window' });
			if (!client) return void (await self.clients.openWindow(url));
			await client.focus();
			await client.navigate(url);
		})()
	);
});
