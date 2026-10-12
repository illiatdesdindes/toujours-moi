// Signed Access requests against the built Worker (integration tests).
import { createExecutionContext, waitOnExecutionContext } from 'cloudflare:test';
import { env } from 'cloudflare:workers';
import { vi } from 'vitest';
import worker from '../.svelte-kit/cloudflare/_worker.js';
import { createAccessSigner } from '../src/lib/server/access-jwt.fixtures';

const signer = await createAccessSigner();

/** Serves Access's certs endpoint to the Worker; undo with `vi.unstubAllGlobals()`. */
export const stubAccessCerts = () =>
	vi.stubGlobal(
		'fetch',
		vi.fn(async () => signer.certs())
	);

/** A `Cf-Access-Jwt-Assertion` header for `email`, as Access would send it to this Worker. */
export const accessHeaders = async (email: string) => ({
	'Cf-Access-Jwt-Assertion': await signer.sign({
		email,
		iss: env.ACCESS_TEAM_DOMAIN,
		aud: [env.ACCESS_AUD]
	})
});

export const fetchPage = async (path: string, headers: HeadersInit = {}) => {
	const ctx = createExecutionContext();
	const request = new Request(`http://example.com${path}`, {
		headers: { Accept: 'text/html', ...headers }
	});
	const res = await worker.fetch(request, env, ctx);
	await waitOnExecutionContext(ctx);
	return res;
};
