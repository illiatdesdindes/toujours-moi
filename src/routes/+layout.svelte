<script lang="ts">
	import './layout.css';
	import favicon from '#lib/assets/favicon.svg';
	import logo from '#lib/assets/logo.svg';
	import Icon, { type IconGlyph } from '#lib/components/Icon.svelte';
	import ProfileSwitcher from '#lib/components/ProfileSwitcher.svelte';
	import { PERSONAL_COLOURS } from '#lib/domain.js';
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import { setChoreOutbox, setShowToast } from '#lib/app-context.js';
	import { createChoreOutbox, localStorageOrMemory, sendChoreToServer } from '#lib/chore-outbox.js';
	import { formatDuration } from '#lib/chore-timing.js';
	import { formatParisDayAndTime } from '#lib/paris-time.js';
	import { onMount } from 'svelte';

	let { data, children } = $props();

	let toastMessage = $state<string | null>(null);
	let toastTimer: ReturnType<typeof setTimeout> | undefined;
	const showToast = (message: string) => {
		clearTimeout(toastTimer);
		toastMessage = message;
		toastTimer = setTimeout(() => (toastMessage = null), 2500);
	};
	setShowToast(showToast);

	// The viewer can't change without a reload (Access session), so one outbox for the app's life.
	// svelte-ignore state_referenced_locally
	const choreOutbox = setChoreOutbox(
		createChoreOutbox({
			storage: localStorageOrMemory(),
			viewerId: data.viewer.id,
			send: (chore) => sendChoreToServer(chore),
			// Often on a later visit, so it names the chore to log again.
			onRejected: (chore, message, choreLabel) =>
				showToast(
					`${choreLabel ?? `Tâche de ${formatDuration(chore.durationMinutes)}`} (${formatParisDayAndTime(new Date(chore.startedAt), new Date())}) non enregistrée : ${message}`
				)
		})
	);
	// Spec Q20 point 1: retried on `online` and on the app reopening (a reload, or back from the background).
	onMount(() => {
		void choreOutbox.retry();
		const retryWhenVisible = () => document.visibilityState === 'visible' && choreOutbox.retry();
		const retry = () => void choreOutbox.retry();
		addEventListener('online', retry);
		document.addEventListener('visibilitychange', retryWhenVisible);
		return () => {
			removeEventListener('online', retry);
			document.removeEventListener('visibilitychange', retryWhenVisible);
		};
	});

	const tabs = (
		[
			{ label: 'Accueil', glyph: 'home', routeId: '/', showsProfile: true },
			{ label: 'Historique', glyph: 'clock', routeId: '/historique', showsProfile: true },
			{ label: 'Rapports', glyph: 'chart-bar', routeId: '/rapports', showsProfile: true },
			{ label: 'Réglages', glyph: 'cog', routeId: '/reglages', showsProfile: false }
		] as const satisfies {
			label: string;
			glyph: IconGlyph;
			routeId: string;
			showsProfile: boolean;
		}[]
	).map((tab) => ({ ...tab, href: resolve(tab.routeId) }));
	type Tab = (typeof tabs)[number];
	// resolve() gives relative hrefs, so match on the route instead. An error page (a profile 403/404 keeps its route id) is no tab.
	const currentTab = $derived(
		page.error ? undefined : tabs.find((tab) => tab.routeId === page.route.id)
	);

	// Spec Q8: `?profil=` is kept across Accueil / Historique / Rapports; leaving it out means yourself.
	// Taken from the load, not the URL: a 403/404 page has none, so its tabs lead back out.
	const selectedProfileParam = $derived(page.data.selectedProfileParam ?? null);
	const tabHref = (tab: Tab, tabProfileParam: string | null) =>
		tab.showsProfile && tabProfileParam
			? resolve(`${tab.routeId}?profil=${encodeURIComponent(tabProfileParam)}`)
			: tab.href;
	// Only set on the profile pages, by their loads; null on the rest (Réglages, errors).
	const selectedProfile = $derived(page.data.selectedProfile);
	// The page wears the selected person's colour (spec Q8, Q10), the viewer's off the profile pages; Famille stays neutral.
	const primaryColour = $derived(
		selectedProfile?.kind === 'family'
			? null
			: PERSONAL_COLOURS[selectedProfile?.person.colourKey ?? data.viewer.colourKey]
	);
	// Off-tab routes are only the error page for now.
	const pageTitle = $derived(
		currentTab?.label ??
			(page.status === 404 && page.route.id === null ? 'Page introuvable' : 'Erreur')
	);
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
	<title>{pageTitle} · TJM</title>
</svelte:head>

<div
	class="flex min-h-dvh bg-base-100 text-base-content"
	style:--color-primary={primaryColour?.background}
	style:--color-primary-content={primaryColour?.content}
>
	<!-- Desktop: sidebar instead of the dock. -->
	<nav
		class="sticky top-0 hidden h-dvh w-56 shrink-0 flex-col gap-1 border-r-2 border-base-content bg-base-200 p-4 md:flex"
	>
		<a href={resolve('/')} class="mb-4 flex items-center gap-2 text-2xl font-black">
			<img src={logo} alt="" class="size-9" />TJM
		</a>
		{#each tabs as tab (tab.href)}
			<a
				href={tabHref(tab, selectedProfileParam)}
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
			{#if currentTab && page.data.profileOptions && page.data.profileOptions.length > 1}
				<ProfileSwitcher
					profileOptions={page.data.profileOptions}
					{selectedProfileParam}
					hrefFor={(optionProfileParam) => tabHref(currentTab, optionProfileParam)}
				/>
			{:else}
				<span class="font-semibold">{data.viewer.name}</span>
			{/if}
		</header>

		<!-- Room for the dock on mobile. -->
		<main class="flex-1 px-4 pt-4 pb-28 md:px-8 md:pb-8">
			<div class="mx-auto max-w-3xl">
				{@render children()}
			</div>
		</main>
	</div>

	<!-- Always in the page, so screen readers hear each new message. Sits above the pending card when one shows (it sets the offset), never over its buttons. -->
	<div role="status">
		{#if toastMessage}
			<p
				class="fixed inset-x-3 bottom-[calc(5rem+var(--pending-chore-card-offset,0px))] z-30 rounded-box bg-neutral p-3 text-sm text-neutral-content pop-edge md:right-6 md:bottom-[calc(1.5rem+var(--pending-chore-card-offset,0px))] md:left-auto md:w-96"
			>
				{toastMessage}
			</p>
		{/if}
	</div>

	<!-- The active tab is a primary pill like the sidebar's: text-primary on base-200 fails contrast for most personal colours. -->
	<nav class="dock border-t-2 border-base-content bg-base-200 md:hidden">
		{#each tabs as tab (tab.href)}
			<a
				href={tabHref(tab, selectedProfileParam)}
				class={{ 'dock-active bg-primary text-primary-content': tab === currentTab }}
				aria-current={tab === currentTab ? 'page' : undefined}
			>
				<Icon glyph={tab.glyph} class="size-6" /><span class="dock-label">{tab.label}</span>
			</a>
		{/each}
	</nav>
</div>
