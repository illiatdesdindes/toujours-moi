// The one place that knows Viewers come from Cloudflare Access (spec Q1, Q20 point 4; copied from
// notakid's viewer-resolution.ts): Access JWT → email → active `users` row.
import { uuidV7 } from '../uuid';
import { saveWithVersion } from './record-versions';
import { findActiveUserByEmail } from './users';

type ViewerEnv = { ACCESS_TEAM_DOMAIN: string; ACCESS_AUD: string; DEV_VIEWER_EMAIL?: string };

/**
 * The verified, lowercased email behind a request, from its signed `Cf-Access-Jwt-Assertion`;
 * null if it doesn't verify. `useDevViewerEmail`: local dev has no Access in front, so the JWT is
 * skipped and `DEV_VIEWER_EMAIL` is the Viewer (any seeded user, to try the 3 roles).
 */
export const resolveViewerEmail = async (
	request: Request,
	env: ViewerEnv,
	{ useDevViewerEmail = false } = {}
): Promise<string | null> => {
	const jwt = request.headers.get('Cf-Access-Jwt-Assertion');
	const email = useDevViewerEmail
		? env.DEV_VIEWER_EMAIL
		: jwt && (await verifyAccessJwt(jwt, env).catch(() => null));
	return email ? email.toLowerCase() : null;
};

/**
 * The active `users` row for a verified email; null for an unknown or deactivated one.
 * Bootstrap (spec Q1): while `users` is empty, the first verified login becomes admin. Safe because
 * the Access policy starts out listing only the admin's email.
 */
export const findOrBootstrapViewer = async (db: D1Database, email: string) => {
	const viewer = await findActiveUserByEmail(db, email);
	if (viewer) return viewer;
	const anyUser = await db.prepare('SELECT 1 FROM users LIMIT 1').first();
	if (anyUser) return null;
	const adminId = uuidV7();
	// ponytail: a concurrent first login of the same email loses on UNIQUE(email) and writes nothing.
	await saveWithVersion(
		db,
		'users',
		adminId,
		{ email, name: email.split('@')[0]!, role: 'admin', colour_key: 'tomato' },
		adminId
	);
	return findActiveUserByEmail(db, email);
};

type AccessClaims = {
	aud?: string | string[];
	iss?: string;
	exp?: number;
	nbf?: number;
	email?: string;
};

const verifyAccessJwt = async (jwt: string, env: ViewerEnv) => {
	const [header, payload, signature] = jwt.split('.');
	if (!header || !payload || !signature) return null;
	const { alg, kid } = JSON.parse(fromBase64url(header)) as { alg?: string; kid?: string };
	if (alg !== 'RS256' || !kid) return null;
	const key = await signingKey(env.ACCESS_TEAM_DOMAIN, kid);
	const valid =
		key &&
		(await crypto.subtle.verify(
			RS256,
			key,
			Uint8Array.from(fromBase64url(signature), (c) => c.charCodeAt(0)),
			new TextEncoder().encode(`${header}.${payload}`)
		));
	if (!valid) return null;

	const claims = JSON.parse(fromBase64url(payload)) as AccessClaims;
	const now = Date.now() / 1000;
	const audiences = [claims.aud].flat();
	if (!audiences.includes(env.ACCESS_AUD) || claims.iss !== env.ACCESS_TEAM_DOMAIN) return null;
	if (!claims.exp || claims.exp < now || (claims.nbf && claims.nbf > now)) return null;
	return claims.email ?? null;
};

const RS256 = { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' };

// ponytail: per-isolate cache, refetched on an unknown kid (Access rotates keys every ~6 weeks).
let certs: (JsonWebKey & { kid?: string })[] = [];
const signingKey = async (teamDomain: string, kid: string) => {
	let jwk = certs.find((k) => k.kid === kid);
	if (!jwk) {
		const res = await fetch(`${teamDomain}/cdn-cgi/access/certs`);
		certs = ((await res.json()) as { keys: typeof certs }).keys;
		jwk = certs.find((k) => k.kid === kid);
	}
	return jwk && crypto.subtle.importKey('jwk', jwk, RS256, false, ['verify']);
};

const fromBase64url = (text: string) => atob(text.replace(/-/g, '+').replace(/_/g, '/'));
