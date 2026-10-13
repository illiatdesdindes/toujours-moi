import { defineConfig } from 'vitest/config';
import tailwindcss from '@tailwindcss/vite';
import adapter from '@sveltejs/adapter-cloudflare';
import { sveltekit } from '@sveltejs/kit/vite';
import { cloudflareTest, readD1Migrations } from '@cloudflare/vitest-plugin';
import { convertToWranglerConfig, loadAndParseConfig } from '@cloudflare/config';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

// `vite dev` bindings: SvelteKit's platform proxy only reads Wrangler config, so convert
// cloudflare.config.ts (notakid docs/spikes/cf-config-local-dev.md). Not at the repo root: the
// adapter's build would pick it up.
const devConfigPath = '.wrangler/dev/wrangler.json';
const { result } = await loadAndParseConfig('cloudflare.config.ts', {
	isPreview: false,
	mode: 'development'
});
if (!result.success) throw result.error;
mkdirSync('.wrangler/dev', { recursive: true });
writeFileSync(devConfigPath, JSON.stringify(convertToWranglerConfig(result.data)));

export default defineConfig({
	plugins: [
		tailwindcss(),
		sveltekit({
			compilerOptions: {
				// Force runes mode for the project, except for libraries. Can be removed in svelte 6.
				runes: ({ filename }) =>
					filename.split(/[/\\]/).includes('node_modules') ? undefined : true
			},
			adapter: adapter({
				platformProxy: {
					configPath: devConfigPath,
					persist: { path: '.wrangler/state/v3' }, // where `npm run db:migrate:local` writes
					envFiles: [resolve('.dev.vars')] // default: next to the generated config
				}
			})
		})
	],
	test: {
		expect: { requireAssertions: true },
		passWithNoTests: true,
		projects: [
			{
				extends: './vite.config.ts',
				test: {
					name: 'unit',
					environment: 'node',
					// Workers run in UTC; so do unit tests.
					env: { TZ: 'UTC' },
					include: ['src/**/*.{test,spec}.{js,ts}'],
					exclude: ['src/**/*.svelte.{test,spec}.{js,ts}']
				}
			},
			{
				// Runs against the built Worker: `npm run build` first.
				plugins: [
					cloudflareTest({
						main: './.svelte-kit/cloudflare/_worker.js',
						experimental: { newConfig: { configPath: './cloudflare.config.ts' } },
						miniflare: {
							bindings: {
								TEST_MIGRATIONS: await readD1Migrations('./migrations'),
								// Test-only VAPID key pair (notakid's).
								VAPID_PUBLIC_KEY:
									'BNeOCsvzD9HMwZnzqX9ZL-sVV4ElYUIAytifJd_YjNJcZMuBvZ8OJ5mC5uiG4hS719BhUW1C3AR-L_RvfyAiHSk',
								VAPID_PRIVATE_KEY: 'zkg35ZUVRU523cAGitJVT-F1Nwcvo5WnkUcwbEdOg78'
							}
						}
					})
				],
				test: {
					name: 'integration',
					include: ['test/**/*.test.ts'],
					setupFiles: ['./test/apply-migrations.ts']
				}
			}
		]
	}
});
