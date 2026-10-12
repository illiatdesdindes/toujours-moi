// Requests to the built Worker, signed as Cloudflare Access would (integration tests).
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

/** A JSON POST to the built Worker, as the page's own fetch would send it. */
export const postJson = async (path: string, body: unknown, headers: HeadersInit = {}) => {
	const ctx = createExecutionContext();
	const request = new Request(`http://example.com${path}`, {
		method: 'POST',
		headers: { 'Content-Type': 'application/json', Origin: 'http://example.com', ...headers },
		body: JSON.stringify(body)
	});
	const res = await worker.fetch(request, env, ctx);
	await waitOnExecutionContext(ctx);
	return res;
};
