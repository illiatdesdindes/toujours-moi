import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { VIEWER_ENV, createAccessSigner } from './access-jwt.fixtures';
import { resolveViewerEmail } from './viewer-resolution';

const signer = await createAccessSigner();
const request = (jwt?: string) =>
	new Request('https://tjm.samyv.com/', {
		headers: jwt ? { 'Cf-Access-Jwt-Assertion': jwt } : {}
	});

describe('resolveViewerEmail', () => {
	beforeEach(() => {
		vi.stubGlobal(
			'fetch',
			vi.fn(async (url: string) => {
				expect(url).toBe(`${VIEWER_ENV.ACCESS_TEAM_DOMAIN}/cdn-cgi/access/certs`);
				return signer.certs();
			})
		);
	});
	afterEach(() => vi.unstubAllGlobals());

	it('reads the verified email, lowercased', async () => {
		const jwt = await signer.sign({ email: 'Papa@Exemple.fr' });
		expect(await resolveViewerEmail(request(jwt), VIEWER_ENV)).toBe('papa@exemple.fr');
	});

	it('rejects a request without a JWT', async () => {
		expect(await resolveViewerEmail(request(), VIEWER_ENV)).toBeNull();
	});

	it('rejects a JWT with the wrong audience, issuer, validity window, or no email', async () => {
		const email = 'papa@exemple.fr';
		for (const claims of [
			{ email, aud: ['other-aud'] },
			{ email, iss: 'https://evil.cloudflareaccess.com' },
			{ email, exp: Math.floor(Date.now() / 1000) - 10 },
			{ email, nbf: Math.floor(Date.now() / 1000) + 600 },
			{ aud: [VIEWER_ENV.ACCESS_AUD] } // service token: no email
		])
			expect(await resolveViewerEmail(request(await signer.sign(claims)), VIEWER_ENV)).toBeNull();
	});

	it('rejects a tampered or foreign-signed JWT', async () => {
		const jwt = await signer.sign({ email: 'lea@exemple.fr' });
		const [header, , signature] = jwt.split('.');
		const forged = btoa(JSON.stringify({ email: 'papa@exemple.fr', aud: ['test-aud'] }));
		expect(
			await resolveViewerEmail(request(`${header}.${forged}.${signature}`), VIEWER_ENV)
		).toBeNull();

		const stranger = await createAccessSigner((JSON.parse(atob(header!)) as { kid: string }).kid);
		const foreign = await stranger.sign({ email: 'papa@exemple.fr' });
		expect(await resolveViewerEmail(request(foreign), VIEWER_ENV)).toBeNull();
	});

	it('takes DEV_VIEWER_EMAIL in local dev, with no JWT', async () => {
		const devEnv = { ...VIEWER_ENV, DEV_VIEWER_EMAIL: 'Lea@exemple.fr' };
		expect(await resolveViewerEmail(request(), devEnv, { dev: true })).toBe('lea@exemple.fr');
		// Outside dev the variable is ignored, even if someone sets it.
		expect(await resolveViewerEmail(request(), devEnv)).toBeNull();
	});

	it('rejects garbage', async () => {
		expect(await resolveViewerEmail(request('not.a.jwt'), VIEWER_ENV)).toBeNull();
	});
});
