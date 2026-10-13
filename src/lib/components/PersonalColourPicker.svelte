<!-- The 8 personal colours (spec Q10, prototype 02) as a radio group posting `colourKey`: Mon profil, Enfants, Membres. -->
<script lang="ts">
	import { COLOUR_KEYS, PERSONAL_COLOURS, type ColourKey } from '#lib/domain.js';

	let {
		selectedColourKey,
		size = 'md'
	}: {
		selectedColourKey: ColourKey;
		/** `sm` for the rows of Enfants and Membres, as the prototype. */
		size?: 'sm' | 'md';
	} = $props();

	/** French names, for screen readers and `title`. */
	const COLOUR_LABELS: Record<ColourKey, string> = {
		tomato: 'Tomate',
		tangerine: 'Mandarine',
		mustard: 'Moutarde',
		sage: 'Sauge',
		turquoise: 'Turquoise',
		cornflower: 'Bleuet',
		lavender: 'Lavande',
		raspberry: 'Framboise'
	};
</script>

<fieldset class="flex flex-wrap gap-2">
	<legend class="sr-only">Couleur</legend>
	{#each COLOUR_KEYS as colourKey (colourKey)}
		<label class="cursor-pointer" title={COLOUR_LABELS[colourKey]}>
			<input
				type="radio"
				name="colourKey"
				value={colourKey}
				checked={colourKey === selectedColourKey}
				class="peer sr-only"
				aria-label={COLOUR_LABELS[colourKey]}
			/>
			<span
				class={[
					'block rounded-full border-2 border-base-content peer-checked:ring-2 peer-checked:ring-base-content peer-checked:ring-offset-2 peer-checked:ring-offset-base-100 peer-focus-visible:outline-2 peer-focus-visible:outline-offset-4',
					size === 'sm' ? 'size-6' : 'size-8'
				]}
				style:background={PERSONAL_COLOURS[colourKey].background}
			></span>
		</label>
	{/each}
</fieldset>
