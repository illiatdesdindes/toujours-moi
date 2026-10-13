// The PWA (spec Q12): every page registers the service worker and carries the install screen, behind
// the CSS gate. Serving /service-worker.js is Cloudflare's asset layer (unbound here) and the bypass
// Access app (#12).
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { resetFamily, seedAdmin } from './test-family';
import { accessHeaders, fetchPage, stubOutboundFetch } from './worker-requests';

describe('PWA install', () => {
	let headers: Record<string, string>;
	beforeAll(async () => {
		await resetFamily();
		await seedAdmin();
		headers = await accessHeaders('papa@exemple.fr');
	});
	beforeEach(stubOutboundFetch);
	afterEach(() => vi.unstubAllGlobals());

	it.each(['/', '/historique', '/rapports', '/reglages'])(
		'%s registers the service worker and has the install screen, the app behind the same gate',
		async (path) => {
			const html = await (await fetchPage(path, headers)).text();
			expect(html).toContain('Installe <b>Toujours Moi!</b>');
			expect(html).toContain('noter tes tâches ménagères en deux clics');
			expect(html).toMatch(/Installer l(&#39;|')application/);
			expect(html).toContain('navigator.serviceWorker.register');
			// Shown and hidden by the one `install-gate` media query (layout.css).
			expect(html).toMatch(/class="hidden[^"]*install-gate:flex/);
			expect(html).toMatch(/class="[^"]*install-gate:hidden/);
		}
	);
});
