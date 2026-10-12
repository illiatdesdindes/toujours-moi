<script lang="ts">
	import { page } from '$app/state';
	import { resolve } from '$app/paths';
</script>

<div class="py-10 text-center">
	<!-- A 403/429 from hooks.server.ts lands here on client-side navigation: show its own message. -->
	<p class="mb-4 opacity-70">
		{page.status === 404 ? "Cette page n'existe pas." : (page.error?.message ?? 'Erreur')}
	</p>
	<a href={resolve('/')} class="btn btn-primary">Retour à l'accueil</a>
</div>
