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
				// Per Viewer, per Cloudflare location, approximate: stops a looping client, not a precise quota.
				VIEWER_RATE_LIMIT: bindings.rateLimit({
					namespace: '1001',
					simple: { limit: 60, period: 60 }
				})
			}
		}
	};
});

// ponytail: the production database doesn't exist yet; #12 creates it and pastes its ID here.
function productionDatabaseId(): string {
	throw new Error('cloudflare.config.ts: no production D1 database yet (#12)');
}

// ponytail: the Access application doesn't exist yet; #12 creates it and pastes its AUD tag here.
function productionAccessAud(): string {
	throw new Error('cloudflare.config.ts: no production Access application yet (#12)');
}
