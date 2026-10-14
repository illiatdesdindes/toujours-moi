<!-- The pending chore, variant A (spec Q4): a bottom card with a 5 s bar, Modifier and Annuler. Each pending chore slides it up from below the screen (the first one, and each one a tap on another type swaps in), with its bar restarted; it slides back down once it's gone. -->
<script lang="ts">
	import PendingCountdownBar from './PendingCountdownBar.svelte';
	import { prefersReducedMotion } from 'svelte/motion';
	import { cubicOut } from 'svelte/easing';

	let {
		pendingChoreId,
		icon,
		summary,
		dayAndTime,
		onEdit,
		onCancel
	}: {
		/** Each new pending chore slides the card in again and restarts the bar. */
		pendingChoreId: string;
		icon: string;
		/** `Vaisselle · 45 min` */
		summary: string;
		/** `aujourd'hui, 14:15` */
		dayAndTime: string;
		onEdit: () => void;
		onCancel: () => void;
	} = $props();

	let cardHeight = $state(0);
	// The toast stacks above the card instead of covering Modifier / Annuler (layout's toast reads it).
	// Cleared as soon as the card starts sliding away, so the toasts settle in its place in one move
	// instead of rising above a card that's already leaving, then dropping. Set again for each chore:
	// a chore that arrives during that slide resumes this same card rather than mounting a new one.
	const clearToastOffsetForPendingCard = () =>
		document.documentElement.style.removeProperty('--pending-chore-card-offset');
	$effect(() => {
		void pendingChoreId;
		document.documentElement.style.setProperty(
			'--pending-chore-card-offset',
			`${cardHeight + 8}px`
		);
		return clearToastOffsetForPendingCard;
	});

	// A keyboard pick moves focus to Modifier, or Tab couldn't reach the card within 5 s (WCAG 2.2.1).
	// A touch or mouse pick leaves focus alone; the tile is refocused once the card is gone.
	let cardElement: HTMLDivElement;
	let editButton = $state<HTMLButtonElement>();
	const slideDurationMs = $derived(prefersReducedMotion.current ? 0 : 250);
	/** From its resting place to just out of sight, whatever transform is playing. */
	const distanceBelowTheScreen = (card: HTMLElement) =>
		card.offsetHeight + parseFloat(getComputedStyle(card).bottom);
	// One slide up for every pending chore, the first included: a swapped-in chore is a new card,
	// replayed on the mounted one (a second card would overlap this one while it slid away).
	$effect(() => {
		void pendingChoreId;
		cardElement.animate(
			[
				{ transform: `translateY(${distanceBelowTheScreen(cardElement)}px)` },
				{ transform: 'none' }
			],
			{ duration: slideDurationMs, easing: 'cubic-bezier(0.33, 1, 0.68, 1)' } // svelte's cubicOut
		);
	});
	/** The way out, a Svelte transition so the card stays in the page while it slides. */
	const slideDownBelowTheScreen = (card: HTMLElement) => {
		const distance = distanceBelowTheScreen(card);
		return {
			duration: slideDurationMs,
			easing: cubicOut,
			css: (shownFraction: number) => `transform: translateY(${(1 - shownFraction) * distance}px)`
		};
	};
	$effect(() => {
		void pendingChoreId; // each pick, not only the card's first
		const pickedTile = document.activeElement;
		if (!(pickedTile instanceof HTMLElement && pickedTile.matches(':focus-visible'))) return;
		editButton?.focus();
		return () => {
			const focusIsLost =
				document.activeElement === document.body || cardElement.contains(document.activeElement);
			if (focusIsLost && pickedTile.isConnected) pickedTile.focus();
		};
	});
</script>

<div
	bind:this={cardElement}
	bind:clientHeight={cardHeight}
	class="fixed inset-x-3 bottom-20 z-20 overflow-hidden rounded-box bg-primary text-primary-content pop-edge md:right-6 md:bottom-6 md:left-auto md:w-96"
	role="region"
	aria-label="Tâche en attente"
	out:slideDownBelowTheScreen
	onoutrostart={clearToastOffsetForPendingCard}
>
	{#key pendingChoreId}
		<div class="flex items-center gap-3 p-3">
			<span class="text-2xl" aria-hidden="true">{icon}</span>
			<div class="min-w-0 flex-1 text-sm leading-tight">
				<p class="font-bold">{summary}</p>
				<p class="opacity-80">{dayAndTime}</p>
			</div>
			<!-- The global focus ring is navy; the card wears the profile's colour, which may be navy too (Famille). -->
			<button
				bind:this={editButton}
				type="button"
				class="btn btn-sm focus-visible:outline-primary-content"
				onclick={onEdit}>Modifier</button
			>
			<button
				type="button"
				class="btn btn-sm focus-visible:outline-primary-content"
				onclick={onCancel}>Annuler</button
			>
		</div>
		<div class="h-1.5 bg-primary-content/30">
			<PendingCountdownBar class="h-full bg-primary-content" />
		</div>
	{/key}
</div>
