<!-- The blocking install screen (spec Q12, prototype 02 "Mobile non installé"). Always in the page, shown by the `install-gate` variant (a phone tab that isn't installed): no escape hatch, desktop exempt. -->
<script lang="ts">
	import logo from '#lib/assets/logo.svg';
	import { listenForInstallPrompt, type InstallPromptOutcome } from '#lib/install-prompt.js';
	import { onMount } from 'svelte';

	let canPrompt = $state(false);
	let promptInstall: () => Promise<InstallPromptOutcome> = async () => 'unavailable';

	onMount(() => {
		const installPrompt = listenForInstallPrompt(
			window,
			(canPromptNow) => (canPrompt = canPromptNow)
		);
		promptInstall = installPrompt.promptInstall;
		return installPrompt.stopListening;
	});
</script>

<div
	class="hidden min-h-dvh flex-col items-center justify-center gap-5 bg-base-100 p-8 text-center text-base-content install-gate:flex"
>
	<img src={logo} alt="" class="size-24 rounded-3xl pop-edge" />
	<h1 class="text-2xl font-bold">Installe <b>Toujours Moi!</b></h1>
	<p>
		Vaisselle, lessive, poubelles… <b class="whitespace-nowrap">Toujours Moi!</b> compte qui s'en occupe
		à la maison. Installe-la sur ton téléphone pour noter tes tâches ménagères en deux clics, et recevoir
		une notification quand quelqu'un en note une.
	</p>
	{#if canPrompt}
		<!-- h-auto: daisyUI's fixed btn height clips a wrapped label on a narrow phone. -->
		<button
			type="button"
			class="btn h-auto w-full py-3 btn-lg btn-primary"
			onclick={() => promptInstall()}
		>
			Installer <b>Toujours Moi!</b>
		</button>
	{/if}
	<p class="text-sm opacity-70">
		Pas de bouton ? Menu <b>⋮</b> du navigateur → <b>Installer l'application</b>.
	</p>
</div>
