// See https://svelte.dev/docs/kit/types#app.d.ts
// for information about these interfaces
import type { Viewer } from '#lib/domain.js';

declare global {
	namespace App {
		// interface Error {}
		interface Locals {
			viewer: Viewer;
		}
		// interface PageData {}
		// interface PageState {}
	}
	namespace Cloudflare {
		interface Env {
			/** Local dev only (`.dev.vars`): the seeded user to act as, since there's no Access. */
			DEV_VIEWER_EMAIL?: string;
		}
	}
}

export {};
