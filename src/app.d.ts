// See https://svelte.dev/docs/kit/types#app.d.ts
// for information about these interfaces
import type { ProfileOption, SelectedProfile, Viewer } from '#lib/domain.js';

declare global {
	namespace App {
		// interface Error {}
		interface Locals {
			viewer: Viewer;
		}
		interface PageData {
			/** Set by the profile pages (Accueil, Historique, Rapports; spec Q8) for the header. */
			selectedProfile?: SelectedProfile;
			/** Its `?profil=` value (null = the viewer), what the tab links carry. */
			selectedProfileParam?: string | null;
			profileOptions?: ProfileOption[];
		}
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
