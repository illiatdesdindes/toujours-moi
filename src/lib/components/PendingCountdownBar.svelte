<!-- The pending chore's 5 s countdown (spec Q4): a bar filling to full width, on the pending card and on its tile. The caller places and colours it, and remounts it to restart it. -->
<script lang="ts">
	import { PENDING_DELAY_MS } from '#lib/pending-chore.js';
	import type { ClassValue } from 'svelte/elements';

	let { class: placementClass }: { class?: ClassValue | undefined } = $props();
</script>

<span
	class={['pending-countdown-bar block', placementClass]}
	style:animation-duration="{PENDING_DELAY_MS}ms"
	aria-hidden="true"
></span>

<style>
	.pending-countdown-bar {
		animation: pending-countdown-fill linear forwards;
	}
	@keyframes pending-countdown-fill {
		from {
			width: 0;
		}
		to {
			width: 100%;
		}
	}
</style>
