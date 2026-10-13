<!-- The pending chore, variant A (spec Q4): a bottom card with a 5 s bar, Modifier and Annuler. Keyed on the chore by its caller, so the bar restarts for each one. -->
<script lang="ts">
	import { PENDING_DELAY_MS } from '#lib/pending-chore.js';

	let {
		icon,
		summary,
		dayAndTime,
		onEdit,
		onCancel
	}: {
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
	$effect(() => {
		const root = document.documentElement.style;
		root.setProperty('--pending-chore-card-offset', `${cardHeight + 8}px`);
		return () => root.removeProperty('--pending-chore-card-offset');
	});

	// A keyboard pick moves focus to Modifier, or Tab couldn't reach the card within 5 s (WCAG 2.2.1).
	// A touch or mouse pick leaves focus alone; the tile is refocused once the card is gone.
	let cardElement: HTMLDivElement;
	let editButton: HTMLButtonElement;
	$effect(() => {
		const pickedTile = document.activeElement;
		if (!(pickedTile instanceof HTMLElement && pickedTile.matches(':focus-visible'))) return;
		editButton.focus();
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
>
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
