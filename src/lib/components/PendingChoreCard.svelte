<!-- The pending chore, variant A (spec Q4): a bottom card with a 5 s bar, Modifier and Annuler. It slides up from below the screen when a chore is pending and back down once it's gone; each chore a tap on another type swaps in replays that slide, with its bar restarted. -->
<script lang="ts">
	import { PENDING_DELAY_MS } from '#lib/pending-chore.js';
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
		/** Keys the content: each new pending chore slides in and restarts the bar. */
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
	// Freed as soon as the card starts sliding away, so the toasts settle in its place in one move
	// instead of rising above a card that's already leaving, then dropping.
	const freeTheToastsPlace = () =>
		document.documentElement.style.removeProperty('--pending-chore-card-offset');
	$effect(() => {
		document.documentElement.style.setProperty(
			'--pending-chore-card-offset',
			`${cardHeight + 8}px`
		);
		return freeTheToastsPlace;
	});

	// A keyboard pick moves focus to Modifier, or Tab couldn't reach the card within 5 s (WCAG 2.2.1).
	// A touch or mouse pick leaves focus alone; the tile is refocused once the card is gone.
	let cardElement: HTMLDivElement;
	let editButton = $state<HTMLButtonElement>();
	const slideDurationMs = $derived(prefersReducedMotion.current ? 0 : 250);
	const distanceBelowTheScreen = (card: HTMLElement) =>
		innerHeight - card.getBoundingClientRect().top;
	/** In and out: the card starts (or ends) just out of sight, below the screen. */
	const slideUpFromBelowTheScreen = (card: HTMLElement) => {
		const distance = distanceBelowTheScreen(card);
		return {
			duration: slideDurationMs,
			easing: cubicOut,
			css: (_: number, remaining: number) => `transform: translateY(${remaining * distance}px)`
		};
	};
	// A swapped-in chore is a new card: the same slide up, replayed on the mounted card (a second card
	// would overlap this one while it slid away). The first chore's slide is the transition's.
	// svelte-ignore state_referenced_locally
	let slidInPendingChoreId = pendingChoreId;
	$effect(() => {
		if (pendingChoreId === slidInPendingChoreId) return;
		slidInPendingChoreId = pendingChoreId;
		cardElement.animate(
			[
				{ transform: `translateY(${distanceBelowTheScreen(cardElement)}px)` },
				{ transform: 'none' }
			],
			{ duration: slideDurationMs, easing: 'cubic-bezier(0.33, 1, 0.68, 1)' } // cubicOut
		);
	});
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
	transition:slideUpFromBelowTheScreen
	onoutrostart={freeTheToastsPlace}
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
			<div
				class="pending-bar h-full bg-primary-content"
				style:animation-duration="{PENDING_DELAY_MS}ms"
			></div>
		</div>
	{/key}
</div>

<style>
	.pending-bar {
		animation: pending-fill linear forwards;
	}
	@keyframes pending-fill {
		from {
			width: 0;
		}
		to {
			width: 100%;
		}
	}
</style>
