<script lang="ts">
	import './layout.css';
	import favicon from '#lib/assets/favicon.svg';
	import logo from '#lib/assets/logo.svg';
	import Icon, { type IconGlyph } from '#lib/components/Icon.svelte';
	import { resolve } from '$app/paths';
	import { page } from '$app/state';

	let { data, children } = $props();

	const tabs = (
		[
			{ label: 'Accueil', glyph: 'home', routeId: '/' },
			{ label: 'Historique', glyph: 'clock', routeId: '/historique' },
			{ label: 'Rapports', glyph: 'chart-bar', routeId: '/rapports' },
			{ label: 'Réglages', glyph: 'cog', routeId: '/reglages' }
		] as const satisfies { label: string; glyph: IconGlyph; routeId: string }[]
	).map((tab) => ({ ...tab, href: resolve(tab.routeId) }));
	// resolve() gives relative hrefs, so match on the route instead.
	const currentTab = $derived(tabs.find((tab) => tab.routeId === page.route.id));
	// Off-tab routes are only the error page for now.
	const pageTitle = $derived(
		currentTab?.label ?? (page.status === 404 ? 'Page introuvable' : 'Erreur')
	);
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
	<title>{pageTitle} · TJM</title>
</svelte:head>

<div class="flex min-h-dvh bg-base-100 text-base-content">
	<!-- Desktop: sidebar instead of the dock. -->
	<nav
		class="sticky top-0 hidden h-dvh w-56 shrink-0 flex-col gap-1 border-r-2 border-base-content bg-base-200 p-4 md:flex"
	>
		<a href={resolve('/')} class="mb-4 flex items-center gap-2 text-2xl font-black">
			<img src={logo} alt="" class="size-9" />TJM
		</a>
		{#each tabs as tab (tab.href)}
			<a
				href={tab.href}
				class={['btn justify-start', tab === currentTab ? 'btn-primary' : 'btn-ghost']}
				aria-current={tab === currentTab ? 'page' : undefined}
			>
				<Icon glyph={tab.glyph} />{tab.label}
			</a>
		{/each}
	</nav>

	<div class="flex min-w-0 flex-1 flex-col">
		<header
			class="flex items-center justify-between gap-2 border-b-2 border-base-content bg-primary px-4 py-3 text-primary-content"
		>
			<span class="flex items-center gap-2 text-lg font-black md:hidden">
				<img src={logo} alt="" class="size-7" />TJM
			</span>
			<h1 class="sr-only text-lg font-bold md:not-sr-only">{pageTitle}</h1>
			<!-- #6 puts the profile switcher here for parents and admin. -->
			<span class="font-semibold">{data.viewer.name}</span>
		</header>

		<!-- Room for the dock on mobile. -->
		<main class="flex-1 px-4 pt-4 pb-28 md:px-8 md:pb-8">
			<div class="mx-auto max-w-3xl">
				{@render children()}
			</div>
		</main>
	</div>

	<nav class="dock border-t-2 border-base-content bg-base-200 md:hidden">
		{#each tabs as tab (tab.href)}
			<a
				href={tab.href}
				class={{ 'dock-active text-primary': tab === currentTab }}
				aria-current={tab === currentTab ? 'page' : undefined}
			>
				<Icon glyph={tab.glyph} class="size-6" /><span class="dock-label">{tab.label}</span>
			</a>
		{/each}
	</nav>
</div>
