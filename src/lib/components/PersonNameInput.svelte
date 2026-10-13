<!-- A person's prénom field (spec Q10), posting `name`: Mon profil, Enfants, Membres and Ajouter un membre. Other input attributes pass through. -->
<script lang="ts">
	import { MAX_PERSON_NAME_LENGTH } from '#lib/domain.js';
	import type { HTMLInputAttributes } from 'svelte/elements';

	let { ...inputAttributes }: HTMLInputAttributes = $props();
</script>

<input name="name" required maxlength={MAX_PERSON_NAME_LENGTH} {...inputAttributes} />
