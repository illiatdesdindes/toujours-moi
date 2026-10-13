<!-- The blocking install screen (spec Q12, prototype 02 "Mobile non installé"). Always in the page, shown by the `install-gate` variant (a phone tab that isn't installed): no escape hatch, desktop exempt. -->
<script lang="ts">
	import logo from '#lib/assets/logo.svg';
	import { listenForInstallPrompt, type InstallPromptOutcome } from '#lib/install-prompt.js';
	import { onMount } from 'svelte';

	let canPrompt = $state(false);
	let lastOutcome = $state<InstallPromptOutcome | null>(null);
	let promptInstall: () => Promise<InstallPromptOutcome> = async () => 'unavailable';

	onMount(() => {
		const installPrompt = listenForInstallPrompt(window, (prompt) => (canPrompt = prompt));
		promptInstall = installPrompt.promptInstall;
		return installPrompt.stopListening;
	});
</script>

<div
	class="hidden min-h-dvh flex-col items-center justify-center gap-5 bg-base-100 p-8 text-center text-base-content install-gate:flex"
>
	<img src={logo} alt="" class="size-24 rounded-3xl pop-edge" />
	<h1 class="text-2xl font-bold">Installe TJM</h1>
	<p>
		TJM s'utilise comme une application. Installe-la sur ton téléphone pour noter tes tâches en deux
		taps et recevoir les notifications.
	</p>
	{#if lastOutcome === 'accepted'}
		<p role="status" class="font-semibold">
			C'est installé ! Ouvre TJM depuis ton écran d'accueil.
		</p>
	{:else if canPrompt}
		<!-- h-auto: daisyUI's fixed btn height clips a wrapped label on a narrow phone. -->
		<button
			type="button"
			class="btn h-auto w-full py-3 btn-lg btn-primary"
			onclick={async () => (lastOutcome = await promptInstall())}
		>
			Installer TJM
		</button>
	{/if}
	<p class="text-sm opacity-70">
		Pas de bouton ? Menu <b>⋮</b> du navigateur → <b>Installer l'application</b>.
	</p>
</div>
