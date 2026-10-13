<!-- A person's prénom field (spec Q10), posting `name`: Mon profil, Enfants, Membres and Ajouter un membre. Other input attributes pass through; `value` is the default too, so a refused edit's form reset comes back to the saved prénom. -->
<script lang="ts">
	import { MAX_PERSON_NAME_LENGTH } from '#lib/domain.js';
	import type { HTMLInputAttributes } from 'svelte/elements';

	let { value, ...inputAttributes }: HTMLInputAttributes = $props();
</script>

<input
	name="name"
	required
	maxlength={MAX_PERSON_NAME_LENGTH}
	{value}
	defaultValue={value}
	{...inputAttributes}
/>
