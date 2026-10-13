<script lang="ts">
	import { page } from '$app/state';
	import { resolve } from '$app/paths';
</script>

<div class="py-10 text-center">
	<!-- An unmatched URL (no route id) gets SvelteKit's English "Not Found": swap in French copy. Every other error (hooks' 403/429, a profile's 403/404) shows its own message. -->
	<p class="mb-4 opacity-70">
		{page.status === 404 && page.route.id === null
			? "Cette page n'existe pas."
			: (page.error?.message ?? 'Erreur')}
	</p>
	<a href={resolve('/')} class="btn btn-primary">Retour à l'accueil</a>
</div>
