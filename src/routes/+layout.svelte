<script lang="ts">
	import './layout.css';
	import favicon from '#lib/assets/favicon.svg';
	import logo from '#lib/assets/logo.svg';
	import Icon, { type IconGlyph } from '#lib/components/Icon.svelte';
	import InstallScreen from '#lib/components/InstallScreen.svelte';
	import ProfileSwitcher from '#lib/components/ProfileSwitcher.svelte';
	import { PERSONAL_COLOURS } from '#lib/domain.js';
	import { profilePageHref } from '#lib/profile-page-href.js';
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import { setChoreOutbox, setShowToast } from '#lib/app-context.js';
	import { createChoreOutbox, localStorageOrMemory, sendChoreToServer } from '#lib/chore-outbox.js';
	import { formatDuration } from '#lib/chore-timing.js';
	import { formatParisDayAndTime } from '#lib/paris-time.js';
	import { onMount } from 'svelte';
	import { prefersReducedMotion } from 'svelte/motion';
	import { fade, fly } from 'svelte/transition';

	let { data, children } = $props();

	// A stack in depth: each new toast pushes the older ones back (smaller, dimmer, peeking out above),
	// so a run of quick logs reads as a pile of confirmations. Each lasts its own 2.5 s.
	const TOAST_DURATION_MS = 2500;
	const MAX_STACKED_TOASTS = 3;
	/** `toastNumber` keys each toast, so the same message twice in a row is two toasts. */
	let toasts = $state<{ message: string; toastNumber: number }[]>([]);
	let lastToastNumber = 0;
	/** Measured per toast: the ones behind take the front one's height, so their top edges peek out. */
	let toastHeights = $state<Record<number, number>>({});
	const frontToastHeight = $derived(toastHeights[toasts.at(-1)?.toastNumber ?? -1]);
	const showToast = (message: string) => {
		const toastNumber = ++lastToastNumber;
		toasts = [...toasts, { message, toastNumber }].slice(-MAX_STACKED_TOASTS);
		setTimeout(() => {
			toasts = toasts.filter((toast) => toast.toastNumber !== toastNumber);
			delete toastHeights[toastNumber];
		}, TOAST_DURATION_MS);
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
		tab.showsProfile ? profilePageHref(tab.routeId, tabProfileParam) : tab.href;
	// Only set on the profile pages, by their loads; null on the rest (Réglages, errors).
	const selectedProfile = $derived(page.data.selectedProfile);
	// The page wears the selected person's colour (spec Q8, Q10), the viewer's off the profile pages; Famille stays neutral.
	const primaryColour = $derived(
		selectedProfile?.kind === 'family'
			? null
			: PERSONAL_COLOURS[selectedProfile?.person.colourKey ?? data.viewer.colourKey]
	);
	const viewerColour = $derived(PERSONAL_COLOURS[data.viewer.colourKey]);
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

<!-- The install screen wears the viewer's colour, as in prototype 02 (its Pop button needs a fill other than the navy edge). -->
<div
	class="contents"
	style:--color-primary={viewerColour.background}
	style:--color-primary-content={viewerColour.content}
>
	<InstallScreen />
</div>

<!-- Hidden behind the install screen on a phone tab that isn't installed (spec Q12). -->
<div
	class="flex min-h-dvh bg-base-100 text-base-content install-gate:hidden"
	style:--color-primary={primaryColour?.background}
	style:--color-primary-content={primaryColour?.content}
>
	<!-- Desktop: sidebar instead of the dock. -->
	<nav
		class="sticky top-0 hidden h-dvh w-56 shrink-0 flex-col gap-1 border-r-2 border-base-content bg-base-200 p-4 md:flex"
	>
		<a href={resolve('/')} class="mb-4 flex items-center gap-2 text-xl font-black">
			<img src={logo} alt="" class="size-9" />Toujours Moi!
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
			{#if currentTab?.showsProfile && page.data.profileOptions && page.data.profileOptions.length > 1}
				{@const profilePageRouteId = currentTab.routeId}
				<!-- The page on screen with another profile, keeping its other params (Rapports' period). -->
				<ProfileSwitcher
					profileOptions={page.data.profileOptions}
					{selectedProfileParam}
					hrefFor={(optionProfileParam) =>
						profilePageHref(profilePageRouteId, optionProfileParam, page.url.searchParams)}
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

	<!-- Always in the page, so screen readers hear each new message. Sits above the pending card when one shows (it sets the offset), never over its buttons, and glides down into the card's place when it goes. -->
	<div role="status">
		{#each toasts as toast, index (toast.toastNumber)}
			{@const depth = toasts.length - 1 - index}
			<p
				class="fixed inset-x-3 bottom-[calc(5rem+var(--pending-chore-card-offset,0px))] z-30 origin-top overflow-hidden rounded-box bg-neutral p-3 text-sm text-neutral-content pop-edge motion-safe:transition-[bottom,transform,opacity] motion-safe:duration-200 md:right-6 md:bottom-[calc(1.5rem+var(--pending-chore-card-offset,0px))] md:left-auto md:w-96"
				style:transform={depth
					? `translateY(${-10 * depth}px) scale(${1 - 0.06 * depth})`
					: undefined}
				style:opacity={depth ? 1 - 0.3 * depth : undefined}
				style:height={depth && frontToastHeight ? `${frontToastHeight}px` : undefined}
				bind:clientHeight={toastHeights[toast.toastNumber]}
				aria-hidden={depth ? true : undefined}
				in:fly={{ y: 12, duration: prefersReducedMotion.current ? 0 : 200 }}
				out:fade={{ duration: prefersReducedMotion.current ? 0 : 150 }}
			>
				{toast.message}
			</p>
		{/each}
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
