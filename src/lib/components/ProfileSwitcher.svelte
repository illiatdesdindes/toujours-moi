<!-- The profile switcher (spec Q8): the header's dropdown on Accueil / Historique / Rapports, each option a link carrying `?profil=`. A native popover, so outside clicks and Échap close it. -->
<script lang="ts">
	import type { ProfileOption } from '#lib/domain.js';
	import type { ResolvedPathname } from '$app/types';
	import Icon from './Icon.svelte';
	import PersonColourDot from './PersonColourDot.svelte';

	let {
		profileOptions,
		selectedProfileParam,
		hrefFor
	}: {
		profileOptions: ProfileOption[];
		/** The option on screen (null = the viewer). */
		selectedProfileParam: string | null;
		/** This page with that `?profil=`. */
		hrefFor: (profileParam: string | null) => ResolvedPathname;
	} = $props();

	const popoverId = $props.id();
	let popover: HTMLUListElement;
	const selectedOption = $derived(
		profileOptions.find((option) => option.profileParam === selectedProfileParam) ??
			profileOptions[0]!
	);
</script>

{#snippet optionLabel(option: ProfileOption)}
	{#if option.colourKey}<PersonColourDot colourKey={option.colourKey} />{/if}
	<span class="truncate">{option.label}</span>
{/snippet}

<button
	type="button"
	class="btn max-w-48 bg-base-100 font-semibold text-base-content btn-sm"
	popovertarget={popoverId}
	style:anchor-name="--{popoverId}"
	aria-label="Profil affiché : {selectedOption.label}"
>
	{@render optionLabel(selectedOption)}<Icon glyph="chevron-down" class="size-4 shrink-0" />
</button>
<ul
	bind:this={popover}
	id={popoverId}
	popover
	class="menu dropdown dropdown-end z-40 mt-1 w-56 rounded-box bg-base-100 text-base-content pop-edge"
	style:position-anchor="--{popoverId}"
>
	{#each profileOptions as option (option.profileParam)}
		{@const isSelected = option === selectedOption}
		<li>
			<a
				href={hrefFor(option.profileParam)}
				class={{ 'menu-active': isSelected }}
				aria-current={isSelected ? 'page' : undefined}
				onclick={() => popover.hidePopover()}>{@render optionLabel(option)}</a
			>
		</li>
	{/each}
</ul>
