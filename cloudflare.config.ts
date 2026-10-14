import { bindings, defineConfig } from 'cf/config';

// Every command names its mode (`cf --mode`, `wrangler --env`, Vite's mode): only `production`
// reaches the real database, and a forgotten mode fails instead of defaulting to it.
const MODES = ['development', 'test', 'production'];

export default defineConfig(({ mode }) => {
	if (!mode || !MODES.includes(mode))
		throw new Error(`cloudflare.config.ts: mode must be one of ${MODES.join(', ')}; got ${mode}`);
	return {
		worker: {
			name: 'tjm',
			compatibilityDate: '2026-09-23',
			compatibilityFlags: ['nodejs_compat'],
			// The adapter output, no wrapper Worker (spec Q20 point 2). `npm run build` first.
			entrypoint: '.svelte-kit/cloudflare/_worker.js',
			workersDev: false,
			previewUrls: false,
			observability: {
				logs: { enabled: true },
				traces: { enabled: true }
			},
			domains: ['tjm.samyv.com'],
			// Bill guards: a runaway loop dies here instead of eating the plan (defaults: 30 s CPU, 10,000 subrequests).
			limits: { cpuMs: 5_000, subrequests: 500 },
			env: {
				// Cloudflare Access (spec Q1). Not secrets: AUD is the Access app's "Application Audience (AUD) Tag".
				ACCESS_TEAM_DOMAIN: bindings.text('https://illiatdesdindes.cloudflareaccess.com'),
				ACCESS_AUD: bindings.text(mode === 'production' ? productionAccessAud() : 'local-aud'),
				// development/test: a local-only database, so `npm run db:migrate:local` never names production.
				DB:
					mode === 'production'
						? bindings.d1({ name: 'tjm-production', id: productionDatabaseId() })
						: bindings.d1({ name: 'tjm-local', id: '00000000-0000-4000-8000-000000000000' }),
				ASSETS: bindings.assets(),
				// Web Push VAPID key pair, base64url: raw P-256 public key and private `d` (spec Q20 point 3).
				// Local: `.dev.vars`; tests: vite.config.ts; production: secrets set by #12.
				VAPID_PUBLIC_KEY: bindings.secret(),
				VAPID_PRIVATE_KEY: bindings.secret(),
				// Declaring any secret makes `vite dev` load only the declared ones from `.dev.vars`, so the
				// local viewer and install screen switch (hooks.server.ts) are declared too, in development only.
				...(mode === 'development' && {
					DEV_VIEWER_EMAIL: bindings.secret(),
					DEV_SKIP_INSTALL_SCREEN: bindings.secret()
				}),
				// Per Viewer, per Cloudflare location, approximate: stops a looping client, not a precise quota.
				// Namespace 1002: notakid (same account) has 1001, and a shared namespace would share the counter.
				VIEWER_RATE_LIMIT: bindings.rateLimit({
					namespace: '1002',
					simple: { limit: 60, period: 60 }
				})
			}
		}
	};
});

// The same ID as the repo variable D1_PRODUCTION_ID (ci.yml).
function productionDatabaseId(): string {
	return '8b6993aa-3a3f-4852-82f4-9b199e2f48e0';
}

// The "Application Audience (AUD) Tag" of the `tjm` Access application (not its ID from the dashboard URL).
function productionAccessAud(): string {
	return '31ec84d8d025c7cac2ab9a34ccd9b29d2dbca34d8a6bb709c00416291be24051';
}
