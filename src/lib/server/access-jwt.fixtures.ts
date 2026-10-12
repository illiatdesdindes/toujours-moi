// Test-only Cloudflare Access: a signing key, its certs endpoint and signed JWTs.

export const VIEWER_ENV = {
	ACCESS_TEAM_DOMAIN: 'https://tjm-test.cloudflareaccess.com',
	ACCESS_AUD: 'test-aud'
};

const b64url = (bytes: Uint8Array | string) =>
	btoa(typeof bytes === 'string' ? bytes : String.fromCharCode(...bytes))
		.replace(/\+/g, '-')
		.replace(/\//g, '_')
		.replace(/=+$/, '');

export const createAccessSigner = async (kid: string = crypto.randomUUID()) => {
	const alg = { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' };
	const pair = (await crypto.subtle.generateKey(
		{ ...alg, modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]) },
		true,
		['sign', 'verify']
	)) as CryptoKeyPair;
	const jwk = { ...(await crypto.subtle.exportKey('jwk', pair.publicKey)), kid };

	/** A Response like `<team>/cdn-cgi/access/certs`. */
	const certs = () => Response.json({ keys: [jwk] });

	const sign = async (claims: Record<string, unknown>) => {
		const now = Math.floor(Date.now() / 1000);
		const header = b64url(JSON.stringify({ alg: 'RS256', kid, typ: 'JWT' }));
		const payload = b64url(
			JSON.stringify({
				aud: [VIEWER_ENV.ACCESS_AUD],
				iss: VIEWER_ENV.ACCESS_TEAM_DOMAIN,
				iat: now,
				exp: now + 3600,
				...claims
			})
		);
		const signature = await crypto.subtle.sign(
			alg,
			pair.privateKey,
			new TextEncoder().encode(`${header}.${payload}`)
		);
		return `${header}.${payload}.${b64url(new Uint8Array(signature))}`;
	};

	return { certs, sign };
};
